import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";

const updates: { table: string; payload: any; id: string }[] = [];
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      update: (payload: any) => ({ eq: async (_c: string, id: string) => { updates.push({ table, payload, id }); return { error: null }; } }),
      insert: async () => ({ error: null }),
      delete: () => ({ eq: async () => ({ error: null }) })
    }),
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn() }) }
  })
}));

import LessonBlockEditor from "@/components/LessonBlockEditor";

// Lesson 1.1 exactly as stored in the live database (read-only copy).
const P = [
  "Let’s start with a distinction that will help you through the whole build. An idea tells us what you are interested in making. An objective tells us what that thing needs to accomplish for someone. “A dream app” is an idea. “A place where someone can record a dream and find it again later” gives us an experience we can actually build and test. Your objective gives AI direction, and it gives you a way to recognize whether the work is moving toward your goal.",
  "If you are brand new to this, your first question is probably not, “What framework should I use?” Your question is, “Where do I even begin?” Begin with the thing you actually know: the idea.",
  "Start by telling your strategist what you want to make. You may only know, 'I want to make an app that does this,' or, 'I want a website where people can do this.' That is enough to begin. Before the build starts, get clear on the objective: what are you making, who is it for, and what is the main thing it should do?",
  "Do not worry about making the first description sound technical. In fact, I would rather you describe the experience you want than try to use technical language you do not understand. Tell the strategist what you want the person using the app or website to be able to do.",
  "I like to get the objective down to about a sentence or a short paragraph. It does not have to describe every feature or page. It needs to tell me what I am making and what the main thing is that it should accomplish.",
  "That short objective becomes an anchor. Later, when AI starts suggesting features or when you get excited about new possibilities, you can come back to it and ask, “Is this helping me accomplish the thing I said I was building?”",
  "For example, when I think about a color studio, the central idea is not 'I want a React application with image-processing functions.' The idea is closer to: 'I want to upload my journal design and be able to recolor it.' That gives the strategist something to plan around and gives me something to judge the build against later.",
  "Your first objective can also include an experience requirement. For me, it is often: it needs to look nice and do the main thing I built it to do. That may sound simple, but it is a powerful filter. If the app is beautiful and the main function does not work, it is not ready. If the function technically exists but the experience is nothing like what I had in mind, I still need to direct the build closer to the vision."
];
const blocks = () => [
  { id: "t", block_type: "teaching_section", order_index: 0, content: { anchor: "objective", heading: "Start With the Objective, Not the Technology", paragraphs: [...P] } },
  { id: "k", block_type: "takeaways", order_index: 1, content: { items: [{ body: "Describe who the app serves and what its main experience should accomplish. Use that objective to judge what AI builds.", heading: "Your objective is the anchor" }] } },
  { id: "d", block_type: "do_this_now", order_index: 2, content: { items: ["Write your objective in My Build.", "Name who it is for and the main action.", "Save My Build before leaving the page."], title: "Do This Now", instruction: "Before you move on, describe one person using your idea. What do they arrive needing to do? What do they do inside the app or website? What should they have when they finish? Write that experience in ordinary language. If your answer turns into a long feature list, come back to the main action. You will use this objective in the workshop checkpoint and the strategist prompt at the end of this phase." } },
  { id: "p", block_type: "prompt_card", order_index: 3, content: { label: "Strategist Prompt", prompt: "I want to build [idea]. The main objective is [objective]. Help me turn this into a buildable app plan. Ask only the questions that materially affect how the app should work. Help me define the central user experience, what the first working version needs to accomplish, and what can reasonably wait." } },
  { id: "w", block_type: "workbook_download", order_index: 4, content: { url: "/courses/3be784b0-5adb-4d10-9ab7-603b914311ee/worksheets/app-objective", label: "App Objective Worksheet" } }
];

beforeEach(() => { updates.length = 0; });
afterEach(cleanup);

const cards = (c: HTMLElement) => [...c.querySelectorAll(".card")].filter((el) => within(el as HTMLElement).queryByText(/^(Edit|Close)$/)) as HTMLElement[];
async function open(container: HTMLElement, i: number) { fireEvent.click(within(cards(container)[i]).getByText("Edit")); return cards(container)[i]; }
async function save(card: HTMLElement) { fireEvent.click(within(card).getByText("Save changes")); await waitFor(() => expect(updates.length).toBeGreaterThan(0)); return updates[updates.length - 1].payload.content; }

