/** Assessment definitions and answers. Definitions live in code (reviewed in PRs); answers are stored per student in the database. */
export type QuestionType = "single" | "multi" | "text" | "recording";
export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  /** Everything is optional by default: students may skip any question. */
  required?: boolean;
  /** Which part of the picture this answers (used for the instructor summary; never a score). */
  topic?: string;
  help?: string;
}
export type AssessmentKind = "personal_time" | "creative_expression" | "hearing_god";
export interface AssessmentDef {
  kind: AssessmentKind;
  title: string;
  intro: string;
  /** "ready": can be assigned. "awaiting_source": the original wording has not been supplied, so it cannot be assigned. */
  status: "ready" | "awaiting_source";
  /** Prophetic-reception material is offered only when the student chose Prophetic Worship Development. */
  requiresTrack?: "prophetic_worship";
  /** True when the student answers it alone; false when it also has an instructor observation part. */
  sections: { id: string; title: string; description?: string; questions: Question[] }[];
}
export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;
export const PREFER_NOT = "Prefer not to answer";
export const isAnswered = (v: AnswerValue | undefined) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim().length > 0);
export const questionsOf = (d: AssessmentDef) => d.sections.flatMap((s) => s.questions);
