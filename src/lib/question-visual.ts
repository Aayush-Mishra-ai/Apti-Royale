import { z } from "zod";

const text = z.string().min(1).max(200);
export const questionVisualSchema = z.union([
  z.object({ type: z.literal("image"), asset: z.enum(["lab-01"]), title: text, alt: text }),
  z.object({
    type: z.literal("table"), title: text,
    columns: z.array(text).min(2).max(6),
    rows: z.array(z.array(z.union([z.string().max(200), z.number().finite()]))).min(1).max(12),
  }).refine((v) => v.rows.every((r) => r.length === v.columns.length)),
  z.object({
    type: z.enum(["bar", "line"]), title: text, unit: text,
    data: z.array(z.object({ label: z.string().min(1).max(20), value: z.number().finite().min(0) })).min(2).max(8),
  }),
]);

export type QuestionVisual = z.infer<typeof questionVisualSchema>;

export function parseQuestionVisual(value: unknown): QuestionVisual | null {
  const result = questionVisualSchema.safeParse(value);
  return result.success ? result.data : null;
}