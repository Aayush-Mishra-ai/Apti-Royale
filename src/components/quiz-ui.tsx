import type { Player, Question } from "@/hooks/use-room";
import { Check, Trophy, X } from "lucide-react";

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
      </div>
      <h2 className="mt-3 text-xl font-semibold leading-snug text-foreground sm:text-2xl">{q.prompt}</h2>
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
  onClick?: () => void;
  disabled?: boolean;
  count?: number;
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
          }`}
        >
          <span className={`w-6 text-center font-mono text-sm ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
            {i === 0 ? <Trophy className="mx-auto h-4 w-4" /> : i + 1}
          </span>
          <span className="flex-1 truncate font-medium text-foreground">{p.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{p.correct_count}✓</span>
          <span className="w-14 text-right font-mono font-semibold text-foreground">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}
