import { describe, expect, it } from "vitest";
import { buildReport, isEliminationPoint, pickEliminated } from "@/lib/royale";

const mk = (scores: number[]) => scores.map((score, i) => ({ id: `p${i}`, score, created_at: `2026-01-01T00:00:0${i}Z` }));

describe("royale rules", () => {
  it("eliminates after every 3rd question but not after the last", () => {
    expect(isEliminationPoint(2, 10)).toBe(true);
    expect(isEliminationPoint(5, 10)).toBe(true);
    expect(isEliminationPoint(3, 10)).toBe(false);
    expect(isEliminationPoint(8, 9)).toBe(false);
  });
  it("removes the lowest-scoring 20%", () => {
    expect(pickEliminated(mk([900, 100, 500, 300, 700, 800, 600, 400, 200, 1000])).sort()).toEqual(["p1", "p8"]);
  });
  it("removes at least one but never the last survivor", () => {
    expect(pickEliminated(mk([10, 5, 8]))).toEqual(["p1"]);
    expect(pickEliminated(mk([10, 5]))).toEqual(["p1"]);
    expect(pickEliminated(mk([10]))).toEqual([]);
  });
  it("report picks the weakest category", () => {
    const r = buildReport([
      { category: "Quant", correct: true },
      { category: "Quant", correct: true },
      { category: "Verbal", correct: false },
      { category: "Verbal", correct: true },
    ]);
    expect(r.practise).toBe("Verbal");
    expect(r.stats.find((s) => s.category === "Verbal")?.accuracy).toBe(50);
  });
});
