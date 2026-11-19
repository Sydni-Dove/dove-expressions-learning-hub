import { describe, it, expect } from "vitest";
import {
  arrowDirection, buildScreens, buildSubmissionContent, clampScreen, draftFromSubmission, emptyDraft, isGuidedLesson, isWelcomeLesson,
  minutesLabel, normalizeDraft, parseGuidedLesson, prettyRange, studentCanEdit, toParagraphs, validateForSubmit, type RawBlock
} from "@/lib/guided-lesson";

// All content below is synthetic placeholder text (the repository is public).
const blocks: RawBlock[] = [
  { block_type: "guided_exercise", order_index: 9, content: { title: "Synthetic exercise", minutes: "10-15", steps: ["One", "Two"], response_prompt: "Write it" } },
  { block_type: "guided_page", order_index: 1, content: { page_id: "page-1", title: "Page A", body: "First.\n\nSecond." } },
  { block_type: "guided_intro", order_index: 0, content: { section_id: "s1", goal: "A goal", reading: ["Ref 1:1", 5, "Ref 2:2"], timing: "5-10 including pauses", exercise_timing: "10-25" } },
  { block_type: "guided_page", order_index: 2, content: { page_id: "page-2", title: "Page B", body: "Body B" } },
  { block_type: "guided_check", order_index: 3, content: { check_id: "check", prompt: "Pick one", options: ["x", "y", "z"] } },
  { block_type: "guided_question", order_index: 4, content: { question_id: "q1", type: "reflection", prompt: "Q one?" } },
  { block_type: "guided_question", order_index: 5, content: { question_id: "q2", type: "reflection", prompt: "Q two?" } },
  { block_type: "written", order_index: 6, content: { body: "ignored" } }
];

describe("parseGuidedLesson", () => {
  const g = parseGuidedLesson(blocks);
  it("orders by block order and keeps each piece", () => {
    expect(g.intro?.goal).toBe("A goal");
    expect(g.intro?.reading).toEqual(["Ref 1:1", "Ref 2:2"]); // non-strings dropped
    expect(g.pages.map((p) => p.title)).toEqual(["Page A", "Page B"]);
    expect(g.check?.options).toEqual(["x", "y", "z"]);
    expect(g.questions.map((q) => q.question_id)).toEqual(["q1", "q2"]);
    expect(g.exercise?.steps).toEqual(["One", "Two"]);
  });
  it("detects guided lessons and ignores other block types", () => {
    expect(isGuidedLesson(blocks)).toBe(true);
    expect(isGuidedLesson([{ block_type: "written" }])).toBe(false);
  });
  it("never throws on malformed content", () => {
    expect(() => parseGuidedLesson([{ block_type: "guided_page", order_index: 0, content: null as any }, { block_type: "guided_check", order_index: 1, content: { options: "nope" } }])).not.toThrow();
  });
  it("carries no answer key: a check block only has a prompt and options", () => {
    expect(JSON.stringify(g)).not.toMatch(/correct/i);
  });
});

describe("screens", () => {
  it("opening, one screen per page, then questions, practice, submit — in that order", () => {
    const s = buildScreens(parseGuidedLesson(blocks)).map((x) => (x.kind === "page" ? `page${x.index}` : x.kind));
    expect(s).toEqual(["opening", "page0", "page1", "questions", "exercise", "submit"]);
  });
  it("omits questions/practice when the lesson has none", () => {
    const g = parseGuidedLesson(blocks.filter((b) => b.block_type === "guided_page"));
    expect(buildScreens(g).map((x) => x.kind)).toEqual(["opening", "page", "page", "submit"]);
  });
  it("clamps the screen index", () => {
    expect(clampScreen(-3, 6)).toBe(0);
    expect(clampScreen(99, 6)).toBe(5);
    expect(clampScreen("x", 6)).toBe(0);
  });
});

describe("keyboard arrows never interfere with typing", () => {
  const key = (k: string, target: any, extra: any = {}) => ({ key: k, target, ...extra });
  it("moves on a plain arrow from the page", () => {
    expect(arrowDirection(key("ArrowRight", { tagName: "BODY" }))).toBe("next");
    expect(arrowDirection(key("ArrowLeft", { tagName: "DIV" }))).toBe("prev");
  });
  it("ignores arrows while typing or choosing in form controls", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) expect(arrowDirection(key("ArrowRight", { tagName }))).toBeNull();
    expect(arrowDirection(key("ArrowLeft", { tagName: "DIV", isContentEditable: true }))).toBeNull();
    expect(arrowDirection(key("ArrowLeft", { tagName: "DIV", getAttribute: (n: string) => (n === "role" ? "textbox" : null) }))).toBeNull();
  });
  it("ignores modified arrows and other keys", () => {
    expect(arrowDirection(key("ArrowRight", { tagName: "BODY" }, { altKey: true }))).toBeNull();
    expect(arrowDirection(key("ArrowRight", { tagName: "BODY" }, { metaKey: true }))).toBeNull();
    expect(arrowDirection(key("ArrowRight", { tagName: "BODY" }, { shiftKey: true }))).toBeNull();
    expect(arrowDirection(key("ArrowUp", { tagName: "BODY" }))).toBeNull();
    expect(arrowDirection(key("ArrowRight", { tagName: "BODY" }, { defaultPrevented: true }))).toBeNull();
  });
});

