import { describe, expect, it } from "vitest";
import { parseQuestionVisual } from "@/lib/question-visual";

describe("visual question payloads", () => {
  it("accepts all supported question stimuli", () => {
    expect(parseQuestionVisual({ type: "image", asset: "lab-01", title: "Instrument", alt: "Laboratory instrument" })?.type).toBe("image");
    expect(parseQuestionVisual({ type: "table", title: "Sales", columns: ["Month", "Units"], rows: [["Jan", 40]] })?.type).toBe("table");
    for (const type of ["bar", "line"]) expect(parseQuestionVisual({ type, title: "Sales", unit: "units", data: [{ label: "Jan", value: 40 }, { label: "Feb", value: 60 }] })?.type).toBe(type);
  });
  it("rejects malformed table rows and unsafe image assets", () => {
    expect(parseQuestionVisual({ type: "table", title: "Sales", columns: ["Month", "Units"], rows: [["Jan"]] })).toBeNull();
    expect(parseQuestionVisual({ type: "image", asset: "javascript:alert(1)", title: "Image", alt: "Image" })).toBeNull();
  });
  it("omits answer metadata from validated stimulus data", () => {
    expect(parseQuestionVisual({ type: "image", asset: "lab-01", title: "Instrument", alt: "Instrument", correct_index: 2 })).not.toHaveProperty("correct_index");
  });
  it("keeps existing text-only questions compatible", () => {
    expect(parseQuestionVisual(null)).toBeNull();
  });
});