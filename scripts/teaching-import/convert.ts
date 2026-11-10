/** One-time conversion of the original manuscripts into editable, database-ready documents. Used by generate-seed.ts and by the preservation test. */
import { emptyDoc, type Content, type Doc, type DocNode, type Payload, type Section, type SectionType } from "../../lib/voice-teaching/doc";
import type { Point, TeachingModule } from "./types";

const t = (text: string, bold = false): DocNode => (bold ? { type: "text", text, marks: [{ type: "bold" }] } : { type: "text", text });
const p = (...kids: DocNode[]): DocNode => ({ type: "paragraph", content: kids });
const para = (s: string) => p(t(s));
const h = (s: string, level = 3): DocNode => ({ type: "heading", attrs: { level }, content: [t(s)] });
const li = (s: string): DocNode => ({ type: "listItem", content: [para(s)] });
const ul = (items: string[]): DocNode => ({ type: "bulletList", content: items.map(li) });
const ol = (items: string[]): DocNode => ({ type: "orderedList", content: items.map(li) });
const quote = (s: string): DocNode => ({ type: "blockquote", content: [para(s)] });
const doc = (...nodes: DocNode[]): Doc => ({ type: "doc", content: nodes.length ? nodes : emptyDoc().content });
let n = 0;
const sec = (type: SectionType, title: string, d: Doc = doc()): Section => ({ id: `s${String(++n).padStart(3, "0")}`, type, title, doc: d });
const pointSection = (pt: Point, type: SectionType = "text"): Section => sec(type, pt.heading.replace(/^\d+\.\s*/, ""), doc(...pt.body.map(para), ...(pt.example ? [p(t("Example. ", true), t(pt.example))] : [])));

export function toPayload(m: TeachingModule): Payload {
  n = 0;
  const s = m.student;
  const student: Section[] = [
    sec("text", "Introduction", doc(...s.intro.map(para))),
    sec("part", "Key Scriptures"),
    ...m.scriptures.map((x) => sec("scripture", x.ref, doc(para(x.paraphrase), p(t("Context. ", true), t(x.context))))),
    sec("part", "Teaching"),
    ...s.points.map((x) => pointSection(x)),
    ...(s.featured ? [sec("part", s.featured.title, s.featured.coreStatement ? doc(quote(s.featured.coreStatement)) : doc()), ...s.featured.sections.map((x) => pointSection(x))] : []),
    ...(s.leaders ? [sec("part", s.leaders.title), ...s.leaders.sections.map((x) => pointSection(x))] : []),
    sec("discussion", "Discussion questions", doc(ol(s.discussion))),
    sec("activity", `Interactive activity: ${s.activity.title}`, doc(para(s.activity.setup), ol(s.activity.steps), h("Talk it through"), ul(s.activity.debrief))),
    sec("reflection", "Personal reflection", doc(ul(s.reflection))),
    sec("homework", `Take-home assignment: ${s.assignment.title}`, doc(para(s.assignment.summary), ol(s.assignment.steps), para(`Plan for about ${s.assignment.minutes} minutes across the week.`))),
    sec("text", "Applying this in praise team ministry", doc(ul(s.application)))
  ];
  const i = m.instructor;
  const instructor: Section[] = [
    sec("text", "Main message", doc(para(m.mainMessage))),
    sec("text", "Overview", doc(...i.overview.map(para))),
    sec("timing", "Suggested timing", doc(ul(i.timing.map((x) => `${x.minutes} min — ${x.segment}`)))),
    sec("part", "Teaching notes"),
    ...i.notes.map((x) => pointSection(x, "script")),
    ...(i.featuredNotes ? [sec("part", "Notes: featured teaching"), ...i.featuredNotes.map((x) => pointSection(x, "script"))] : []),
    ...(i.leaderNotes ? [sec("part", "Notes: leaders' section"), ...i.leaderNotes.map((x) => pointSection(x, "script"))] : []),
    sec("facilitation", "Facilitation tips", doc(ul(i.facilitation))),
    sec("reminder", "Cautions", doc(ul(i.cautions)))
  ];
  const c = (sections: Section[]): Content => ({ sections });
  return { title: m.title, description: m.summary, estimated_minutes: m.estimatedMinutes, objectives: m.objectives, student: c(student), instructor: c(instructor) };
}
/** Categories for the three imported teachings (all remain editable in the app). */
export const IMPORT_CATEGORIES: Record<string, string[]> = {
  "praise-is-what-i-do": ["spiritual-foundations"],
  "being-in-the-word": ["spiritual-foundations"],
  "psyche-of-a-praiser": ["spiritual-foundations", "personal-ministry-development"]
};
