/**
 * Guided lessons: a lesson shown one screen at a time (opening → teaching pages → questions →
 * practice → review & submit). The lesson text lives in the database as dp_lesson_blocks rows of the
 * guided_* types below; nothing about any particular course is hardcoded here.
 *
 * SECURITY NOTE: the objective check's answer key is NOT part of any block. It lives in a
 * staff-only table and is only ever revealed by the dp_check_guided_answer function after the
 * student has chosen an option.
 */

export const GUIDED_BLOCK_TYPES = ["guided_intro", "guided_page", "guided_check", "guided_question", "guided_exercise"] as const;

export interface RawBlock {
  id?: string;
  block_type: string;
  order_index: number;
  content: Record<string, any>;
}

export interface GuidedIntro {
  section_id: string;
  goal: string;
  reading: string[];
  timing: string;
  exercise_timing: string;
}
export interface GuidedPage { page_id: string; title: string; body: string }
export interface GuidedCheck { check_id: string; prompt: string; options: string[] }
export interface GuidedQuestion { question_id: string; type: string; prompt: string }
export interface GuidedExercise { title: string; minutes: string; steps: string[]; response_prompt: string }

export interface GuidedLesson {
  intro: GuidedIntro | null;
  pages: GuidedPage[];
  check: GuidedCheck | null;
  questions: GuidedQuestion[];
  exercise: GuidedExercise | null;
}

export const MAX_REFLECTION_CHARS = 5000;
export const MAX_EXERCISE_CHARS = 10000;

