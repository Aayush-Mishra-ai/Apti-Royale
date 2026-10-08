import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Users, Zap, ShieldCheck } from "lucide-react";
import { createRoom } from "@/lib/quiz.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AptiQuiz — Live Multiplayer Aptitude Quiz" },
      {
        name: "description",
        content: "Host a live aptitude quiz for up to 50 players. Join with a code, race the timer, climb the live leaderboard.",
      },
      { property: "og:title", content: "AptiQuiz — Live Multiplayer Aptitude Quiz" },
      { property: "og:description", content: "Join with a code, race the timer, climb the live leaderboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const create = useServerFn(createRoom);
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(20);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function host() {
    setLoading(true);
    setError(null);
    try {
      const r = await create({ data: { seconds, count } });
      localStorage.setItem(`aptiquiz:host:${r.code}`, r.hostToken);
      navigate({ to: "/host/$code", params: { code: r.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a room.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 hero-glow" />
      <div className="relative z-10 w-full max-w-md text-center">
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Apti<span className="text-primary">Quiz</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
          Live aptitude battles for placement prep. Up to 50 players, one code, one leaderboard.
        </p>

        <form
          className="mt-8 rounded-2xl border border-border bg-card/80 p-5 text-left backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (c.length === 5) navigate({ to: "/play/$code", params: { code: c } });
          }}
        >
          <label htmlFor="code" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Join a game
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
              placeholder="CODE"
              autoComplete="off"
              inputMode="text"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-center font-mono text-xl tracking-[0.4em] text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={code.length !== 5}
              className="rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </form>

        <div className="mt-4 rounded-2xl border border-border bg-card/60 p-5 text-left">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Host a game</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm text-muted-foreground">
              Questions
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              >
                {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-sm text-muted-foreground">
              Seconds each
              <select
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              >
                {[10, 15, 20, 30, 45].map((n) => <option key={n} value={n}>{n}s</option>)}
              </select>
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <button
            onClick={host}
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/60 px-4 py-3 font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create room
          </button>
        </div>

        <ul className="mt-8 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <li className="flex flex-col items-center gap-1"><Users className="h-4 w-4 text-primary" />50 players</li>
          <li className="flex flex-col items-center gap-1"><Zap className="h-4 w-4 text-primary" />Speed scoring</li>
          <li className="flex flex-col items-center gap-1"><ShieldCheck className="h-4 w-4 text-primary" />Server referee</li>
        </ul>
      </div>
    </main>
  );
}
