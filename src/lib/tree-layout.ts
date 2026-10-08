import type { RoadmapNode, RoadmapStage } from "./roadmap-schema";

export const NODE_W = 196;
export const NODE_H = 66;
const COL_GAP = 150;
const ROW_GAP = 26;

export interface Positioned {
  id: string;
  x: number; // top-left
  y: number; // top-left
  col: number;
  rowIndex: number;
  rowCount: number;
}

export interface TreeLayout {
  positions: Map<string, Positioned>;
  width: number;
  height: number;
  minX: number;
  minY: number;
  labelByCol: Map<number, string>;
}

/**
 * Stage-column layout: one column per roadmap stage (4-6 columns), rows within
 * a column ordered by barycenter of their prerequisites so edges stay clean.
 */
export function layoutRoadmap(
  nodes: RoadmapNode[],
  stages: RoadmapStage[]
): TreeLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const colOfStage = new Map<string, number>();
  const nameOfStage = new Map<string, string>();
  stages.forEach((s, i) => {
    colOfStage.set(s.id, i);
    nameOfStage.set(s.id, s.name);
  });

  const cols = new Map<number, string[]>();
  for (const n of nodes) {
    const c = colOfStage.get(n.stageId) ?? 0;
    if (!cols.has(c)) cols.set(c, []);
    cols.get(c)!.push(n.id);
  }
  const colNums = [...cols.keys()].sort((a, b) => a - b);

  const rowOf = new Map<string, number>();
  for (let iter = 0; iter < 10; iter++) {
    for (const c of colNums) {
      const col = cols.get(c)!;
      const scored = col.map((id, i) => {
        const n = byId.get(id)!;
        const parentRows = n.prereqIds.filter((p) => rowOf.has(p)).map((p) => rowOf.get(p)!);
        const score = parentRows.length
          ? parentRows.reduce((a, b) => a + b, 0) / parentRows.length
          : i;
        return { id, score, fallback: i };
      });
      scored.sort((a, b) => (a.score === b.score ? a.fallback - b.fallback : a.score - b.score));
      scored.forEach((s, i) => rowOf.set(s.id, i));
    }
  }

  const positions = new Map<string, Positioned>();
  const labelByCol = new Map<number, string>();

  for (const c of colNums) {
    const col = cols.get(c)!;
    const rowCount = col.length;
    col.forEach((id) => {
      const row = rowOf.get(id) ?? 0;
      positions.set(id, {
        id,
        x: c * (NODE_W + COL_GAP),
        y: (row - (rowCount - 1) / 2) * (NODE_H + ROW_GAP),
        col: c,
        rowIndex: row,
        rowCount,
      });
    });
    const firstId: string | undefined = col[0];
    const first = firstId ? byId.get(firstId) : undefined;
    if (first) labelByCol.set(c, nameOfStage.get(first.stageId) ?? "");
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  }
  if (!positions.size) { minX = 0; minY = 0; maxX = NODE_W; maxY = NODE_H; }

  return { positions, width: maxX - minX, height: maxY - minY, minX, minY, labelByCol };
}
