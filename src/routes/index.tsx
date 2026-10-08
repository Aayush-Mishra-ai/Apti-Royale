import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Users, Zap, ShieldCheck, Trophy } from "lucide-react";
import { createRoom, getWorldRanking, joinRoom, nextQuestion } from "@/lib/quiz.functions";

export const Route = createFileRoute("/")({
  loader: () => getWorldRanking(),
  head: () => ({
    meta: [
      { title: "Apti Royale — Live Multiplayer Aptitude Quiz" },
      {
        name: "description",
        content: "Host a live aptitude quiz for up to 50 players. Join with a code, race the timer, climb the live leaderboard.",
      },
      { property: "og:title", content: "Apti Royale — Live Multiplayer Aptitude Quiz" },
      { property: "og:description", content: "Join with a code, race the timer, climb the live leaderboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const world = Route.useLoaderData();
  const navigate = useNavigate();
  const create = useServerFn(createRoom);
  const join = useServerFn(joinRoom);
  const start = useServerFn(nextQuestion);
  const [code, setCode] = useState("");
  const [count, setCount] = useState(10);
  const [category, setCategory] = useState<"mixed" | "Quant" | "Logical" | "Verbal" | "Science" | "Tech" | "Sports" | "GK">("mixed");
  const [difficulty, setDifficulty] = useState<"mixed" | "easy" | "medium" | "hard">("mixed");
  const [teamSize, setTeamSize] = useState<1 | 2 | 4>(1);
  const [royale, setRoyale] = useState(true);
  const [autoControl, setAutoControl] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function host() {
    setLoading(true);
    setError(null);
    try {
      const r = await create({ data: { seconds: 20, count, royale, category, teamSize, difficulty, autoControl } });
      localStorage.setItem(`aptiroyale:host:${r.code}`, r.hostToken);
      navigate({ to: "/host/$code", params: { code: r.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a room.");
      setLoading(false);
    }
  }

  const [soloName, setSoloName] = useState("");
  const [soloLoading, setSoloLoading] = useState(false);
  const [soloError, setSoloError] = useState<string | null>(null);
  async function solo() {
    const name = soloName.trim();
    if (!name) return;
    setSoloLoading(true);
    setSoloError(null);
    try {
      const r = await create({ data: { seconds: 20, count, royale: false, category, teamSize: 1, difficulty, autoControl: true } });
      localStorage.setItem(`aptiroyale:host:${r.code}`, r.hostToken);
      const p = await join({ data: { code: r.code, name } });
      localStorage.setItem(`aptiroyale:player:${r.code}`, JSON.stringify({ ...p, name }));
      // Start in the background so the game screen opens instantly.
      void start({ data: { code: r.code, hostToken: r.hostToken } }).catch(() => {});
      navigate({ to: "/play/$code", params: { code: r.code } });
    } catch (e) {
      setSoloError(e instanceof Error ? e.message : "Could not start the game.");
      setSoloLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 select-none">
      <div className="pointer-events-none absolute inset-0 hero-glow" />
      <div className="pointer-events-none absolute inset-0 ember-grid" />
      <div className="embers" aria-hidden><span style={{left:"0%",animationDuration:"8s",animationDelay:"-0.0s"}} /><span style={{left:"37%",animationDuration:"11s",animationDelay:"-1.7s"}} /><span style={{left:"74%",animationDuration:"14s",animationDelay:"-3.4s"}} /><span style={{left:"11%",animationDuration:"10s",animationDelay:"-5.1s"}} /><span style={{left:"48%",animationDuration:"13s",animationDelay:"-6.8s"}} /><span style={{left:"85%",animationDuration:"9s",animationDelay:"-8.5s"}} /><span style={{left:"22%",animationDuration:"12s",animationDelay:"-1.2s"}} /><span style={{left:"59%",animationDuration:"8s",animationDelay:"-2.9s"}} /><span style={{left:"96%",animationDuration:"11s",animationDelay:"-4.6s"}} /><span style={{left:"33%",animationDuration:"14s",animationDelay:"-6.3s"}} /><span style={{left:"70%",animationDuration:"10s",animationDelay:"-8.0s"}} /><span style={{left:"7%",animationDuration:"13s",animationDelay:"-0.7s"}} /><span style={{left:"44%",animationDuration:"9s",animationDelay:"-2.4s"}} /><span style={{left:"81%",animationDuration:"12s",animationDelay:"-4.1s"}} /></div>
      <div className="relative z-10 flex w-full max-w-[390px] flex-col gap-4 rise-in">
        {/* Hero */}
        <header className="pt-4 pb-2 text-center">
          <h1 className="float-slow font-display text-7xl leading-none tracking-tight select-none">
            APTI{" "}
            <span className="text-glow-primary bg-gradient-to-br from-primary via-accent to-neon bg-clip-text text-transparent">
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

          {/* Solo */}
          <form
            className="col-span-2 rounded-3xl border border-accent/30 bg-accent/5 p-5 backdrop-blur-xl"
            onSubmit={(e) => { e.preventDefault(); solo(); }}
          >
            <h2 className="mb-1 font-display text-2xl tracking-wide text-accent">Single Player</h2>
            <p className="mb-3 text-xs text-muted-foreground">Play alone, no host needed. Uses the category, difficulty and question count below.</p>
            <div className="flex gap-2">
              <input
                value={soloName}
                onChange={(e) => setSoloName(e.target.value.slice(0, 20))}
                placeholder="Your nickname"
                aria-label="Nickname for single player"
                className="w-full min-w-0 rounded-xl border border-border bg-background/60 px-4 py-3 font-bold text-foreground outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={!soloName.trim() || soloLoading}
                className="rounded-xl bg-accent px-5 font-bold text-accent-foreground transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {soloLoading ? "..." : "PLAY"}
              </button>
            </div>
            {soloError && <p className="mt-2 text-sm text-destructive">{soloError}</p>}
          </form>

          {/* Host */}
          <div className="col-span-2 rounded-3xl border border-neon/30 bg-neon/5 p-5 backdrop-blur-xl">
            <h2 className="mb-4 font-display text-2xl tracking-wide text-neon">Host Arena</h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-3">
                <label htmlFor="control" className="text-sm font-bold uppercase text-muted-foreground">Game control</label>
                <select id="control" value={autoControl ? "auto" : "manual"} onChange={e => setAutoControl(e.target.value === "auto")} className="min-w-0 bg-transparent font-bold text-neon outline-none">
                  <option value="auto" className="bg-card text-foreground">Automatic + AI review</option>
                  <option value="manual" className="bg-card text-foreground">Host controlled</option>
                </select>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 p-3">
                <label htmlFor="qcat" className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
                  Category
                </label>
                <select
                  id="qcat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as typeof category)}
                  className="cursor-pointer bg-transparent font-bold text-neon outline-none"
                >
                  {[
                    ["mixed", "Mixed"],
                    ["Quant", "Quant"],
                    ["Logical", "Logical"],
                    ["Verbal", "Verbal"],
                    ["Science", "Science"],
                    ["Tech", "Tech"],
                    ["Sports", "Sports"],
                    ["GK", "GK"],
                  ].map(([v, l]) => (
                    <option key={v} value={v} className="bg-card text-foreground">
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 p-3">
                <label htmlFor="qdiff" className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
                  Difficulty
                </label>
                <select
                  id="qdiff"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                  className="cursor-pointer bg-transparent font-bold text-neon outline-none"
                >
                  {[
                    ["mixed", "All levels"],
                    ["easy", "Easy (1x)"],
                    ["medium", "Medium (1.25x)"],
                    ["hard", "Hard (1.5x)"],
                  ].map(([v, l]) => (
                    <option key={v} value={v} className="bg-card text-foreground">
                      {l}
                    </option>
                  ))}
                </select>
              </div>
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
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 p-3">
                <label htmlFor="tmode" className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
                  Teams
                </label>
                <select
                  id="tmode"
                  value={teamSize}
                  onChange={(e) => setTeamSize(Number(e.target.value) as 1 | 2 | 4)}
                  className="cursor-pointer bg-transparent font-bold text-neon outline-none"
                >
                  {[
                    [1, "Solo"],
                    [2, "Duos"],
                    [4, "Squads of 4"],
                  ].map(([v, l]) => (
                    <option key={v} value={v} className="bg-card text-foreground">
                      {l}
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
          {/* World ranking */}
          <div className="col-span-2 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-accent" />
              <h2 className="font-display text-xl tracking-wide text-foreground">World Ranking</h2>
            </div>
            {world.length === 0 ? (
              <p className="text-xs text-muted-foreground">No games finished yet — be the first on the board.</p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {world.slice(0, 5).map((w, i) => (
                  <li key={w.name} className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-5 font-mono text-xs text-muted-foreground">#{i + 1}</span>
                      <span className="font-semibold text-foreground">{w.name}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {w.total_score} pts · {w.wins}W/{w.games}G
                    </span>
                  </li>
                ))}
              </ol>
            )}
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
