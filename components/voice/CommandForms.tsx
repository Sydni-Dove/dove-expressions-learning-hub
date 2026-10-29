"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Student = { id: string; full_name: string | null; email: string | null };
const label = (s: Student) => s.full_name || s.email || "Student";
const errText = (e: unknown) => (e as { message?: string })?.message ?? "Something went wrong. Please try again.";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function run(work: () => Promise<string>) {
    setBusy(true); setError(""); setMessage("");
    try { setMessage(await work()); router.refresh(); } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }
  return { busy, message, error, run };
}
const Feedback = ({ message, error }: { message: string; error: string }) => <>
  {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
  {message && <p role="status" className="font-ui text-sm text-charcoal/80">{message}</p>}</>;

export function LessonStatusButtons({ lessonId }: { lessonId: string }) {
  const { busy, error, run } = useAction();
  const set = (status: string, ok: string) => run(async () => { const { error: e } = await createClient().rpc("dp_set_lesson_status", { target_id: lessonId, next_status: status }); if (e) throw e; return ok; });
  return <div className="flex flex-wrap gap-2" role="group" aria-label="Record lesson outcome">
    <button disabled={busy} onClick={() => set("completed", "Completed")} className="btn-primary !px-3 !py-1.5 text-xs">Completed</button>
    <button disabled={busy} onClick={() => set("cancelled", "Cancelled")} className="btn-secondary !px-3 !py-1.5 text-xs">Cancelled in advance</button>
    <button disabled={busy} onClick={() => set("late_cancelled", "Late cancellation")} className="btn-secondary !px-3 !py-1.5 text-xs">Late cancel</button>
    <button disabled={busy} onClick={() => set("no_show", "Missed")} className="btn-secondary !px-3 !py-1.5 text-xs">Missed</button>
    {error && <span role="alert" className="font-ui text-xs text-[#7a2c1c]">{error}</span>}
  </div>;
}

export function PlanForm({ students, programId, instructorId }: { students: Student[]; programId: string; instructorId: string }) {
  const { busy, message, error, run } = useAction();
  const [f, setF] = useState({ student: "", cadence: "weekly", minutes: "60", date: "", time: "", tz: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "" });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    if (!f.student || !f.date || !f.time || !f.tz) throw new Error("Choose a student, first lesson date, time and time zone.");
    const supabase = createClient();
    const { data, error: e1 } = await supabase.from("dp_coaching_plans").insert({ student_id: f.student, program_id: programId, instructor_id: instructorId, cadence: f.cadence, lesson_minutes: Number(f.minutes), first_lesson_on: f.date, lesson_time: f.time, timezone: f.tz, created_by: instructorId }).select("id").single();
    if (e1) throw e1;
    const through = new Date(Date.now() + 56 * 86400000).toISOString().slice(0, 10);
    const { data: n, error: e2 } = await supabase.rpc("dp_generate_appointments", { target_plan_id: data.id, through });
    if (e2) throw e2;
    return `Schedule saved and ${n} upcoming lesson${n === 1 ? "" : "s"} created.`;
  }); };
  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
    <label className="font-ui text-sm sm:col-span-2">Student<select value={f.student} onChange={e => set("student", e.target.value)} className="input mt-1 w-full"><option value="">Choose…</option>{students.map(s => <option key={s.id} value={s.id}>{label(s)}</option>)}</select></label>
    <label className="font-ui text-sm">Rhythm<select value={f.cadence} onChange={e => set("cadence", e.target.value)} className="input mt-1 w-full"><option value="weekly">Weekly</option><option value="biweekly">Every other week (shares a position)</option></select></label>
    <label className="font-ui text-sm">Lesson length<select value={f.minutes} onChange={e => set("minutes", e.target.value)} className="input mt-1 w-full"><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
    <label className="font-ui text-sm">First lesson date<input type="date" value={f.date} onChange={e => set("date", e.target.value)} className="input mt-1 w-full"/></label>
    <label className="font-ui text-sm">Start time<input type="time" value={f.time} onChange={e => set("time", e.target.value)} className="input mt-1 w-full"/></label>
    <label className="font-ui text-sm sm:col-span-2">Time zone<input value={f.tz} onChange={e => set("tz", e.target.value)} className="input mt-1 w-full" placeholder="America/New_York"/></label>
    <p className="font-body text-xs text-charcoal/65 sm:col-span-2">For alternating weeks, give the two students the same weekday and time with first lesson dates one week apart. The system blocks any overlap.</p>
    <div className="sm:col-span-2"><button disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save schedule"}</button></div>
    <div className="sm:col-span-2"><Feedback message={message} error={error}/></div>
  </form>;
}

export function GenerateButton({ planId }: { planId: string }) {
  const { busy, message, error, run } = useAction();
  return <span><button disabled={busy} className="link-action font-ui text-xs" onClick={() => run(async () => {
    const through = new Date(Date.now() + 56 * 86400000).toISOString().slice(0, 10);
    const { data, error: e } = await createClient().rpc("dp_generate_appointments", { target_plan_id: planId, through });
    if (e) throw e; return `${data} new lesson${data === 1 ? "" : "s"} added.`;
  })}>{busy ? "Working…" : "Add next 8 weeks"}</button> <Feedback message={message} error={error}/></span>;
}

const STATUSES = [["new", "New"], ["acknowledged", "Acknowledged"], ["booked", "Consultation booked"], ["consulted", "Consultation held"], ["recommended", "Recommendation sent"], ["enrolled", "Enrolled"], ["closed", "Closed"]];
export function ConsultationStatus({ id, status }: { id: string; status: string }) {
  const { busy, error, run } = useAction();
  return <span><label className="sr-only" htmlFor={`c-${id}`}>Inquiry status</label><select id={`c-${id}`} disabled={busy} value={status} className="input !py-1 text-xs" onChange={e => run(async () => {
    const next = e.target.value; const patch: Record<string, unknown> = { status: next };
    if (next === "booked") patch.booked_at = new Date().toISOString();
    if (next === "recommended") patch.recommendation_sent_at = new Date().toISOString();
    const { error: er } = await createClient().from("dp_consultation_inquiries").update(patch).eq("id", id); if (er) throw er; return "Updated";
  })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>{error && <span role="alert" className="ml-2 text-xs text-[#7a2c1c]">{error}</span>}</span>;
}

export function MarkReminderSent({ id }: { id: string }) {
  const { busy, error, run } = useAction();
  return <span><button disabled={busy} className="link-action font-ui text-xs" onClick={() => run(async () => { const { error: e } = await createClient().from("dp_consultation_inquiries").update({ reminder_sent_at: new Date().toISOString() }).eq("id", id); if (e) throw e; return "Marked"; })}>Mark reminder sent</button>{error && <span role="alert" className="ml-2 text-xs text-[#7a2c1c]">{error}</span>}</span>;
}
