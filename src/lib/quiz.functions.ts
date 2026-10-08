import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { FREEZE_SECONDS, basePoints, buildReport, isEliminationPoint, pickEliminated } from "./royale";

const MAX_PLAYERS = 50;
const GRACE_MS = 1500; // network slack after the timer ends
const LEAD_IN_MS = 3000; // synced "get ready" so every screen opens the question together
const codeSchema = z.string().trim().regex(/^\d{6}$/);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function makeCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 900000;
  return String(100000 + n);
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
        royale: z.boolean().default(false),
        category: z.enum(["mixed", "Quant", "Logical", "Verbal", "Science", "Tech", "Sports", "GK"]).default("mixed"),
        teamSize: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1),
        difficulty: z.enum(["mixed", "easy", "medium", "hard"]).default("mixed"),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const db = await admin();
    let qq = db.from("questions").select("id, difficulty");
    if (data.category !== "mixed") qq = qq.eq("category", data.category);
    const { data: qs } = await qq;
    const shuffled = (qs ?? []).sort(() => Math.random() - 0.5);
    // Chosen difficulty first; top up with others if the pool is too small.
    const ordered = data.difficulty === "mixed" ? shuffled : [...shuffled.filter((q) => q.difficulty === data.difficulty), ...shuffled.filter((q) => q.difficulty !== data.difficulty)];
    const ids = ordered.map((q) => q.id).slice(0, data.count);
    if (ids.length === 0) throw new Error("No questions available");

    let room: { id: string; code: string } | null = null;
    for (let i = 0; i < 5 && !room; i++) {
      const { data: r } = await db
        .from("rooms")
        .insert({
          code: makeCode(),
          question_seconds: data.seconds,
          total_questions: ids.length,
          royale: data.royale,
          category: data.category,
          team_size: data.teamSize,
          difficulty: data.difficulty,
        })
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

    // Teams: round-robin players across Team A, Team B, … so squads stay balanced.
    let team: string | null = null;
    if (room.team_size > 1) {
      const numTeams = Math.ceil(MAX_PLAYERS / room.team_size);
      team = `Team ${String.fromCharCode(65 + ((count ?? 0) % numTeams))}`;
    }
    const { data: player, error } = await db
      .from("players")
      .insert({ room_id: room.id, name: data.name, team })
      .select("id")
      .maybeSingle();
    if (error || !player) throw new Error(error?.code === "23505" ? "That name is taken in this room." : "Could not join.");
    const token = crypto.randomUUID();
    await db.from("player_secrets").insert({ player_id: player.id, token });
    return { playerId: player.id, token };
  });

/** When a game finishes, fold every player's result into the all-time world ranking. */
async function recordWorld(db: Awaited<ReturnType<typeof admin>>, roomId: string) {
  const { data: ps } = await db
    .from("players")
    .select("name, score")
    .eq("room_id", roomId)
    .order("score", { ascending: false })
    .order("created_at");
  if (!ps?.length) return;
  const winner = ps[0]!.name;
  for (const p of ps) {
    await db.rpc("bump_world_ranking", { _name: p.name, _score: p.score, _won: p.name === winner });
  }
}

/** Host advances: lobby/reveal -> next question, or finishes the game. */
export const nextQuestion = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: codeSchema, hostToken: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const room = await getRoomByCode(data.code);
    await assertHost(room.id, data.hostToken);
    if (room.status === "question" || room.status === "finished") return { ok: true };

    // Royale: after every 3rd reveal, knock out the bottom 20%.
    if (room.royale && room.status === "reveal" && isEliminationPoint(room.current_index, room.total_questions)) {
      const { data: alive } = await db
        .from("players")
        .select("id, score, created_at")
        .eq("room_id", room.id)
        .is("eliminated_at", null);
      const out = pickEliminated(alive ?? []);
      if (out.length) await db.from("players").update({ eliminated_at: room.current_index }).in("id", out);
      const left = (alive ?? []).length - out.length;
      await db
        .from("rooms")
        .update({ status: left <= 1 ? "finished" : "elimination" })
        .eq("id", room.id)
        .eq("status", "reveal");
      if (left <= 1) await recordWorld(db, room.id);
      return { ok: true };
    }

    const next = room.current_index + 1;
    if (next >= room.total_questions) {
      await db.from("rooms").update({ status: "finished" }).eq("id", room.id);
      await recordWorld(db, room.id);
    } else {
      await db
        .from("rooms")
        .update({ status: "question", current_index: next, question_started_at: new Date(Date.now() + LEAD_IN_MS).toISOString() })
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
    if (room.status === "question") {
      await db.from("rooms").update({ status: "reveal" }).eq("id", room.id);
      // Players who didn't answer lose their streak.
      const { data: ans } = await db.from("answers").select("player_id").eq("room_id", room.id).eq("idx", room.current_index);
      const answered = (ans ?? []).map((a) => a.player_id);
      let q = db.from("players").update({ streak: 0 }).eq("room_id", room.id);
      if (answered.length) q = q.not("id", "in", `(${answered.join(",")})`);
      await q;
    }
    return { ok: true };
  });

