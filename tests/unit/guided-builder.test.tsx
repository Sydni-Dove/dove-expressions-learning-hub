import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";

// Synthetic content only (public repo).
const writes: { table: string; op: string; payload: any; eq?: [string, any] }[] = [];
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      update: (payload: any) => ({ eq: async (c: string, v: any) => { writes.push({ table, op: "update", payload, eq: [c, v] }); return { error: null }; } }),
      insert: async (payload: any) => { writes.push({ table, op: "insert", payload }); return { error: null }; },
      upsert: async (payload: any) => { writes.push({ table, op: "upsert", payload }); return { error: null }; },
      delete: () => ({ eq: async () => ({ error: null }) })
    }),
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn() }) }
  })
}));

import LessonBlockEditor from "@/components/LessonBlockEditor";

const blocks = () => [
  { id: "b-intro", block_type: "guided_intro", order_index: 0, content: { section_id: "s", goal: "Goal text", reading: ["Ref 1:1"], timing: "5-10", exercise_timing: "10-25" } },
  { id: "b-page", block_type: "guided_page", order_index: 1, content: { page_id: "page-1", title: "Page title", body: "Body one.\n\nBody two." } },
  { id: "b-check", block_type: "guided_check", order_index: 2, content: { check_id: "check", prompt: "Pick one", options: ["Option A", "Option B", "Option C"] } },
  { id: "b-q", block_type: "guided_question", order_index: 3, content: { question_id: "q1", type: "reflection", prompt: "Reflect?" } },
  { id: "b-ex", block_type: "guided_exercise", order_index: 4, content: { title: "Exercise", minutes: "10-15", steps: ["One", "Two"], response_prompt: "Record it" } }
];

const cards = (c: HTMLElement) => [...c.querySelectorAll(".card")].filter((el) => within(el as HTMLElement).queryByText(/^(Edit|Close)$/)) as HTMLElement[];
async function open(c: HTMLElement, i: number) { fireEvent.click(within(cards(c)[i]).getByText("Edit")); return cards(c)[i]; }

beforeEach(() => { writes.length = 0; });
afterEach(cleanup);

describe("guided blocks in the staff builder", () => {
  it("lists every guided piece with a plain label", () => {
    const { container } = render(<LessonBlockEditor lessonId="l1" blocks={blocks()} />);
    expect(cards(container)).toHaveLength(5);
    for (const label of ["opening", "teaching page", "knowledge check", "reflection question", "practice exercise"]) expect(container.textContent).toContain(label);
  });

  it("saving a page with no edits keeps its text and its stable id", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l1" blocks={blocks()} />);
    const card = await open(container, 1);
    fireEvent.click(within(card).getByText("Save changes"));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ table: "dp_lesson_blocks", op: "update", eq: ["id", "b-page"] });
    expect(writes[0].payload.content).toEqual(blocks()[1].content);
  });

  it("editing a page changes only that field", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l1" blocks={blocks()} />);
    const card = await open(container, 1);
    fireEvent.change(within(card).getByDisplayValue("Page title"), { target: { value: "New title" } });
    fireEvent.click(within(card).getByText("Save changes"));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].payload.content).toEqual({ ...blocks()[1].content, title: "New title" });
  });

  it("an empty page cannot be saved", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l1" blocks={blocks()} />);
    const card = await open(container, 1);
    fireEvent.change(within(card).getByDisplayValue("Page title"), { target: { value: "" } });
    fireEvent.click(within(card).getByText("Save changes"));
    expect(await within(card).findByRole("alert")).toHaveTextContent("page title");
    expect(writes).toHaveLength(0);
  });

  it("the answer key is a separate staff-only editor that writes ONLY to the key table, never into the block", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l1" blocks={blocks()} answerKeys={{ check: { correct_index: 1, feedback: "Existing feedback" } }} />);
    const card = await open(container, 2);
    const key = within(card).getByTestId("answer-key-editor");
    expect(key).toHaveTextContent("staff only");
    expect(within(key).getByLabelText("Option B")).toBeChecked(); // loaded from the saved key
    fireEvent.click(within(key).getByLabelText("Option C"));
    fireEvent.change(within(key).getByDisplayValue("Existing feedback"), { target: { value: "New feedback" } });
    fireEvent.click(within(key).getByText("Save answer key"));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ table: "dp_lesson_answer_keys", op: "upsert" });
    expect(writes[0].payload).toMatchObject({ lesson_id: "l1", check_id: "check", correct_index: 2, feedback: "New feedback" });
    // saving the QUESTION never carries the key
    fireEvent.click(within(card).getByText("Save changes"));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(JSON.stringify(writes[1].payload)).not.toMatch(/correct|feedback/i);
  });

  it("no answer-key editor appears on other block types", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l1" blocks={blocks()} />);
    const card = await open(container, 3);
    expect(within(card).queryByTestId("answer-key-editor")).toBeNull();
  });

  it("a new reflection question gets the next stable id; a second intro/check/exercise is refused", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l1" blocks={blocks()} />);
    const picker = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: "guided_question" } });
    fireEvent.change(screen.getByPlaceholderText(/Reflection question/), { target: { value: "Another?" } });
    fireEvent.click(screen.getByText(/Add (section|block|content)/i));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].payload).toMatchObject({ lesson_id: "l1", block_type: "guided_question" });
    expect(writes[0].payload.content).toMatchObject({ question_id: "q2", prompt: "Another?" }); // q1 already exists

    writes.length = 0;
    fireEvent.change(picker, { target: { value: "guided_check" } });
    fireEvent.change(screen.getByPlaceholderText("Knowledge check question"), { target: { value: "Second check?" } });
    fireEvent.click(screen.getByText(/Add (section|block|content)/i));
    expect(await screen.findByText(/already has one of those/i)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
});
