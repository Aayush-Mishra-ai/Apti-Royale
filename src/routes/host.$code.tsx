import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { nextQuestion, revealAnswer } from "@/lib/quiz.functions";
import { useCountdown, useLeadIn, useRoom } from "@/hooks/use-room";
import { EliminationScreen, GetReady, Leaderboard, OptionButton, QuestionHeader, TimerBar, WinnerScreen } from "@/components/quiz-ui";

export const Route = createFileRoute("/host/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Hosting ${params.code} — AptiRoyale` },
      { name: "description", content: "Host screen for a live AptiRoyale game." },
      { property: "og:title", content: "Host a live AptiRoyale game" },
      { property: "og:description", content: "Run a live multiplayer aptitude quiz with a real-time leaderboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const { code } = Route.useParams();
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const { room, players, question, clockOffset, error } = useRoom(code, undefined, true);
  const left = useCountdown(room?.status === "question" ? question : null, clockOffset, question?.hostExtraSeconds ?? 0);
  const lead = useLeadIn(room?.status === "question" ? question : null, clockOffset);
  const alive = players.filter((p) => p.eliminated_at === null);
  const next = useServerFn(nextQuestion);
  const reveal = useServerFn(revealAnswer);
  const [busy, setBusy] = useState(false);
  const revealedFor = useRef(-1);

  useEffect(() => {
    setToken(localStorage.getItem(`aptiroyale:host:${code}`));
    setChecked(true);
  }, [code]);

  const act = async (fn: typeof next) => {
    if (!token) return;
    setBusy(true);
    try {
      await fn({ data: { code, hostToken: token } });
    } finally {
      setBusy(false);
    }
  };

  // Auto-reveal when time runs out or everyone answered.
  useEffect(() => {
    if (!room || !question || room.status !== "question" || !token) return;
    if (revealedFor.current === question.idx) return;
    const allIn = alive.length > 0 && question.answeredCount >= alive.length;
    if (left <= 0 || allIn) {
      revealedFor.current = question.idx;
      reveal({ data: { code, hostToken: token } });
    }
  }, [left, question, alive.length, room, token, code, reveal]);

  if (error) return <Centered>{error}</Centered>;
  if (checked && !token)
    return (
      <Centered>
        You are not the host of this room.{" "}
        <Link to="/play/$code" params={{ code }} className="text-primary underline">Join as a player</Link>
      </Centered>
    );
  if (!room) return <Centered><Loader2 className="h-6 w-6 animate-spin" /></Centered>;

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/play/${code}` : "";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="text-lg font-bold text-foreground">Apti<span className="text-primary">Royale</span></Link>
        {room.royale && room.status !== "lobby" && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2" aria-live="polite">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Players left</span>
            <span className="font-display text-3xl leading-none text-destructive">{alive.length}</span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Code</span>
          <span className="font-mono text-2xl font-bold tracking-[0.3em] text-primary">{code}</span>
        </div>
      </header>

      {room.status === "lobby" && (
        <section className="mt-10 grid gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Waiting for players…</h1>
            <p className="mt-2 text-muted-foreground">
              Players open <span className="font-mono text-foreground">{joinUrl || "this site"}</span> or enter the code on the home page.
            </p>
            <p className="mt-6 font-mono text-sm text-muted-foreground">
              {room.total_questions} questions · {room.question_seconds}s each · {players.length}/50 joined
              <span className="ml-2 rounded bg-primary/15 px-2 py-0.5 text-primary">
                {room.category === "mixed" ? "Mixed" : room.category}
              </span>
              {room.royale && <span className="ml-2 rounded bg-destructive/15 px-2 py-0.5 text-destructive">Royale mode</span>}
            </p>
            <button
              onClick={() => act(next)}
              disabled={busy || players.length === 0}
              className="mt-6 rounded-xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {players.length === 0 ? "Need at least 1 player" : "Start game"}
            </button>
          </div>
          <div className="flex flex-wrap content-start gap-2" aria-live="polite">
            {players.map((p) => (
              <span key={p.id} className="animate-in zoom-in rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground">
                {p.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {(room.status === "question" || room.status === "reveal") && question && (
        <section className="mt-8 grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            {room.status === "question" ? (
              <TimerBar left={left} total={question.seconds + question.hostExtraSeconds} />
            ) : (
              <p className="font-mono text-xs uppercase tracking-widest text-success">Answer revealed</p>
            )}
            <QuestionHeader q={question} />
            <div className="grid gap-2.5">
              {question.options.map((o, i) => (
                <OptionButton
                  key={i}
                  idx={i}
                  text={o}
                  disabled
                  state={question.correctIndex === null ? "idle" : i === question.correctIndex ? "correct" : "dim"}
                  count={question.distribution ? question.distribution[i] : undefined}
                />
              ))}
            </div>
            {question.explanation && <p className="text-sm text-muted-foreground">{question.explanation}</p>}
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-muted-foreground">
                {question.answeredCount}/{alive.length} answered{question.hostExtraSeconds > 0 && room.status === "question" ? " · freeze active" : ""}
              </span>
              {room.status === "question" ? (
                <button onClick={() => act(reveal)} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent">
                  Reveal now
                </button>
              ) : (
                <button
                  onClick={() => act(next)}
                  disabled={busy}
                  className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {question.idx + 1 >= question.total ? "Final results" : "Next question"}
                </button>
              )}
            </div>
          </div>
          <aside>
            {room.team_size > 1 && <TeamStandings players={players} />}
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Live leaderboard</h2>
            <Leaderboard players={players} limit={10} />
          </aside>
        </section>
      )}

      {room.status === "elimination" && (
        <section className="mx-auto mt-6 max-w-2xl">
          <EliminationScreen eliminated={players.filter((p) => p.eliminated_at === room.current_index)} left={alive.length} />
          <button
            onClick={() => act(next)}
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Next question
          </button>
        </section>
      )}

      {room.status === "finished" && (
        <section className="mx-auto mt-10 max-w-lg">
          {room.royale && alive[0] ? (
            <WinnerScreen name={alive[0].name} score={alive[0].score} />
          ) : (
            <>
              <h1 className="text-center text-3xl font-bold text-foreground">Final standings</h1>
              {players[0] && <p className="mt-2 text-center text-primary">{players[0].name} wins with {players[0].score} pts</p>}
            </>
          )}
          {room.team_size > 1 && <div className="mt-6"><TeamStandings players={players} /></div>}
          <div className="mt-6"><Leaderboard players={players} /></div>
          <Link to="/" className="mt-6 block text-center text-sm text-primary underline">Host another game</Link>
        </section>
      )}
    </main>
  );
}

/** Aggregate team scores, highest first. */
function TeamStandings({ players }: { players: { team: string | null; score: number }[] }) {
  const totals = new Map<string, number>();
  for (const p of players) if (p.team) totals.set(p.team, (totals.get(p.team) ?? 0) + p.score);
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="mb-5 rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-accent">Team standings</h2>
      <ol className="flex flex-col gap-1">
        {rows.map(([team, score], i) => (
          <li key={team} className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              <span className="mr-2 font-mono text-xs text-muted-foreground">#{i + 1}</span>
              {team}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{score} pts</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4 text-center text-muted-foreground">{children}</div>;
}
