import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudentPrograms } from "@/lib/student-programs";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { ASSESSMENTS, type AssessmentKind } from "@/lib/voice-assessments";

export const dynamic = "force-dynamic";
const LABEL: Record<string, string> = { assigned: "Not started", in_progress: "In progress — resume", submitted: "Submitted", reviewed: "Reviewed" };

export default async function MyAssessments() {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  if (!(await getStudentPrograms(user.id)).includes("voice")) redirect("/dashboard");
  const { data } = await createClient().from("dp_voice_assessments").select("id,kind,status,assigned_at,submitted_at").order("assigned_at", { ascending: false });
  return (
    <div className="space-y-6 pb-20">
      <header><Link href="/voice" className="inline-flex min-h-[44px] items-center font-ui text-sm font-semibold text-[#630000] underline">← Voice Home</Link>
        <h1 className="font-display text-4xl text-[#630000]">My assessments</h1>
        <p className="mt-2 max-w-2xl font-body text-[#4a3a3a]">Only you and your Voice instructor can see your answers. You can skip any question, save a draft, and come back.</p></header>
      {(data ?? []).length === 0 ? <p className="rounded-2xl border border-dashed border-[#630000]/30 p-6 font-body text-[#4a3a3a]">Nothing has been assigned to you yet.</p> :
        <ul className="space-y-3">{(data ?? []).map((a) => (
          <li key={a.id} className="rounded-2xl border border-[#630000]/15 bg-white p-4">
            <p className="font-ui text-lg font-bold text-[#630000]">{ASSESSMENTS[a.kind as AssessmentKind]?.title ?? a.kind}</p>
            <p className="font-body text-sm text-[#4a3a3a]">{LABEL[a.status] ?? a.status}</p>
            <Link href={`/voice/assessments/${a.id}`} className="mt-2 inline-flex min-h-[44px] items-center rounded-full bg-[#630000] px-5 font-ui text-sm font-bold text-white">{["assigned", "in_progress"].includes(a.status) ? (a.status === "assigned" ? "Start" : "Resume") : "View"}</Link>
          </li>))}</ul>}
    </div>
  );
}
