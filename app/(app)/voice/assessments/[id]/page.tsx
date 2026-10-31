import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AssessmentForm from "@/components/voice/AssessmentForm";
import { getStudentPrograms } from "@/lib/student-programs";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import PaymentNotice from "@/components/voice/PaymentNotice";
import { getMyAccess } from "@/lib/voice-access";
import { ASSESSMENTS, type AssessmentKind } from "@/lib/voice-assessments";

export const dynamic = "force-dynamic";
export default async function AssessmentPage({ params }: { params: { id: string } }) {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  if (!(await getStudentPrograms(user.id)).includes("voice")) redirect("/dashboard");
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createClient();
  const { data: a } = await supabase.from("dp_voice_assessments").select("id,kind,status,answers,shared_summary,student_id").eq("id", params.id).maybeSingle();
  if (!a || a.student_id !== user.id) notFound();
  const def = ASSESSMENTS[a.kind as AssessmentKind];
  if (!def || def.status !== "ready") notFound();
  const access = await getMyAccess(supabase);
  const open = ["assigned", "in_progress"].includes(a.status);
  const { data: recs } = await supabase.from("dp_practice_recordings").select("id,label,title,part_no,created_at").neq("status", "pending").order("created_at", { ascending: false });
  return (
    <div className="space-y-6 pb-20">
      <Link href="/voice/assessments" className="inline-flex min-h-[44px] items-center font-ui text-sm font-semibold text-[#630000] underline">← My assessments</Link>
      <h1 className="font-display text-4xl text-[#630000]">{def.title}</h1>
      {open && !access.paid ? <PaymentNotice status={access.status} what="This assessment" /> :
      <AssessmentForm id={a.id} def={def} initial={(a.answers ?? {}) as never} status={a.status} sharedSummary={a.shared_summary}
        recordings={(recs ?? []).map((r) => ({ id: r.id, label: `${r.label}${r.title ? " — " + r.title : ""} · part ${r.part_no} · ${new Date(r.created_at).toLocaleDateString()}` }))} />}
    </div>
  );
}
