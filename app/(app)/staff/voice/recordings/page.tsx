import { redirect } from "next/navigation";
import RecordingCard, { type RecordingRow } from "@/components/voice/RecordingCard";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { loadRecordings } from "@/lib/recording-queries";

export const dynamic = "force-dynamic";

export default async function StaffRecordings({ searchParams }: { searchParams: { student?: string } }) {
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  if (!roles.some((r) => ["faculty", "teacher", "super_admin"].includes(r))) redirect("/dashboard");
  const supabase = createClient();
  const student = searchParams.student && /^[0-9a-f-]{36}$/i.test(searchParams.student) ? searchParams.student : undefined;
  const all = (await loadRecordings(supabase, { studentId: student })) as RecordingRow[];
  const sections: [string, string[]][] = [["Waiting for review", ["submitted"]], ["Returned for revision", ["returned"]], ["Reviewed", ["reviewed"]], ["Private drafts (not submitted)", ["saved"]]];
  return (
    <div className="space-y-8 pb-20">
      <header>
        <h1 className="font-display text-4xl text-[#630000]">Practice Recordings</h1>
        <p className="mt-2 max-w-2xl font-body text-[#4a3a3a]">Play recordings here without downloading them. Feedback is added to the history; the student&apos;s original recording is never replaced.</p>
      </header>
      {sections.map(([title, statuses]) => {
        const rows = all.filter((r) => statuses.includes(r.status));
        return (
          <section key={title} aria-label={title}>
            <h2 className="font-display text-xl text-[#630000]">{title} ({rows.length})</h2>
            {rows.length ? <ul className="mt-3 space-y-3">{rows.map((r) => <RecordingCard key={r.id} rec={r} mode="staff" />)}</ul> : <p className="mt-2 font-body text-sm text-[#4a3a3a]">None.</p>}
          </section>);
      })}
    </div>
  );
}
