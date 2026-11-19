import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { parseGuidedLesson, type RawBlock } from "@/lib/guided-lesson";

// ---- mocks: the database client and the router (no network) -------------------------------------
const upserts: any[] = [];
const inserts: any[] = [];
const updates: any[] = [];
let rpcImpl: (name: string, args: any) => Promise<any>;
let upsertError: any = null;
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      upsert: async (row: any) => { upserts.push({ table, row }); return { error: upsertError }; },
      insert: async (row: any) => { inserts.push({ table, row }); return { error: null }; },
      update: (row: any) => ({ eq: async () => { updates.push({ table, row }); return { error: null }; } })
    }),
    rpc: (name: string, args: any) => rpcImpl(name, args)
  })
}));

import GuidedLessonFlow, { type GuidedLessonFlowProps } from "@/components/guided/GuidedLessonFlow";

// Synthetic placeholder content only.
const blocks: RawBlock[] = [
  { block_type: "guided_intro", order_index: 0, content: { section_id: "s", goal: "Synthetic goal", reading: ["Ref 1:1", "Ref 2:2"], timing: "5-10 including pauses", exercise_timing: "10-25" } },
  { block_type: "guided_page", order_index: 1, content: { page_id: "page-1", title: "First page", body: "Alpha paragraph.\n\nBeta paragraph." } },
  { block_type: "guided_page", order_index: 2, content: { page_id: "page-2", title: "Second page", body: "Gamma." } },
  { block_type: "guided_check", order_index: 3, content: { check_id: "check", prompt: "Pick one", options: ["Option A", "Option B", "Option C"] } },
  { block_type: "guided_question", order_index: 4, content: { question_id: "q1", type: "reflection", prompt: "Reflect one?" } },
  { block_type: "guided_question", order_index: 5, content: { question_id: "q2", type: "reflection", prompt: "Reflect two?" } },
  { block_type: "guided_exercise", order_index: 6, content: { title: "Do the thing", minutes: "10-15", steps: ["Step one", "Step two"], response_prompt: "Record it" } }
];

const base = (over: Partial<GuidedLessonFlowProps> = {}): GuidedLessonFlowProps => ({
  lessonId: "lesson-1", lessonTitle: "Synthetic Section", lessonStatus: "published", contentVersion: 2,
  courseId: "course-1", courseTitle: "Synthetic Course", guided: parseGuidedLesson(blocks), userId: "user-1",
  initialDraft: null, assignmentId: "assign-1", submission: null, feedback: [], resources: [],
  isStaffPreview: false, position: { index: 1, total: 3 }, nextLessonId: "lesson-2", prevLessonId: null, lessonCompleted: false, ...over
});

const next = () => fireEvent.click(screen.getByTestId("next"));
const back = () => fireEvent.click(screen.getByTestId("back"));

