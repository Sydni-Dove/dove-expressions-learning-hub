import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pill, EmptyState } from "@/components/ui";

export default async function StudentDetailPage({ params }: { params: { studentId: string } }) {
  const supabase = createClient();
  const studentId = params.studentId;

  const [
    { data: profile },
    { data: enrollments },
    { data: results },
    { data: plan },
    { data: sessions },
    { data: submissions }
  ] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,avatar_url").eq("id", studentId).maybeSingle(),
    supabase.from("dp_enrollments").select("id,scope_type,scope_id,status,enrolled_at").eq("user_id", studentId),
    supabase.from("dp_wiring_results").select("id,generated_at,primary_category_id").eq("student_id", studentId).order("generated_at", { ascending: false }).limit(1),
    supabase.from("dp_discipleship_plans").select("id,current_season,status").eq("student_id", studentId).order("version", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("dp_sessions").select("id,session_type,scheduled_at,student_visible_notes,private_faculty_notes,follow_up_date").eq("student_id", studentId).order("scheduled_at", { ascending: false }),
    supabase.from("dp_submissions").select("id,status,submitted_at,dp_assignments(title)").eq("student_id", studentId).order("submitted_at", { ascending: false }).limit(5)
  ]);

  // If RLS blocked the read, `profile` comes back null even though the row exists — that IS the
  // access control working (not a bug): this staff member isn't scoped to this student.
  if (!profile) {
    return (
      <EmptyState
        title="Not available"
        body="Either this student doesn't exist, or you don't currently have an assigned relationship to them. Faculty, ask an admin to review cohort/mentor assignments."
      />
    );
  }

  let category: { name: string } | null = null;
  if (results?.[0]?.primary_category_id) {
    const { data } = await supabase.from("dp_wiring_categories").select("name").eq("id", results[0].primary_category_id).maybeSingle();
    category = data;
  }

  return (
    <div className="max-w-4xl space-y-8 pb-16">
      <div>
        <Link href="/staff/dashboard" className="font-ui text-sm text-charcoal/60 underline">
          ← Staff Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-burgundy">{profile.full_name || profile.email}</h1>
            <p className="font-ui text-sm text-charcoal/50">{profile.email}</p>
          </div>
          <Link href={`/staff/students/${studentId}/session/new`} className="btn-primary">
            + Log a session
          </Link>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-lg text-burgundy">Enrollments</h2>
          <ul className="mt-2 space-y-1">
            {(enrollments ?? []).map((e) => (
              <li key={e.id} className="font-body text-sm text-charcoal/80">
                {e.scope_type} · <Pill tone="neutral">{e.status}</Pill>
              </li>
            ))}
            {(!enrollments || enrollments.length === 0) && <p className="font-body text-sm text-charcoal/50">No enrollments yet.</p>}
          </ul>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg text-burgundy">Spiritual Wiring</h2>
          {category ? (
            <p className="mt-2 font-body text-sm text-charcoal/80">
              Primary: <strong>{category.name}</strong> (automated result — discuss in session before treating as
              settled)
            </p>
          ) : (
            <p className="mt-2 font-body text-sm text-charcoal/60">Assessment not completed yet.</p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg text-burgundy">Discipleship Plan</h2>
          {plan ? (
            <p className="mt-2 font-body text-sm text-charcoal/80">
              Season: <strong>{plan.current_season || "Not yet defined"}</strong> · <Pill tone="neutral">{plan.status}</Pill>
            </p>
          ) : (
            <p className="mt-2 font-body text-sm text-charcoal/60">No plan built yet.</p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg text-burgundy">Recent Submissions</h2>
          <ul className="mt-2 space-y-1">
            {(submissions ?? []).map((s: any) => (
              <li key={s.id} className="font-body text-sm text-charcoal/80">
                {s.dp_assignments?.title || "Assignment"} — <Pill tone="neutral">{s.status}</Pill>
              </li>
            ))}
            {(!submissions || submissions.length === 0) && <p className="font-body text-sm text-charcoal/50">No submissions yet.</p>}
          </ul>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl text-burgundy">Session History</h2>
        <div className="mt-3 space-y-4">
          {(sessions ?? []).map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-center justify-between">
                <Pill tone="burgundy">{s.session_type.replace(/_/g, " ")}</Pill>
                {s.scheduled_at && <span className="font-ui text-xs text-charcoal/50">{new Date(s.scheduled_at).toLocaleDateString()}</span>}
              </div>
              {s.student_visible_notes && (
                <div className="mt-3">
                  <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">Student-visible summary</p>
                  <p className="mt-1 font-body text-sm text-charcoal/80">{s.student_visible_notes}</p>
                </div>
              )}
              {s.private_faculty_notes && (
                <div className="mt-3 rounded-lg bg-coral/10 p-3">
                  <p className="font-ui text-xs font-semibold uppercase tracking-wide text-[#7a2c1c]">Private faculty note — not visible to student</p>
                  <p className="mt-1 font-body text-sm text-charcoal/80">{s.private_faculty_notes}</p>
                </div>
              )}
            </div>
          ))}
          {(!sessions || sessions.length === 0) && <EmptyState title="No sessions logged yet" body="Session history will appear here once a mentor logs a session with this student." />}
        </div>
      </div>
    </div>
  );
}
