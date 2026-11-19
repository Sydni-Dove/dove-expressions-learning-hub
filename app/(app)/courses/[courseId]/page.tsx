import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles, hasAnyRole } from "@/lib/roles";
import { getCourseSettings, canAccessCourse } from "@/lib/course-access";
import CourseLocked from "@/components/CourseLocked";

export default async function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const supabase = createClient();
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: course } = await supabase.from("dp_courses").select("id,title,description,pillar").eq("id", params.courseId).maybeSingle();
  if (!course) notFound();

  const settings = await getCourseSettings(supabase, params.courseId);
  const isStaff = hasAnyRole(roles, ["super_admin", "faculty", "teacher"]);
  if (!(await canAccessCourse(supabase, params.courseId, settings, isStaff))) {
    return <CourseLocked courseId={params.courseId} />;
  }

  const { data: modules } = await supabase
    .from("dp_modules")
    .select("id,title,description,order_index")
    .eq("course_id", params.courseId)
    .order("order_index");

  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length
    ? await supabase.from("dp_lessons").select("id,title,module_id,status,estimated_duration_minutes,order_index").in("module_id", moduleIds).order("order_index")
    : { data: [] };

  const { data: resources } = await supabase
    .from("dp_course_resources")
    .select("id,title,kind,version")
    .eq("course_id", params.courseId)
    .eq("is_active", true)
    .order("kind", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: progressRows } = await supabase.from("dp_lesson_progress").select("lesson_id,status").eq("user_id", user!.id);
  const completedIds = new Set((progressRows ?? []).filter((p) => p.status === "completed").map((p) => p.lesson_id));

  return (
    <div className="space-y-8 pb-16">
      <div>
        <Link href="/courses" className="font-ui text-sm text-charcoal/60 underline">
          ← My Courses
        </Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">{course.title}</h1>
        {course.description && <p className="mt-2 font-body text-charcoal/70">{course.description}</p>}
        {settings.lessonStyle === "practical" && (
          <Link href={`/courses/${course.id}/my-build`} className="btn-sunrise mt-4" data-testid="my-build-link">
            Open My Build
          </Link>
        )}
      </div>

      {(resources ?? []).length > 0 && (
        <aside className="card p-5" aria-labelledby="course-downloads" data-testid="course-downloads">
          <h2 id="course-downloads" className="font-display text-xl text-burgundy">Workbook &amp; printable pages</h2>
          <ul className="mt-3 space-y-2">
            {(resources ?? []).map((r: any) => (
              <li key={r.id}>
                <a href={`/courses/${course.id}/resources/${r.id}`} className="btn-secondary w-full justify-start sm:w-auto" data-testid="resource-download">
                  Download: {r.title}{r.version ? ` (${r.version})` : ""} ↓
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-ui text-xs text-charcoal/60">
            Print it, or type in the PDF on your own device. Anything you type in the downloaded PDF stays on your device and is <strong>not</strong> sent to the Hub. To save your work here and send it to your instructor, use the screens inside each lesson.
          </p>
        </aside>
      )}

      <div className="space-y-6">
        {(modules ?? []).map((mod) => (
          <div key={mod.id} className="card p-6">
            <h2 className="font-display text-xl text-burgundy">{mod.title}</h2>
            {mod.description && <p className="mt-1 font-body text-sm text-charcoal/70">{mod.description}</p>}
            <ul className="mt-4 divide-y divide-charcoal/10">
              {(lessons ?? [])
                .filter((l) => l.module_id === mod.id && (l.status === "published" || isStaff))
                .map((l) => {
                  const done = completedIds.has(l.id);
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/courses/${course.id}/lessons/${l.id}`}
                        className="flex items-center justify-between gap-4 py-3 font-body text-charcoal hover:text-burgundy"
                      >
                        <span className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                              done ? "border-burgundy bg-burgundy text-soft" : "border-charcoal/30"
                            }`}
                          >
                            {done ? "✓" : ""}
                          </span>
                          {l.title}
                          {l.status !== "published" && <span className="rounded-full bg-gold/20 px-2 py-0.5 font-ui text-[11px] uppercase tracking-wide text-charcoal/70">{l.status} · staff only</span>}
                        </span>
                        {l.estimated_duration_minutes && (
                          <span className="shrink-0 font-ui text-xs text-charcoal/50">{l.estimated_duration_minutes} min</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        {(!modules || modules.length === 0) && (
          <div className="card p-8 text-center">
            <p className="font-body text-charcoal/70">Modules for this course are still being built.</p>
          </div>
        )}
      </div>
    </div>
  );
}
