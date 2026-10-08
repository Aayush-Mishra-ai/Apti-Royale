import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Users, Zap, ShieldCheck } from "lucide-react";
import { createRoom } from "@/lib/quiz.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AptiRoyale — Live Multiplayer Aptitude Quiz" },
      {
        name: "description",
        content: "Host a live aptitude quiz for up to 50 players. Join with a code, race the timer, climb the live leaderboard.",
      },
      { property: "og:title", content: "AptiRoyale — Live Multiplayer Aptitude Quiz" },
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
  const [count, setCount] = useState(10);
  const [royale, setRoyale] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function host() {
    setLoading(true);
    setError(null);
    try {
      const r = await create({ data: { seconds: 20, count, royale } });
      localStorage.setItem(`aptiroyale:host:${r.code}`, r.hostToken);
      navigate({ to: "/host/$code", params: { code: r.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a room.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 select-none">
      <div className="pointer-events-none absolute inset-0 hero-glow" />
      <div className="relative z-10 flex w-full max-w-[390px] flex-col gap-4">
        {/* Hero */}
        <header className="pt-4 pb-2 text-center">
          <h1 className="font-display text-7xl leading-none tracking-tight select-none">
            APTI
            <span className="text-glow-primary bg-gradient-to-br from-primary via-neon to-accent bg-clip-text text-transparent">
              ROYALE
            </span>
          </h1>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Live Multiplayer Logic Battles
          </p>
        </header>

        {/* Bento grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Join */}
          <form
            className="col-span-2 rounded-3xl border border-primary/30 bg-primary/5 p-5 shadow-[inset_0_0_20px_color-mix(in_oklab,var(--primary)_10%,transparent)] backdrop-blur-xl"
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim();
              if (c.length === 6) navigate({ to: "/play/$code", params: { code: c } });
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl tracking-wide text-primary">Join Game</h2>
              <div className="flex gap-1" aria-hidden>
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
              </div>
            </div>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                autoComplete="off"
                inputMode="numeric"
                aria-label="6-digit room code"
                className="w-full min-w-0 rounded-xl border border-border bg-background/60 px-4 py-4 text-center font-mono text-xl tracking-[0.4em] text-foreground outline-none transition-all placeholder:opacity-20 focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={code.length !== 6}
                className="rounded-xl bg-primary px-6 font-bold text-primary-foreground shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_30%,transparent)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                GO
              </button>
            </div>
          </form>

          {/* Host */}
          <div className="col-span-2 rounded-3xl border border-neon/30 bg-neon/5 p-5 backdrop-blur-xl">
            <h2 className="mb-4 font-display text-2xl tracking-wide text-neon">Host Arena</h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 p-3">
                <label htmlFor="qcount" className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
                  Questions
                </label>
                <select
                  id="qcount"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="cursor-pointer bg-transparent font-bold text-neon outline-none"
                >
                  {[5, 10, 15, 20].map((n) => (
                    <option key={n} value={n} className="bg-card text-foreground">
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-3">
                <span>
                  <span className="block text-sm font-bold uppercase tracking-tight text-foreground">Royale mode</span>
                  <span className="block text-xs text-muted-foreground">Bottom 20% knocked out every 3 questions</span>
                </span>
                <input
                  type="checkbox"
                  checked={royale}
                  onChange={(e) => setRoyale(e.target.checked)}
                  className="h-5 w-5 accent-[var(--neon)]"
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                onClick={host}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-neon py-4 font-bold uppercase tracking-widest text-neon transition-all hover:bg-neon/10 active:bg-neon/20 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Room
              </button>
            </div>
          </div>

          {/* Features */}
          <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-border bg-secondary/50 p-4 text-center">
            <Users className="h-6 w-6 text-accent" />
            <span className="font-display text-lg leading-none text-foreground">50 Players</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-border bg-secondary/50 p-4 text-center">
            <Zap className="h-6 w-6 text-neon" />
            <span className="font-display text-lg leading-none text-foreground">Speed Scoring</span>
          </div>
          <div className="col-span-2 flex items-center justify-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-5 py-3">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/80">
              Server Referee Active
            </span>
          </div>
        </div>

        {/* Privacy */}
        <footer className="mt-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            No personal data is collected, only a nickname.
          </p>
        </footer>
      </div>
    </main>
  );
}
