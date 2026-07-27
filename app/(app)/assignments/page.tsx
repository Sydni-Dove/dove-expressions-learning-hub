import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill } from "@/components/ui";
import SubmissionForm from "@/components/SubmissionForm";

export default async function AssignmentsPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  // An assignment reaches a student three ways: assigned directly to them, assigned to a
  // cohort they're enrolled in, or attached to a course they're enrolled in with no specific
  // target (a general "everyone in this course" assignment). We fetch course-scoped
  // enrollments up front so we can pull that third category too.
  const { data: courseEnrollments } = await supabase
    .from("dp_enrollments")
    .select("scope_id")
    .eq("user_id", user!.id)
    .eq("scope_type", "course");
  const enrolledCourseIds = (courseEnrollments ?? []).map((e) => e.scope_id);

  const orClauses = [`assigned_to_user_id.eq.${user!.id}`];
  if (enrolledCourseIds.length > 0) {
    orClauses.push(`course_id.in.(${enrolledCourseIds.join(",")})`);
  }

  const { data: assignments } = await supabase
    .from("dp_assignments")
    .select("id,title,description,assignment_type,due_at,pillars,assigned_to_user_id")
    .or(orClauses.join(","))
    .order("due_at", { ascending: true });

  const { data: submissions } = await supabase
    .from("dp_submissions")
    .select("assignment_id,status,submitted_at")
    .eq("student_id", user!.id);

  const submissionFor = (assignmentId: string) => submissions?.find((s) => s.assignment_id === assignmentId);

  return (
    <div className="max-w-2xl space-y-4 pb-16">
      <h1 className="font-display text-3xl text-burgundy">Assignments</h1>
      <p className="font-body text-sm text-charcoal/70">Assigned directly to you, or as part of a course you're enrolled in.</p>

      {(!assignments || assignments.length === 0) && (
        <EmptyState title="Nothing assigned yet" body="Assignments from your teachers and mentor will show up here." />
      )}

      {(assignments ?? []).map((a) => {
        const sub = submissionFor(a.id);
        return (
          <div key={a.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="burgundy">{a.assignment_type.replace(/_/g, " ")}</Pill>
              {a.due_at && <Pill tone="neutral">Due {new Date(a.due_at).toLocaleDateString()}</Pill>}
              {sub && <Pill tone="success">{sub.status}</Pill>}
            </div>
            <h2 className="mt-2 font-display text-lg text-burgundy">{a.title}</h2>
            {a.description && <p className="mt-1 font-body text-sm text-charcoal/70">{a.description}</p>}
            {!sub && <SubmissionForm assignmentId={a.id} studentId={user!.id} />}
          </div>
        );
      })}
    </div>
  );
}
