import Link from "next/link";
import { redirect } from "next/navigation";
import RecordingLibrary from "@/components/voice/RecordingLibrary";
import type { RecordingRow } from "@/components/voice/RecordingCard";
import { getStudentPrograms } from "@/lib/student-programs";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { recordingLimits } from "@/lib/r2";
import { loadRecordings } from "@/lib/recording-queries";

export const dynamic = "force-dynamic";

export default async function MyPracticeRecordings() {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  if (!(await getStudentPrograms(user.id)).includes("voice")) redirect("/dashboard");
  const supabase = createClient();
  const l = recordingLimits();
  const [{ data: asg }, recordings] = await Promise.all([
    supabase.from("dp_assignments").select("id,title,lesson_id").order("due_at", { ascending: true, nullsFirst: false }),
    loadRecordings(supabase, { studentId: user.id })
  ]);
  return (
    <div className="space-y-6 pb-20">
      <header>
        <Link href="/voice" className="inline-flex min-h-[44px] items-center font-ui text-sm font-semibold text-[#630000] underline">← Voice Home</Link>
        <h1 className="font-display text-4xl text-[#630000]">My Practice Recordings</h1>
        <p className="mt-2 max-w-2xl font-body text-[#4a3a3a]">Only you and your Voice instructor can hear these. Save a recording privately first, then submit it when you want feedback. Submitted recordings and feedback are never overwritten.</p>
      </header>
      <RecordingLibrary recordings={recordings as RecordingRow[]} assignments={(asg ?? []).map((a) => ({ id: a.id, title: a.title, lessonId: a.lesson_id }))}
        limits={{ recommendedMinutes: l.recommendedMinutes, warnMinutes: l.warnMinutes, maxMinutes: l.maxMinutes, maxMb: Math.round(l.maxBytes / 1048576) }} />
    </div>
  );
}