export const getQuestion = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ code: codeSchema, playerId: z.string().uuid().optional(), token: z.string().optional() }).parse(d)
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

    const { data: answers } = await db.from("answers").select("player_id, choice, points").eq("room_id", room.id).eq("idx", room.current_index);
    const revealed = room.status === "reveal";
    const { data: uses } = await db
      .from("powerup_uses")
      .select("player_id, kind, idx, removed")
      .eq("idx", room.current_index)
      .in("player_id", (await db.from("players").select("id").eq("room_id", room.id)).data?.map((p) => p.id) ?? []);
    const answeredIds = new Set((answers ?? []).map((a) => a.player_id));
    const pendingFreeze = (uses ?? []).some((u) => u.kind === "freeze" && !answeredIds.has(u.player_id));

    let power: { used: string[]; removed: number[]; double: boolean; freeze: boolean } | null = null;
    if (data.playerId && data.token) {
      const { data: secret } = await db.from("player_secrets").select("token").eq("player_id", data.playerId).maybeSingle();
      if (secret && secret.token === data.token) {
        const { data: mineUses } = await db.from("powerup_uses").select("kind, idx, removed").eq("player_id", data.playerId);
        const cur = (mineUses ?? []).filter((u) => u.idx === room.current_index);
        power = {
          used: (mineUses ?? []).map((u) => u.kind),
          removed: cur.find((u) => u.kind === "fifty")?.removed ?? [],
          double: cur.some((u) => u.kind === "double"),
          freeze: cur.some((u) => u.kind === "freeze"),
        };
      }
    }
    const distribution = q.options.map((_, i) => (answers ?? []).filter((a) => a.choice === i).length);
    const mine = data.playerId ? (answers ?? []).find((a) => a.player_id === data.playerId) : undefined;

    return {
      idx: room.current_index,
      total: room.total_questions,
      category: q.category,
      prompt: q.question ?? q.prompt,
      difficulty: q.difficulty,
      options: q.options,
      startedAt: room.question_started_at,
      seconds: room.question_seconds,
      serverNow: new Date().toISOString(),
      answeredCount: (answers ?? []).length,
      myChoice: mine ? mine.choice : null,
      myPoints: revealed && mine ? mine.points : null,
      correctIndex: revealed ? q.correct_index : null,
      explanation: revealed ? q.explanation : null,
      distribution: revealed ? distribution : null,
      hostExtraSeconds: pendingFreeze ? FREEZE_SECONDS : 0,
      power,
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
    const { data: pl } = await db.from("players").select("eliminated_at").eq("id", data.playerId).maybeSingle();
    if (!pl || pl.eliminated_at !== null) throw new Error("You're spectating — eliminated players can't score.");
    const { data: myUses } = await db.from("powerup_uses").select("kind").eq("player_id", data.playerId).eq("idx", data.idx);
    const frozen = (myUses ?? []).some((u) => u.kind === "freeze");
    const doubled = (myUses ?? []).some((u) => u.kind === "double");

    // Server clock is the only clock that counts.
    const elapsed = Date.now() - new Date(room.question_started_at!).getTime();
    const limit = room.question_seconds * 1000;
    const myLimit = limit + (frozen ? FREEZE_SECONDS * 1000 : 0);
    if (elapsed > myLimit + GRACE_MS) throw new Error("Time's up!");
    if (elapsed < 0) throw new Error("Wait for the question to open.");

    const { data: rq } = await db.from("room_questions").select("question_id").eq("room_id", room.id).eq("idx", data.idx).maybeSingle();
    const { data: q } = await db.from("questions").select("correct_index, difficulty").eq("id", rq!.question_id).maybeSingle();
    const correct = q!.correct_index === data.choice;
    const speed = Math.max(0, 1 - Math.min(elapsed, myLimit) / myLimit);
    const points = basePoints(correct, speed, q!.difficulty) * (doubled ? 2 : 1);

    const { data: ok } = await db.rpc("record_answer_v3", {
      _room: room.id,
      _player: data.playerId,
      _idx: data.idx,
      _choice: data.choice,
      _correct: correct,
      _points: points,
    });
    if (ok === null || ok < 0) throw new Error("You already answered this one.");
    return { accepted: true };
  });

