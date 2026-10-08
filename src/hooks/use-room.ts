import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getQuestion, tickGame } from "@/lib/quiz.functions";
import { canTickGame, REVIEW_SECONDS } from "@/lib/auto-control";

export type Room = {
  id: string;
  code: string;
  status: string;
  current_index: number;
  total_questions: number;
  question_seconds: number;
  royale: boolean;
  category: string;
  difficulty: string;
  team_size: number;
  auto_control: boolean;
  phase_started_at: string | null;
  ai_error: string | null;
};
export type Player = { id: string; name: string; score: number; correct_count: number; streak: number; created_at: string; eliminated_at: number | null; team: string | null };
export type Question = NonNullable<Awaited<ReturnType<typeof getQuestion>>>;

/** Live room + leaderboard via realtime; question payload fetched from the server referee. */
export function useRoom(code: string, playerId?: string, pollAnswers = false, token?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fetchQ = useServerFn(getQuestion);
  const tickGameFn = useServerFn(tickGame);
  const roomRef = useRef<Room | null>(null);
  const questionRequest = useRef(0);

  const loadPlayers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("players")
      .select("id, name, score, correct_count, streak, created_at, eliminated_at, team")
      .eq("room_id", roomId)
      .order("score", { ascending: false })
      .order("created_at");
    setPlayers(data ?? []);
  }, []);

  const loadQuestion = useCallback(async () => {
    const request = ++questionRequest.current;
    try {
      const q = await fetchQ({ data: { code, playerId, token } });
      if (request !== questionRequest.current) return;
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

  useEffect(() => {
    if (!room || !token || !canTickGame(room.auto_control, room.status)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      try {
        await tickGameFn({ data: { code, playerId, token } });
        const { data } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
        const prev = roomRef.current;
        // Only re-render and refetch when the phase actually changed — avoids stutter every poll.
        if (!cancelled && data && (!prev || prev.status !== data.status || prev.current_index !== data.current_index || prev.phase_started_at !== data.phase_started_at || prev.ai_error !== data.ai_error)) {
          setError(null); setRoom(data); roomRef.current = data;
          loadQuestion(); loadPlayers(data.id);
        } else if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Connection interrupted.");
      }
      if (!cancelled) timer = setTimeout(run, 900);
    };
    run();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [room?.auto_control, room?.status, code, playerId, token, tickGameFn, loadQuestion, loadPlayers]);

  /** Ask the referee to advance right away (e.g. everyone has answered) instead of waiting for the next poll. */
  const tickNow = useCallback(async () => {
    const r = roomRef.current;
    if (!r || !token || !canTickGame(r.auto_control, r.status)) return;
    try {
      await tickGameFn({ data: { code, playerId, token } });
      const { data } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
      if (data && (data.status !== r.status || data.current_index !== r.current_index)) {
        setRoom(data); roomRef.current = data; loadQuestion(); loadPlayers(data.id);
      }
    } catch { /* poll will retry */ }
  }, [code, playerId, token, tickGameFn, loadQuestion, loadPlayers]);

  return { room, players, question, clockOffset, error, reloadQuestion: loadQuestion, tickNow };
}

export function usePhaseCountdown(room: Room | null, clockOffset: number) {
  const [left, setLeft] = useState(REVIEW_SECONDS);
  useEffect(() => {
    if (!room?.phase_started_at) return;
    const end = new Date(room.phase_started_at).getTime() + REVIEW_SECONDS * 1000;
    const update = () => setLeft(Math.max(0, Math.ceil((end - Date.now() - clockOffset) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [room?.phase_started_at, clockOffset]);
  return left;
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
  return state.key === key ? Math.min(state.left, q.seconds + extra) : q.seconds + extra;
}

/** Seconds until the server-scheduled start (synced "Get ready" on every screen). */
export function useLeadIn(q: Question | null, clockOffset: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!q?.startedAt) return setLeft(0);
    const start = new Date(q.startedAt).getTime();
    const tick = () => setLeft(Math.max(0, (start - (Date.now() + clockOffset)) / 1000));
    tick();
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  }, [q?.startedAt, clockOffset]);
  return left;
}
