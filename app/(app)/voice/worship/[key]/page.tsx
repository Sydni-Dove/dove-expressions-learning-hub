import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StudentTeaching } from "@/components/voice/TeachingView";
import { getStudentPrograms } from "@/lib/student-programs";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { ScriptureNote, StudentContent } from "@/lib/voice-teaching/types";

export const dynamic = "force-dynamic";
export default async function MyWorshipTeaching({ params }: { params: { key: string } }) {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  if (!(await getStudentPrograms(user.id)).includes("voice")) redirect("/dashboard");
  if (!/^[a-z0-9-]+$/.test(params.key)) notFound();
  const supabase = createClient();
  // Returns nothing unless your instructor assigned this teaching to you.
  const { data: m } = await supabase.from("dp_voice_teaching_modules").select("id,title,summary,estimated_minutes,student_content").eq("key", params.key).maybeSingle();
  if (!m) notFound();
  const c = m.student_content as StudentContent & { objectives: string[]; scriptures: ScriptureNote[] };
  return (
    <div className="space-y-6 pb-20">
      <Link href="/voice/worship" className="inline-flex min-h-[44px] items-center font-ui text-sm font-semibold text-[#630000] underline">← Worship Development</Link>
      <StudentTeaching title={m.title} summary={m.summary} minutes={m.estimated_minutes} objectives={c.objectives} scriptures={c.scriptures} content={c} />
      <p className="rounded-2xl bg-[#F2DFD8] p-4 font-body text-[#630000]">Ready to submit your take-home work? <Link href="/assignments" className="inline-flex min-h-[44px] items-center font-semibold underline">Open My Assignments</Link></p>
    </div>
  );
}