export const activatePowerup = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: codeSchema,
        playerId: z.string().uuid(),
        token: z.string(),
        idx: z.number().int().min(0),
        kind: z.enum(["fifty", "double", "freeze"]),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const room = await getRoomByCode(data.code);
    const { data: secret } = await db.from("player_secrets").select("token").eq("player_id", data.playerId).maybeSingle();
    if (!secret || secret.token !== data.token) throw new Error("Not a player in this room.");
    if (room.status !== "question" || room.current_index !== data.idx) throw new Error("This question is closed.");
    const { data: pl } = await db.from("players").select("eliminated_at, room_id").eq("id", data.playerId).maybeSingle();
    if (!pl || pl.room_id !== room.id || pl.eliminated_at !== null) throw new Error("Spectators can't use power-ups.");
    const elapsed = Date.now() - new Date(room.question_started_at!).getTime();
    if (elapsed > room.question_seconds * 1000) throw new Error("Time's up!");
    const { data: answered } = await db.from("answers").select("id").eq("player_id", data.playerId).eq("idx", data.idx).maybeSingle();
    if (answered) throw new Error("You already answered.");

    let removed: number[] = [];
    if (data.kind === "fifty") {
      const { data: rq } = await db.from("room_questions").select("question_id").eq("room_id", room.id).eq("idx", data.idx).maybeSingle();
      const { data: q } = await db.from("questions").select("correct_index, options").eq("id", rq!.question_id).maybeSingle();
      removed = q!.options
        .map((_, i) => i)
        .filter((i) => i !== q!.correct_index)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
    }
    const { error } = await db.from("powerup_uses").insert({ player_id: data.playerId, kind: data.kind, idx: data.idx, removed });
    if (error) throw new Error("You already used that power-up.");
    return { removed };
  });

/** All-time world ranking across every game — public read. */
export const getWorldRanking = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db
    .from("world_rankings")
    .select("name, best_score, total_score, games, wins")
    .order("total_score", { ascending: false })
    .order("wins", { ascending: false })
    .limit(20);
  return data ?? [];
});

export const getReport = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: codeSchema, playerId: z.string().uuid(), token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const room = await getRoomByCode(data.code);
    if (room.status !== "finished") throw new Error("The game isn't over yet.");
    const { data: secret } = await db.from("player_secrets").select("token").eq("player_id", data.playerId).maybeSingle();
    if (!secret || secret.token !== data.token) throw new Error("Not a player in this room.");
    const { data: pl } = await db.from("players").select("eliminated_at").eq("id", data.playerId).maybeSingle();
    const lastIdx = pl?.eliminated_at ?? room.current_index;
    const { data: rqs } = await db.from("room_questions").select("idx, question_id").eq("room_id", room.id).lte("idx", lastIdx);
    const qids = (rqs ?? []).map((r) => r.question_id);
    const { data: qs } = await db.from("questions").select("id, category").in("id", qids.length ? qids : [-1]);
    const { data: ans } = await db.from("answers").select("idx, is_correct").eq("player_id", data.playerId);
    const cat = new Map((qs ?? []).map((q) => [q.id, q.category]));
    const ok = new Map((ans ?? []).map((a) => [a.idx, a.is_correct]));
    const rows = (rqs ?? []).map((r) => ({ category: cat.get(r.question_id) ?? "Other", correct: ok.get(r.idx) === true }));
    return buildReport(rows);
  });
