/**
 * Guided lessons: a lesson shown one screen at a time (opening → teaching pages → questions →
 * practice → review & submit). The lesson text lives in the database as dp_lesson_blocks rows of the
 * guided_* types below; nothing about any particular course is hardcoded here.
 *
 * SECURITY NOTE: the objective check's answer key is NOT part of any block. It lives in a
 * staff-only table and is only ever revealed by the dp_check_guided_answer function after the
 * student has chosen an option.
 */

export const GUIDED_BLOCK_TYPES = ["guided_intro", "guided_page", "guided_screen", "guided_note", "guided_check", "guided_question", "guided_exercise"] as const;

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
  /** A "How to use this course" style lesson: teaching pages only, no questions, practice or submit. */
  welcome: boolean;
  /** false = no separate opening screen; the first screen is the first teaching page. */
  opening: boolean;
}
export interface GuidedPage { page_id: string; title: string; body: string }
export interface GuidedCheck { check_id: string; prompt: string; options: string[] }
export interface GuidedQuestion { question_id: string; type: string; prompt: string; /** the response screen this question belongs to (sequenced lessons only) */ screen_id?: string }
export type ScreenItem = { kind: "question"; question_id: string } | { kind: "note"; title: string; body: string };
/** A screen of responses that belongs to one teaching page (or stands alone, like an exercise). */
export interface GuidedResponseScreen { screen_id: string; label: string; title: string; for_page: string; items: ScreenItem[] }
export type GuidedStep = { kind: "page"; index: number } | { kind: "responses"; screen_id: string };
export interface GuidedExercise { title: string; minutes: string; steps: string[]; response_prompt: string }

