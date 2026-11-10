import { newSection, type Payload, type Section, type SectionType } from "./doc";

/** Optional starting points. A template only creates empty, titled sections you then fill in; every section can be renamed, moved, duplicated or deleted. */
export interface Template { key: string; name: string; blurb: string; minutes: number; student: [SectionType, string][]; instructor: [SectionType, string][]; objectives: string[] }
export const TEMPLATES: Template[] = [
  { key: "bible-teaching", name: "Bible teaching", blurb: "A Scripture-based lesson with context, teaching points, discussion and homework.", minutes: 40,
    objectives: ["", "", ""],
    student: [["text", "Introduction"], ["part", "Key Scriptures"], ["scripture", "Scripture reading"], ["part", "Teaching"], ["text", "Teaching point 1"], ["text", "Teaching point 2"], ["text", "Teaching point 3"], ["discussion", "Discussion questions"], ["activity", "Activity"], ["reflection", "Personal reflection"], ["homework", "Homework"]],
    instructor: [["text", "Overview"], ["timing", "Timing"], ["script", "Teaching script"], ["example", "Personal examples and illustrations"], ["facilitation", "Facilitation notes"], ["reminder", "Reminders"]] },
  { key: "vocal-exercise", name: "Vocal exercise lesson", blurb: "A technique lesson: purpose, warm-up, the exercise, care notes and practice.", minutes: 30,
    objectives: ["", ""],
    student: [["text", "Why this matters"], ["text", "Warm-up"], ["activity", "The exercise"], ["text", "Care and safety"], ["media", "Demonstration"], ["homework", "Practice plan"], ["reflection", "How did it feel?"]],
    instructor: [["script", "Demonstration script"], ["timing", "Timing"], ["facilitation", "What to listen and look for"], ["reminder", "Reminders"]] },
  { key: "worship-leadership", name: "Worship leadership development", blurb: "Character and craft for people who lead others in worship.", minutes: 45,
    objectives: ["", "", ""],
    student: [["text", "Introduction"], ["part", "Key Scriptures"], ["scripture", "Scripture reading"], ["text", "Leading well"], ["activity", "Leadership activity"], ["discussion", "Discussion questions"], ["reflection", "Personal reflection"], ["homework", "Put it into practice"]],
    instructor: [["text", "Overview"], ["script", "Teaching script"], ["example", "Examples from ministry"], ["facilitation", "Facilitation notes"], ["reminder", "Reminders"]] },
  { key: "practical-coaching", name: "Practical coaching lesson", blurb: "A one-to-one coaching session with a focus, practice steps and a follow-up.", minutes: 30,
    objectives: ["", ""],
    student: [["text", "Today's focus"], ["activity", "Practice in the lesson"], ["text", "What to remember"], ["homework", "This week's practice"], ["reflection", "Check-in questions"]],
    instructor: [["script", "Session plan"], ["timing", "Timing"], ["facilitation", "Coaching notes"], ["reminder", "Follow up next lesson"]] },
  { key: "scripture-to-song", name: "Scripture-to-song activity", blurb: "Turn a passage into an original sung response, in your own words.", minutes: 40,
    objectives: ["", ""],
    student: [["text", "Introduction"], ["scripture", "Scripture reading"], ["activity", "Scripture-to-song steps"], ["media", "Example or backing track"], ["reflection", "Reflection"], ["homework", "Write and sing your response"]],
    instructor: [["script", "Teaching script"], ["timing", "Timing"], ["facilitation", "Facilitation notes"], ["reminder", "Reminders (use original words; do not copy existing lyrics)"]] }
];
export const templateByKey = (k: string | null | undefined) => TEMPLATES.find((t) => t.key === k);
export function payloadFromTemplate(title: string, tpl: Template | undefined): Payload {
  const mk = (rows: [SectionType, string][]): Section[] => rows.map(([type, name]) => newSection(type, name));
  return tpl
    ? { title, description: "", estimated_minutes: tpl.minutes, objectives: tpl.objectives.filter(Boolean), student: { sections: mk(tpl.student) }, instructor: { sections: mk(tpl.instructor) } }
    : { title, description: "", estimated_minutes: null, objectives: [], student: { sections: [newSection("text", "Introduction")] }, instructor: { sections: [newSection("script", "Teaching script")] } };
}
