import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { buildScreens, buildSubmissionContent, normalizeDraft, parseBody, parseGuidedLesson, responseGroups, screenInfo, validateForSubmit, type RawBlock } from "@/lib/guided-lesson";

const upserts: any[] = [];
const inserts: any[] = [];
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      upsert: async (row: any) => { upserts.push({ table, row }); return { error: null }; },
      insert: async (row: any) => { inserts.push({ table, row }); return { error: null }; },
      update: () => ({ eq: async () => ({ error: null }) })
    }),
    rpc: async () => ({ data: [], error: null })
  })
}));
import GuidedLessonFlow, { type GuidedLessonFlowProps } from "@/components/guided/GuidedLessonFlow";

// Synthetic placeholder content only (the real course text must never be in this repository).
const blocks: RawBlock[] = [
  { block_type: "guided_intro", order_index: 0, content: { section_id: "s", goal: "", reading: [], timing: "", exercise_timing: "", opening: false } },
  { block_type: "guided_page", order_index: 1, content: { page_id: "p1", title: "Page One", body: "## Sub heading\n\nPlain paragraph.\n\n> “Quoted synthetic line.”\n> —Synthetic 1:1, KJV\n\nA closing line.\n—Source 2:2" } },
  { block_type: "guided_screen", order_index: 2, content: { screen_id: "s1", label: "Questions", title: "Page One", for_page: "p1" } },
  { block_type: "guided_question", order_index: 3, content: { question_id: "a1", type: "reflection", prompt: "Question A?" } },
  { block_type: "guided_question", order_index: 4, content: { question_id: "a2", type: "reflection", prompt: "Question B?" } },
  { block_type: "guided_page", order_index: 5, content: { page_id: "p2", title: "Page Two", body: "Second page text.\n\n* first bullet\n* second bullet" } },
  { block_type: "guided_screen", order_index: 6, content: { screen_id: "s2", label: "Questions and Exercise", title: "Page Two / Psalm X", for_page: "p2" } },
  { block_type: "guided_question", order_index: 7, content: { question_id: "b1", type: "reflection", prompt: "Question C?" } },
  { block_type: "guided_note", order_index: 8, content: { title: "Exercise: Read it", body: "Read the whole psalm, then answer:" } },
  { block_type: "guided_question", order_index: 9, content: { question_id: "b2", type: "reflection", prompt: "Question D?" } },
  { block_type: "guided_screen", order_index: 10, content: { screen_id: "s3", label: "Exercise", title: "Stand alone", for_page: "" } },
  { block_type: "guided_question", order_index: 11, content: { question_id: "c1", type: "reflection", prompt: "Question E?" } }
];
const guided = parseGuidedLesson(blocks);

const base = (over: Partial<GuidedLessonFlowProps> = {}): GuidedLessonFlowProps => ({
  lessonId: "l1", lessonTitle: "Synthetic Section", lessonStatus: "published", contentVersion: 3, courseId: "c1", courseTitle: "Synthetic Course",
  guided, userId: "u1", initialDraft: null, assignmentId: "a1", submission: null, feedback: [], resources: [], isStaffPreview: false,
  position: { index: 1, total: 3 }, nextLessonId: null, prevLessonId: null, lessonCompleted: false, ...over
});
const next = () => fireEvent.click(screen.getByTestId("next"));
const back = () => fireEvent.click(screen.getByTestId("back"));
const answer = (label: string, text: string) => fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value: text } });

