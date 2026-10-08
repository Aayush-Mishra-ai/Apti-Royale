/** Pure game rules for Royale mode, power-ups and the end-of-game report. */

export const ELIMINATE_EVERY = 3;
export const ELIMINATE_SHARE = 0.2;
export const FREEZE_SECONDS = 10;
export type PowerKind = "fifty" | "double" | "freeze";

/** Should an elimination happen after question `idx` (0-based) was revealed? */
export function isEliminationPoint(idx: number, total: number) {
  return (idx + 1) % ELIMINATE_EVERY === 0 && idx + 1 < total;
}

/** Lowest-scoring 20% of alive players (at least 1 while 2+ remain; never everyone). */
export function pickEliminated<T extends { id: string; score: number; created_at: string }>(alive: T[]): string[] {
  if (alive.length < 2) return [];
  const n = Math.min(alive.length - 1, Math.max(1, Math.floor(alive.length * ELIMINATE_SHARE)));
  // Lowest score first; on ties the later joiner goes first.
  const sorted = [...alive].sort((a, b) => a.score - b.score || b.created_at.localeCompare(a.created_at));
  return sorted.slice(0, n).map((p) => p.id);
}

export const CATEGORY_TIPS: Record<string, string> = {
  Quant: "Drill percentages, ratios and speed-distance-time daily — learn shortcuts like 10% chunks and unit rates.",
  Logical: "Practise series and seating puzzles: write the pattern or draw the arrangement before picking an option.",
  Verbal: "Read one editorial a day and note 5 new words; for grammar, read the sentence aloud to catch errors.",
  Science: "Revise one NCERT-style concept a day — formulas, symbols and definitions — and quiz yourself without notes.",
  Tech: "Follow a weekly tech newsletter and build one tiny project a month; hands-on beats reading docs alone.",
  Sports: "Watch match highlights with the rulebook in mind — learn scoring, fouls and formats for 3 sports you follow.",
  GK: "Spend 10 minutes daily on current affairs and maps; capitals, currencies and records repeat often in quizzes.",
};

export type CategoryStat = { category: string; correct: number; total: number; accuracy: number };

export function buildReport(rows: { category: string; correct: boolean }[]) {
  const map = new Map<string, CategoryStat>();
  for (const r of rows) {
    const s = map.get(r.category) ?? { category: r.category, correct: 0, total: 0, accuracy: 0 };
    s.total++;
    if (r.correct) s.correct++;
    map.set(r.category, s);
  }
  const stats = [...map.values()].map((s) => ({ ...s, accuracy: Math.round((s.correct / s.total) * 100) }));
  stats.sort((a, b) => a.category.localeCompare(b.category));
  const weakest = [...stats].sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)[0] ?? null;
  return {
    stats,
    practise: weakest ? weakest.category : null,
    tip: weakest ? (CATEGORY_TIPS[weakest.category] ?? "Revisit the basics of this topic and time yourself on 10 questions.") : null,
  };
}

// Harder questions are worth more: base speed points are multiplied by this.
export const DIFFICULTY_MULTIPLIER: Record<string, number> = { easy: 1, medium: 1.25, hard: 1.5 };
export function basePoints(correct: boolean, speed: number, difficulty: string): number {
  if (!correct) return 0;
  const s = Math.max(0, Math.min(1, speed));
  return Math.round((500 + 500 * s) * (DIFFICULTY_MULTIPLIER[difficulty] ?? 1));
}
