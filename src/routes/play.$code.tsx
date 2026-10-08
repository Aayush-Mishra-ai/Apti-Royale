import { useEffect, useState } from "react";
import { Snowflake, Sparkles, Divide } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { activatePowerup, getReport, joinRoom, submitAnswer } from "@/lib/quiz.functions";
import { FREEZE_SECONDS, type PowerKind } from "@/lib/royale";
import { useCountdown, useRoom } from "@/hooks/use-room";
import { EliminationScreen, Leaderboard, OptionButton, QuestionHeader, TimerBar, WinnerScreen } from "@/components/quiz-ui";

type Session = { playerId: string; token: string; name: string };

export const Route = createFileRoute("/play/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Join ${params.code} — AptiRoyale` },
      { name: "description", content: "Join a live AptiRoyale aptitude game with your room code." },
      { property: "og:title", content: "Join a live AptiRoyale game" },
      { property: "og:description", content: "Race the timer and climb the live leaderboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { code } = Route.useParams();
  const key = `aptiroyale:player:${code}`;
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setSession(JSON.parse(raw));
    } catch { /* ignore */ }
    setChecked(true);
  }, [key]);

  if (!checked) return <Centered><Loader2 className="h-6 w-6 animate-spin" /></Centered>;
  if (!session)
    return (
      <JoinForm
        code={code}
        onJoined={(s) => {
          localStorage.setItem(key, JSON.stringify(s));
          setSession(s);
        }}
      />
    );
  return <Game code={code} session={session} />;
}

function JoinForm({ code, onJoined }: { code: string; onJoined: (s: Session) => void }) {
  const join = useServerFn(joinRoom);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError(null);
          try {
            const r = await join({ data: { code, name: name.trim() } });
            onJoined({ ...r, name: name.trim() });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not join.");
            setLoading(false);
          }
        }}
      >
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Room</p>
        <p className="font-mono text-3xl font-bold tracking-[0.3em] text-primary">{code}</p>
        <label htmlFor="name" className="mt-6 block text-sm text-muted-foreground">Nickname</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
          className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Join game
        </button>
        <p className="mt-4 text-center text-xs text-muted-foreground">No personal data is collected, only a nickname.</p>
        <Link to="/" className="mt-2 block text-center text-sm text-muted-foreground underline">Back</Link>
      </form>
    </main>
  );
}

