import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { nextQuestion, revealAnswer } from "@/lib/quiz.functions";
import { useCountdown, useRoom } from "@/hooks/use-room";
import { Leaderboard, OptionButton, QuestionHeader, TimerBar } from "@/components/quiz-ui";

export const Route = createFileRoute("/host/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Hosting ${params.code} — AptiQuiz` },
      { name: "description", content: "Host screen for a live AptiQuiz game." },
      { property: "og:title", content: "Host a live AptiQuiz game" },
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
  const left = useCountdown(room?.status === "question" ? question : null, clockOffset);
  const next = useServerFn(nextQuestion);
  const reveal = useServerFn(revealAnswer);
  const [busy, setBusy] = useState(false);
  const revealedFor = useRef(-1);

  useEffect(() => {
    setToken(localStorage.getItem(`aptiquiz:host:${code}`));
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
    const allIn = players.length > 0 && question.answeredCount >= players.length;
    if (left <= 0 || allIn) {
      revealedFor.current = question.idx;
      reveal({ data: { code, hostToken: token } });
    }
  }, [left, question, players.length, room, token, code, reveal]);

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
        <Link to="/" className="text-lg font-bold text-foreground">Apti<span className="text-primary">Quiz</span></Link>
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
              <TimerBar left={left} total={question.seconds} />
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
            {question.explanation && <p className="text-sm text-muted-foreground">💡 {question.explanation}</p>}
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-muted-foreground">
                {question.answeredCount}/{players.length} answered
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
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Live leaderboard</h2>
            <Leaderboard players={players} limit={10} />
          </aside>
        </section>
      )}

      {room.status === "finished" && (
        <section className="mx-auto mt-10 max-w-lg">
          <h1 className="text-center text-3xl font-bold text-foreground">🏆 Final standings</h1>
          {players[0] && <p className="mt-2 text-center text-primary">{players[0].name} wins with {players[0].score} pts</p>}
          <div className="mt-6"><Leaderboard players={players} /></div>
          <Link to="/" className="mt-6 block text-center text-sm text-primary underline">Host another game</Link>
        </section>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4 text-center text-muted-foreground">{children}</div>;
}
