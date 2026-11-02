import type { InstructorNotes, Point, ScriptureNote, StudentContent } from "@/lib/voice-teaching/types";

const h2 = "font-display text-2xl text-[#630000]";
function Paras({ items }: { items: string[] }) { return <>{items.map((t, i) => <p key={i} className="mt-2 font-body text-[#201414]">{t}</p>)}</>; }
function Points({ items }: { items: Point[] }) {
  return <div className="mt-3 space-y-4">{items.map((p) => (
    <div key={p.heading} className="rounded-2xl border border-[#630000]/15 bg-white p-4">
      <h3 className="font-ui text-base font-bold text-[#630000]">{p.heading}</h3><Paras items={p.body} />
      {p.example && <p className="mt-3 rounded-xl bg-[#F2DFD8]/60 p-3 font-body text-sm text-[#201414]"><strong>Example. </strong>{p.example}</p>}
    </div>))}</div>;
}
const List = ({ items, ordered }: { items: string[]; ordered?: boolean }) => {
  const Tag = ordered ? "ol" : "ul";
  return <Tag className={`mt-2 space-y-1 pl-5 font-body text-[#201414] ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((t, i) => <li key={i}>{t}</li>)}</Tag>;
};

/** Everything a student may read once the instructor has assigned the teaching. Contains no instructor-only notes. */
export function StudentTeaching({ title, summary, minutes, objectives, scriptures, content }: { title: string; summary: string | null; minutes: number | null; objectives: string[]; scriptures: ScriptureNote[]; content: StudentContent }) {
  return (
    <article className="space-y-8">
      <header><h1 className="font-display text-3xl text-[#630000] sm:text-4xl">{title}</h1>
        {summary && <p className="mt-2 max-w-3xl font-body text-[#4a3a3a]">{summary}</p>}
        {minutes && <p className="mt-1 font-ui text-xs font-semibold text-[#4a3a3a]">About {minutes} minutes with your instructor</p>}</header>
      <section aria-labelledby="t-intro"><h2 id="t-intro" className={h2}>Introduction</h2><Paras items={content.intro} /></section>
      <section aria-labelledby="t-obj"><h2 id="t-obj" className={h2}>What you will learn</h2><List items={objectives} /></section>
      <section aria-labelledby="t-scr"><h2 id="t-scr" className={h2}>Key Scriptures</h2>
        <p className="mt-1 font-body text-sm text-[#4a3a3a]">Read each passage in your own Bible. The notes below are a paraphrase and background, not a replacement for the text.</p>
        <div className="mt-3 space-y-3">{scriptures.map((s) => (
          <div key={s.ref} className="rounded-2xl bg-[#FBF4F1] p-4"><h3 className="font-ui font-bold text-[#630000]">{s.ref}</h3>
            <p className="mt-1 font-body text-[#201414]">{s.paraphrase}</p><p className="mt-2 font-body text-sm text-[#4a3a3a]"><strong>Context. </strong>{s.context}</p></div>))}</div></section>
      <section aria-labelledby="t-points"><h2 id="t-points" className={h2}>Teaching</h2><Points items={content.points} /></section>
      {content.featured && (
        <section aria-labelledby="t-feat" className="rounded-3xl border-2 border-[#630000]/30 p-4 sm:p-6"><h2 id="t-feat" className={h2}>{content.featured.title}</h2>
          {content.featured.coreStatement && <blockquote className="mt-3 border-l-4 border-[#630000] bg-[#F2DFD8]/50 p-4 font-display text-lg italic text-[#630000]">{content.featured.coreStatement}</blockquote>}
          <Points items={content.featured.sections} /></section>)}
      {content.leaders && (
        <section aria-labelledby="t-lead"><h2 id="t-lead" className={h2}>{content.leaders.title}</h2><Points items={content.leaders.sections} /></section>)}
      <section aria-labelledby="t-disc"><h2 id="t-disc" className={h2}>Discussion questions</h2><List ordered items={content.discussion} /></section>
      <section aria-labelledby="t-act"><h2 id="t-act" className={h2}>Interactive activity: {content.activity.title}</h2>
        <p className="mt-2 font-body text-[#201414]">{content.activity.setup}</p><List ordered items={content.activity.steps} />
        <h3 className="mt-4 font-ui font-bold text-[#630000]">Talk it through</h3><List items={content.activity.debrief} /></section>
      <section aria-labelledby="t-ref"><h2 id="t-ref" className={h2}>Personal reflection</h2><p className="font-body text-sm text-[#4a3a3a]">Write your answers privately. Only you and your instructor see what you submit.</p><List items={content.reflection} /></section>
      <section aria-labelledby="t-asg"><h2 id="t-asg" className={h2}>Take-home assignment: {content.assignment.title}</h2>
        <p className="mt-2 font-body text-[#201414]">{content.assignment.summary}</p><List ordered items={content.assignment.steps} />
        <p className="mt-2 font-ui text-xs font-semibold text-[#4a3a3a]">Plan for about {content.assignment.minutes} minutes across the week.</p></section>
      <section aria-labelledby="t-app"><h2 id="t-app" className={h2}>Applying this in praise team ministry</h2><List items={content.application} /></section>
    </article>
  );
}

/** Instructor-only teaching notes. Rendered only on staff pages; the data comes from a table students cannot read. */
export function InstructorTeaching({ notes }: { notes: InstructorNotes }) {
  return (
    <div className="space-y-6">
      <section><h3 className="font-ui text-lg font-bold text-[#630000]">Overview</h3><Paras items={notes.overview} /></section>
      <section><h3 className="font-ui text-lg font-bold text-[#630000]">Suggested timing</h3>
        <ul className="mt-2 divide-y divide-[#630000]/10 font-body">{notes.timing.map((t) => <li key={t.segment} className="flex gap-3 py-2"><span className="w-16 shrink-0 font-ui text-sm font-bold">{t.minutes} min</span><span>{t.segment}</span></li>)}</ul></section>
      <section><h3 className="font-ui text-lg font-bold text-[#630000]">Teaching notes</h3><Points items={notes.notes} /></section>
      {notes.featuredNotes && <section><h3 className="font-ui text-lg font-bold text-[#630000]">Notes: featured teaching</h3><Points items={notes.featuredNotes} /></section>}
      {notes.leaderNotes && <section><h3 className="font-ui text-lg font-bold text-[#630000]">Notes: leaders&apos; section</h3><Points items={notes.leaderNotes} /></section>}
      <section><h3 className="font-ui text-lg font-bold text-[#630000]">Facilitation tips</h3><List items={notes.facilitation} /></section>
      <section className="rounded-2xl bg-amber-50 p-4"><h3 className="font-ui text-lg font-bold text-amber-900">Cautions</h3><List items={notes.cautions} /></section>
    </div>
  );
}
