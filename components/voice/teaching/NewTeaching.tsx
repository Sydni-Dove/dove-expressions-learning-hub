"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/voice-rpc";
import { TEMPLATES, payloadFromTemplate, templateByKey } from "@/lib/voice-teaching/templates";

const field = "mt-1 block font-normal min-h-[44px] w-full rounded-xl border border-[#630000]/25 bg-white px-3 py-2 text-base text-[#1B1717]";
/** Create a teaching from scratch, optionally starting from a template. Every template is just a set of empty, editable sections. */
export default function NewTeaching({ categories }: { categories: { slug: string; name: string }[] }) {
  const router = useRouter(); const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(""); const [tpl, setTpl] = useState(""); const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function create() {
    setBusy(true); setErr("");
    const r = await callRpc<string>("dp_teaching_create", { p_title: title.trim(), p_template: tpl, p_categories: cats, p_payload: payloadFromTemplate(title.trim(), templateByKey(tpl)) });
    if (!r.ok) { setBusy(false); setErr(r.error); return; }
    router.push(`/staff/voice/worship/${r.data}`);
  }
  if (!open) return <button className="min-h-[44px] rounded-full bg-[#630000] px-6 text-sm font-bold text-white" onClick={() => setOpen(true)}>+ New teaching</button>;
  return (
    <section aria-labelledby="new-h" className="teach-ui space-y-4 rounded-2xl border-2 border-[#630000] bg-white p-4 sm:p-5">
      <h2 id="new-h" className="font-display text-xl text-[#630000]">New teaching</h2>
      <label className="block text-sm font-semibold text-[#630000]">Title<input className={field} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Singing the Psalms" /></label>
      <fieldset><legend className="text-sm font-semibold text-[#630000]">Start from (optional)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[{ key: "", name: "Blank page", blurb: "Start from scratch with one student section and one instructor section.", minutes: 0 }, ...TEMPLATES].map((t) => (
            <label key={t.key} className={`flex min-h-[44px] cursor-pointer gap-3 rounded-xl border p-3 ${tpl === t.key ? "border-[#630000] bg-[#FBF4F1]" : "border-[#630000]/20"}`}>
              <input type="radio" name="template" className="mt-1 h-5 w-5 accent-[#630000]" checked={tpl === t.key} onChange={() => setTpl(t.key)} /><span><span className="block font-semibold text-[#630000]">{t.name}</span><span className="block text-xs text-[#4a3a3a]">{t.blurb}</span></span></label>))}</div></fieldset>
      <fieldset><legend className="text-sm font-semibold text-[#630000]">Categories</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{categories.map((c) => <label key={c.slug} className="flex min-h-[44px] items-center gap-3 rounded-xl border border-[#630000]/15 px-3"><input type="checkbox" className="h-5 w-5 accent-[#630000]" checked={cats.includes(c.slug)} onChange={(e) => setCats(e.target.checked ? [...cats, c.slug] : cats.filter((x) => x !== c.slug))} />{c.name}</label>)}</div></fieldset>
      <div className="flex gap-2"><button className="min-h-[44px] rounded-full bg-[#630000] px-6 text-sm font-bold text-white disabled:opacity-50" disabled={busy || !title.trim()} onClick={create}>Create draft</button><button className="min-h-[44px] rounded-full border border-[#630000]/30 px-6 text-sm font-bold text-[#630000]" onClick={() => setOpen(false)}>Cancel</button></div>
      <p className="text-xs text-[#4a3a3a]">New teachings start as drafts. Nothing is visible to students until you publish and assign it.</p>
      {err && <p role="alert" className="text-sm font-semibold text-[#9b1c1c]">{err}</p>}
    </section>
  );
}