beforeEach(() => {
  upserts.length = 0; inserts.length = 0; updates.length = 0; upsertError = null; refresh.mockClear();
  rpcImpl = async () => ({ data: [{ correct: true, feedback: "Synthetic feedback text" }], error: null });
  window.scrollTo = vi.fn() as any;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("teaching screens", () => {
  it("opens with the title, goal, reading and a timing ESTIMATE — and no page content yet", () => {
    render(<GuidedLessonFlow {...base()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Synthetic Section");
    expect(screen.getByText("Synthetic goal")).toBeInTheDocument();
    expect(screen.getByTestId("reading-list")).toHaveTextContent("Ref 1:1");
    expect(screen.getByTestId("timing")).toHaveTextContent("About 5–10 minutes, including pauses");
    expect(screen.getByTestId("timing")).toHaveTextContent("estimates");
    expect(screen.queryByText("Alpha paragraph.")).toBeNull();
    expect(screen.getByTestId("back")).toBeDisabled();
  });

  it("shows ONE page at a time with 'Page x of y', visible Back/Next, in order", () => {
    render(<GuidedLessonFlow {...base()} />);
    next();
    expect(screen.getByTestId("page-counter")).toHaveTextContent("Page 1 of 2");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("First page");
    expect(screen.getByTestId("page-body")).toHaveTextContent("Alpha paragraph.");
    expect(screen.queryByText("Gamma.")).toBeNull();
    next();
    expect(screen.getByTestId("page-counter")).toHaveTextContent("Page 2 of 2");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Second page");
    expect(screen.getByTestId("next")).toHaveTextContent("Go to questions");
    back();
    expect(screen.getByTestId("page-counter")).toHaveTextContent("Page 1 of 2");
  });

  it("left/right arrow keys navigate — but not while typing", () => {
    render(<GuidedLessonFlow {...base()} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByTestId("page-counter")).toHaveTextContent("Page 1 of 2");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" }); // now on the questions screen
    expect(screen.getByTestId("screen-questions")).toBeInTheDocument();
    const ta = screen.getAllByTestId("reflection")[0].querySelector("textarea")!;
    ta.focus();
    fireEvent.keyDown(ta, { key: "ArrowLeft" });
    fireEvent.keyDown(ta, { key: "ArrowRight" });
    expect(screen.getByTestId("screen-questions")).toBeInTheDocument(); // still here
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByTestId("page-counter")).toHaveTextContent("Page 2 of 2");
  });
});

describe("questions, practice and saving", () => {
  const goToQuestions = () => { render(<GuidedLessonFlow {...base()} />); next(); next(); next(); };

  it("a separate questions screen holds the knowledge check and every reflection, in order", () => {
    goToQuestions();
    expect(screen.getByTestId("screen-questions")).toBeInTheDocument();
    expect(screen.queryByText("Alpha paragraph.")).toBeNull();
    expect(screen.getByTestId("knowledge-check")).toHaveTextContent("Pick one");
    expect(screen.getAllByTestId("reflection").map((r) => r.querySelector("label")!.textContent)).toEqual([expect.stringContaining("Reflect one?"), expect.stringContaining("Reflect two?")]);
  });

  it("the page never contains the answer key; feedback only appears after a choice is checked", async () => {
    goToQuestions();
    expect(document.body.textContent).not.toMatch(/Synthetic feedback text|correct answer/i);
    fireEvent.click(screen.getByLabelText("Option B"));
    expect(screen.queryByTestId("check-result")).toBeNull();
    fireEvent.click(screen.getByTestId("check-answer"));
    await waitFor(() => expect(screen.getByTestId("check-result")).toHaveTextContent("Synthetic feedback text"));
    expect(screen.getByTestId("check-result")).toHaveAttribute("data-correct", "true");
  });

  it("shows 'not quite' (without revealing the right answer) for a wrong choice", async () => {
    rpcImpl = async () => ({ data: [{ correct: false, feedback: "Explanation text" }], error: null });
    goToQuestions();
    fireEvent.click(screen.getByLabelText("Option A"));
    fireEvent.click(screen.getByTestId("check-answer"));
    await waitFor(() => expect(screen.getByTestId("check-result")).toHaveTextContent("Not quite"));
    expect(screen.getByTestId("check-result")).toHaveAttribute("data-correct", "false");
  });

  it("autosaves typed answers as a private draft, showing real saving/saved states", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    goToQuestions();
    const ta = screen.getAllByTestId("reflection")[0].querySelector("textarea")!;
    fireEvent.change(ta, { target: { value: "my private thought" } });
    expect(screen.getByTestId("save-status")).toHaveAttribute("data-state", "dirty");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveAttribute("data-state", "saved"));
    const last = upserts[upserts.length - 1];
    expect(last.table).toBe("dp_lesson_drafts");
    expect(last.row).toMatchObject({ user_id: "user-1", lesson_id: "lesson-1", content_version: 2 });
    expect(last.row.content.answers.q1).toBe("my private thought");
    expect(inserts).toHaveLength(0); // saving a draft never submits
  });

  it("reports a failed save honestly and offers a retry that works", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    upsertError = { message: "network down" };
    goToQuestions();
    fireEvent.change(screen.getAllByTestId("reflection")[0].querySelector("textarea")!, { target: { value: "x" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveAttribute("data-state", "error"));
    upsertError = null;
    fireEvent.click(screen.getByTestId("save-retry"));
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveAttribute("data-state", "saved"));
  });

  it("resumes: a saved draft restores the screen, answers and the earlier check choice", async () => {
    const initialDraft = { v: 1, contentVersion: 2, screen: 3, check: { choice: 1, correct: true }, answers: { q1: "earlier answer" }, exercise: "" };
    render(<GuidedLessonFlow {...base({ initialDraft })} />);
    expect(screen.getByTestId("screen-questions")).toBeInTheDocument();
    expect((screen.getAllByTestId("reflection")[0].querySelector("textarea") as HTMLTextAreaElement).value).toBe("earlier answer");
    expect(screen.getByLabelText("Option B")).toBeChecked();
    await waitFor(() => expect(screen.getByTestId("check-result")).toHaveTextContent("Synthetic feedback text")); // feedback restored via the checker
  });

  it("going back to the teaching keeps the answers", () => {
    goToQuestions();
    fireEvent.change(screen.getAllByTestId("reflection")[0].querySelector("textarea")!, { target: { value: "kept" } });
    back(); back();
    next(); next();
    expect((screen.getAllByTestId("reflection")[0].querySelector("textarea") as HTMLTextAreaElement).value).toBe("kept");
  });

  it("practice is its own screen with the steps and a response field", () => {
    goToQuestions();
    next();
    expect(screen.getByTestId("screen-exercise")).toBeInTheDocument();
    expect(screen.getByTestId("exercise-steps").querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByTestId("exercise-response")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Do the thing");
  });
});

describe("submitting", () => {
  const fullDraft = { v: 1, contentVersion: 2, screen: 5, check: { choice: 1, correct: true }, answers: { q1: "one", q2: "two" }, exercise: "practiced" };

  it("Next alone never submits or completes anything", () => {
    render(<GuidedLessonFlow {...base()} />);
    for (let i = 0; i < 5; i++) if (screen.queryByTestId("next")) next();
    expect(screen.getByTestId("screen-submit")).toBeInTheDocument();
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("blocks submitting until everything is answered and lists what is missing", () => {
    render(<GuidedLessonFlow {...base()} />);
    for (let i = 0; i < 5; i++) if (screen.queryByTestId("next")) next();
    expect(screen.getByTestId("submit-start")).toBeDisabled();
    expect(screen.getByText(/Still to do:/)).toHaveTextContent("Answer the knowledge check");
  });

  it("asks for explicit confirmation, then submits ONE submission with the prompts snapshot", async () => {
    render(<GuidedLessonFlow {...base({ initialDraft: fullDraft })} />);
    expect(screen.getByTestId("screen-submit")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("submit-start"));
    expect(inserts).toHaveLength(0); // not yet — needs confirmation
    fireEvent.click(screen.getByTestId("submit-confirm"));
    await waitFor(() => expect(inserts).toHaveLength(1));
    const row = inserts[0].row;
    expect(inserts[0].table).toBe("dp_submissions");
    expect(row).toMatchObject({ assignment_id: "assign-1", student_id: "user-1" });
    expect(row.content).toMatchObject({ kind: "guided_section", contentVersion: 2, sectionTitle: "Synthetic Section" });
    expect(row.content.answers[0]).toEqual({ id: "q1", prompt: "Reflect one?", response: "one" });
    expect(refresh).toHaveBeenCalled();
  });

  it("a submitted section is locked: read-only answers, no submit button, review status shown", () => {
    const submission = { id: "s1", status: "submitted" as const, content: { kind: "guided_section", answers: [{ id: "q1", prompt: "Reflect one?", response: "sent" }], exercise: { response: "ex" }, check: null } };
    render(<GuidedLessonFlow {...base({ submission })} />);
    expect(screen.getByTestId("submission-status")).toHaveTextContent("waiting for your instructor's review");
    for (let i = 0; i < 3; i++) next();
    const ta = screen.getAllByTestId("reflection")[0].querySelector("textarea") as HTMLTextAreaElement;
    expect(ta.value).toBe("sent");
    expect(ta).toHaveAttribute("readonly");
    next(); next();
    expect(screen.queryByTestId("submit-start")).toBeNull();
    expect(upserts).toHaveLength(0); // a locked lesson never writes drafts
  });

  it("a returned section shows the instructor's feedback and lets the student revise and resubmit", async () => {
    const submission = { id: "s1", status: "returned" as const, content: { kind: "guided_section", answers: [{ id: "q1", prompt: "Reflect one?", response: "first try" }, { id: "q2", prompt: "Reflect two?", response: "second" }], exercise: { response: "ex" }, check: { choice: 1, correct: true } } };
    render(<GuidedLessonFlow {...base({ submission, feedback: [{ id: "f1", content: "Please add detail.", created_at: "2026-11-01T00:00:00Z" }] })} />);
    expect(screen.getByTestId("submission-status")).toHaveAttribute("data-status", "returned");
    expect(screen.getByTestId("submission-status")).toHaveTextContent("Please add detail.");
    for (let i = 0; i < 3; i++) next();
    const ta = screen.getAllByTestId("reflection")[0].querySelector("textarea") as HTMLTextAreaElement;
    expect(ta.value).toBe("first try");
    expect(ta).not.toHaveAttribute("readonly");
    fireEvent.change(ta, { target: { value: "revised answer" } });
    next(); next();
    fireEvent.click(screen.getByTestId("submit-start"));
    fireEvent.click(screen.getByTestId("submit-confirm"));
    await waitFor(() => expect(updates.length).toBeGreaterThan(0));
    const u = updates[updates.length - 1];
    expect(u.table).toBe("dp_submissions");
    expect(u.row.status).toBe("revised");
    expect(u.row.content.answers[0].response).toBe("revised answer");
    expect(inserts).toHaveLength(0); // never a second attempt
  });

  it("an approved section says so and shows the completion record", () => {
    const submission = { id: "s1", status: "approved" as const, content: { kind: "guided_section", answers: [], exercise: null, check: null } };
    render(<GuidedLessonFlow {...base({ submission, lessonCompleted: true })} />);
    expect(screen.getByTestId("submission-status")).toHaveTextContent("Reviewed and approved");
    expect(screen.getByTestId("submission-status")).toHaveTextContent("recorded this section as complete");
  });

  it("explains a missing assignment instead of failing silently", () => {
    render(<GuidedLessonFlow {...base({ assignmentId: null, initialDraft: fullDraft })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("isn't set up yet");
    expect(screen.getByTestId("submit-start")).toBeDisabled();
  });
});

describe("workbook and preview", () => {
  it("offers private downloads on the opening screen with the honest 'stays on your device' note", () => {
    render(<GuidedLessonFlow {...base({ resources: [{ id: "r1", title: "Synthetic Workbook", kind: "workbook", file_name: "w.pdf", version: "v1" }] })} />);
    const link = screen.getByTestId("resource-download");
    expect(link).toHaveAttribute("href", "/courses/course-1/resources/r1");
    expect(link).toHaveTextContent("Synthetic Workbook (v1)");
    expect(screen.getByTestId("workbook-card")).toHaveTextContent("not");
    expect(screen.getByTestId("workbook-card")).toHaveTextContent("stays on your device");
  });
  it("marks an instructor viewing a draft lesson", () => {
    render(<GuidedLessonFlow {...base({ isStaffPreview: true, lessonStatus: "draft" })} />);
    expect(screen.getByTestId("staff-preview-banner")).toHaveTextContent("students can't open this lesson yet");
  });
});