export function isGuidedLesson(blocks: { block_type: string }[]): boolean {
  return blocks.some((b) => b.block_type === "guided_page");
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strArray = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Blocks → the lesson model, in block order. Unknown or malformed pieces are skipped, never thrown on. */
export function parseGuidedLesson(blocks: RawBlock[]): GuidedLesson {
  const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index);
  const out: GuidedLesson = { intro: null, pages: [], check: null, questions: [], exercise: null };
  for (const b of sorted) {
    const c = b.content ?? {};
    switch (b.block_type) {
      case "guided_intro":
        out.intro ??= { section_id: str(c.section_id), goal: str(c.goal), reading: strArray(c.reading), timing: str(c.timing), exercise_timing: str(c.exercise_timing) };
        break;
      case "guided_page":
        if (str(c.title) || str(c.body)) out.pages.push({ page_id: str(c.page_id) || `page-${out.pages.length + 1}`, title: str(c.title), body: str(c.body) });
        break;
      case "guided_check":
        out.check ??= { check_id: str(c.check_id) || "check", prompt: str(c.prompt), options: strArray(c.options) };
        break;
      case "guided_question":
        if (str(c.prompt)) out.questions.push({ question_id: str(c.question_id) || `q${out.questions.length + 1}`, type: str(c.type) || "reflection", prompt: str(c.prompt) });
        break;
      case "guided_exercise":
        out.exercise ??= { title: str(c.title) || "Practice", minutes: str(c.minutes), steps: strArray(c.steps), response_prompt: str(c.response_prompt) };
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
export type Screen =
  | { kind: "opening" }
  | { kind: "page"; index: number }
  | { kind: "questions" }
  | { kind: "exercise" }
  | { kind: "submit" };

/** The ordered screens: opening, each teaching page, then (only if present) questions, practice, and finally review & submit. */
export function buildScreens(g: GuidedLesson): Screen[] {
  const screens: Screen[] = [{ kind: "opening" }];
  g.pages.forEach((_, index) => screens.push({ kind: "page", index }));
  if (g.check || g.questions.length > 0) screens.push({ kind: "questions" });
  if (g.exercise) screens.push({ kind: "exercise" });
  screens.push({ kind: "submit" });
  return screens;
}

export function clampScreen(i: unknown, total: number): number {
  const n = typeof i === "number" && Number.isFinite(i) ? Math.trunc(i) : 0;
  return Math.min(Math.max(n, 0), Math.max(total - 1, 0));
}

/** "5-10 including …" → "5–10 including …" (a real en dash between numbers). */
export function prettyRange(text: string): string {
  return text.replace(/(\d)\s*-\s*(\d)/g, "$1–$2");
}

// ---------------------------------------------------------------------------
// Keyboard navigation (must never fire while someone is typing)
// ---------------------------------------------------------------------------
export interface KeyLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  defaultPrevented?: boolean;
  target?: unknown;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION"]);

export function isTypingTarget(target: unknown): boolean {
  const t = target as { tagName?: string; isContentEditable?: boolean; getAttribute?: (n: string) => string | null } | null | undefined;
  if (!t || typeof t !== "object") return false;
  if (t.tagName && TYPING_TAGS.has(t.tagName.toUpperCase())) return true;
  if (t.isContentEditable) return true;
  const role = t.getAttribute?.("role");
  return role === "textbox" || role === "combobox" || role === "listbox" || role === "slider" || role === "spinbutton";
}

/** Returns "next" / "prev" for a plain ArrowRight / ArrowLeft, otherwise null. */
export function arrowDirection(e: KeyLike): "next" | "prev" | null {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  if (isTypingTarget(e.target)) return null;
  if (e.key === "ArrowRight") return "next";
  if (e.key === "ArrowLeft") return "prev";
  return null;
}

// ---------------------------------------------------------------------------
// Draft + submission shapes
// ---------------------------------------------------------------------------
export interface GuidedDraft {
  v: 1;
  contentVersion: number;
  screen: number;
  check: { choice: number | null; correct: boolean | null };
  answers: Record<string, string>;
  exercise: string;
}

export function emptyDraft(contentVersion: number): GuidedDraft {
  return { v: 1, contentVersion, screen: 0, check: { choice: null, correct: null }, answers: {}, exercise: "" };
}

/** Defensive read of whatever is stored in dp_lesson_drafts.content. */
export function normalizeDraft(raw: unknown, contentVersion: number): GuidedDraft {
  const d = emptyDraft(contentVersion);
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, any>;
  if (typeof r.contentVersion === "number") d.contentVersion = r.contentVersion;
  if (typeof r.screen === "number") d.screen = Math.max(0, Math.trunc(r.screen));
  if (r.check && typeof r.check === "object") {
    d.check.choice = Number.isInteger(r.check.choice) ? r.check.choice : null;
    d.check.correct = typeof r.check.correct === "boolean" ? r.check.correct : null;
  }
  if (r.answers && typeof r.answers === "object") {
    for (const [k, v] of Object.entries(r.answers)) if (typeof v === "string") d.answers[k] = v.slice(0, MAX_REFLECTION_CHARS);
  }
  if (typeof r.exercise === "string") d.exercise = r.exercise.slice(0, MAX_EXERCISE_CHARS);
  return d;
}

export interface SubmitCheck {
  ok: boolean;
  missing: string[];
}

/** Everything required before a student may submit for review. */
export function validateForSubmit(g: GuidedLesson, d: GuidedDraft): SubmitCheck {
  const missing: string[] = [];
  if (g.check) {
    if (d.check.choice === null || d.check.choice < 0 || d.check.choice >= g.check.options.length) missing.push("Answer the knowledge check");
  }
  g.questions.forEach((q, i) => {
    if (!(d.answers[q.question_id] ?? "").trim()) missing.push(`Answer reflection question ${i + 1}`);
  });
  if (g.exercise && !d.exercise.trim()) missing.push("Write your practice response");
  return { ok: missing.length === 0, missing };
}

export interface GuidedSubmissionContent {
  kind: "guided_section";
  version: 1;
  lessonId: string;
  contentVersion: number;
  sectionTitle: string;
  check: { id: string; prompt: string; options: string[]; choice: number | null; choiceText: string; correct: boolean | null } | null;
  answers: { id: string; prompt: string; response: string }[];
  exercise: { title: string; steps: string[]; prompt: string; response: string } | null;
  submittedAt: string;
}

/**
 * The snapshot stored in dp_submissions.content. It carries the prompts the student actually saw,
 * so later edits to the lesson (new content versions) never change what a past submission means.
 */
export function buildSubmissionContent(g: GuidedLesson, lessonId: string, sectionTitle: string, contentVersion: number, d: GuidedDraft, now = new Date()): GuidedSubmissionContent {
  return {
    kind: "guided_section",
    version: 1,
    lessonId,
    contentVersion,
    sectionTitle,
    check: g.check
      ? {
          id: g.check.check_id,
          prompt: g.check.prompt,
          options: g.check.options,
          choice: d.check.choice,
          choiceText: d.check.choice !== null ? (g.check.options[d.check.choice] ?? "") : "",
          correct: d.check.correct
        }
      : null,
    answers: g.questions.map((q) => ({ id: q.question_id, prompt: q.prompt, response: (d.answers[q.question_id] ?? "").trim() })),
    exercise: g.exercise ? { title: g.exercise.title, steps: g.exercise.steps, prompt: g.exercise.response_prompt, response: d.exercise.trim() } : null,
    submittedAt: now.toISOString()
  };
}

export function isGuidedSubmission(content: unknown): content is GuidedSubmissionContent {
  return !!content && typeof content === "object" && (content as any).kind === "guided_section" && Array.isArray((content as any).answers);
}

/** Paragraphs for display: blank-line separated, single line breaks kept inside a paragraph. */
export function toParagraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export type SubmissionStatus = "submitted" | "returned" | "revised" | "approved" | "exempt";

/** What the student may do, given the submission they already have (mirrors the database guard). */
export function studentCanEdit(status: SubmissionStatus | null): boolean {
  return status === null || status === "returned";
}

/**
 * Timing text from the course data → a sentence fragment. "5-10 including core reading and pauses"
 * → "About 5–10 minutes, including core reading and pauses". These are estimates, never promises per page.
 */
export function minutesLabel(text: string): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const m = t.match(/^(\d+\s*[-–]\s*\d+|\d+)\s*(?:minutes?|min)?\s*(.*)$/i);
  if (!m) return t;
  const range = prettyRange(m[1]).replace(/\s+/g, "");
  const rest = m[2].trim();
  return `About ${range} minutes${rest ? `, ${rest}` : ""}`;
}

/** A returned submission becomes the starting point for the student's revision. */
export function draftFromSubmission(content: unknown, contentVersion: number): GuidedDraft {
  const d = emptyDraft(contentVersion);
  if (!isGuidedSubmission(content)) return d;
  for (const a of content.answers) if (a && typeof a.id === "string" && typeof a.response === "string") d.answers[a.id] = a.response.slice(0, MAX_REFLECTION_CHARS);
  if (content.exercise && typeof content.exercise.response === "string") d.exercise = content.exercise.response.slice(0, MAX_EXERCISE_CHARS);
  if (content.check && Number.isInteger(content.check.choice)) {
    d.check.choice = content.check.choice;
    d.check.correct = typeof content.check.correct === "boolean" ? content.check.correct : null;
  }
  return d;
}
