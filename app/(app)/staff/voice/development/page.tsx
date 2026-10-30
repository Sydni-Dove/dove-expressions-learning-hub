import Link from "next/link";
import { ImportIntake } from "@/components/voice/DevelopmentAdmin";
import { requireRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function DevelopmentIndex() {
  await requireRoles(["faculty", "teacher", "super_admin"]);
  const supabase = createClient();
  const [roster, intakes, assess, plans] = await Promise.all([
    supabase.rpc("dp_program_students", { target_program_slug: "vocal-coaching" }),
    supabase.from("dp_voice_intakes").select("student_id"),
    supabase.from("dp_voice_assessments").select("student_id,status"),
    supabase.from("dp_voice_plans").select("student_id,status").eq("is_sample", false)
  ]);
  const students = (roster.data ?? []) as { id: string; full_name: string | null; email: string | null }[];
  const count = <T extends { student_id: string }>(rows: T[] | null, id: string, f: (r: T) => boolean = () => true) => (rows ?? []).filter((r) => r.student_id === id && f(r)).length;
  return (
    <div className="space-y-8 pb-20">
      <header><Link href="/staff/voice" className="link-action font-ui text-sm">← Voice command center</Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">Student development</h1>
        <p className="mt-1 max-w-2xl font-body text-sm text-charcoal/70">Intake, assessments, optional tracks, personalized plans and progress checks. Student faith information is private to you and the student.</p>
        <p className="mt-2 font-body text-sm"><Link href="/staff/voice/development/sample" className="link-action">Sample pathway (Stephanie)</Link> · <Link href="/staff/voice/curriculum" className="link-action">Curriculum</Link></p></header>
      {roster.error && <p role="alert" className="card p-4 text-sm">The student list could not be loaded.</p>}
      <section aria-labelledby="stu-h"><h2 id="stu-h" className="mb-2 font-display text-xl text-burgundy">Students</h2>
        {students.length ? <ul className="card divide-y divide-charcoal/10">{students.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 p-3 font-body text-sm">
            <Link href={`/staff/voice/development/${s.id}`} className="link-action font-semibold">{s.full_name || s.email}</Link>
            <span className="text-charcoal/70">Intake {count(intakes.data, s.id) ? "✓" : "—"} · Assessments {count(assess.data, s.id)} ({count(assess.data, s.id, (a) => a.status === "submitted")} to review) · Plan {count(plans.data, s.id, (p) => p.status === "active") ? "active" : count(plans.data, s.id) ? "draft" : "—"}</span>
          </li>))}</ul> : <p className="font-body text-sm">No Voice students yet.</p>}</section>
      <section aria-labelledby="imp-h"><h2 id="imp-h" className="mb-2 font-display text-xl text-burgundy">Import intake from Google Forms</h2><ImportIntake roster={students} /></section>
    </div>
  );
}
