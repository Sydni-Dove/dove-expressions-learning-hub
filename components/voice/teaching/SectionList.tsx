"use client";

import { useRef, useState } from "react";
import RichText from "./RichText";
import { SECTION_LABEL, docText, newId, newSection, safeHttps, wordCount, type Content, type MediaItem, type Section, type SectionType } from "@/lib/voice-teaching/doc";

const field = "mt-1 block font-normal min-h-[44px] w-full rounded-xl border border-[#630000]/25 bg-white px-3 py-2 text-base text-[#1B1717] focus:outline-none focus:ring-2 focus:ring-[#630000]/40";
const ib = "inline-flex h-10 min-w-[40px] items-center justify-center rounded-lg border border-[#630000]/20 bg-white px-2 text-sm font-semibold text-[#630000] hover:bg-[#F2DFD8] disabled:opacity-35";
const HINT: Partial<Record<SectionType, string>> = {
  scripture: "Add the reference as the title, then your explanation. Read the passage from your own Bible.", discussion: "Use a numbered list of questions.", reflection: "Questions for private reflection.",
  homework: "Describe the practice or homework. Use a numbered list for steps.", activity: "Describe the activity and its steps.", script: "Your detailed teaching script.", timing: "Minutes for each part of the session.",
  example: "A personal example or illustration.", facilitation: "Notes on how to lead this.", reminder: "An instructor-only reminder.", part: "A heading that groups the sections below it."
};
const KINDS: { v: MediaItem["kind"]; l: string }[] = [{ v: "video", l: "Video" }, { v: "audio", l: "Audio" }, { v: "file", l: "File / document" }, { v: "link", l: "Link" }];

