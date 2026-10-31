import Link from "next/link";
import { redirect } from "next/navigation";
import TrackChoice from "@/components/voice/TrackChoice";
import PaymentNotice from "@/components/voice/PaymentNotice";
import { getMyAccess } from "@/lib/voice-access";
import { RatingsComparison } from "@/components/voice/DevelopmentAdmin";
import { compareRatings } from "@/lib/voice-assessments";
import { getStudentPrograms } from "@/lib/student-programs";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { TrackKey } from "@/lib/voice-curriculum";

export const dynamic = "force-dynamic";
const KIND: Record<string, string> = { baseline: "Starting point", progress: "Progress check", midpoint: "Mid-program check", final: "Final evaluation", custom: "Check-in" };

export default async function MyPlan() {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  if (!(await getStudentPrograms(user.id)).includes("voice")) redirect("/dashboard");
  const supabase = createClient(); const access = await getMyAccess(supabase);
  const [{ data: profile }, { data: plans }, { data: intakes }, { data: checks }, { data: demoRows }] = await Promise.all([
    supabase.from("dp_voice_profiles").select("selected_tracks,approved_tracks,tongues_requested").eq("student_id", user.id).maybeSingle(),
    supabase.from("dp_voice_plans").select("id,title,package_type,notes").eq("status", "active").order("approved_at", { ascending: false }).limit(1),
    supabase.from("dp_voice_intakes").select("id").limit(1),
    supabase.from("dp_voice_progress_checks").select("id,week,kind,ratings,strengths,next_focus,shared_at,created_at").order("week"),
    supabase.from("dp_voice_demos").select("ratings,observed_at,strengths,next_focus").order("observed_at", { ascending: false }).limit(1)
  ]);
  const plan = plans?.[0];
  const { data: units } = plan ? await supabase.from("dp_voice_plan_units").select("id,seq,week,area_key,area_title,level,objective,checkpoint,segment_advice,status,assigned_assignment_id").eq("plan_id", plan.id).order("seq") : { data: [] };
  return (
    <div className="space-y-8 pb-20">
      <header><Link href="/voice" className="inline-flex min-h-[44px] items-center font-ui text-sm font-semibold text-[#630000] underline">← Voice Home</Link>
        <h1 className="font-display text-4xl text-[#630000]">My development plan</h1></header>
      {!(intakes ?? []).length && <p className="rounded-2xl bg-[#F2DFD8] p-4 font-body text-[#630000]">Start with your goals so your coach can personalise your plan. <Link href="/voice/intake" className="inline-flex min-h-[44px] items-center font-semibold underline">Tell us your goals</Link></p>}
      {!access.paid && <PaymentNotice status={access.status} what="Assessments, recordings and coaching resources" />}
      {demoRows?.[0] && (
        <section aria-labelledby="demo-h"><h2 id="demo-h" className="font-display text-2xl text-[#630000]">Your Vocal Demo: where you started</h2>
          <div className="mt-3 rounded-2xl bg-[#FBF4F1] p-4 font-body">{demoRows[0].strengths && <p><strong>Strengths: </strong>{demoRows[0].strengths}</p>}{demoRows[0].next_focus && <p><strong>First focus: </strong>{demoRows[0].next_focus}</p>}</div></section>)}
      {plan ? (
        <section aria-labelledby="plan-h">
          <h2 id="plan-h" className="font-display text-2xl text-[#630000]">{plan.title}</h2>
          {(plan.notes ?? []).map((n: string) => <p key={n} className="font-body text-sm text-[#4a3a3a]">{n}</p>)}
          <ol className="mt-4 space-y-3">{(units ?? []).map((u) => (
            <li key={u.id} className="rounded-2xl border border-[#630000]/15 bg-white p-4">
              <p className="font-ui text-sm font-bold text-[#630000]">Lesson {u.week}{u.checkpoint ? ` · ${KIND[u.checkpoint] ?? "Check"}` : ""} · {u.area_title} · {u.level}</p>
              <p className="mt-1 font-body">{u.objective}</p>
              <p className="mt-1 font-body text-xs text-[#4a3a3a]">{u.segment_advice}</p>
              {u.assigned_assignment_id ? <Link href="/assignments" className="mt-2 inline-flex min-h-[44px] items-center font-ui text-sm font-semibold text-[#630000] underline">Open this week&apos;s practice</Link> : <p className="mt-1 font-ui text-xs text-[#4a3a3a]">Practice will be assigned by your instructor.</p>}
            </li>))}</ol>
        </section>) : <p className="rounded-2xl border border-dashed border-[#630000]/30 p-6 font-body text-[#4a3a3a]">Your instructor is preparing your plan. You will see it here once it is approved.</p>}
      {(checks ?? []).length > 0 && (
        <section aria-labelledby="checks-h"><h2 id="checks-h" className="font-display text-2xl text-[#630000]">Progress checks</h2>
          <div className="mt-3 rounded-2xl bg-white p-4"><RatingsComparison rows={compareRatings((checks ?? []) as never, (units ?? []).map((u) => u.area_key), demoRows?.[0] ? { ratings: demoRows[0].ratings as never } : null)} /></div>
          <ul className="mt-3 space-y-3">{(checks ?? []).map((c) => (
            <li key={c.id} className="rounded-2xl bg-[#FBF4F1] p-4"><p className="font-ui text-sm font-bold text-[#630000]">{KIND[c.kind]} · week {c.week}</p>
              {c.strengths && <p className="mt-1 font-body"><strong>Going well: </strong>{c.strengths}</p>}{c.next_focus && <p className="font-body"><strong>Next: </strong>{c.next_focus}</p>}</li>))}</ul></section>)}
      <TrackChoice selected={(profile?.selected_tracks ?? []) as TrackKey[]} approved={(profile?.approved_tracks ?? []) as TrackKey[]} tongues={!!profile?.tongues_requested} />
      <p className="font-body text-sm"><Link href="/voice/assessments" className="inline-flex min-h-[44px] items-center font-semibold text-[#630000] underline">My assessments</Link></p>
    </div>
  );
}
