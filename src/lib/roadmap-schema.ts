import { z } from "zod";

export type NodeKind = "skill" | "project" | "credential" | "milestone";

export const roadmapNodeSchema = z.object({
  id: z.string(),
  stageId: z.string(),
  title: z.string(),
  kind: z.enum(["skill", "project", "credential", "milestone"]),
  description: z.string(),
  why: z.string(),
  prereqIds: z.array(z.string()).default([]),
  estWeeks: z.coerce.number().min(0).max(520),
});

export const roadmapSchema = z.object({
  title: z.string(),
  summary: z.string(),
  stages: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      timeframe: z.string(),
      goal: z.string(),
    })
  ),
  nodes: z.array(roadmapNodeSchema).min(6),
});

export type RoadmapNode = z.infer<typeof roadmapNodeSchema>;
export type RoadmapStage = z.infer<typeof roadmapSchema>["stages"][number];
export type Roadmap = z.infer<typeof roadmapSchema>;

export const nodeAdviceSchema = z.object({
  advice: z.string(),
  actions: z.array(z.string()).min(2).max(6),
  resources: z.array(z.string()).min(1).max(5),
  projectIdea: z.string(),
  pitfall: z.string(),
});

export type NodeAdvice = z.infer<typeof nodeAdviceSchema>;

export const KIND_LABEL: Record<NodeKind, string> = {
  skill: "Skill",
  project: "Project",
  credential: "Credential",
  milestone: "Milestone",
};

export const KIND_COLOR: Record<NodeKind, string> = {
  skill: "oklch(0.72 0.12 230)",
  project: "oklch(0.8 0.155 78)",
  credential: "oklch(0.72 0.15 300)",
  milestone: "oklch(0.78 0.16 163)",
};

/** Nodes whose prerequisites are all known but which aren't known yet — the re-routed "next steps". */
export function computeFrontier(nodes: RoadmapNode[], known: Set<string>): Set<string> {
  const frontier = new Set<string>();
  for (const n of nodes) {
    if (known.has(n.id)) continue;
    if (n.prereqIds.every((p) => known.has(p))) frontier.add(n.id);
  }
  return frontier;
}

/** Unknown nodes that still lie on a required path to an unknown milestone. Everything else is skippable. */
export function computeOnPath(nodes: RoadmapNode[], known: Set<string>): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const onPath = new Set<string>();

  const addWithAncestors = (id: string) => {
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (onPath.has(cur)) continue;
      onPath.add(cur);
      const n = byId.get(cur);
      if (n) for (const p of n.prereqIds) stack.push(p);
    }
  };

  for (const n of nodes) {
    if (n.kind === "milestone" && !known.has(n.id)) addWithAncestors(n.id);
  }
  // Nodes already known still show as done even if off-path.
  for (const id of known) onPath.add(id);
  return onPath;
}

export function stageOf(roadmap: Roadmap, stageId: string): RoadmapStage | undefined {
  return roadmap.stages.find((s) => s.id === stageId);
}
