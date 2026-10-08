import { Bot } from "lucide-react";
import type { Question, Room } from "@/hooks/use-room";
import { reviewStats } from "@/lib/auto-control";

export function RoundReview({ room, question, remaining }: { room: Room; question: Question; remaining: number }) {
  const stats = reviewStats(question.distribution, question.correctIndex, question.answeredCount);
  return (
    <section className="space-y-3 border-l-2 border-accent pl-4" aria-live="polite">
      <h2 className="flex items-center gap-2 font-mono text-sm text-accent"><Bot className="h-4 w-4" />{question.aiReview ? "AI answer review" : "Round review"}</h2>
      {stats && <p className="text-sm text-foreground">{stats.correct}/{stats.answered} answers correct · {stats.accuracy}% accuracy</p>}
      <p className="text-sm text-muted-foreground">{question.aiReview ?? question.explanation}</p>
      {room.ai_error && <p className="text-xs text-destructive">{room.ai_error}</p>}
      <p className="font-mono text-sm text-primary">Next round in {remaining}s</p>
    </section>
  );
}