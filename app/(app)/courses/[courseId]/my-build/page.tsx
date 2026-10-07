import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles, hasAnyRole } from "@/lib/roles";
import { getCourseSettings, canAccessCourse } from "@/lib/course-access";
import { orderPublishedLessons } from "@/lib/lesson-nav";
import CourseLocked from "@/components/CourseLocked";
import MyBuildForm from "@/components/MyBuildForm";
import type { BuildFields } from "@/lib/build-validation";

export default async function MyBuildPage({ params }: { params: { courseId: string } }) {
  const supabase = createClient();
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: course } = await supabase.from("dp_courses").select("id,title").eq("id", params.courseId).maybeSingle();
  if (!course) notFound();

  const settings = await getCourseSettings(supabase, params.courseId);
  const isStaff = hasAnyRole(roles, ["super_admin", "faculty", "teacher"]);
  if (!(await canAccessCourse(supabase, params.courseId, settings, isStaff))) {
    return <CourseLocked courseId={params.courseId} />;
  }

  // The student's own record only (RLS also enforces this).
  const { data: build, error: buildError } = await supabase
    .from("dp_builds")
    .select("app_name,building_what,audience,central_action,repo_url,preview_url,live_url,strategist_tool,developer_tool,evaluator_tool,current_focus,notes,parked_ideas")
    .eq("user_id", user!.id)
    .eq("course_id", params.courseId)
    .maybeSingle();

  // Current phase is derived from real progress rather than stored twice: the module
  // of the first published lesson the student hasn't completed.
  const { data: modules } = await supabase.from("dp_modules").select("id,title,order_index").eq("course_id", params.courseId).order("order_index");
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length
    ? await supabase.from("dp_lessons").select("id,title,module_id,order_index,status").in("module_id", moduleIds).eq("status", "published")
    : { data: [] };
  const ordered = orderPublishedLessons(modules ?? [], lessons ?? []) as (typeof lessons extends (infer L)[] | null ? L : never)[];
  const { data: progress } = await supabase.from("dp_lesson_progress").select("lesson_id,status").eq("user_id", user!.id);
  const done = new Set((progress ?? []).filter((p) => p.status === "completed").map((p) => p.lesson_id));
  const nextLesson = ordered.find((l: any) => !done.has(l.id)) as any;
  const currentModule = nextLesson ? (modules ?? []).find((m) => m.id === nextLesson.module_id) : null;

  return (
    <div className="space-y-6 pb-24">
      <div>
        <Link href={`/courses/${course.id}`} className="font-ui text-sm text-charcoal/60 underline">
          ← {course.title}
        </Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">My Build</h1>
        <p className="mt-1 font-body text-charcoal/70">The one app or website you&rsquo;re building through this course. Only you (and your instructors) can see it.</p>
      </div>

      <div className="card card-band-gold flex flex-wrap items-center justify-between gap-3 p-5" data-testid="my-build-progress">
        <div>
          <p className="font-ui text-xs font-bold uppercase tracking-[0.16em] text-charcoal/50">Where you are in the course</p>
          <p className="font-display text-lg text-burgundy">
            {nextLesson ? `${currentModule?.title ?? "Course"} — ${nextLesson.title}` : ordered.length ? "You’ve completed every lesson so far" : "Lessons are still being added"}
          </p>
        </div>
        <div className="flex gap-2">
          {nextLesson && (
            <Link href={`/courses/${course.id}/lessons/${nextLesson.id}`} className="btn-primary">Continue lesson</Link>
          )}
          <Link href="/assignments" className="btn-secondary">My assignments</Link>
        </div>
      </div>

      {buildError ? (
        <div className="card p-6" role="status" data-testid="my-build-unavailable">
          <p className="font-body text-charcoal/70">My Build isn&rsquo;t switched on yet for this course. Check back soon.</p>
        </div>
      ) : (
        <MyBuildForm userId={user!.id} courseId={course.id} initial={(build as Partial<BuildFields> | null) ?? null} />
      )}
    </div>
  );
}