export interface GuidedLesson {
  intro: GuidedIntro | null;
  pages: GuidedPage[];
  check: GuidedCheck | null;
  questions: GuidedQuestion[];
  exercise: GuidedExercise | null;
  /** Sequenced lessons: teaching pages and their own response screens, in the order they are shown. Empty for the older layout. */
  screens: GuidedResponseScreen[];
  steps: GuidedStep[];
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
  const out: GuidedLesson = { intro: null, pages: [], check: null, questions: [], exercise: null, screens: [], steps: [] };
  let current: GuidedResponseScreen | null = null;
  for (const b of sorted) {
    const c = b.content ?? {};
    switch (b.block_type) {
      case "guided_intro":
        out.intro ??= { section_id: str(c.section_id), goal: str(c.goal), reading: strArray(c.reading), timing: str(c.timing), exercise_timing: str(c.exercise_timing), welcome: c.kind === "welcome", opening: c.opening !== false };
        break;
      case "guided_page":
        if (str(c.title) || str(c.body)) {
          out.pages.push({ page_id: str(c.page_id) || `page-${out.pages.length + 1}`, title: str(c.title), body: str(c.body) });
          out.steps.push({ kind: "page", index: out.pages.length - 1 });
          current = null;
        }
        break;
      case "guided_screen":
        current = { screen_id: str(c.screen_id) || `screen-${out.screens.length + 1}`, label: str(c.label) || "Questions", title: str(c.title), for_page: str(c.for_page), items: [] };
        out.screens.push(current);
        out.steps.push({ kind: "responses", screen_id: current.screen_id });
        break;
      case "guided_note":
        if (current && (str(c.title) || str(c.body))) current.items.push({ kind: "note", title: str(c.title), body: str(c.body) });
        break;
      case "guided_check":
        out.check ??= { check_id: str(c.check_id) || "check", prompt: str(c.prompt), options: strArray(c.options) };
        break;
      case "guided_question":
        if (str(c.prompt)) {
          const q: GuidedQuestion = { question_id: str(c.question_id) || `q${out.questions.length + 1}`, type: str(c.type) || "reflection", prompt: str(c.prompt) };
          if (current) {
            q.screen_id = current.screen_id;
            current.items.push({ kind: "question", question_id: q.question_id });
          }
          out.questions.push(q);
        }
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
  | { kind: "responses"; id: string }
  | { kind: "submit" };

/** True when the lesson shows each teaching page followed by its own response screen. */
export function isSequenced(g: GuidedLesson): boolean {
  return g.screens.length > 0;
}

/**
 * A welcome lesson (intro content.kind === "welcome") is read-only orientation: it has pages and
 * nothing to answer, so it shows its pages alone, with no opening, questions, practice or submit screen.
 */
export function isWelcomeLesson(g: GuidedLesson): boolean {
  return !!g.intro?.welcome && g.pages.length > 0 && !g.check && g.questions.length === 0 && !g.exercise;
}

/** The ordered screens: opening, each teaching page, then (only if present) questions, practice, and finally review & submit. */
export function buildScreens(g: GuidedLesson): Screen[] {
  if (isWelcomeLesson(g)) return g.pages.map((_, index) => ({ kind: "page" as const, index }));
  const screens: Screen[] = [];
  if (g.intro?.opening !== false || !isSequenced(g)) screens.push({ kind: "opening" });
  if (isSequenced(g)) {
    for (const st of g.steps) screens.push(st.kind === "page" ? { kind: "page", index: st.index } : { kind: "responses", id: st.screen_id });
    screens.push({ kind: "submit" });
    return screens;
  }
  g.pages.forEach((_, index) => screens.push({ kind: "page", index }));
  if (g.check || g.questions.length > 0) screens.push({ kind: "questions" });
  if (g.exercise) screens.push({ kind: "exercise" });
  screens.push({ kind: "submit" });
  return screens;
}

/** True when the draft holds anything the student actually did (an answer, a check choice, an exercise response). */
export function draftHasWork(d: GuidedDraft): boolean {
  return d.check.choice !== null || d.exercise.trim() !== "" || Object.values(d.answers).some((v) => v.trim() !== "");
}

/**
 * Where to open a lesson. A saved place is only honoured when real work was saved (clicking through the
 * pages does not count), and it never lands on "Review and submit" while something is still unanswered:
 * it goes to the first screen that has an unanswered question instead.
 */
export function resumeScreen(g: GuidedLesson, screens: Screen[], saved: GuidedDraft, contentVersion: number): number {
  if (saved.contentVersion !== contentVersion || !draftHasWork(saved)) return 0;
  const idx = clampScreen(saved.screen, screens.length);
  if (screens[idx]?.kind !== "submit" || validateForSubmit(g, saved).ok) return idx;
  const answered = (id: string) => (saved.answers[id] ?? "").trim() !== "";
  const first = screens.findIndex((s) => {
    if (s.kind === "responses") return g.screens.find((x) => x.screen_id === s.id)?.items.some((i) => i.kind === "question" && !answered(i.question_id)) ?? false;
    if (s.kind === "questions") return (!!g.check && saved.check.choice === null) || g.questions.some((q) => !answered(q.question_id));
    if (s.kind === "exercise") return saved.exercise.trim() === "";
    return false;
  });
  return first >= 0 ? first : idx;
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
  answers: { id: string; prompt: string; response: string; group?: string }[];
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
    answers: g.questions.map((q) => {
      const group = isSequenced(g) ? responseGroups(g).find((x) => x.questions.some((y) => y.question_id === q.question_id))?.title : undefined;
      return { id: q.question_id, prompt: q.prompt, response: (d.answers[q.question_id] ?? "").trim(), ...(group ? { group } : {}) };
    }),
    exercise: g.exercise ? { title: g.exercise.title, steps: g.exercise.steps, prompt: g.exercise.response_prompt, response: d.exercise.trim() } : null,
    submittedAt: now.toISOString()
  };
}

export function isGuidedSubmission(content: unknown): content is GuidedSubmissionContent {
  return !!content && typeof content === "object" && (content as any).kind === "guided_section" && Array.isArray((content as any).answers);
}

export interface ScreenInfo {
  /** e.g. "Teaching: Praise", "Questions: Praise", "Review and submit" */
  label: string;
  /** "Teaching" | "Questions" | "Exercise" | … (the kind of step, for compact progress) */
  kind: string;
}

/** Plain-language name of a screen, used for progress, announcements and the review list. */
export function screenInfo(g: GuidedLesson, s: Screen): ScreenInfo {
  switch (s.kind) {
    case "opening": return { label: "Lesson opening", kind: "Opening" };
    case "page": return { label: `Teaching: ${g.pages[s.index]?.title ?? ""}`, kind: "Teaching" };
    case "responses": {
      const r = g.screens.find((x) => x.screen_id === s.id);
      return { label: r ? `${r.label}: ${r.title}` : "Questions", kind: r?.label ?? "Questions" };
    }
    case "questions": return { label: "Questions", kind: "Questions" };
    case "exercise": return { label: g.exercise?.title ? `Practice: ${g.exercise.title}` : "Practice", kind: "Practice" };
    default: return { label: "Review and submit", kind: "Submit" };
  }
}

export interface ResponseGroup {
  /** the teaching page's title (or the exercise's title when the screen stands alone) */
  title: string;
  screen_id: string;
  questions: GuidedQuestion[];
}

/** The student's questions grouped under the teaching-page titles (sequenced lessons only). */
export function responseGroups(g: GuidedLesson): ResponseGroup[] {
  return g.screens
    .map((sc) => {
      const page = sc.for_page ? g.pages.find((p) => p.page_id === sc.for_page) : undefined;
      const ids = new Set(sc.items.flatMap((i) => (i.kind === "question" ? [i.question_id] : [])));
      return { title: page?.title ?? sc.title, screen_id: sc.screen_id, questions: g.questions.filter((q) => ids.has(q.question_id)) };
    })
    .filter((x) => x.questions.length > 0);
}

// ---------------------------------------------------------------------------
// Lesson body text: paragraphs plus light markup the instructor can type
//   "## Heading"            a sub-heading inside a page
//   "* item"                a bullet list (one item per line)
//   "> quoted line"         a Scripture quotation (one line per paragraph of the quote)
//   "—Reference"            a source line (last line of a paragraph or of a quote)
// ---------------------------------------------------------------------------
export type BodyNode =
  | { kind: "p"; lines: string[]; cite?: string }
  | { kind: "h"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "quote"; lines: string[]; cite?: string };

export function parseBody(body: string): BodyNode[] {
  const nodes: BodyNode[] = [];
  for (const block of body.split(/\n\s*\n/)) {
    const raw = block.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
    if (raw.length === 0) continue;
    if (raw.length === 1 && raw[0].startsWith("## ")) {
      nodes.push({ kind: "h", text: raw[0].slice(3).trim() });
      continue;
    }
    if (raw.every((l) => /^[*•] /.test(l))) {
      nodes.push({ kind: "list", items: raw.map((l) => l.slice(2).trim()) });
      continue;
    }
    const quoted = raw.every((l) => l === ">" || l.startsWith("> "));
    let lines = quoted ? raw.map((l) => l.slice(1).trim()).filter(Boolean) : raw.map((l) => l.trim());
    let cite: string | undefined;
    const last = lines[lines.length - 1];
    if (last && /^(—|--\s)/.test(last) && (lines.length > 1 || quoted)) {
      cite = last.replace(/^--\s/, "—");
      lines = lines.slice(0, -1);
    }
    nodes.push(quoted ? { kind: "quote", lines, cite } : { kind: "p", lines, cite });
  }
  return nodes;
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
