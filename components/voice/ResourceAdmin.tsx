"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, Goal, Skill, TemplateItem } from "@/lib/voice-resources";

type Student = { id: string; full_name: string | null; email: string | null };
const who = (s: Student) => s.full_name || s.email || "Student";
const msg = (e: unknown) => (e as { message?: string })?.message ?? "Something went wrong. Please try again.";

function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  async function run(work: () => Promise<string>) {
    setBusy(true); setError(""); setOk("");
    try { setOk(await work()); router.refresh(); } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }
  return { busy, error, ok, run };
}
const Note = ({ error, ok }: { error: string; ok: string }) => <>{error && <p role="alert" className="font-ui text-sm text-[#7a2c1c]">{error}</p>}{ok && <p role="status" className="font-ui text-sm">{ok}</p>}</>;

export function ExerciseManager({ skills, exercises }: { skills: Skill[]; exercises: Exercise[] }) {
  const { busy, error, ok, run } = useSave();
  const [edit, setEdit] = useState<Exercise | null>(null);
  const [f, setF] = useState({ skill: skills[0]?.id ?? "", title: "", instructions: "", url: "", source: "", minutes: "" });
  const load = (e: Exercise | null) => { setEdit(e); setF({ skill: e?.skill_id ?? skills[0]?.id ?? "", title: e?.title ?? "", instructions: e?.instructions ?? "", url: e?.video_url ?? "", source: e?.source_name ?? "", minutes: e?.minutes ? String(e.minutes) : "" }); };
  const submit = (ev: React.FormEvent) => { ev.preventDefault(); run(async () => {
    if (!f.title.trim()) throw new Error("Give the exercise a title.");
    if (f.url.trim() && !/^https:\/\/\S+$/i.test(f.url.trim())) throw new Error("Use an https:// link for the video.");
    const row = { skill_id: f.skill, title: f.title.trim(), instructions: f.instructions.trim() || null, video_url: f.url.trim() || null, source_name: f.source.trim() || null, minutes: f.minutes ? Number(f.minutes) : null };
    const supabase = createClient();
    const { error: e } = edit ? await supabase.from("dp_voice_exercises").update(row).eq("id", edit.id) : await supabase.from("dp_voice_exercises").insert(row);
    if (e) throw e; load(null); return edit ? "Exercise updated." : "Exercise added to the library.";
  }); };
  const retire = (e: Exercise) => run(async () => { const { error: er } = await createClient().from("dp_voice_exercises").update({ is_active: e.is_active === false }).eq("id", e.id); if (er) throw er; return e.is_active === false ? "Exercise restored." : "Exercise hidden from students and new plans."; });
  return <div className="space-y-5">
    <form onSubmit={submit} className="card grid gap-3 p-5 sm:grid-cols-2">
      <h3 className="font-display text-lg text-burgundy sm:col-span-2">{edit ? "Edit exercise" : "Add an exercise"}</h3>
      <label className="font-ui text-sm">Vocal skill<select value={f.skill} onChange={e => setF({ ...f, skill: e.target.value })} className="input mt-1 w-full">{skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="font-ui text-sm">Title<input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className="input mt-1 w-full" /></label>
      <label className="font-ui text-sm sm:col-span-2">Video link (https, optional)<input value={f.url} onChange={e => setF({ ...f, url: e.target.value })} className="input mt-1 w-full" placeholder="https://" /></label>
      <label className="font-ui text-sm">Where it is hosted (optional)<input value={f.source} onChange={e => setF({ ...f, source: e.target.value })} className="input mt-1 w-full" placeholder="YouTube, your channel…" /></label>
      <label className="font-ui text-sm">Minutes (optional)<input type="number" min={1} max={120} value={f.minutes} onChange={e => setF({ ...f, minutes: e.target.value })} className="input mt-1 w-full" /></label>
      <label className="font-ui text-sm sm:col-span-2">What the student should do<textarea rows={3} value={f.instructions} onChange={e => setF({ ...f, instructions: e.target.value })} className="input mt-1 w-full" /></label>
      <div className="flex gap-3 sm:col-span-2"><button disabled={busy} className="btn-primary">{busy ? "Saving…" : edit ? "Save changes" : "Add exercise"}</button>{edit && <button type="button" className="btn-secondary" onClick={() => load(null)}>Cancel</button>}</div>
      <div className="sm:col-span-2"><Note error={error} ok={ok} /></div>
    </form>
    {skills.map(s => { const list = exercises.filter(e => e.skill_id === s.id); if (!list.length) return null; return <div key={s.id} className="card p-5"><h3 className="font-display text-lg text-burgundy">{s.name}</h3>
      <ul className="mt-2 divide-y divide-charcoal/10">{list.map(e => <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className={`font-body text-sm ${e.is_active === false ? "text-charcoal/40 line-through" : ""}`}>{e.title}{e.video_url ? "" : " (no video)"}</span>
        <span className="flex gap-1 font-ui text-xs"><button className="link-action" onClick={() => load(e)}>Edit</button><button disabled={busy} className="link-action" onClick={() => retire(e)}>{e.is_active === false ? "Restore" : "Hide"}</button></span></li>)}</ul></div>; })}
  </div>;
}

export function TemplateManager({ exercises, templates }: { exercises: Exercise[]; templates: { id: string; title: string; description: string | null; items: TemplateItem[]; is_active: boolean }[] }) {
  const { busy, error, ok, run } = useSave();
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [picked, setPicked] = useState<string[]>([]);
  const active = exercises.filter(e => e.is_active !== false);
  const submit = (ev: React.FormEvent) => { ev.preventDefault(); run(async () => {
    if (!title.trim() || !picked.length) throw new Error("Add a title and choose at least one exercise.");
    const { error: e } = await createClient().from("dp_voice_plan_templates").insert({ title: title.trim(), description: description.trim() || null, items: picked.map(id => ({ exercise_id: id })) });
    if (e) throw e; setTitle(""); setDescription(""); setPicked([]); return "Template saved.";
  }); };
  const remove = (id: string, on: boolean) => run(async () => { const { error: e } = await createClient().from("dp_voice_plan_templates").update({ is_active: on }).eq("id", id); if (e) throw e; return on ? "Template restored." : "Template hidden."; });
  return <div className="space-y-4">
    <form onSubmit={submit} className="card space-y-3 p-5"><h3 className="font-display text-lg text-burgundy">New practice-plan template</h3>
      <label className="block font-ui text-sm">Template name<input value={title} onChange={e => setTitle(e.target.value)} className="input mt-1 w-full" placeholder="For example: Foundations week" /></label>
      <label className="block font-ui text-sm">Description (optional)<input value={description} onChange={e => setDescription(e.target.value)} className="input mt-1 w-full" /></label>
      <fieldset><legend className="font-ui text-sm font-semibold">Exercises (in the order you tick them)</legend>
        {active.length ? <div className="mt-2 grid gap-1 sm:grid-cols-2">{active.map(e => <label key={e.id} className="flex items-start gap-2 font-body text-sm"><input type="checkbox" checked={picked.includes(e.id)} onChange={ev => setPicked(ev.target.checked ? [...picked, e.id] : picked.filter(x => x !== e.id))} />{e.title}</label>)}</div> : <p className="font-body text-sm">Add exercises to the library first.</p>}</fieldset>
      <button disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save template"}</button><Note error={error} ok={ok} /></form>
    <ul className="space-y-2">{templates.map(t => <li key={t.id} className="card flex flex-wrap items-center justify-between gap-2 p-4"><span className={`font-body text-sm ${t.is_active ? "" : "text-charcoal/40 line-through"}`}><strong>{t.title}</strong> · {t.items.length} exercise{t.items.length === 1 ? "" : "s"}</span><button disabled={busy} className="link-action font-ui text-xs" onClick={() => remove(t.id, !t.is_active)}>{t.is_active ? "Hide" : "Restore"}</button></li>)}</ul>
  </div>;
}

export function ContentEditor({ content }: { content: { key: string; title: string; body: string }[] }) {
  const { busy, error, ok, run } = useSave();
  const [vals, setVals] = useState(Object.fromEntries(content.map(c => [c.key, c])));
  return <div className="space-y-4">{content.map(c => <div key={c.key} className="card space-y-2 p-5"><label className="block font-ui text-sm font-semibold">Heading<input value={vals[c.key].title} onChange={e => setVals({ ...vals, [c.key]: { ...vals[c.key], title: e.target.value } })} className="input mt-1 w-full" /></label>
    <label className="block font-ui text-sm font-semibold">{c.key === "welcome" ? "Welcome" : "Practice guide"}<textarea rows={c.key === "welcome" ? 6 : 10} value={vals[c.key].body} onChange={e => setVals({ ...vals, [c.key]: { ...vals[c.key], body: e.target.value } })} className="input mt-1 w-full" /></label>
    <button disabled={busy} className="btn-primary" onClick={() => run(async () => { const v = vals[c.key]; if (!v.title.trim() || !v.body.trim()) throw new Error("Heading and text cannot be empty."); const { error: e } = await createClient().from("dp_voice_resource_content").update({ title: v.title.trim(), body: v.body.trim() }).eq("key", c.key); if (e) throw e; return "Saved."; })}>Save</button></div>)}
    <Note error={error} ok={ok} /></div>;
}

export function AssignPlanForm({ students, exercises, templates }: { students: Student[]; exercises: Exercise[]; templates: { id: string; title: string; items: TemplateItem[]; is_active: boolean }[] }) {
  const { busy, error, ok, run } = useSave();
  const [f, setF] = useState({ student: "", title: "", notes: "", goal: "", due: "" });
  const [picked, setPicked] = useState<{ id: string; note: string; minutes: string }[]>([]);
  const active = exercises.filter(e => e.is_active !== false);
  const applyTemplate = (id: string) => { const t = templates.find(x => x.id === id); if (t) setPicked(t.items.filter(i => active.some(e => e.id === i.exercise_id)).map(i => ({ id: i.exercise_id, note: i.note ?? "", minutes: i.minutes ? String(i.minutes) : "" }))); };
  const toggle = (id: string, on: boolean) => setPicked(on ? [...picked, { id, note: "", minutes: "" }] : picked.filter(p => p.id !== id));
  const submit = (ev: React.FormEvent) => { ev.preventDefault(); run(async () => {
    if (!f.student || !f.title.trim() || !picked.length) throw new Error("Choose a student, a title and at least one exercise.");
    const items = picked.map(p => ({ exercise_id: p.id, note: p.note.trim() || undefined, minutes: p.minutes ? Number(p.minutes) : undefined }));
    const { error: e } = await createClient().rpc("dp_assign_weekly_plan", { student: f.student, plan_title: f.title, notes: f.notes, goal_text: f.goal, due: f.due || null, items });
    if (e) throw e; setPicked([]); setF({ ...f, title: "", notes: "", goal: "", due: "" }); return "Plan assigned. The student sees it under This week’s practice plan.";
  }); };
  return <form onSubmit={submit} className="card space-y-3 p-5"><h3 className="font-display text-lg text-burgundy">Assign a weekly practice plan</h3>
    <label className="block font-ui text-sm">Student<select value={f.student} onChange={e => setF({ ...f, student: e.target.value })} className="input mt-1 w-full"><option value="">Choose…</option>{students.map(s => <option key={s.id} value={s.id}>{who(s)}</option>)}</select></label>
    {templates.filter(t => t.is_active).length > 0 && <label className="block font-ui text-sm">Start from a template (optional)<select defaultValue="" onChange={e => { applyTemplate(e.target.value); e.target.value = ""; }} className="input mt-1 w-full"><option value="">Choose a template…</option>{templates.filter(t => t.is_active).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}
    <label className="block font-ui text-sm">Plan title<input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className="input mt-1 w-full" placeholder="Week of …" /></label>
    <label className="block font-ui text-sm">Note to the student (optional)<textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="input mt-1 w-full" /></label>
    <label className="block font-ui text-sm">Focus for this week (optional)<input value={f.goal} onChange={e => setF({ ...f, goal: e.target.value })} className="input mt-1 w-full" /></label>
    <label className="block font-ui text-sm">Due date (optional)<input type="date" value={f.due} onChange={e => setF({ ...f, due: e.target.value })} className="input mt-1 block" /></label>
    <fieldset><legend className="font-ui text-sm font-semibold">Exercises for this student</legend>
      <div className="mt-2 space-y-2">{active.map(e => { const p = picked.find(x => x.id === e.id); return <div key={e.id} className="rounded-xl border border-charcoal/10 p-2"><label className="flex items-start gap-2 font-body text-sm"><input type="checkbox" checked={!!p} onChange={ev => toggle(e.id, ev.target.checked)} />{e.title}</label>
        {p && <div className="mt-2 grid gap-2 sm:grid-cols-3"><input aria-label={`Note for ${e.title}`} placeholder="Note for this student" value={p.note} onChange={ev => setPicked(picked.map(x => x.id === e.id ? { ...x, note: ev.target.value } : x))} className="input sm:col-span-2" /><input aria-label={`Minutes for ${e.title}`} type="number" min={1} max={120} placeholder="Minutes" value={p.minutes} onChange={ev => setPicked(picked.map(x => x.id === e.id ? { ...x, minutes: ev.target.value } : x))} className="input" /></div>}</div>; })}
        {!active.length && <p className="font-body text-sm">Add exercises to the library first.</p>}</div></fieldset>
    <button disabled={busy} className="btn-primary">{busy ? "Assigning…" : "Assign plan"}</button><Note error={error} ok={ok} /></form>;
}

export function GoalManager({ students, skills, goals, instructorId }: { students: Student[]; skills: Skill[]; goals: (Goal & { student_id: string })[]; instructorId: string }) {
  const { busy, error, ok, run } = useSave();
  const [f, setF] = useState({ student: "", title: "", detail: "", skill: "", date: "" });
  const submit = (ev: React.FormEvent) => { ev.preventDefault(); run(async () => {
    if (!f.student || !f.title.trim()) throw new Error("Choose a student and write the goal.");
    const { error: e } = await createClient().from("dp_voice_goals").insert({ student_id: f.student, title: f.title.trim(), detail: f.detail.trim() || null, skill_id: f.skill || null, target_date: f.date || null, created_by: instructorId });
    if (e) throw e; setF({ ...f, title: "", detail: "", date: "" }); return "Goal added.";
  }); };
  const setStatus = (id: string, status: string) => run(async () => { const { error: e } = await createClient().from("dp_voice_goals").update({ status }).eq("id", id); if (e) throw e; return "Goal updated."; });
  return <div className="space-y-4"><form onSubmit={submit} className="card grid gap-3 p-5 sm:grid-cols-2"><h3 className="font-display text-lg text-burgundy sm:col-span-2">Set a vocal goal for a student</h3>
    <label className="font-ui text-sm">Student<select value={f.student} onChange={e => setF({ ...f, student: e.target.value })} className="input mt-1 w-full"><option value="">Choose…</option>{students.map(s => <option key={s.id} value={s.id}>{who(s)}</option>)}</select></label>
    <label className="font-ui text-sm">Skill (optional)<select value={f.skill} onChange={e => setF({ ...f, skill: e.target.value })} className="input mt-1 w-full"><option value="">—</option>{skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label className="font-ui text-sm sm:col-span-2">Goal<input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className="input mt-1 w-full" placeholder="Sing the chorus in tune at a steady tempo" /></label>
    <label className="font-ui text-sm sm:col-span-2">Details (optional)<textarea rows={2} value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} className="input mt-1 w-full" /></label>
    <label className="font-ui text-sm">Target date (optional)<input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className="input mt-1 block" /></label>
    <div className="sm:col-span-2"><button disabled={busy} className="btn-primary">{busy ? "Saving…" : "Add goal"}</button></div><div className="sm:col-span-2"><Note error={error} ok={ok} /></div></form>
    <ul className="space-y-2">{goals.map(g => <li key={g.id} className="card flex flex-wrap items-center justify-between gap-2 p-4"><span className="font-body text-sm"><strong>{who(students.find(s => s.id === g.student_id) ?? { id: "", full_name: null, email: null })}</strong>: {g.title} <em className="text-charcoal/60">({g.status})</em></span>
      <span className="flex gap-1 font-ui text-xs">{g.status !== "achieved" && <button disabled={busy} className="link-action" onClick={() => setStatus(g.id, "achieved")}>Mark achieved</button>}{g.status === "active" && <button disabled={busy} className="link-action" onClick={() => setStatus(g.id, "paused")}>Pause</button>}{g.status !== "active" && <button disabled={busy} className="link-action" onClick={() => setStatus(g.id, "active")}>Reopen</button>}</span></li>)}</ul></div>;
}
