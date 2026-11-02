import { z } from "zod";
import type { AssessmentDef } from "./types";

/**
 * Assessment A, "How Does God Speak to You?" — AWAITING SOURCE.
 * The original questions, answer wording and the seven reception categories come from the owner's document
 * ("From Vision to Reality - A 30-Day Journey to Establishing God's Plans 7.30.24.docx", Day 1). That document has not been supplied to this
 * build, so NO question text is written here and the assessment cannot be assigned. When the source is supplied, its wording is imported
 * verbatim with `parseHearingGodSource` (below) and the category-by-category engine (`summarizeHearingGod`) is used instead of the original numeric score.
 */
export const HEARING_GOD_PENDING: AssessmentDef = {
  kind: "hearing_god",
  title: "How Does God Speak to You?",
  intro: "",
  status: "awaiting_source",
  requiresTrack: "prophetic_worship",
  sections: []
};

export const HearingGodSource = z.object({
  title: z.string().min(1),
  intro: z.string().default(""),
  categories: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), instructorGuidance: z.string().default("") })).min(1),
  questions: z.array(z.object({
    id: z.string().min(1), text: z.string().min(1),
    options: z.array(z.object({ id: z.string().min(1), text: z.string().min(1), category: z.string().min(1) })).min(2)
  })).min(1)
}).superRefine((v, ctx) => {
  const cats = new Set(v.categories.map((c) => c.id));
  v.questions.forEach((q, i) => q.options.forEach((o, j) => { if (!cats.has(o.category)) ctx.addIssue({ code: "custom", message: `Unknown category "${o.category}"`, path: ["questions", i, "options", j] }); }));
});
export type HearingGodSourceT = z.infer<typeof HearingGodSource>;

export function parseHearingGodSource(raw: unknown): HearingGodSourceT { return HearingGodSource.parse(raw); }

/** Turns the verbatim source into an assignable definition. Each question is multi-select so a student may pick every option that fits. */
export function toDefinition(src: HearingGodSourceT): AssessmentDef {
  return {
    kind: "hearing_god", title: src.title, intro: src.intro, status: "ready", requiresTrack: "prophetic_worship",
    sections: [{ id: "main", title: src.title, questions: src.questions.map((q) => ({ id: q.id, type: "multi" as const, text: q.text, options: q.options.map((o) => o.text), topic: "reception" })) }]
  };
}

export interface CategoryResult { id: string; name: string; selections: number; share: number; prominent: boolean; instructorGuidance: string }
/**
 * Category-by-category self-reported pattern. NOT the original numeric score. Counts how often each category was selected; any category
 * within `closeness` of the most-selected one is "prominent", so several can stand out together. Interpretation is for the instructor
 * to discuss with the student; it is a self-report, not a verdict about how God speaks to anyone.
 */
export function summarizeHearingGod(src: HearingGodSourceT, answers: Record<string, string | string[]>, closeness = 0.75): CategoryResult[] {
  const counts = new Map(src.categories.map((c) => [c.id, 0]));
  for (const q of src.questions) {
    const picked = new Set([answers[q.id]].flat().filter(Boolean) as string[]);
    for (const o of q.options) if (picked.has(o.text)) counts.set(o.category, (counts.get(o.category) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const max = Math.max(0, ...counts.values());
  return src.categories.map((c) => {
    const n = counts.get(c.id) ?? 0;
    return { id: c.id, name: c.name, selections: n, share: total ? n / total : 0, prominent: max > 0 && n >= max * closeness, instructorGuidance: c.instructorGuidance };
  });
}