function Game({ code, session }: { code: string; session: Session }) {
  const { room, players, question, clockOffset, error, reloadQuestion } = useRoom(code, session.playerId, false, session.token);
  const [local, setLocal] = useState<{ idx: number; used: PowerKind[]; removed: number[] }>({ idx: -1, used: [], removed: [] });
  const left = useCountdown(room?.status === "question" ? question : null, clockOffset, question?.power?.freeze || (local.idx === question?.idx && local.used.includes("freeze")) ? FREEZE_SECONDS : 0);
  const activate = useServerFn(activatePowerup);
  const [powerBusy, setPowerBusy] = useState(false);
  const submit = useServerFn(submitAnswer);
  const [picked, setPicked] = useState<number | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  useEffect(() => {
    setPicked(null);
    setSubmitErr(null);
  }, [question?.idx]);

  if (error) return <Centered>{error}</Centered>;
  if (!room) return <Centered><Loader2 className="h-6 w-6 animate-spin" /></Centered>;

  const me = players.find((p) => p.id === session.playerId);
  const rank = players.findIndex((p) => p.id === session.playerId) + 1;
  const myChoice = question?.myChoice ?? picked;
  const spectator = me ? me.eliminated_at !== null : false;
  const alive = players.filter((p) => p.eliminated_at === null);
  const cur = local.idx === question?.idx ? local : { used: [] as PowerKind[], removed: [] as number[] };
  const removed = question?.power?.removed.length ? question.power.removed : cur.removed;
  const usedAll = [...new Set([...(question?.power?.used ?? []), ...local.used])];
  const activeNow = {
    fifty: removed.length > 0,
    double: !!question?.power?.double || cur.used.includes("double"),
    freeze: !!question?.power?.freeze || cur.used.includes("freeze"),
  };

  async function power(kind: PowerKind) {
    if (!question || powerBusy) return;
    setPowerBusy(true);
    try {
      const r = await activate({ data: { code, playerId: session.playerId, token: session.token, idx: question.idx, kind } });
      setLocal((l) => ({
        idx: question.idx,
        used: [...l.used, kind],
        removed: kind === "fifty" ? r.removed : l.idx === question.idx ? l.removed : [],
      }));
      reloadQuestion();
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Power-up failed.");
    } finally {
      setPowerBusy(false);
    }
  }

  async function choose(i: number) {
    if (!question || myChoice !== null || left <= 0 || spectator || removed.includes(i)) return;
    setPicked(i);
    try {
      await submit({ data: { code, playerId: session.playerId, token: session.token, idx: question.idx, choice: i } });
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Answer not accepted.");
      reloadQuestion();
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-5">
      <header className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
        <span className="truncate font-medium text-foreground">
          {session.name}
          {spectator && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Spectating</span>}
          {room.royale && !spectator && room.status !== "lobby" && (
            <span className="ml-2 font-mono text-xs text-destructive">{alive.length} left</span>
          )}
        </span>
        <span className="font-mono text-sm text-muted-foreground">
          {rank > 0 && <>#{rank} · </>}<span className="font-semibold text-primary">{me?.score ?? 0}</span> pts
        </span>
      </header>

      {room.status === "lobby" && (
        <section className="mt-16 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">You're in!</h1>
          <p className="mt-2 text-muted-foreground">Waiting for the host to start · {players.length} players</p>
        </section>
      )}

      {room.status === "question" && question && (
        <section className="mt-6 space-y-5">
          <TimerBar left={left} total={question.seconds + (activeNow.freeze ? FREEZE_SECONDS : 0)} />
          <QuestionHeader q={question} />
          {!spectator && question.power && (
            <PowerBar
              used={usedAll}
              active={activeNow}
              disabled={powerBusy || myChoice !== null || left <= 0}
              onUse={power}
            />
          )}
          <div className="grid gap-2.5">
            {question.options.map((o, i) => (
              <OptionButton
                key={i}
                idx={i}
                text={removed.includes(i) ? "—" : o}
                onClick={spectator ? undefined : () => choose(i)}
                disabled={spectator || myChoice !== null || left <= 0 || removed.includes(i)}
                state={removed.includes(i) ? "dim" : myChoice === null ? "idle" : myChoice === i ? "picked" : "dim"}
              />
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            {spectator
              ? "You're spectating — watch the survivors battle it out."
              : submitErr ?? (myChoice !== null ? "Locked in! Waiting for the reveal…" : left <= 0 ? "Time's up!" : "Faster correct answers score more.")}
          </p>
        </section>
      )}

      {room.status === "reveal" && question && (
        <section className="mt-6 space-y-5">
          <div
            className={`rounded-xl border p-4 text-center font-semibold ${
              myChoice === question.correctIndex ? "border-success bg-success/10 text-success" : "border-destructive bg-destructive/10 text-destructive"
            }`}
            aria-live="polite"
          >
            {spectator ? "Spectating" : myChoice === null ? "No answer this time" : myChoice === question.correctIndex ? "Correct!" : "Not quite"}
            <div className="mt-1 font-mono text-sm font-normal text-foreground">
              +{question.myPoints ?? 0} pts{rank > 0 && <> · Rank #{rank} of {players.length}</>}
              {me && me.streak > 1 && <> · {me.streak} in a row</>}
            </div>
          </div>
          <QuestionHeader q={question} />
          <div className="grid gap-2.5">
            {question.options.map((o, i) => (
              <OptionButton
                key={i}
                idx={i}
                text={o}
                disabled
                state={i === question.correctIndex ? "correct" : i === myChoice ? "wrong" : "dim"}
              />
            ))}
          </div>
          {question.explanation && <p className="text-sm text-muted-foreground">{question.explanation}</p>}
          <div>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Top 5</h2>
            <Leaderboard players={players} highlightId={session.playerId} limit={5} />
          </div>
        </section>
      )}

      {room.status === "elimination" && (
        <EliminationScreen
          eliminated={players.filter((p) => p.eliminated_at === room.current_index)}
          left={alive.length}
          highlightId={spectator && me?.eliminated_at !== room.current_index ? undefined : session.playerId}
        />
      )}

      {room.status === "finished" && (
        <section className="mt-8">
          {room.royale && alive[0] ? (
            <WinnerScreen name={alive[0].name} score={alive[0].score} isMe={alive[0].id === session.playerId} />
          ) : (
            <h1 className="text-center text-3xl font-bold text-foreground">Game over</h1>
          )}
          <p className="mt-4 text-center text-primary">You finished #{rank} with {me?.score ?? 0} pts</p>
          <Report code={code} session={session} />
          <div className="mt-6"><Leaderboard players={players} highlightId={session.playerId} /></div>
          <Link to="/" className="mt-6 block text-center text-sm text-primary underline">Play again</Link>
        </section>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4 text-center text-muted-foreground">{children}</div>;
}

const POWERS: { kind: PowerKind; label: string; Icon: typeof Snowflake }[] = [
  { kind: "fifty", label: "50:50", Icon: Divide },
  { kind: "double", label: "Double", Icon: Sparkles },
  { kind: "freeze", label: "Freeze +10s", Icon: Snowflake },
];

function PowerBar({
  used,
  active,
  disabled,
  onUse,
}: {
  used: string[];
  active: Record<PowerKind, boolean>;
  disabled: boolean;
  onUse: (k: PowerKind) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Power-ups (one use each)">
      {POWERS.map(({ kind, label, Icon }) => {
        const isActive = active[kind];
        const isUsed = used.includes(kind);
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onUse(kind)}
            disabled={disabled || isUsed}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold uppercase tracking-wide transition active:scale-95 disabled:cursor-default ${
              isActive
                ? "border-neon bg-neon/15 text-neon shadow-[0_0_16px_color-mix(in_oklab,var(--neon)_35%,transparent)]"
                : isUsed
                  ? "border-border bg-card text-muted-foreground opacity-40"
                  : "border-accent/40 bg-accent/5 text-accent hover:bg-accent/10"
            }`}
          >
            <Icon className="h-4 w-4" />
            {isActive ? "Active" : isUsed ? "Used" : label}
          </button>
        );
      })}
    </div>
  );
}

function Report({ code, session }: { code: string; session: Session }) {
  const fetchReport = useServerFn(getReport);
  const [r, setR] = useState<Awaited<ReturnType<typeof getReport>> | null>(null);
  useEffect(() => {
    fetchReport({ data: { code, playerId: session.playerId, token: session.token } }).then(setR).catch(() => {});
  }, [code, session.playerId, session.token, fetchReport]);
  if (!r || r.stats.length === 0) return null;
  return (
    <section className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <h2 className="font-display text-2xl tracking-wide text-primary">Your report</h2>
      <ul className="mt-3 space-y-3">
        {r.stats.map((s) => (
          <li key={s.category}>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-foreground">{s.category}</span>
              <span className="font-mono text-muted-foreground">
                {s.correct}/{s.total} · {s.accuracy}%
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${s.category === r.practise ? "bg-neon" : "bg-accent"}`}
                style={{ width: `${Math.max(4, s.accuracy)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {r.practise && (
        <div className="mt-4 rounded-xl border border-neon/40 bg-neon/10 p-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neon">Practise next: {r.practise}</p>
          <p className="mt-1 text-sm text-foreground">{r.tip}</p>
        </div>
      )}
    </section>
  );
}
