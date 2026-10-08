import { useEffect, useState } from "react";
import { Compass, Loader2 } from "lucide-react";

interface LandingProps {
  onGenerate: (dreamJob: string, currentSkills?: string) => void;
  loading: boolean;
  error: string | null;
}

const EXAMPLES = [
  "Full Stack Dev at a climate tech startup",
  "ML Engineer at a self-driving car company",
  "Game developer at Nintendo",
  "Product Manager at Stripe",
];

const STAGES = [
  "Reading your goal…",
  "Mapping the skill graph…",
  "Sequencing stages and timeframes…",
  "Finding shortcuts you can skip…",
  "Drawing your map…",
];

export function Landing({ onGenerate, loading, error }: LandingProps) {
  const [dreamJob, setDreamJob] = useState("");
  const [skills, setSkills] = useState("");
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!loading) return;
    setStage(0);
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2600);
    return () => clearInterval(t);
  }, [loading]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 hero-glow" />
      <div className="relative z-10 w-full max-w-xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
          <Compass className="h-3.5 w-3.5 text-primary" />
          AI career roadmapper
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          As<span className="text-primary">cent</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-balance text-muted-foreground">
          Name your dream job. Get an interactive skill map you can climb — click any node for coaching,
          mark what you know, and watch the path re-route around it.
        </p>

        <form
          className="mt-10 space-y-3 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            if (dreamJob.trim().length >= 3) onGenerate(dreamJob.trim(), skills.trim() || undefined);
          }}
        >
          <label htmlFor="dream" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Your dream job
          </label>
          <input
            id="dream"
            value={dreamJob}
            onChange={(e) => setDreamJob(e.target.value)}
            placeholder="e.g. Full Stack Dev at a climate tech startup"
            maxLength={160}
            className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            disabled={loading}
          />

          <label htmlFor="skills" className="block pt-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            What do you already know? <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            id="skills"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="e.g. Python basics, built 2 small websites, 2nd year CS student"
            rows={2}
            maxLength={600}
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            disabled={loading}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading || dreamJob.trim().length < 3}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Building your map…
              </>
            ) : (
              "Map my path"
            )}
          </button>
        </form>

        {loading && (
          <p className="mt-4 font-mono text-xs text-muted-foreground transition-all">{STAGES[stage]}</p>
        )}

        {!loading && (
          <div className="mt-8">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Try one</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setDreamJob(ex)}
                  className="rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs text-foreground/80 transition hover:border-primary/60 hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