describe("drafts and submission", () => {
  const g = parseGuidedLesson(blocks);
  it("normalizeDraft is defensive", () => {
    expect(normalizeDraft(null, 3)).toEqual(emptyDraft(3));
    const d = normalizeDraft({ screen: -4, contentVersion: 2, check: { choice: "x" }, answers: { q1: "hi", q2: 5 }, exercise: 9 }, 3);
    expect(d.screen).toBe(0);
    expect(d.contentVersion).toBe(2);
    expect(d.check.choice).toBeNull();
    expect(d.answers).toEqual({ q1: "hi" });
    expect(d.exercise).toBe("");
  });
  it("requires every item before submitting, and names what is missing", () => {
    const empty = validateForSubmit(g, emptyDraft(1));
    expect(empty.ok).toBe(false);
    expect(empty.missing).toEqual(["Answer the knowledge check", "Answer reflection question 1", "Answer reflection question 2", "Write your practice response"]);
    const full = validateForSubmit(g, { ...emptyDraft(1), check: { choice: 1, correct: true }, answers: { q1: "a", q2: " b " }, exercise: "done" });
    expect(full).toEqual({ ok: true, missing: [] });
    expect(validateForSubmit(g, { ...emptyDraft(1), check: { choice: 1, correct: null }, answers: { q1: "a", q2: "   " }, exercise: "done" }).ok).toBe(false);
    expect(validateForSubmit(g, { ...emptyDraft(1), check: { choice: 9, correct: null }, answers: { q1: "a", q2: "b" }, exercise: "x" }).ok).toBe(false);
  });
  it("the submission snapshot keeps the prompts the student saw", () => {
    const d = { ...emptyDraft(4), check: { choice: 2, correct: false }, answers: { q1: " mine ", q2: "two" }, exercise: " practiced " };
    const c = buildSubmissionContent(g, "lesson-1", "Section X", 4, d, new Date("2026-01-02T03:04:05Z"));
    expect(c).toMatchObject({ kind: "guided_section", version: 1, lessonId: "lesson-1", contentVersion: 4, sectionTitle: "Section X", submittedAt: "2026-01-02T03:04:05.000Z" });
    expect(c.check).toMatchObject({ prompt: "Pick one", choice: 2, choiceText: "z", correct: false });
    expect(c.answers).toEqual([{ id: "q1", prompt: "Q one?", response: "mine" }, { id: "q2", prompt: "Q two?", response: "two" }]);
    expect(c.exercise).toMatchObject({ title: "Synthetic exercise", response: "practiced" });
  });
  it("a returned submission restores into an editable draft", () => {
    const c = buildSubmissionContent(g, "l", "S", 1, { ...emptyDraft(1), check: { choice: 0, correct: true }, answers: { q1: "one", q2: "two" }, exercise: "ex" });
    const d = draftFromSubmission(c, 1);
    expect(d.answers).toEqual({ q1: "one", q2: "two" });
    expect(d.exercise).toBe("ex");
    expect(d.check).toEqual({ choice: 0, correct: true });
    expect(draftFromSubmission({ not: "guided" }, 1)).toEqual(emptyDraft(1));
  });
  it("mirrors the database rule: only an unsubmitted or returned section can be edited", () => {
    expect(studentCanEdit(null)).toBe(true);
    expect(studentCanEdit("returned")).toBe(true);
    for (const s of ["submitted", "revised", "approved", "exempt"] as const) expect(studentCanEdit(s)).toBe(false);
  });
});

describe("text helpers", () => {
  it("timing is shown as an estimate in words", () => {
    expect(minutesLabel("5-10 including assigned core reading and pauses")).toBe("About 5–10 minutes, including assigned core reading and pauses");
    expect(minutesLabel("10-25")).toBe("About 10–25 minutes");
    expect(minutesLabel("15–20")).toBe("About 15–20 minutes");
    expect(minutesLabel("")).toBe("");
    expect(minutesLabel("varies")).toBe("varies");
    expect(prettyRange("5 - 10")).toBe("5–10");
  });
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    expect(toParagraphs("One\nstill one\n\nTwo\n \nThree")).toEqual(["One\nstill one", "Two", "Three"]);
  });
});

describe("welcome lessons", () => {
  const welcomeBlocks: RawBlock[] = [
    { block_type: "guided_intro", order_index: 0, content: { kind: "welcome", section_id: "welcome", goal: "", reading: [], timing: "", exercise_timing: "" } },
    { block_type: "guided_page", order_index: 1, content: { page_id: "page-1", title: "Welcome A", body: "Body A" } },
    { block_type: "guided_page", order_index: 2, content: { page_id: "page-2", title: "Welcome B", body: "Body B" } }
  ];
  it("shows only its pages: no opening, questions, practice or submit", () => {
    const g = parseGuidedLesson(welcomeBlocks);
    expect(isWelcomeLesson(g)).toBe(true);
    expect(buildScreens(g).map((x) => x.kind)).toEqual(["page", "page"]);
  });
  it("is not a welcome lesson when it has anything to answer", () => {
    const g = parseGuidedLesson([...welcomeBlocks, { block_type: "guided_question", order_index: 3, content: { question_id: "q1", prompt: "Q?" } }]);
    expect(isWelcomeLesson(g)).toBe(false);
    expect(buildScreens(g)[0].kind).toBe("opening");
  });
  it("ordinary lessons are never welcome lessons", () => {
    expect(isWelcomeLesson(parseGuidedLesson(blocks))).toBe(false);
  });
});
