import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill, IconBadge } from "@/components/ui";
import { ClipboardList, ArrowRight } from "lucide-react";

export default async function StaffAssignmentsPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: assignments } = await supabase
    .from("dp_assignments")
    .select("id,title,assignment_type,due_at,course_id,assigned_to_user_id,assigned_to_cohort_id,dp_courses(title)")
    .order("created_at", { ascending: false });

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = assignmentIds.length
    ? await supabase.from("dp_submissions").select("id,assignment_id,status").in("assignment_id", assignmentIds)
    : { data: [] };

  const subsFor = (assignmentId: string) => (submissions ?? []).filter((s) => s.assignment_id === assignmentId);

  const scopeLabel = (a: { assigned_to_user_id: string | null; assigned_to_cohort_id: string | null }) => {
    if (a.assigned_to_user_id) return "Individual student";
    if (a.assigned_to_cohort_id) return "Cohort";
    return "Whole course";
  };

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <IconBadge icon={ClipboardList} className="bg-pale-pink text-burgundy" />
        <div>
          <h1 className="font-display text-3xl text-burgundy">Assignments</h1>
          <p className="mt-1 font-body text-charcoal/70">
            Every assignment created from a lesson builder, with submission counts. New assignments are created
            from a lesson's builder page, not here.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {(assignments ?? []).map((a) => {
          const subs = subsFor(a.id);
          const awaiting = subs.filter((s) => s.status === "submitted");
          const course = a.dp_courses as unknown as { title: string } | null;
          return (
            <div key={a.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="burgundy">{a.assignment_type.replace(/_/g, " ")}</Pill>
                <Pill tone="neutral">{scopeLabel(a)}</Pill>
                {a.due_at && <Pill tone="gold">Due {new Date(a.due_at).toLocaleDateString()}</Pill>}
                {awaiting.length > 0 && <Pill tone="sunrise">{awaiting.length} awaiting feedback</Pill>}
              </div>
              <h2 className="mt-2 font-display text-lg text-burgundy">{a.title}</h2>
              {course && <p className="font-ui text-xs text-charcoal/50">{course.title}</p>}
              <p className="mt-1 font-body text-sm text-charcoal/70">
                {subs.length} submission{subs.length === 1 ? "" : "s"} so far
              </p>
              {awaiting.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {awaiting.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/staff/submissions/${s.id}`}
                        className="inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy"
                      >
                        Review submission <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        {(!assignments || assignments.length === 0) && (
          <EmptyState
            icon={ClipboardList}
            title="No assignments yet"
            body="Create one from a lesson's builder page — open a course, a lesson, and use the assignment form there."
          />
        )}
      </div>

      <Link href="/staff/dashboard" className="btn-secondary">
        Back to Dashboard
      </Link>
    </div>
  );
}
