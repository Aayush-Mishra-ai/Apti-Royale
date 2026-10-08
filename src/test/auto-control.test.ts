import { describe, expect, it } from "vitest";
import { canTickGame, reviewStats } from "../lib/auto-control";
describe("automatic referee", () => {
  it("only advances when the host chose automatic control", () => {
    expect(canTickGame(false, "question")).toBe(false);
    expect(canTickGame(true, "question")).toBe(true);
    expect(canTickGame(true, "reveal")).toBe(true);
    expect(canTickGame(true, "elimination")).toBe(true);
  });
  it("never starts the lobby or restarts a finished game", () => {
    expect(canTickGame(true, "lobby")).toBe(false);
    expect(canTickGame(true, "finished")).toBe(false);
  });
  it("analyses recorded answers without changing scores", () => {
    expect(reviewStats([1, 3, 0, 0], 1, 4)).toEqual({ correct: 3, answered: 4, accuracy: 75 });
    expect(reviewStats(null, null, 4)).toBeNull();
  });
});