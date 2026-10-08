import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getQuestion } from "@/lib/quiz.functions";

export type Room = {
  id: string;
  code: string;
  status: string;
  current_index: number;
  total_questions: number;
  question_seconds: number;
  royale: boolean;
  category: string;
};
export type Player = { id: string; name: string; score: number; correct_count: number; streak: number; created_at: string; eliminated_at: number | null };
export type Question = NonNullable<Awaited<ReturnType<typeof getQuestion>>>;

/** Live room + leaderboard via realtime; question payload fetched from the server referee. */
export function useRoom(code: string, playerId?: string, pollAnswers = false, token?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fetchQ = useServerFn(getQuestion);
  const roomRef = useRef<Room | null>(null);

  const loadPlayers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("players")
      .select("id, name, score, correct_count, streak, created_at, eliminated_at")
      .eq("room_id", roomId)
      .order("score", { ascending: false })
      .order("created_at");
    setPlayers(data ?? []);
  }, []);

  const loadQuestion = useCallback(async () => {
    try {
      const q = await fetchQ({ data: { code, playerId, token } });
      setQuestion(q);
      if (q) setClockOffset(new Date(q.serverNow).getTime() - Date.now());
    } catch {
      /* transient */
    }
  }, [code, playerId, token, fetchQ]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
      if (cancelled) return;
      if (!data) return setError("Room not found. Check the code.");
      setRoom(data);
      roomRef.current = data;
      loadPlayers(data.id);
      loadQuestion();
      channel = supabase
        .channel(`room-${data.id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${data.id}` }, (p) => {
          const r = p.new as Room;
          setRoom(r);
          roomRef.current = r;
          loadQuestion();
          loadPlayers(r.id);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${data.id}` }, () =>
          loadPlayers(data.id)
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [code, loadPlayers, loadQuestion]);

  // Host polls the answered count while a question is live.
  useEffect(() => {
    if (!pollAnswers || room?.status !== "question") return;
    const t = setInterval(loadQuestion, 1500);
    return () => clearInterval(t);
  }, [pollAnswers, room?.status, loadQuestion]);

  return { room, players, question, clockOffset, error, reloadQuestion: loadQuestion };
}

export function useCountdown(q: Question | null, clockOffset: number, extra = 0) {
  const key = q?.startedAt ?? null;
  const [state, setState] = useState<{ key: string | null; left: number }>({ key: null, left: 0 });
  useEffect(() => {
    if (!q?.startedAt) return;
    const end = new Date(q.startedAt).getTime() + (q.seconds + extra) * 1000;
    const tick = () => setState({ key: q.startedAt, left: Math.max(0, (end - (Date.now() + clockOffset)) / 1000) });
    tick();
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  }, [q?.startedAt, q?.seconds, clockOffset, extra]);
  // Until the first tick for this question, report the full duration (never a stale 0).
  if (!q) return 0;
  return state.key === key ? state.left : q.seconds + extra;
}
