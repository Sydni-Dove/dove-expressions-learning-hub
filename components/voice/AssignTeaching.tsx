"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/voice-rpc";

export interface Candidate { id: string; name: string; paid: boolean; assigned: boolean }
const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-[#630000]/25 bg-white px-3 py-2 font-body text-base text-[#201414]";

/** The instructor assigns ONE teaching to ONE enrolled, paid student. Nothing here is automatic. */
export default function AssignTeaching({ moduleKey, candidates }: { moduleKey: string; candidates: Candidate[] }) {
  const router = useRouter();
  const [student, setStudent] = useState(""); const [due, setDue] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr(""); setMsg("");
    const r = await callRpc("dp_assign_teaching_module", { student, module_key: moduleKey, due: due || null, note: note.trim() || null });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setMsg("Assigned. The student can now open this teaching and its take-home assignment."); setStudent(""); setNote(""); router.refresh();
  }
  const open = candidates.filter((c) => c.paid && !c.assigned);
  return (
    <div className="space-y-3">
      <p className="font-body text-sm text-[#4a3a3a]">Only students who are enrolled in Voice and have verified paid access can be assigned new material. A student never receives a teaching until you assign it.</p>
      {!open.length && <p role="note" className="rounded-xl bg-amber-50 p-3 font-body text-sm text-amber-900">No eligible students right now: everyone enrolled is either already assigned this teaching or does not have verified paid access.</p>}
      <label className="block font-ui text-sm font-semibold text-[#630000]">Student
        <select className={field} value={student} onChange={(e) => setStudent(e.target.value)} disabled={!open.length}>
          <option value="">Choose…</option>{open.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="block font-ui text-sm font-semibold text-[#630000]">Due date (optional)<input type="date" className={field} value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <label className="block font-ui text-sm font-semibold text-[#630000]">Personal note to the student (optional)<textarea className={field} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="min-h-[44px] rounded-full bg-[#630000] px-5 font-ui text-sm font-bold text-white disabled:opacity-50" disabled={busy || !student} onClick={go}>Assign this teaching</button>
      {msg && <p role="status" className="font-ui text-sm text-[#630000]">{msg}</p>}{err && <p role="alert" className="font-ui text-sm text-[#9b1c1c]">{err}</p>}
    </div>
  );
}
