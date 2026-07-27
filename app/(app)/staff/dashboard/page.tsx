import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { Pill, EmptyState } from "@/components/ui";

export default async function StaffDashboardPage() {
  const supabase = createClient();
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const [{ data: mentees }, { data: submissions }, { data: upcoming }, { data: recentResults }] = await Promise.all([
    supabase.from("dp_mentor_assignments").select("id,student_id,status").eq("status", "active"),
    supabase
      .from("dp_submissions")
      .select("id,student_id,assignment_id,status,submitted_at,dp_assignments(title)")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(8),
    supabase.from("dp_live_sessions").select("id,title,starts_at").gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
    supabase.from("dp_wiring_results").select("id,student_id,generated_at").order("generated_at", { ascending: false }).limit(5)
  ]);

  const studentIds = Array.from(
    new Set([...(mentees ?? []).map((m) => m.student_id), ...(recentResults ?? []).map((r) => r.student_id)])
  );
  const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", studentIds)
    : { data: [] };
  const nameFor = (id: string) => profiles?.find((p) => p.id === id)?.full_name || profiles?.find((p) => p.id === id)?.email || "Student";

  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">Staff Dashboard</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {roles.map((r) => (
            <Pill key={r} tone="burgundy">
              {r.replace(/_/g, " ")}
            </Pill>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-lg text-burgundy">My Students</h2>
          <ul className="mt-3 space-y-2">
            {(mentees ?? []).map((m) => (
              <li key={m.id}>
                <Link href={`/staff/students/${m.student_id}`} className="font-body text-charcoal hover:text-burgundy hover:underline">
                  {nameFor(m.student_id)}
                </Link>
              </li>
            ))}
          </ul>
          {(!mentees || mentees.length === 0) && <EmptyState title="No assigned students yet" body="Students assigned to you as mentor will appear here." />}
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg text-burgundy">Submissions Awaiting Feedback</h2>
          <ul className="mt-3 space-y-3">
            {(submissions ?? []).map((s: any) => (
              <li key={s.id}>
                <Link href={`/staff/submissions/${s.id}`} className="flex items-center justify-between gap-3 rounded-lg p-1 hover:bg-pale-pink/30">
                  <div>
                    <p className="font-body text-sm text-charcoal">{s.dp_assignments?.title || "Assignment"}</p>
                    <p className="font-ui text-xs text-charcoal/50">{nameFor(s.student_id)}</p>
                  </div>
                  <Pill tone="sunrise">Needs review</Pill>
                </Link>
              </li>
            ))}
          </ul>
          {(!submissions || submissions.length === 0) && <EmptyState title="All caught up" body="No submissions are waiting on feedback right now." />}
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg text-burgundy">Recent Wiring Results</h2>
          <p className="mt-1 font-ui text-xs text-charcoal/50">Candidates for a session-prep review.</p>
          <ul className="mt-3 space-y-2">
            {(recentResults ?? []).map((r) => (
              <li key={r.id}>
                <Link href={`/staff/students/${r.student_id}`} className="font-body text-charcoal hover:text-burgundy hover:underline">
                  {nameFor(r.student_id)}
                </Link>
              </li>
            ))}
          </ul>
          {(!recentResults || recentResults.length === 0) && <EmptyState title="No recent results" body="Newly completed assessments will surface here." />}
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg text-burgundy">Upcoming Live Sessions</h2>
          <ul className="mt-3 space-y-2">
            {(upcoming ?? []).map((s) => (
              <li key={s.id} className="font-body text-sm text-charcoal">
                {s.title} — <span className="font-ui text-xs text-charcoal/50">{new Date(s.starts_at as string).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
          {(!upcoming || upcoming.length === 0) && <EmptyState title="Nothing scheduled" body="Upcoming live sessions will appear here." />}
        </div>
      </div>
    </div>
  );
}
