"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/voice-rpc";

export interface Candidate { id: string; name: string; paid: boolean; assigned: boolean }
const field = "mt-1 block font-normal min-h-[44px] w-full rounded-xl border border-[#630000]/25 bg-white px-3 py-2 text-base text-[#1B1717]";
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/** The instructor assigns ONE published teaching to ONE enrolled, verified-paid student, customizing what that student receives. Nothing here is automatic. */
export default function AssignTeaching({ teachingKey, published, candidates, defaultReflection, defaultHomework }: { teachingKey: string; published: boolean; candidates: Candidate[]; defaultReflection: string[]; defaultHomework: string[] }) {
  const router = useRouter();
  const [student, setStudent] = useState(""); const [due, setDue] = useState(""); const [note, setNote] = useState("");
  const [refl, setRefl] = useState(defaultReflection.join("\n")); const [hw, setHw] = useState(defaultHomework.join("\n"));
  const [res, setRes] = useState<{ title: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr(""); setMsg("");
    const r = await callRpc("dp_assign_teaching", { student, teaching_key: teachingKey, due: due || null, instructions: note.trim() || null, reflection: lines(refl), homework: lines(hw), resources: res.filter((x) => x.title.trim() || x.url.trim()) });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setMsg("Assigned. The student can now open this teaching and its take-home assignment."); setStudent(""); setNote(""); setRes([]); router.refresh();
  }
  const open = candidates.filter((c) => c.paid && !c.assigned);
  if (!published) return <p role="note" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This teaching is not published, so it cannot be assigned. Mark it ready for review, then approve and publish it.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#4a3a3a]">Only students who are enrolled in Voice and have verified paid access can be assigned new material. A student never receives a teaching until you assign it, and they receive the version that is published now.</p>
      {!open.length && <p role="note" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No eligible students right now: everyone enrolled is either already assigned this teaching or does not have verified paid access.</p>}
      <label className="block text-sm font-semibold text-[#630000]">Student
        <select className={field} value={student} onChange={(e) => setStudent(e.target.value)} disabled={!open.length}><option value="">Choose…</option>{open.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="block text-sm font-semibold text-[#630000]">Due date (optional)<input type="date" className={field} value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <label className="block text-sm font-semibold text-[#630000]">Personal instructions for this student (optional)<textarea className={field} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <label className="block text-sm font-semibold text-[#630000]">Reflection questions (one per line; starts with the teaching’s own, edit freely)<textarea className={field} rows={4} value={refl} onChange={(e) => setRefl(e.target.value)} /></label>
      <label className="block text-sm font-semibold text-[#630000]">Homework / practice steps (one per line; starts with the teaching’s own, edit freely)<textarea className={field} rows={5} value={hw} onChange={(e) => setHw(e.target.value)} /></label>
      <fieldset><legend className="text-sm font-semibold text-[#630000]">Supporting resources (optional)</legend>
        {res.map((r, i) => <div key={i} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]"><input aria-label={`Resource ${i + 1} title`} className={field} placeholder="Title" value={r.title} onChange={(e) => setRes(res.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /><input aria-label={`Resource ${i + 1} address`} className={field} placeholder="https://…" value={r.url} onChange={(e) => setRes(res.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} /><button type="button" className="mt-1 min-h-[44px] rounded-xl border border-[#630000]/20 px-3 text-sm font-semibold text-[#630000]" onClick={() => setRes(res.filter((_, j) => j !== i))}>Remove</button></div>)}
        {res.length < 5 && <button type="button" className="mt-2 min-h-[44px] rounded-xl border border-[#630000]/20 px-3 text-sm font-semibold text-[#630000]" onClick={() => setRes([...res, { title: "", url: "" }])}>+ Add resource</button>}</fieldset>
      <button className="min-h-[44px] rounded-full bg-[#630000] px-5 text-sm font-bold text-white disabled:opacity-50" disabled={busy || !student} onClick={go}>Assign this teaching</button>
      {msg && <p role="status" className="text-sm font-semibold text-[#630000]">{msg}</p>}{err && <p role="alert" className="text-sm font-semibold text-[#9b1c1c]">{err}</p>}
    </div>
  );
}
