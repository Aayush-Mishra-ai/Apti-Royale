import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_PLAYERS = 50;
const GRACE_MS = 1500; // network slack after the timer ends
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5}$/);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  for (const b of bytes) s += chars[b % chars.length];
  return s;
}

async function getRoomByCode(code: string) {
  const db = await admin();
  const { data, error } = await db.from("rooms").select("*").eq("code", code).maybeSingle();
  if (error) throw new Error("Could not load room");
  if (!data) throw new Error("Room not found. Check the code.");
  return data;
}

async function assertHost(roomId: string, hostToken: string) {
  const db = await admin();
  const { data } = await db.from("room_secrets").select("host_token").eq("room_id", roomId).maybeSingle();
  if (!data || data.host_token !== hostToken) throw new Error("Only the host can do that.");
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        seconds: z.number().int().min(10).max(60).default(20),
        count: z.number().int().min(5).max(20).default(10),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: qs } = await db.from("questions").select("id");
    const ids = (qs ?? []).map((q) => q.id).sort(() => Math.random() - 0.5).slice(0, data.count);
    if (ids.length === 0) throw new Error("No questions available");

    let room: { id: string; code: string } | null = null;
    for (let i = 0; i < 5 && !room; i++) {
      const { data: r } = await db
        .from("rooms")
        .insert({ code: makeCode(), question_seconds: data.seconds, total_questions: ids.length })
        .select("id, code")
        .maybeSingle();
      room = r;
    }
    if (!room) throw new Error("Could not create room, try again.");

    const hostToken = crypto.randomUUID();
    await db.from("room_secrets").insert({ room_id: room.id, host_token: hostToken });
    await db.from("room_questions").insert(ids.map((qid, idx) => ({ room_id: room!.id, idx, question_id: qid })));
    return { code: room.code, hostToken };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: codeSchema, name: z.string().trim().min(1).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const room = await getRoomByCode(data.code);
    if (room.status !== "lobby") throw new Error("This game has already started.");
    const { count } = await db.from("players").select("id", { count: "exact", head: true }).eq("room_id", room.id);
    if ((count ?? 0) >= MAX_PLAYERS) throw new Error("Room is full (50 players).");

    const { data: player, error } = await db
      .from("players")
      .insert({ room_id: room.id, name: data.name })
      .select("id")
      .maybeSingle();
    if (error || !player) throw new Error(error?.code === "23505" ? "That name is taken in this room." : "Could not join.");
    const token = crypto.randomUUID();
    await db.from("player_secrets").insert({ player_id: player.id, token });
    return { playerId: player.id, token };
  });

/** Host advances: lobby/reveal -> next question, or finishes the game. */
export const nextQuestion = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: codeSchema, hostToken: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const room = await getRoomByCode(data.code);
    await assertHost(room.id, data.hostToken);
    if (room.status === "question" || room.status === "finished") return { ok: true };
    const next = room.current_index + 1;
    if (next >= room.total_questions) {
      await db.from("rooms").update({ status: "finished" }).eq("id", room.id);
    } else {
      await db
        .from("rooms")
        .update({ status: "question", current_index: next, question_started_at: new Date().toISOString() })
        .eq("id", room.id)
        .eq("current_index", room.current_index);
    }
    return { ok: true };
  });

export const revealAnswer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: codeSchema, hostToken: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const room = await getRoomByCode(data.code);
    await assertHost(room.id, data.hostToken);
    if (room.status === "question") await db.from("rooms").update({ status: "reveal" }).eq("id", room.id);
    return { ok: true };
  });

export const getQuestion = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ code: codeSchema, playerId: z.string().uuid().optional() }).parse(d)
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const room = await getRoomByCode(data.code);
    if (room.status !== "question" && room.status !== "reveal") return null;

    const { data: rq } = await db
      .from("room_questions")
      .select("question_id")
      .eq("room_id", room.id)
      .eq("idx", room.current_index)
      .maybeSingle();
    if (!rq) return null;
    const { data: q } = await db.from("questions").select("*").eq("id", rq.question_id).maybeSingle();
    if (!q) return null;

    const { data: answers } = await db.from("answers").select("player_id, choice").eq("room_id", room.id).eq("idx", room.current_index);
    const revealed = room.status === "reveal";
    const distribution = q.options.map((_, i) => (answers ?? []).filter((a) => a.choice === i).length);
    const mine = data.playerId ? (answers ?? []).find((a) => a.player_id === data.playerId) : undefined;

    return {
      idx: room.current_index,
      total: room.total_questions,
      category: q.category,
      prompt: q.prompt,
      options: q.options,
      startedAt: room.question_started_at,
      seconds: room.question_seconds,
      serverNow: new Date().toISOString(),
      answeredCount: (answers ?? []).length,
      myChoice: mine ? mine.choice : null,
      correctIndex: revealed ? q.correct_index : null,
      explanation: revealed ? q.explanation : null,
      distribution: revealed ? distribution : null,
    };
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: codeSchema,
        playerId: z.string().uuid(),
        token: z.string(),
        idx: z.number().int().min(0),
        choice: z.number().int().min(0).max(3),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const room = await getRoomByCode(data.code);
    const { data: secret } = await db.from("player_secrets").select("token").eq("player_id", data.playerId).maybeSingle();
    if (!secret || secret.token !== data.token) throw new Error("Not a player in this room.");
    if (room.status !== "question" || room.current_index !== data.idx) throw new Error("Too late — this question is closed.");

    // Server clock is the only clock that counts.
    const elapsed = Date.now() - new Date(room.question_started_at!).getTime();
    const limit = room.question_seconds * 1000;
    if (elapsed > limit + GRACE_MS) throw new Error("Time's up!");

    const { data: rq } = await db.from("room_questions").select("question_id").eq("room_id", room.id).eq("idx", data.idx).maybeSingle();
    const { data: q } = await db.from("questions").select("correct_index").eq("id", rq!.question_id).maybeSingle();
    const correct = q!.correct_index === data.choice;
    const speed = Math.max(0, 1 - Math.min(elapsed, limit) / limit);
    const points = correct ? 500 + Math.round(500 * speed) : 0;

    const { data: ok } = await db.rpc("record_answer", {
      _room: room.id,
      _player: data.playerId,
      _idx: data.idx,
      _choice: data.choice,
      _correct: correct,
      _points: points,
    });
    if (!ok) throw new Error("You already answered this one.");
    return { accepted: true };
  });
