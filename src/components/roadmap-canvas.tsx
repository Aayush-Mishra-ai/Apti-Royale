import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KIND_COLOR, type Roadmap, type RoadmapNode } from "@/lib/roadmap-schema";
import { NODE_H, NODE_W, layoutRoadmap, type Positioned } from "@/lib/tree-layout";

interface CanvasProps {
  roadmap: Roadmap;
  known: Set<string>;
  frontier: Set<string>;
  onPath: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  fitSignal: number;
}

const MIN_K = 0.35;
const MAX_K = 1.8;

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function edgePath(a: Positioned, b: Positioned) {
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  const dx = Math.max(40, (x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function RoadmapCanvas({
  roadmap,
  known,
  frontier,
  onPath,
  selectedId,
  onSelect,
  fitSignal,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);

  const layout = useMemo(() => layoutRoadmap(roadmap.nodes, roadmap.stages), [roadmap.nodes, roadmap.stages]);
  const nodeById = useMemo(() => new Map(roadmap.nodes.map((n) => [n.id, n])), [roadmap.nodes]);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const pad = 90;
    const k = Math.max(MIN_K, Math.min((cw - pad) / layout.width, (ch - pad) / layout.height, 1));
    setView({
      k,
      x: (cw - layout.width * k) / 2 - layout.minX * k,
      y: (ch - layout.height * k) / 2 - layout.minY * k,
    });
  }, [layout]);

  useEffect(() => {
    fit();
  }, [fit, fitSignal]);

  // Zoom around the pointer.
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    setView((v) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const wx = (sx - v.x) / v.k;
      const wy = (sy - v.y) / v.k;
      return { k, x: sx - wx * k, y: sy - wy * k };
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Let clicks on nodes pass through to their own handler (no drag capture).
    if ((e.target as Element).closest("[data-node]")) return;
    dragRef.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setView((v) => ({ ...v, x: d.vx + (e.clientX - d.px), y: d.vy + (e.clientY - d.py) }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    const cx = el ? el.clientWidth / 2 : 0;
    const cy = el ? el.clientHeight / 2 : 0;
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const wx = (cx - v.x) / v.k;
      const wy = (cy - v.y) / v.k;
      return { k, x: cx - wx * k, y: cy - wy * k };
    });
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="map-surface h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg className="h-full w-full select-none">
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {/* Stage column headers */}
            {[...layout.labelByCol.entries()].map(([col, name]) => {
              const first = [...layout.positions.values()].find((p) => p.col === col);
              if (!first || !name) return null;
              return (
                <text
                  key={`stage-${col}`}
                  x={first.x + NODE_W / 2}
                  y={first.y - 90}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  fontSize={13}
                  letterSpacing={2}
                  style={{ textTransform: "uppercase" }}
                >
                  {name.toUpperCase()}
                </text>
              );
            })}

            {/* Edges */}
            {roadmap.nodes.map((n) => {
              const to = layout.positions.get(n.id);
              if (!to) return null;
              return n.prereqIds.map((pid) => {
                const from = layout.positions.get(pid);
                if (!from) return null;
                const lit = known.has(pid);
                const active = selectedId === n.id || selectedId === pid;
                return (
                  <path
                    key={`${pid}-${n.id}`}
                    d={edgePath(from, to)}
                    fill="none"
                    stroke={lit ? "var(--success)" : "var(--border)"}
                    strokeWidth={active ? 3 : lit ? 2 : 1.5}
                    strokeOpacity={active ? 0.95 : lit ? 0.7 : 0.5}
                    strokeDasharray={lit ? undefined : "5 5"}
                  />
                );
              });
            })}

            {/* Nodes */}
            {roadmap.nodes.map((n) => {
              const p = layout.positions.get(n.id);
              if (!p) return null;
              return (
                <CanvasNode
                  key={n.id}
                  node={nodeById.get(n.id)!}
                  pos={p}
                  isKnown={known.has(n.id)}
                  isFrontier={frontier.has(n.id)}
                  dimmed={!onPath.has(n.id) && !known.has(n.id)}
                  selected={selectedId === n.id}
                  onSelect={onSelect}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => zoomBy(1.25)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground shadow-md backdrop-blur transition hover:bg-accent"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(0.8)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground shadow-md backdrop-blur transition hover:bg-accent"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={fit}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground shadow-md backdrop-blur transition hover:bg-accent"
          aria-label="Fit map"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface NodeProps {
  node: RoadmapNode;
  pos: Positioned;
  isKnown: boolean;
  isFrontier: boolean;
  dimmed: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}

function CanvasNode({ node, pos, isKnown, isFrontier, dimmed, selected, onSelect }: NodeProps) {
  let fill = "var(--card)";
  let stroke = "var(--border)";
  if (isKnown) {
    fill = "color-mix(in oklab, var(--success) 16%, var(--card))";
    stroke = "var(--success)";
  } else if (isFrontier) {
    fill = "color-mix(in oklab, var(--primary) 10%, var(--card))";
    stroke = "var(--primary)";
  }

  return (
    <g
      data-node={node.id}
      transform={`translate(${pos.x},${pos.y})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      style={{ cursor: "pointer", opacity: dimmed ? 0.4 : 1, transition: "opacity 300ms" }}
    >
      {isFrontier && <rect x={-5} y={-5} width={NODE_W + 10} height={NODE_H + 10} rx={14} fill="none" stroke="var(--primary)" strokeOpacity={0.35} strokeWidth={1.5} className="node-pulse" />}
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={10}
        fill={fill}
        stroke={selected ? "var(--primary)" : stroke}
        strokeWidth={selected ? 2.5 : isFrontier ? 2 : 1.2}
      />
      <circle cx={20} cy={NODE_H / 2} r={4.5} fill={KIND_COLOR[node.kind]} />
      <text x={36} y={NODE_H / 2 - 4} fontSize={13} fontWeight={600} className="fill-foreground">
        {truncate(node.title, 24)}
      </text>
      <text x={36} y={NODE_H / 2 + 14} fontSize={10.5} className="fill-muted-foreground font-mono">
        {isKnown ? "✓ done" : `${node.estWeeks}w`}
      </text>
      {isKnown && (
        <text x={NODE_W - 18} y={NODE_H / 2 + 5} fontSize={13} className="fill-success" textAnchor="middle">
          ✓
        </text>
      )}
    </g>
  );
}
