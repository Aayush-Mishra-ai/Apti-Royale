import { useState } from "react";
import { X, Sparkles, CheckCircle2, Circle } from "lucide-react";
import { getNodeAdvice } from "@/lib/roadmap.functions";
import type { NodeAdvice } from "@/lib/roadmap-schema";
import {
  KIND_LABEL,
  KIND_COLOR,
  stageOf,
  type Roadmap,
  type RoadmapNode,
} from "@/lib/roadmap-schema";

interface PanelProps {
  roadmap: Roadmap;
  node: RoadmapNode;
  isKnown: boolean;
  knownTitles: string[];
  onClose: () => void;
  onToggleKnown: (id: string) => void;
  onNavigate: (id: string) => void;
}

export function NodePanel({ roadmap, node, isKnown, knownTitles, onClose, onToggleKnown, onNavigate }: PanelProps) {
  const [advice, setAdvice] = useState<NodeAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stage = stageOf(roadmap, node.stageId);

  const loadAdvice = async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = getNodeAdvice;
      const result = await fn({
        data: {
          nodeTitle: node.title,
          nodeDescription: node.description,
          kind: node.kind,
          dreamRole: roadmap.title,
          knownSkills: knownTitles,
        },
      });
      setAdvice(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const prereqs = roadmap.nodes.filter((n) => node.prereqIds.includes(n.id));

  return (
    <aside className="node-panel">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: KIND_COLOR[node.kind] }} />
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {KIND_LABEL[node.kind]}{stage ? ` · ${stage.name}` : ""}
            </span>
          </div>
          <h2 className="mt-1.5 truncate text-lg font-semibold text-foreground">{node.title}</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <p className="text-sm leading-relaxed text-foreground/90">{node.description}</p>
          <p className="mt-2 border-l-2 border-primary/50 pl-3 text-sm leading-relaxed text-muted-foreground italic">
            {node.why}
          </p>
          <div className="mt-3 flex gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="rounded bg-muted px-2 py-0.5">~{node.estWeeks} weeks</span>
            <span className="rounded bg-muted px-2 py-0.5">10 h/week</span>
          </div>
        </div>

        {prereqs.length > 0 && (
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Unlocks after</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {prereqs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onNavigate(p.id)}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground transition hover:border-primary/60"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI advice */}
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Coach says</h3>
          </div>

          {!advice && !loading && !error && (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Get specific guidance for this step — actions, free resources and a practice idea.
              </p>
              <button
                onClick={loadAdvice}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate advice
              </button>
            </>
          )}

          {loading && (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${90 - i * 15}%` }} />
              ))}
            </div>
          )}

          {error && (
            <div className="mt-2">
              <p className="text-sm text-destructive">{error}</p>
              <button onClick={loadAdvice} className="mt-2 text-sm font-medium text-primary underline">
                Retry
              </button>
            </div>
          )}

          {advice && (
            <div className="mt-3 space-y-3 text-sm">
              <p className="leading-relaxed text-foreground/90">{advice.advice}</p>
              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Do this</h4>
                <ul className="mt-1.5 space-y-1.5">
                  {advice.actions.map((a, i) => (
                    <li key={i} className="flex gap-2 leading-snug text-foreground/90">
                      <span className="mt-0.5 font-mono text-[11px] text-primary">{String(i + 1).padStart(2, "0")}</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Free resources</h4>
                <ul className="mt-1.5 space-y-1">
                  {advice.resources.map((r, i) => (
                    <li key={i} className="leading-snug text-foreground/80">· {r}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-foreground/90"><span className="font-medium text-primary">Try:</span> {advice.projectIdea}</p>
              </div>
              <p className="text-muted-foreground"><span className="font-medium text-destructive">Watch out:</span> {advice.pitfall}</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border px-5 py-4">
        <button
          onClick={() => onToggleKnown(node.id)}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            isKnown
              ? "border border-success/40 bg-success/10 text-success"
              : "bg-success text-success-foreground hover:bg-success/90"
          }`}
        >
          {isKnown ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          {isKnown ? "Marked as known — tap to undo" : "I already know this"}
        </button>
      </div>
    </aside>
  );
}
