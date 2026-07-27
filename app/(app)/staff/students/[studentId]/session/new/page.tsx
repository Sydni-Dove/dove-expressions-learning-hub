import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import SessionLogForm from "@/components/SessionLogForm";
import { EmptyState } from "@/components/ui";

export default async function NewSessionPage({ params }: { params: { studentId: string } }) {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  const studentId = params.studentId;

  const { data: profile } = await supabase.from("profiles").select("id,full_name,email").eq("id", studentId).maybeSingle();

  // Same access-control note as the student detail page: if RLS blocked the read, profile
  // comes back null even though the row exists. That's the boundary working correctly.
  if (!profile) {
    return (
      <EmptyState
        title="Not available"
        body="Either this student doesn't exist, or you don't currently have an assigned relationship to them."
      />
    );
  }

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <Link href={`/staff/students/${studentId}`} className="font-ui text-sm text-charcoal/60 underline">
          ← {profile.full_name || profile.email}
        </Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">Log a session</h1>
        <p className="mt-1 font-body text-charcoal/70">
          The student-visible summary is what {profile.full_name || "the student"} will see. Private notes are
          faculty-only and never shown to the student. Recording is off unless explicit consent is captured below —
          never assume consent from silence or continued participation.
        </p>
      </div>

      <SessionLogForm studentId={studentId} mentorId={user!.id} />
    </div>
  );
}
