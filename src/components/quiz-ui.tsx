import type { Player, Question } from "@/hooks/use-room";
import { Check, Trophy, X } from "lucide-react";
import { QuestionVisual } from "@/components/question-visual";

export const OPTION_LABELS = ["A", "B", "C", "D"];

export function TimerBar({ left, total }: { left: number; total: number }) {
  const pct = total ? (left / total) * 100 : 0;
  return (
    <div className="w-full" role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>Time</span>
        <span className={left <= 5 ? "text-destructive" : "text-foreground"}>{Math.ceil(left)}s</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ${left <= 5 ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function QuestionHeader({ q }: { q: Question }) {
  return (
    <div>
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        <span>Q{q.idx + 1}/{q.total}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-primary">{q.category}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-accent">
          {q.difficulty} · {q.difficulty === "hard" ? "1.5x" : q.difficulty === "medium" ? "1.25x" : "1x"}
        </span>
      </div>
      <h2 className="mt-3 text-xl font-semibold leading-snug text-foreground sm:text-2xl">{q.prompt}</h2>
      <QuestionVisual key={q.idx} visual={q.visual} />
    </div>
  );
}

export function OptionButton({
  idx,
  text,
  state,
  onClick,
  disabled,
  count,
}: {
  idx: number;
  text: string;
  state: "idle" | "picked" | "correct" | "wrong" | "dim";
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  count?: number | undefined;
}) {
  const styles = {
    idle: "border-border bg-card hover:border-primary/70",
    picked: "border-primary bg-primary/15 ring-2 ring-primary/40",
    correct: "border-success bg-success/15 ring-2 ring-success/40",
    wrong: "border-destructive bg-destructive/15",
    dim: "border-border bg-card opacity-50",
  }[state];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-foreground transition disabled:cursor-default ${styles}`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-sm font-semibold">
        {OPTION_LABELS[idx]}
      </span>
      <span className="flex-1">{text}</span>
      {state === "correct" && <Check className="h-5 w-5 text-success" />}
      {state === "wrong" && <X className="h-5 w-5 text-destructive" />}
      {count !== undefined && <span className="font-mono text-sm text-muted-foreground">{count}</span>}
    </button>
  );
}

export function Leaderboard({ players, highlightId, limit }: { players: Player[]; highlightId?: string; limit?: number }) {
  const list = limit ? players.slice(0, limit) : players;
  if (players.length === 0) return <p className="text-sm text-muted-foreground">No players yet.</p>;
  return (
    <ol className="space-y-1.5">
      {list.map((p, i) => (
        <li
          key={p.id}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
            p.id === highlightId ? "border-primary bg-primary/10" : "border-border bg-card"
          } ${p.eliminated_at !== null ? "opacity-50" : ""}`}
        >
          <span className={`w-6 text-center font-mono text-sm ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
            {i === 0 ? <Trophy className="mx-auto h-4 w-4" /> : i + 1}
          </span>
          <span className="flex-1 truncate font-medium text-foreground">{p.name}</span>
          {p.eliminated_at !== null && (
            <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-destructive">Out</span>
          )}
          <span className="font-mono text-xs text-muted-foreground">{p.correct_count}✓</span>
          <span className="w-14 text-right font-mono font-semibold text-foreground">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

export function EliminationScreen({
  eliminated,
  left,
  highlightId,
}: {
  eliminated: Player[];
  left: number;
  highlightId?: string | undefined;
}) {
  const meOut = highlightId ? eliminated.some((p) => p.id === highlightId) : false;
  return (
    <section className="elim-screen relative mt-6 overflow-hidden rounded-3xl border border-destructive/40 bg-destructive/5 p-6 text-center" aria-live="assertive">
      <div className="pointer-events-none absolute inset-0 elim-glow" />
      <p className="relative font-mono text-xs uppercase tracking-[0.3em] text-destructive">Royale cut</p>
      <h1 className="elim-title relative mt-2 font-display text-6xl leading-none tracking-wide text-destructive sm:text-8xl">
        {highlightId ? (meOut ? "You're out" : "You survived") : "Eliminated"}
      </h1>
      <div className="relative mt-6 flex flex-wrap justify-center gap-2">
        {eliminated.map((p, i) => (
          <span
            key={p.id}
            style={{ animationDelay: `${300 + i * 150}ms` }}
            className="elim-chip rounded-full border border-destructive/50 bg-background/60 px-3 py-1.5 text-sm font-semibold text-foreground line-through decoration-destructive decoration-2"
          >
            {p.name}
          </span>
        ))}
      </div>
      <div className="relative mt-8">
        <p className="font-display text-7xl leading-none text-foreground">{left}</p>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Players left</p>
      </div>
      {meOut && <p className="relative mt-4 text-sm text-muted-foreground">You can keep watching as a spectator.</p>}
    </section>
  );
}

export function WinnerScreen({ name, score, isMe }: { name: string; score: number; isMe?: boolean }) {
  return (
    <section className="relative mt-6 overflow-hidden rounded-3xl border border-neon/40 bg-neon/5 p-8 text-center" aria-live="polite">
      <div className="pointer-events-none absolute inset-0 hero-glow" />
      <Trophy className="winner-pop relative mx-auto h-16 w-16 text-neon" />
      <p className="relative mt-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Last one standing</p>
      <h1 className="winner-pop relative mt-1 font-display text-6xl leading-none text-glow-primary sm:text-8xl">
        {isMe ? "You win!" : name}
      </h1>
      <p className="relative mt-3 font-mono text-lg text-neon">{score} pts</p>
    </section>
  );
}

/** Full-screen synced countdown shown on host and players before a question opens. */
export function GetReady({ left }: { left: number }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Get ready</p>
      <p className="font-display text-9xl text-primary">{Math.ceil(left)}</p>
      <p className="mt-2 text-sm text-muted-foreground">Fastest correct answer wins a bonus</p>
    </div>
  );
}
