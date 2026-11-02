import { Fragment, type ReactNode } from "react";
import { SECTION_LABEL, embedFor, sanitizeContent, sanitizeDoc, type Content, type DocNode, type MediaItem, type Section, type Doc } from "@/lib/voice-teaching/doc";

/** Renders stored teaching content. Content is re-sanitized on every render and turned into React elements (never injected as HTML),
 *  so unsafe markup, script or links cannot appear even if bad data were somehow stored. */
function inline(n: DocNode, key: number): ReactNode {
  if (n.type === "hardBreak") return <br key={key} />;
  let el: ReactNode = n.text ?? "";
  for (const m of n.marks ?? []) {
    if (m.type === "bold") el = <strong>{el}</strong>;
    else if (m.type === "italic") el = <em>{el}</em>;
    else if (m.type === "underline") el = <u>{el}</u>;
    else if (m.type === "strike") el = <s>{el}</s>;
    else if (m.type === "link" && m.attrs?.href) el = <a href={m.attrs.href} target="_blank" rel="noopener noreferrer nofollow" className="text-[#630000] underline">{el}</a>;
  }
  return <Fragment key={key}>{el}</Fragment>;
}
function block(n: DocNode, key: number): ReactNode {
  const kids = (n.content ?? []);
  switch (n.type) {
    case "paragraph": return <p key={key} className="tt-p">{kids.length ? kids.map(inline) : <br />}</p>;
    case "heading": { const l = Number(n.attrs?.level); return l === 2 ? <h4 key={key} className="tt-h2">{kids.map(inline)}</h4> : <h5 key={key} className="tt-h3">{kids.map(inline)}</h5>; }
    case "bulletList": return <ul key={key} className="tt-ul">{kids.map(block)}</ul>;
    case "orderedList": return <ol key={key} className="tt-ol">{kids.map(block)}</ol>;
    case "listItem": return <li key={key}>{kids.map(block)}</li>;
    case "blockquote": return <blockquote key={key} className="tt-quote">{kids.map(block)}</blockquote>;
    default: return null;
  }
}
export function DocView({ doc }: { doc: Doc | unknown }) { return <div className="tt-prose">{sanitizeDoc(doc).content.map(block)}</div>; }

export function MediaView({ items }: { items: MediaItem[] }) {
  return <div className="mt-3 space-y-3">{items.map((m) => {
    const e = embedFor(m); if (!e) return null;
    const label = m.title || (m.kind === "file" ? "Supporting file" : "Open link");
    return (
      <figure key={m.id} className="rounded-2xl border border-[#630000]/15 bg-white p-3">
        {e.mode === "iframe" && <div className="aspect-video w-full overflow-hidden rounded-xl bg-black"><iframe src={e.src} title={label} className="h-full w-full" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" /></div>}
        {e.mode === "video" && <video src={e.src} controls preload="metadata" className="w-full rounded-xl" />}
        {e.mode === "audio" && <audio src={e.src} controls preload="metadata" className="w-full" />}
        {e.mode === "link" && <a href={e.src} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-[44px] items-center font-ui font-semibold text-[#630000] underline">{label}</a>}
        {e.mode !== "link" && m.title && <figcaption className="mt-2 font-ui text-sm text-[#4a3a3a]">{m.title}</figcaption>}
      </figure>);
  })}</div>;
}

export function SectionsView({ content, audience }: { content: Content | unknown; audience: "student" | "instructor" }) {
  const c = sanitizeContent(content);
  const part = (s: Section) => (
    <div key={s.id} className="pt-4"><h2 className="border-b-2 border-[#630000]/30 pb-1 font-display text-2xl text-[#630000]">{s.title}</h2>
      {s.doc.content.some((n) => n.content?.length) && <DocView doc={s.doc} />}{s.media?.length ? <MediaView items={s.media} /> : null}</div>);
  return (
    <div className="space-y-5">{c.sections.map((s) => s.type === "part" ? part(s) : (
      <section key={s.id} className={`rounded-2xl border bg-white p-4 sm:p-5 ${audience === "instructor" ? "border-amber-300" : "border-[#630000]/15"}`}>
        {(s.title || audience === "instructor") && <h3 className="font-ui text-lg font-bold text-[#630000]">{s.title}{audience === "instructor" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle font-ui text-[11px] font-semibold text-amber-900">{SECTION_LABEL[s.type]}</span>}</h3>}
        <DocView doc={s.doc} />{s.media?.length ? <MediaView items={s.media} /> : null}
      </section>))}</div>
  );
}

/** Exactly what a student sees. Used by the student page and by the editor's Preview tab, so the two can never differ. */
export function StudentLesson({ title, description, minutes, objectives, content, version }: { title: string; description?: string | null; minutes?: number | null; objectives?: unknown; content: unknown; version?: number | null }) {
  const objs = Array.isArray(objectives) ? (objectives as unknown[]).filter((o): o is string => typeof o === "string" && !!o.trim()) : [];
  return (
    <article className="space-y-6">
      <header><h1 className="font-display text-3xl text-[#630000] sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl font-body text-[#4a3a3a]">{description}</p>}
        <p className="mt-1 font-ui text-xs font-semibold text-[#4a3a3a]">{minutes ? `About ${minutes} minutes with your instructor` : ""}{minutes && version ? " · " : ""}{version ? `Version ${version}` : ""}</p></header>
      {objs.length > 0 && <section aria-labelledby="t-obj"><h2 id="t-obj" className="font-display text-2xl text-[#630000]">What you will learn</h2><ul className="tt-ul mt-2">{objs.map((o, i) => <li key={i}>{o}</li>)}</ul></section>}
      <SectionsView content={content} audience="student" />
    </article>
  );
}
