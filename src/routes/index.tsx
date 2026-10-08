import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Compass, RotateCcw } from "lucide-react";
import { Landing } from "@/components/landing";
import { RoadmapCanvas } from "@/components/roadmap-canvas";
import { NodePanel } from "@/components/node-panel";
import { generateRoadmap } from "@/lib/roadmap.functions";
import {
  computeFrontier,
  computeOnPath,
  type Roadmap,
} from "@/lib/roadmap-schema";

const ROADMAP_KEY = "ascent:roadmap";
const KNOWN_KEY = "ascent:known";

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ascent — AI Career Roadmapper" },
      {
        name: "description",
        content:
          "Turn any dream job into an interactive, zoomable skill-tree roadmap. Click a node for AI coaching, mark skills known, and watch your path re-route.",
      },
      { property: "og:title", content: "Ascent — AI Career Roadmapper" },
      {
        property: "og:description",
        content: "Name your dream job. Get an interactive skill map you can climb, with AI coaching on every step.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fitSignal, setFitSignal] = useState(0);

  const generate = useServerFn(generateRoadmap);

  useEffect(() => {
    const savedRoadmap = loadJson<Roadmap>(ROADMAP_KEY);
    const savedKnown = loadJson<string[]>(KNOWN_KEY);
    if (savedRoadmap) setRoadmap(savedRoadmap);
    if (savedKnown) setKnown(new Set(savedKnown));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (roadmap) localStorage.setItem(ROADMAP_KEY, JSON.stringify(roadmap));
    else localStorage.removeItem(ROADMAP_KEY);
  }, [roadmap]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KNOWN_KEY, JSON.stringify([...known]));
  }, [known, hydrated]);

  const handleGenerate = useCallback(
    async (dreamJob: string, currentSkills?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await generate({ data: { dreamJob, currentSkills } });
        setRoadmap(result);
        setKnown(new Set());
        setSelectedId(null);
        setFitSignal((n) => n + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      } finally {
        setLoading(false);
      }
    },
    [generate]
  );

  const frontier = useMemo(() => (roadmap ? computeFrontier(roadmap.nodes, known) : new Set<string>()), [roadmap, known]);
  const onPath = useMemo(() => (roadmap ? computeOnPath(roadmap.nodes, known) : new Set<string>()), [roadmap, known]);
  const selected = roadmap?.nodes.find((n) => n.id === selectedId) ?? null;
  const progress = roadmap ? Math.round((known.size / roadmap.nodes.length) * 100) : 0;

  const toggleKnown = useCallback((id: string) => {
    setKnown((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!roadmap) {
    return <Landing onGenerate={handleGenerate} loading={loading} error={error} />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar */}
      <header className="z-20 flex items-center gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <Compass className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight text-foreground">{roadmap.title}</h1>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">{roadmap.summary}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden w-40 sm:block">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Climbed</span>
              <span>{known.size}/{roadmap.nodes.length}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="hidden font-mono text-sm font-semibold text-success md:inline">{progress}%</span>
          <button
            onClick={() => {
              if (confirm("Start over with a new dream job? Your current map will be replaced.")) {
                setRoadmap(null);
                setSelectedId(null);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New goal</span>
          </button>
        </div>
      </header>

      {/* Map + panel */}
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <RoadmapCanvas
            roadmap={roadmap}
            known={known}
            frontier={frontier}
            onPath={onPath}
            selectedId={selectedId}
            onSelect={setSelectedId}
            fitSignal={fitSignal}
          />
        </div>

        {selected && (
          <>
            {/* Mobile backdrop */}
            <div
              className="absolute inset-0 z-20 bg-black/50 md:hidden"
              onClick={() => setSelectedId(null)}
            />
            <NodePanel
              roadmap={roadmap}
              node={selected}
              isKnown={known.has(selected.id)}
              knownTitles={roadmap.nodes.filter((n) => known.has(n.id)).map((n) => n.title)}
              onClose={() => setSelectedId(null)}
              onToggleKnown={toggleKnown}
              onNavigate={setSelectedId}
            />
          </>
        )}
      </div>

      {/* Legend */}
      <footer className="z-10 flex items-center justify-center gap-4 border-t border-border bg-card/50 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Next up</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Known</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Locked</span>
        <span className="hidden sm:inline">Drag to pan · scroll to zoom · click a node</span>
      </footer>
    </div>
  );
}