beforeEach(() => { upserts.length = 0; inserts.length = 0; window.scrollTo = vi.fn() as any; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("sequenced model", () => {
  it("orders screens exactly as authored: each page, then its own questions — no opening, nothing pooled at the end", () => {
    const s = buildScreens(guided);
    expect(s.map((x) => screenInfo(guided, x).label)).toEqual([
      "Teaching: Page One", "Questions: Page One", "Teaching: Page Two", "Questions and Exercise: Page Two / Psalm X", "Exercise: Stand alone", "Review and submit"
    ]);
  });
  it("still flattens every question (so submit validation and snapshots see all of them), tagged with their screen", () => {
    expect(guided.questions.map((q) => [q.question_id, q.screen_id])).toEqual([["a1", "s1"], ["a2", "s1"], ["b1", "s2"], ["b2", "s2"], ["c1", "s3"]]);
    expect(guided.check).toBeNull();
    expect(guided.screens[1].items.map((i) => i.kind)).toEqual(["question", "note", "question"]);
  });
  it("groups responses under the teaching-page titles; a stand-alone exercise uses its own title", () => {
    expect(responseGroups(guided).map((g) => [g.title, g.questions.length])).toEqual([["Page One", 2], ["Page Two", 2], ["Stand alone", 1]]);
  });
  it("snapshots carry the group so the instructor sees answers under their page", () => {
    const d = { ...normalizeDraft(null, 3), answers: { a1: "x", a2: "y", b1: "z", b2: "w", c1: "v" } };
    const c = buildSubmissionContent(guided, "l1", "Synthetic Section", 3, d);
    expect(c.answers.map((a) => a.group)).toEqual(["Page One", "Page One", "Page Two", "Page Two", "Stand alone"]);
    expect(validateForSubmit(guided, d).ok).toBe(true);
    expect(validateForSubmit(guided, { ...d, answers: { ...d.answers, b2: " " } }).missing).toEqual(["Answer reflection question 4"]);
  });
  it("the older layout (check + questions + exercise at the end) is unchanged", () => {
    const old = parseGuidedLesson([
      { block_type: "guided_intro", order_index: 0, content: { goal: "g" } },
      { block_type: "guided_page", order_index: 1, content: { page_id: "page-1", title: "T", body: "B" } },
      { block_type: "guided_question", order_index: 2, content: { question_id: "q1", prompt: "Q?" } },
      { block_type: "guided_exercise", order_index: 3, content: { title: "E", steps: ["s"] } }
    ]);
    expect(buildScreens(old).map((s) => s.kind)).toEqual(["opening", "page", "questions", "exercise", "submit"]);
  });
});

describe("page text markup", () => {
  it("parses headings, quotes with a source, bullets and trailing source lines — as data, never HTML", () => {
    const n = parseBody("## Heading\n\nPlain.\n\n> Quote line one\n> Quote line two\n> —Ref 1:1\n\nText\n—Ref 2:2\n\n* one\n* two\n\n<script>alert(1)</script>");
    expect(n).toEqual([
      { kind: "h", text: "Heading" },
      { kind: "p", lines: ["Plain."], cite: undefined },
      { kind: "quote", lines: ["Quote line one", "Quote line two"], cite: "—Ref 1:1" },
      { kind: "p", lines: ["Text"], cite: "—Ref 2:2" },
      { kind: "list", items: ["one", "two"] },
      { kind: "p", lines: ["<script>alert(1)</script>"], cite: undefined }
    ]);
  });
});

describe("sequenced student flow", () => {
  it("starts on the first teaching page, shows 'Step x of y' with the real label, and leads to ITS OWN questions", () => {
    render(<GuidedLessonFlow {...base()} />);
    expect(screen.getByTestId("step-counter")).toHaveTextContent("Step 1 of 6");
    expect(screen.getByTestId("sequence-progress")).toHaveTextContent("Teaching: Page One");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Page One");
    expect(screen.getByTestId("page-counter")).toHaveTextContent("Teaching page 1 of 2");
    expect(screen.getByRole("heading", { level: 2, name: "Sub heading" })).toBeInTheDocument();
    expect(screen.getByText("Quoted synthetic line.", { exact: false }).closest("blockquote")).toHaveTextContent("Synthetic 1:1, KJV");
    expect(screen.queryByText("Question A?")).toBeNull();
    expect(screen.queryByLabelText("Lesson steps")).toBeNull(); // the old Teaching/Questions/Practice bar is gone
    next();
    expect(screen.getByTestId("step-counter")).toHaveTextContent("Step 2 of 6");
    expect(screen.getByTestId("sequence-progress")).toHaveTextContent("Questions: Page One");
    expect(screen.getAllByTestId("response-question")).toHaveLength(2);
    expect(screen.queryByText("Question C?")).toBeNull(); // page two's questions are not pooled here
    next();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Page Two");
    expect(screen.getAllByRole("listitem").map((l) => l.textContent)).toEqual(expect.arrayContaining(["first bullet", "second bullet"]));
  });

  it("a questions-and-exercise screen shows its note between the questions, in order", () => {
    render(<GuidedLessonFlow {...base()} />);
    next(); next(); next();
    expect(screen.getByTestId("sequence-progress")).toHaveTextContent("Questions and Exercise: Page Two / Psalm X");
    const html = screen.getByTestId("screen-responses").textContent!;
    expect(html.indexOf("Question C?")).toBeLessThan(html.indexOf("Exercise: Read it"));
    expect(html.indexOf("Exercise: Read it")).toBeLessThan(html.indexOf("Question D?"));
    expect(screen.getByText("Question D?").closest("label")).toHaveTextContent("Question 2");
  });

  it("answers survive Back/Next, autosave with the current place, and the teaching is one click away", async () => {
    render(<GuidedLessonFlow {...base()} />);
    next();
    answer("Question A\\?", "my first answer");
    back();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Page One");
    next();
    expect((screen.getByLabelText(/Question A\?/) as HTMLTextAreaElement).value).toBe("my first answer");
    fireEvent.click(screen.getByTestId("back-to-teaching"));
    expect(screen.getByTestId("page-counter")).toHaveTextContent("Teaching page 1 of 2");
    await waitFor(() => expect(upserts.length).toBeGreaterThan(0), { timeout: 3000 });
    const saved = upserts[upserts.length - 1].row.content;
    expect(saved.answers.a1).toBe("my first answer");
    expect(typeof saved.screen).toBe("number");
  });

  it("resumes at the saved place", () => {
    render(<GuidedLessonFlow {...base({ initialDraft: { v: 1, contentVersion: 3, screen: 3, check: { choice: null, correct: null }, answers: { a1: "kept" }, exercise: "" } })} />);
    expect(screen.getByTestId("step-counter")).toHaveTextContent("Step 4 of 6");
  });

  it("a place saved under an older version of the lesson starts again at the first screen, keeping the answers", () => {
    render(<GuidedLessonFlow {...base({ initialDraft: { v: 1, contentVersion: 2, screen: 5, check: { choice: null, correct: null }, answers: { a1: "kept answer" }, exercise: "" } })} />);
    expect(screen.getByTestId("step-counter")).toHaveTextContent("Step 1 of 6");
    next();
    expect((screen.getByLabelText(/Question A\?/) as HTMLTextAreaElement).value).toBe("kept answer");
  });

  it("review & submit groups every response under its page title, with an Edit link back, and blocks submit until all are answered", () => {
    render(<GuidedLessonFlow {...base({ initialDraft: { v: 1, contentVersion: 3, screen: 5, check: { choice: null, correct: null }, answers: { a1: "A", a2: "B", b1: "C", c1: "E" }, exercise: "" } })} />);
    const groups = screen.getAllByTestId("review-group");
    expect(groups.map((g) => within(g).getByRole("heading", { level: 2 }).textContent)).toEqual(["Page One", "Page Two", "Stand alone"]);
    expect(within(groups[1]).getByText(/Not answered yet/)).toBeInTheDocument();
    expect(screen.getByTestId("submit-start")).toBeDisabled();
    fireEvent.click(within(groups[1]).getByRole("button", { name: /Edit your responses for Page Two/ }));
    expect(screen.getByTestId("step-counter")).toHaveTextContent("Step 4 of 6");
    answer("Question D\\?", "now answered");
    next(); next();
    expect(screen.getByTestId("submit-start")).not.toBeDisabled();
  });

  it("never marks completion by clicking through; submit needs an explicit confirm", async () => {
    render(<GuidedLessonFlow {...base({ initialDraft: { v: 1, contentVersion: 3, screen: 5, check: { choice: null, correct: null }, answers: { a1: "A", a2: "B", b1: "C", b2: "D", c1: "E" }, exercise: "" } })} />);
    expect(inserts).toHaveLength(0);
    fireEvent.click(screen.getByTestId("submit-start"));
    expect(inserts).toHaveLength(0);
    fireEvent.click(screen.getByTestId("submit-confirm"));
    await waitFor(() => expect(inserts).toHaveLength(1));
    expect(inserts[0].table).toBe("dp_submissions");
    expect(inserts[0].row.content.answers.map((a: any) => a.group)).toEqual(["Page One", "Page One", "Page Two", "Page Two", "Stand alone"]);
  });
});
