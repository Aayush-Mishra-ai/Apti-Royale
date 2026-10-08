export const REVIEW_SECONDS = 10;
export function canTickGame(auto: boolean, status: string) {
  return auto && status !== "lobby" && status !== "finished";
}
export function reviewStats(distribution: number[] | null, correctIndex: number | null, answered: number) {
  if (!distribution || correctIndex === null) return null;
  const correct = distribution[correctIndex] ?? 0;
  return { correct, answered, accuracy: answered ? Math.round(correct / answered * 100) : 0 };
}