function MediaEditor({ items, onChange, editable }: { items: MediaItem[]; onChange: (m: MediaItem[]) => void; editable: boolean }) {
  const set = (i: number, patch: Partial<MediaItem>) => onChange(items.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="mt-3 rounded-xl bg-[#FBF4F1] p-3">
      <p className="text-sm font-semibold text-[#630000]">Videos, audio and supporting materials</p>
      <p className="text-xs text-[#4a3a3a]">Paste a YouTube or Vimeo address, a direct audio/video file address, or a link to a document. Addresses must start with https://.</p>
      {items.map((m, i) => (
        <div key={m.id} className="mt-2 grid gap-2 rounded-xl border border-[#630000]/15 bg-white p-2 sm:grid-cols-[9rem_1fr_1.4fr_auto]">
          <select aria-label="Media type" className={field} value={m.kind} disabled={!editable} onChange={(e) => set(i, { kind: e.target.value as MediaItem["kind"] })}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
          <input aria-label="Media title" className={field} placeholder="Title or caption" value={m.title} disabled={!editable} maxLength={200} onChange={(e) => set(i, { title: e.target.value })} />
          <div><input aria-label="Media address" className={field} placeholder="https://…" value={m.url} disabled={!editable} onChange={(e) => set(i, { url: e.target.value })} />
            {m.url && !safeHttps(m.url) && <p role="alert" className="mt-1 text-xs text-[#9b1c1c]">This address will not be saved or shown. It must be a valid https:// address.</p>}</div>
          {editable && <button type="button" className={ib} aria-label="Remove media" onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>}
        </div>))}
      {editable && <button type="button" className={`${ib} mt-2`} onClick={() => onChange([...items, { id: newId(), kind: "video", url: "", title: "" }])}>+ Add media</button>}
    </div>
  );
}

export default function SectionList({ content, onChange, types, editable, label }: { content: Content; onChange: (c: Content) => void; types: SectionType[]; editable: boolean; label: string }) {
  const [open, setOpen] = useState<string | null>(content.sections[0]?.id ?? null);
  const [addType, setAddType] = useState<SectionType>(types[0]);
  const s = content.sections;
  const latest = useRef(content); latest.current = content; // edits always apply to the newest content, so typing in one section can never overwrite another
  const put = (next: Section[]) => { latest.current = { sections: next }; onChange(latest.current); };
  const patch = (id: string, p: Partial<Section>) => put(latest.current.sections.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => { const n = [...s]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); put(n); };
  const dup = (i: number) => { const c: Section = JSON.parse(JSON.stringify(s[i])); c.id = newId(); c.title = c.title ? `${c.title} (copy)` : c.title; c.media = c.media?.map((m) => ({ ...m, id: newId() })); const n = [...s]; n.splice(i + 1, 0, c); put(n); setOpen(c.id); };
  const del = (i: number) => { if (!window.confirm(`Remove “${s[i].title || "this section"}”? You can get it back from History.`)) return; put(s.filter((_, j) => j !== i)); };
  const add = (at: number) => { const n = newSection(addType, ""); const arr = [...s]; arr.splice(at, 0, n); put(arr); setOpen(n.id); };
  const AddBar = ({ at }: { at: number }) => editable ? (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`add-${label}-${at}`}>Section type</label>
      <select id={`add-${label}-${at}`} className="min-h-[44px] rounded-xl border border-[#630000]/25 bg-white px-3 text-sm" value={addType} onChange={(e) => setAddType(e.target.value as SectionType)}>{types.map((t) => <option key={t} value={t}>{SECTION_LABEL[t]}</option>)}</select>
      <button type="button" className="min-h-[44px] rounded-full bg-[#630000] px-5 text-sm font-bold text-white" onClick={() => add(at)}>+ Add section</button>
    </div>) : null;
  return (
    <div className="space-y-3">
      <AddBar at={0} />
      {s.length === 0 && <p className="rounded-xl border border-dashed border-[#630000]/30 p-6 text-center text-sm text-[#4a3a3a]">No sections yet. Add one above.</p>}
      <ol className="space-y-3">{s.map((sec, i) => {
        const isOpen = open === sec.id; const txt = docText(sec.doc);
        return (
          <li key={sec.id} className={`rounded-2xl border bg-white ${isOpen ? "border-[#630000] shadow-md" : "border-[#630000]/20"} ${sec.type === "part" ? "bg-[#FBF4F1]" : ""}`}>
            <div className="flex flex-wrap items-center gap-2 p-2">
              <button type="button" className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : sec.id)}>
                <span className="shrink-0 rounded-full bg-[#630000] px-2 py-0.5 text-xs font-bold text-white">{i + 1}</span>
                <span className="min-w-0"><span className="block truncate font-semibold text-[#630000]">{sec.title || <em className="font-normal text-[#4a3a3a]">Untitled</em>}</span>
                  <span className="block truncate text-xs text-[#4a3a3a]">{SECTION_LABEL[sec.type]}{txt ? ` · ${txt.slice(0, 80)}` : " · empty"}</span></span>
              </button>
              {editable && <div className="flex shrink-0 gap-1" role="group" aria-label={`Actions for ${sec.title || "section " + (i + 1)}`}>
                <button type="button" className={ib} aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className={ib} aria-label="Move down" disabled={i === s.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className={ib} aria-label="Duplicate section" onClick={() => dup(i)}>Duplicate</button>
                <button type="button" className={ib} aria-label="Delete section" onClick={() => del(i)}>Delete</button></div>}
            </div>
            {isOpen && (
              <div className="space-y-3 border-t border-[#630000]/15 p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                  <label className="text-sm font-semibold text-[#630000]">Type<select className={field} value={sec.type} disabled={!editable} onChange={(e) => patch(sec.id, { type: e.target.value as SectionType })}>{[...new Set([...types, sec.type])].map((t) => <option key={t} value={t}>{SECTION_LABEL[t]}</option>)}</select></label>
                  <label className="text-sm font-semibold text-[#630000]">Heading<input className={field} value={sec.title} disabled={!editable} maxLength={300} onChange={(e) => patch(sec.id, { title: e.target.value })} placeholder="Section heading" /></label>
                </div>
                <RichText key={sec.id} label={`${sec.title || SECTION_LABEL[sec.type]} text`} value={sec.doc} editable={editable} placeholder={HINT[sec.type] ?? "Write here…"} onChange={(doc) => patch(sec.id, { doc })} />
                <MediaEditor items={sec.media ?? []} editable={editable} onChange={(m) => patch(sec.id, { media: m })} />
                <p className="text-xs text-[#4a3a3a]">{wordCount({ sections: [sec] })} words</p>
              </div>)}
          </li>);
      })}</ol>
      {s.length > 3 && <AddBar at={s.length} />}
    </div>
  );
}
