import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/roles";
import { AssignPlanForm, GoalManager } from "@/components/voice/ResourceAdmin";
import type { Exercise, Goal, Skill } from "@/lib/voice-resources";

export const dynamic = "force-dynamic";
export default async function VoicePlansPage() {
  const { user } = await requireRoles(["faculty", "teacher", "super_admin"]);
  const supabase = createClient();
  const [roster, s, e, t, g, plans] = await Promise.all([
    supabase.rpc("dp_program_students", { target_program_slug: "vocal-coaching" }),
    supabase.from("dp_voice_skills").select("id,slug,name,sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("dp_voice_exercises").select("id,skill_id,title,instructions,video_url,source_name,minutes,is_active").eq("is_active", true).order("title"),
    supabase.from("dp_voice_plan_templates").select("id,title,items,is_active").eq("is_active", true),
    supabase.from("dp_voice_goals").select("id,student_id,skill_id,title,detail,target_date,status").order("created_at", { ascending: false }),
    supabase.from("dp_assignments").select("id,title,assigned_to_user_id,due_at,created_at").not("practice_items", "is", null).order("created_at", { ascending: false }).limit(20)
  ]);
  const students = roster.data ?? [];
  const name = (id: string | null) => students.find((x: { id: string }) => x.id === id)?.full_name || students.find((x: { id: string }) => x.id === id)?.email || "Student";
  return <div className="space-y-8 pb-20">
    <div><Link href="/staff/voice" className="font-ui text-sm underline">← Voice command center</Link><h1 className="mt-2 font-display text-3xl text-burgundy">Plans and goals</h1>
      <p className="mt-1 font-body text-sm text-charcoal/70">Weekly plans are personal homework: students check off each exercise, record, submit, and you review in the usual queue.</p></div>
    {[roster, s, e, g].some(r => r.error) && <p role="alert" className="card p-4 text-sm">Some data could not be loaded. The student resources database migration may not be applied yet.</p>}
    <section><AssignPlanForm students={students} exercises={(e.data ?? []) as Exercise[]} templates={(t.data ?? []) as never} /></section>
    <section aria-labelledby="recent-h"><h2 id="recent-h" className="mb-2 font-display text-xl text-burgundy">Recently assigned plans</h2>
      {(plans.data ?? []).length ? <ul className="card divide-y divide-charcoal/10">{(plans.data ?? []).map(p => <li key={p.id} className="p-3 font-body text-sm">{name(p.assigned_to_user_id)} · {p.title}{p.due_at ? ` · due ${new Date(p.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}</li>)}</ul> : <p className="font-body text-sm">No weekly plans assigned yet.</p>}</section>
    <section aria-labelledby="goals-h"><h2 id="goals-h" className="mb-2 font-display text-2xl text-burgundy">Goals</h2><GoalManager students={students} skills={(s.data ?? []) as Skill[]} goals={(g.data ?? []) as (Goal & { student_id: string })[]} instructorId={user.id} /></section>
  </div>;
}
