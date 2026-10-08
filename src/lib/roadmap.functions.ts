import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  roadmapSchema,
  nodeAdviceSchema,
  type Roadmap,
  type NodeAdvice,
} from "./roadmap-schema";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callAI(system: string, user: string, jsonSchema: object): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured. Add the AI Gateway key and retry.");

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "output", strict: true, schema: jsonSchema } },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`The AI service returned an error (${res.status}). ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("The AI service returned an empty response. Try again.");
  return content;
}

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error("Could not read the AI response. Try again.");
  }
}

const roadmapJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "stages", "nodes"],
  properties: {
    title: { type: "string", description: "Short inspiring roadmap title" },
    summary: { type: "string", description: "2-3 sentence plan overview addressed to the learner" },
    stages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "timeframe", "goal"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          timeframe: { type: "string", description: "e.g. 'Months 1-2'" },
          goal: { type: "string" },
        },
      },
    },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "stageId", "title", "kind", "description", "why", "prereqIds", "estWeeks"],
        properties: {
          id: { type: "string" },
          stageId: { type: "string" },
          title: { type: "string", description: "Max 40 chars" },
          kind: { type: "string", enum: ["skill", "project", "credential", "milestone"] },
          description: { type: "string", description: "1-2 sentences, concrete" },
          why: { type: "string", description: "Why this matters for the dream role" },
          prereqIds: { type: "array", items: { type: "string" } },
          estWeeks: { type: "number", description: "Realistic weeks at ~10h/week" },
        },
      },
    },
  },
};

export const generateRoadmap = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        dreamJob: z.string().min(3).max(160),
        currentSkills: z.string().max(600).optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }): Promise<Roadmap> => {
    const system = [
      "You are an expert career coach who builds dependency-based learning roadmaps as DAGs.",
      "Rules:",
      "- 4 to 6 stages, 16 to 26 total nodes.",
      "- Every node's prereqIds must reference node ids that appear EARLIER in the nodes array (no cycles, no self-reference).",
      "- First-stage nodes have empty prereqIds. Every later node has 1-3 prereqs.",
      "- Each stage ends with one 'milestone' node synthesizing the stage.",
      "- Mix kinds: mostly skills, 3-5 projects, 1-3 credentials/certifications where genuinely valued.",
      "- estWeeks must be realistic for ~10 hours/week of effort. Total should match stage timeframes.",
      "- Be specific: name actual technologies, companies, exam names, portfolio pieces — not generic advice.",
      "- If the learner already listed skills, do not make those prerequisites; route around them or deepen them.",
      "- Titles max 40 characters. No emoji.",
    ].join("\n");

    const user = [
      `Dream role: ${data.dreamJob}`,
      data.currentSkills?.trim()
        ? `Already known / current position: ${data.currentSkills.trim()}`
        : "Already known: nothing specified, assume a motivated beginner.",
      "Build the roadmap JSON now.",
    ].join("\n");

    const raw = await callAI(system, user, roadmapJsonSchema);
    const parsed = roadmapSchema.safeParse(extractJson(raw));
    if (!parsed.success) throw new Error("The AI produced an invalid roadmap. Try generating again.");
    return parsed.data;
  });

const adviceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["advice", "actions", "resources", "projectIdea", "pitfall"],
  properties: {
    advice: { type: "string", description: "2-3 sentences of specific guidance for this node" },
    actions: { type: "array", items: { type: "string" }, description: "3-5 concrete next actions" },
    resources: { type: "array", items: { type: "string" }, description: "2-4 named free/cheap resources (course, book, docs, YouTube channel)" },
    projectIdea: { type: "string", description: "One mini-project to prove this skill" },
    pitfall: { type: "string", description: "The most common mistake learners make here" },
  },
};

export const getNodeAdvice = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        nodeTitle: z.string(),
        nodeDescription: z.string(),
        kind: z.string(),
        dreamRole: z.string(),
        knownSkills: z.array(z.string()).max(60),
      })
      .parse(data)
  )
  .handler(async ({ data }): Promise<NodeAdvice> => {
    const system =
      "You are a sharp, no-fluff career coach. Give specific, current, actionable advice. Name real resources (docs, courses, books, channels). Never invent paid credentials. Reply with JSON only.";
    const user = [
      `Dream role: ${data.dreamRole}`,
      `Learner has already covered: ${data.knownSkills.join(", ") || "nothing yet"}`,
      `Current step (${data.kind}): ${data.nodeTitle} — ${data.nodeDescription}`,
    ].join("\n");
    const raw = await callAI(system, user, adviceJsonSchema);
    const parsed = nodeAdviceSchema.safeParse(extractJson(raw));
    if (!parsed.success) throw new Error("Could not read the advice. Try again.");
    return parsed.data;
  });