describe("Lesson 1.1 in the staff builder (real content)", () => {
  it("all five blocks are listed with the right type labels", () => {
    const { container } = render(<LessonBlockEditor lessonId="l" blocks={blocks()} />);
    const labels = cards(container).map((c) => c.querySelector(".pill, [class*=pill]")?.textContent);
    expect(cards(container).length).toBe(5);
    expect(container.textContent).toMatch(/Teaching section/);
    expect(container.textContent).toMatch(/Key takeaways/);
    expect(container.textContent).toMatch(/Do This Now \(practical action\)/);
    expect(container.textContent).toMatch(/Copyable prompt/);
    expect(container.textContent).toMatch(/Workbook \/ download/);
    expect(labels.length).toBe(5);
  });

  it.each([0, 1, 2, 3, 4])("opening block %i and saving with NO edits writes back identical content (nothing lost)", async (i) => {
    const original = blocks();
    const { container } = render(<LessonBlockEditor lessonId="l" blocks={original} />);
    const card = await open(container, i);
    const saved = await save(card);
    expect(saved).toEqual(original[i].content);
    expect(updates[0].id).toBe(original[i].id);
  });

  it("teaching text: editing one paragraph keeps all 8 paragraphs, curly quotes and apostrophes", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l" blocks={blocks()} />);
    const card = await open(container, 0);
    const ta = [...card.querySelectorAll("textarea")].find((t) => (t as HTMLTextAreaElement).defaultValue.includes("Let’s start")) as HTMLTextAreaElement;
    const next = ta.defaultValue.replace("Let’s start", "Let’s begin");
    fireEvent.change(ta, { target: { value: next } });
    const saved = await save(card);
    expect(saved.paragraphs).toHaveLength(8);
    expect(saved.paragraphs[0]).toMatch(/^Let’s begin with a distinction/);
    expect(saved.paragraphs.slice(1)).toEqual(P.slice(1));
    expect(saved.heading).toBe("Start With the Objective, Not the Technology");
    expect(saved.anchor).toBe("objective");
  });

  it("teaching text: editing the heading updates the heading and anchor but keeps every paragraph", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l" blocks={blocks()} />);
    const card = await open(container, 0);
    const heading = within(card).getByDisplayValue("Start With the Objective, Not the Technology");
    fireEvent.change(heading, { target: { value: "Start With the Objective" } });
    const saved = await save(card);
    expect(saved.heading).toBe("Start With the Objective");
    expect(saved.anchor).toBe("start-with-the-objective");
    expect(saved.paragraphs).toEqual(P);
  });

  it("Do This Now: editing the instruction and one checklist item preserves the rest", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l" blocks={blocks()} />);
    const card = await open(container, 2);
    const instr = [...card.querySelectorAll("textarea")].find((t) => (t as HTMLTextAreaElement).value.startsWith("Before you move on")) as HTMLTextAreaElement;
    fireEvent.change(instr, { target: { value: instr.value + " Take your time." } });
    const list = [...card.querySelectorAll("textarea")].find((t) => (t as HTMLTextAreaElement).defaultValue.includes("Write your objective")) as HTMLTextAreaElement;
    fireEvent.change(list, { target: { value: "Write your objective in My Build.\nName who it is for and the main action.\nSave My Build before leaving the page.\nCome back and refine it." } });
    const saved = await save(card);
    expect(saved.title).toBe("Do This Now");
    expect(saved.instruction.endsWith("Take your time.")).toBe(true);
    expect(saved.items).toHaveLength(4);
    expect(saved.items.slice(0, 3)).toEqual(blocks()[2].content.items);
  });

  it("Prompt Card: edits keep line breaks and indentation exactly (no trimming)", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l" blocks={blocks()} />);
    const card = await open(container, 3);
    const ta = [...card.querySelectorAll("textarea")][0] as HTMLTextAreaElement;
    const text = "Line one.\n\n  1. Indented item\n  2. Another\n\nLast line. ";
    fireEvent.change(ta, { target: { value: text } });
    const saved = await save(card);
    expect(saved.prompt).toBe(text);
    expect(saved.label).toBe("Strategist Prompt");
  });

  it("Worksheet: label can be edited and the protected download link is kept", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l" blocks={blocks()} />);
    const card = await open(container, 4);
    fireEvent.change(within(card).getByDisplayValue("App Objective Worksheet"), { target: { value: "App Objective Worksheet (v2)" } });
    const saved = await save(card);
    expect(saved.label).toBe("App Objective Worksheet (v2)");
    expect(saved.url).toBe("/courses/3be784b0-5adb-4d10-9ab7-603b914311ee/worksheets/app-objective");
  });

  it("Key Takeaways: a takeaway body that contains a | character is kept whole (previously truncated)", async () => {
    const { container } = render(<LessonBlockEditor lessonId="l" blocks={blocks()} />);
    const card = await open(container, 1);
    const ta = card.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "Your objective is the anchor | Describe who it serves | and what it should do." } });
    const saved = await save(card);
    expect(saved.items[0].heading).toBe("Your objective is the anchor");
    expect(saved.items[0].body).toBe("Describe who it serves | and what it should do.");
  });
});

