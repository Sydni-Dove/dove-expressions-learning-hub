import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) }));
import PromptCard from "@/components/lesson/PromptCard";
import DoThisNow from "@/components/lesson/DoThisNow";
import LessonNav from "@/components/lesson/LessonNav";

afterEach(cleanup);

describe("PromptCard", () => {
  const prompt = "I want to build [idea].\n\n  - keep this indent\nSecond line";
  it("shows the label and preserves line breaks exactly", () => {
    render(<PromptCard label="STRATEGIST PROMPT" prompt={prompt} />);
    expect(screen.getByText("STRATEGIST PROMPT")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-text").textContent).toBe(prompt);
    expect(screen.getByTestId("prompt-text").className).toContain("whitespace-pre-wrap");
  });
  it("copies the exact text and shows Copied feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<PromptCard prompt={prompt} />);
    fireEvent.click(screen.getByTestId("prompt-copy"));
    await waitFor(() => expect(screen.getByTestId("prompt-copy")).toHaveTextContent("Copied"));
    expect(writeText).toHaveBeenCalledWith(prompt);
  });
  it("uses a default label when none is provided", () => {
    render(<PromptCard prompt="x" />);
    expect(screen.getByText("Prompt")).toBeInTheDocument();
  });
});

describe("DoThisNow", () => {
  it("renders the instruction and checklist", () => {
    render(<DoThisNow instruction="Write the one-sentence objective." items={["who it is for", "the main thing"]} />);
    expect(screen.getByText("Do this now")).toBeInTheDocument();
    expect(screen.getByText("Write the one-sentence objective.")).toBeInTheDocument();
    expect(screen.getByText("who it is for")).toBeInTheDocument();
  });
});

describe("LessonNav", () => {
  it("first lesson: no Previous, has Next", () => {
    render(<LessonNav courseId="c" previousId={null} nextId="n" isLast={false} />);
    expect(screen.queryByTestId("prev-lesson")).toBeNull();
    expect(screen.getByTestId("next-lesson")).toHaveAttribute("href", "/courses/c/lessons/n");
  });
  it("middle lesson: both", () => {
    render(<LessonNav courseId="c" previousId="p" nextId="n" isLast={false} />);
    expect(screen.getByTestId("prev-lesson")).toHaveAttribute("href", "/courses/c/lessons/p");
  });
  it("last lesson: finish action back to the course, no dead Next", () => {
    render(<LessonNav courseId="c" previousId="p" nextId={null} isLast />);
    expect(screen.queryByTestId("next-lesson")).toBeNull();
    expect(screen.getByTestId("finish-course")).toHaveAttribute("href", "/courses/c");
  });
});

import LessonIntro from "@/components/lesson/LessonIntro";

describe("LessonIntro stage tracker", () => {
  const base = { eyebrow: "e", title: "t", courseTitle: "c", statusLabel: "s", moduleIndex: "01", activeStage: "Teaching" as const };
  it("default (existing discipleship courses): shows the four stages", () => {
    const { container } = render(<LessonIntro {...base} />);
    const tracker = container.querySelector('[aria-label="Lesson stages"]');
    expect(tracker).not.toBeNull();
    for (const s of ["Teaching", "Reflection", "Practice", "Follow-Up"]) expect(tracker!.textContent).toContain(s);
  });
  it("practical courses pass [] and the tracker is gone", () => {
    const { container } = render(<LessonIntro {...base} stages={[]} />);
    expect(container.querySelector('[aria-label="Lesson stages"]')).toBeNull();
    expect(container.textContent).not.toMatch(/Reflection|Follow-Up/);
  });
});

import LessonToolbox from "@/components/lesson/LessonToolbox";

describe("LessonToolbox Scripture List", () => {
  const props = { lessonId: "l", userId: "u", lessonTitle: "T", lessonNotesText: "", transcriptText: "", initiallyBookmarked: false, onOpenNotes: () => {}, onOpenScriptureList: () => {} };
  it("shows the button when the lesson has scriptures (default)", () => {
    render(<LessonToolbox {...props} />);
    expect(screen.getByText("Scripture List")).toBeInTheDocument();
  });
  it("hides it when there is nothing to list, keeping the other tools", () => {
    render(<LessonToolbox {...props} hasScriptures={false} />);
    expect(screen.queryByText("Scripture List")).toBeNull();
    expect(screen.getByText("My Lesson Notes")).toBeInTheDocument();
    expect(screen.getByText("Bookmark Lesson")).toBeInTheDocument();
  });
});
