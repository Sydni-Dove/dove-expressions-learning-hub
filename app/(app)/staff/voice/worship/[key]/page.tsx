import Link from "next/link";
import { notFound } from "next/navigation";
import AssignTeaching, { type Candidate } from "@/components/voice/AssignTeaching";
import { InstructorTeaching, StudentTeaching } from "@/components/voice/TeachingView";
import { requireRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { InstructorNotes, ScriptureNote, StudentContent } from "@/lib/voice-teaching/types";

export const dynamic = "force-dynamic";
export default async function WorshipModuleStaff({ params }: { params: { key: string } }) {
  await requireRoles(["faculty", "teacher", "super_admin"]);
  if (!/^[a-z0-9-]+$/.test(params.key)) notFound();
  const supabase = createClient();
  const { data: m } = await supabase.from("dp_voice_teaching_modules").select("id,key,title,summary,estimated_minutes,student_content").eq("key", params.key).maybeSingle();
  if (!m) notFound();
  const [{ data: priv }, { data: people }, { data: assigns }] = await Promise.all([
    supabase.from("dp_voice_teaching_module_private").select("instructor_notes").eq("module_id", m.id).maybeSingle(),
    supabase.rpc("dp_voice_people"),
    supabase.from("dp_assignments").select("id,assigned_to_user_id,due_at,created_at").eq("teaching_module_id", m.id)
  ]);
  const ids = (assigns ?? []).map((a) => a.id);
  const { data: subs } = ids.length ? await supabase.from("dp_submissions").select("assignment_id,status,submitted_at").in("assignment_id", ids) : { data: [] };
  const roster = (people ?? []) as { id: string; full_name: string | null; email: string | null; enrolled: boolean; paid: boolean }[];
  const nameOf = (id: string) => { const p = roster.find((r) => r.id === id); return p?.full_name || p?.email || "Student"; };
  const assignedIds = new Set((assigns ?? []).map((a) => a.assigned_to_user_id));
  const candidates: Candidate[] = roster.filter((r) => r.enrolled).map((r) => ({ id: r.id, name: r.full_name || r.email || "Student", paid: r.paid, assigned: assignedIds.has(r.id) }));
  const c = m.student_content as StudentContent & { objectives: string[]; scriptures: ScriptureNote[] };
  return (
    <div className="space-y-8 pb-20">
      <header><Link href="/staff/voice/worship" className="link-action font-ui text-sm">← Worship Development</Link>
        <p className="mt-2 rounded-xl bg-amber-50 p-3 font-body text-sm text-amber-900">Instructor view. The teaching notes below are private to staff and are never shown to students. Students see only the teaching content once you assign it.</p></header>
      <section aria-labelledby="assign-h" className="card p-5"><h2 id="assign-h" className="font-display text-xl text-burgundy">Assign to a student</h2>
        <div className="mt-3"><AssignTeaching moduleKey={m.key} candidates={candidates} /></div></section>
      <section aria-labelledby="assigned-h" className="card p-5"><h2 id="assigned-h" className="font-display text-xl text-burgundy">Assigned students</h2>
        {(assigns ?? []).length ? <ul className="mt-3 divide-y divide-charcoal/10">{(assigns ?? []).map((a) => { const s = (subs ?? []).find((x) => x.assignment_id === a.id);
          return <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 font-body text-sm"><span>{nameOf(a.assigned_to_user_id)}{a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}</span>
            <span className="font-ui text-xs text-charcoal/70">{s ? `Submitted (${s.status})` : "Not submitted yet"}</span></li>; })}</ul> : <p className="mt-3 font-body text-sm text-charcoal/70">Not assigned to anyone yet.</p>}
        <p className="mt-3 font-body text-xs text-charcoal/60">Reflections and take-home responses arrive in your usual review queue under Assignments, where you give feedback.</p></section>
      <section aria-labelledby="notes-h"><h2 id="notes-h" className="font-display text-2xl text-burgundy">Instructor teaching notes (private)</h2>
        <div className="mt-3 rounded-3xl border-2 border-amber-300 p-4 sm:p-6">{priv ? <InstructorTeaching notes={priv.instructor_notes as InstructorNotes} /> : <p className="font-body text-sm">Notes are not available.</p>}</div></section>
      <section aria-labelledby="student-h"><h2 id="student-h" className="font-display text-2xl text-burgundy">What the student sees</h2>
        <div className="mt-3 rounded-3xl border border-burgundy/20 p-4 sm:p-6"><StudentTeaching title={m.title} summary={m.summary} minutes={m.estimated_minutes} objectives={c.objectives} scriptures={c.scriptures} content={c} /></div></section>
    </div>
  );
}