describe("pipe characters never lose text, in every list field", () => {
  const edit = async (block: any, mutate: (card: HTMLElement) => void) => {
    const { container } = render(<LessonBlockEditor lessonId="l" blocks={[block]} />);
    const card = await open(container, 0);
    mutate(card);
    return save(card);
  };

  it("key scriptures: text containing | is kept whole, and re-saving a stored pipe doesn't change it", async () => {
    const block = { id: "ks", block_type: "key_scriptures", order_index: 0, content: { refs: [{ reference: "Prov 3:5", text: "Trust in the LORD | with all your heart" }] } };
    expect(await edit(block, () => {})).toEqual(block.content);
    cleanup(); updates.length = 0;
    const saved = await edit(block, (card) => {
      const ta = card.querySelector("textarea") as HTMLTextAreaElement;
      fireEvent.change(ta, { target: { value: ta.defaultValue + "\nJohn 3:16 | For God so loved | the world" } });
    });
    expect(saved.refs).toEqual([
      { reference: "Prov 3:5", text: "Trust in the LORD | with all your heart" },
      { reference: "John 3:16", text: "For God so loved | the world" }
    ]);
  });

  it("teaching-section scripture refs: escaped pipe in the text keeps the note in the note field", async () => {
    const block = { id: "t2", block_type: "teaching_section", order_index: 0, content: { anchor: "a", heading: "H", paragraphs: ["p"], scripture_refs: [{ key: "x", reference: "Ps 1:1", text: "Blessed | is the man", note: "a note" }] } };
    expect(await edit(block, () => {})).toEqual(block.content);
  });

  it("transcript rows keep a | inside the spoken text", async () => {
    const block = { id: "lm", block_type: "lesson_media", order_index: 0, content: { overview_heading: "x", transcript: [{ time: "00:05", text: "Use A | B when choosing" }] } };
    expect(await edit(block, () => {})).toEqual(block.content);
  });

  it("resources: label and URL survive, a pipe in the label is escaped, and typing a trailing | is not erased", async () => {
    const block = { id: "rs", block_type: "resources", order_index: 0, content: { items: [{ label: "Do | Don't sheet", url: "https://example.com/x", downloadable: true }] } };
    const { container } = render(<LessonBlockEditor lessonId="l" blocks={[block]} />);
    const card = await open(container, 0);
    const ta = card.querySelector("textarea") as HTMLTextAreaElement;
    expect(ta.value).toBe("Do \\| Don't sheet | https://example.com/x");
    fireEvent.change(ta, { target: { value: ta.value + "\nChecklist |" } });
    expect((card.querySelector("textarea") as HTMLTextAreaElement).value).toMatch(/Checklist \|$/); // the pipe is still there
    fireEvent.change(card.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Do \\| Don't sheet | https://example.com/x\nChecklist | https://example.com/c" } });
    const saved = await save(card);
    expect(saved.items).toEqual([
      { label: "Do | Don't sheet", url: "https://example.com/x", downloadable: true },
      { label: "Checklist", url: "https://example.com/c", downloadable: true }
    ]);
  });
});
