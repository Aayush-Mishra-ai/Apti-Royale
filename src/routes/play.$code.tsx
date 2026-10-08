import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { joinRoom, submitAnswer } from "@/lib/quiz.functions";
import { useCountdown, useRoom } from "@/hooks/use-room";
import { Leaderboard, OptionButton, QuestionHeader, TimerBar } from "@/components/quiz-ui";

type Session = { playerId: string; token: string; name: string };

export const Route = createFileRoute("/play/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Join ${params.code} — AptiQuiz` },
      { name: "description", content: "Join a live AptiQuiz aptitude game with your room code." },
      { property: "og:title", content: "Join a live AptiQuiz game" },
      { property: "og:description", content: "Race the timer and climb the live leaderboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { code } = Route.useParams();
  const key = `aptiquiz:player:${code}`;
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
        <label htmlFor="name" className="mt-6 block text-sm text-muted-foreground">Your name</label>
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
        <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground underline">Back</Link>
      </form>
    </main>
  );
}

function Game({ code, session }: { code: string; session: Session }) {
  const { room, players, question, clockOffset, error, reloadQuestion } = useRoom(code, session.playerId);
  const left = useCountdown(room?.status === "question" ? question : null, clockOffset);
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

  async function choose(i: number) {
    if (!question || myChoice !== null || left <= 0) return;
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
        <span className="truncate font-medium text-foreground">{session.name}</span>
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
          <TimerBar left={left} total={question.seconds} />
          <QuestionHeader q={question} />
          <div className="grid gap-2.5">
            {question.options.map((o, i) => (
              <OptionButton
                key={i}
                idx={i}
                text={o}
                onClick={() => choose(i)}
                disabled={myChoice !== null || left <= 0}
                state={myChoice === null ? "idle" : myChoice === i ? "picked" : "dim"}
              />
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            {submitErr ?? (myChoice !== null ? "Locked in! Waiting for the reveal…" : left <= 0 ? "Time's up!" : "Faster correct answers score more.")}
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
            {myChoice === null ? "No answer this time" : myChoice === question.correctIndex ? "Correct! 🎉" : "Not quite"}
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
          {question.explanation && <p className="text-sm text-muted-foreground">💡 {question.explanation}</p>}
          <div>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Top 5</h2>
            <Leaderboard players={players} highlightId={session.playerId} limit={5} />
          </div>
        </section>
      )}

      {room.status === "finished" && (
        <section className="mt-8">
          <h1 className="text-center text-3xl font-bold text-foreground">Game over</h1>
          <p className="mt-2 text-center text-primary">You finished #{rank} with {me?.score ?? 0} pts</p>
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
