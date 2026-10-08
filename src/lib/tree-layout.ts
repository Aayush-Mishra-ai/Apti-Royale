import type { RoadmapNode } from "./roadmap-schema";

export const NODE_W = 196;
export const NODE_H = 66;
const COL_GAP = 120;
const ROW_GAP = 28;

export interface Positioned {
  id: string;
  x: number; // top-left
  y: number; // top-left
  depth: number;
  colIndex: number;
  colCount: number;
}

export interface TreeLayout {
  positions: Map<string, Positioned>;
  width: number;
  height: number;
  minX: number;
  minY: number;
  stageByDepth: Map<number, string>;
}

/**
 * Layered DAG layout: x from dependency depth, y from barycenter ordering
 * (children pulled toward their parents) to keep edges clean.
 */
export function layoutRoadmap(nodes: RoadmapNode[], stageNameById: Map<string, string>): TreeLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depthMemo = new Map<string, number>();
  const visiting = new Set<string>();

  const depthOf = (id: string): number => {
    const memo = depthMemo.get(id);
    if (memo !== undefined) return memo;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    const n = byId.get(id);
    if (n) for (const p of n.prereqIds) if (byId.has(p)) d = Math.max(d, depthOf(p) + 1);
    visiting.delete(id);
    depthMemo.set(id, d);
    return d;
  };
  nodes.forEach((n) => depthOf(n.id));

  const cols = new Map<number, string[]>();
  for (const n of nodes) {
    const d = depthMemo.get(n.id) ?? 0;
    if (!cols.has(d)) cols.set(d, []);
    cols.get(d)!.push(n.id);
  }
  const depths = [...cols.keys()].sort((a, b) => a - b);

  const rowOf = new Map<string, number>();
  for (let iter = 0; iter < 8; iter++) {
    for (const d of depths) {
      const col = cols.get(d)!;
      const scored = col.map((id) => {
        const n = byId.get(id)!;
        const parentRows = n.prereqIds.filter((p) => rowOf.has(p)).map((p) => rowOf.get(p)!);
        const score = parentRows.length
          ? parentRows.reduce((a, b) => a + b, 0) / parentRows.length
          : col.indexOf(id) + iter * 0; // stable fallback keeps initial order
        return { id, score, fallback: col.indexOf(id) };
      });
      scored.sort((a, b) => (a.score === b.score ? a.fallback - b.fallback : a.score - b.score));
      scored.forEach((s, i) => rowOf.set(s.id, i));
    }
  }

  const positions = new Map<string, Positioned>();
  const stageByDepth = new Map<number, string>();

  for (const d of depths) {
    const col = cols.get(d)!;
    const rowCount = col.length;
    col.forEach((id) => {
      const row = rowOf.get(id) ?? 0;
      positions.set(id, {
        id,
        x: d * (NODE_W + COL_GAP),
        y: (row - (rowCount - 1) / 2) * (NODE_H + ROW_GAP),
        depth: d,
        colIndex: row,
        colCount: rowCount,
      });
    });
    // Stage label for the column = stage of its first node (nodes are stage-ordered by the AI).
    const first = byId.get(col[0]);
    if (first) stageByDepth.set(d, stageNameById.get(first.stageId) ?? "");
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  }
  if (!positions.size) { minX = 0; minY = 0; maxX = NODE_W; maxY = NODE_H; }

  return { positions, width: maxX - minX, height: maxY - minY, minX, minY, stageByDepth };
}
