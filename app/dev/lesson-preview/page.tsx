import { notFound } from "next/navigation";
import LessonExperience from "@/components/lesson/LessonExperience";
import sampleBlocks from "@/lib/app-objective-sample.json";
import type { LessonBlock } from "@/lib/types";

/**
 * TEST-ONLY harness. Renders the real lesson UI from fixture blocks with no
 * database or auth, so browser tests can exercise Do This Now, prompt cards,
 * Previous/Next and the practical/reflective styles at phone and desktop widths
 * without touching the live Supabase project. Returns 404 unless
 * NEXT_PUBLIC_ENABLE_DEV_HARNESS=1 (set only by the Playwright web server).
 */
export const dynamic = "force-dynamic";

const PROMPT = "I want to build [idea]. The main objective is [objective].\n\nRules:\n  1. Ask me questions first.\n  2. Do not write code yet.";

const blocks = (style: string): LessonBlock[] => [
  { id: "b1", lesson_id: "l", block_type: "teaching_section", order_index: 0, content: { anchor: "intro", section_number: "01", heading: "Start with the objective", paragraphs: ["Before you build anything, say what it is for."] } },
  { id: "b2", lesson_id: "l", block_type: "do_this_now", order_index: 1, content: { title: "Do this now", instruction: "Write the one-sentence objective for your app or website.", items: ["who it is for", "the main thing the user should be able to do", "what you would need to see working before you can evaluate it"] } },
  { id: "b3", lesson_id: "l", block_type: "prompt_card", order_index: 2, content: { label: "STRATEGIST PROMPT", prompt: PROMPT } },
  { id: "b4", lesson_id: "l", block_type: "resources", order_index: 3, content: { items: [{ label: "Checklist (PDF)", url: "https://example.com/checklist.pdf" }, { label: "Locked sheet", url: "unavailable://denied" }] } },
  ...(style === "reflective" ? [{ id: "b5", lesson_id: "l", block_type: "reflection_question", order_index: 4, content: { prompt: "What is God highlighting?" } }] : [])
];

export default function Page({ searchParams }: { searchParams: { style?: string; pos?: string; sample?: string } }) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_HARNESS !== "1") notFound();
  const style = searchParams.style === "reflective" ? "reflective" : "practical";
  const pos = searchParams.pos === "first" ? "first" : searchParams.pos === "last" ? "last" : "middle";
  return (
    <LessonExperience
      lessonId="l"
      lessonTitle={searchParams.sample ? "Lesson 1.1 — Start With the Objective, Not the Technology" : "Fixture lesson"}
      eyebrow="Fixture course · Lesson 2 of 5"
      courseId="c"
      courseTitle={searchParams.sample ? "How to Make an App with AI" : "Fixture course"}
      instructorName="Sydni"
      durationLabel="10 min"
      statusLabel="Not started"
      moduleIndexLabel="02"
      courseProgressPercent={20}
      blocks={searchParams.sample ? sampleBlocks.map((b, i) => ({ ...b, id: `sample-${i}`, lesson_id: "l", order_index: i })) as LessonBlock[] : blocks(style)}
      userId="u"
      isComplete={false}
      initiallyBookmarked={false}
      reflectionStarted={false}
      markCompleteButton={<button className="btn-primary" data-testid="mark-complete">Mark lesson complete</button>}
      reflectionForm={<div data-testid="reflection-form">8-part reflection form</div>}
      lessonStyle={style}
      nav={{ previousId: pos === "first" ? null : "p", nextId: pos === "last" ? null : "n", isLast: pos === "last" }}
      myBuildHref={style === "practical" ? "/courses/c/my-build" : undefined}
    />
  );
}
