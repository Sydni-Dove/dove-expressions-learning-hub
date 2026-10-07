import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles, hasAnyRole } from "@/lib/roles";
import { getCourseSettings, canAccessCourse } from "@/lib/course-access";
import { orderPublishedLessons, computeLessonNeighbors } from "@/lib/lesson-nav";
import CourseLocked from "@/components/CourseLocked";
import LessonExperience from "@/components/lesson/LessonExperience";
import LessonReflectionForm from "@/components/LessonReflectionForm";
import MarkCompleteButton from "@/components/MarkCompleteButton";
import { resolveStorageContent } from "@/lib/storage";
import type { LessonBlock } from "@/lib/types";

export default async function LessonPage({ params }: { params: { courseId: string; lessonId: string } }) {
  const supabase = createClient();
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  // Route-level enrollment gate (defense in depth; RLS in migration 0027 is the real boundary).
  const settings = await getCourseSettings(supabase, params.courseId);
  const isStaff = hasAnyRole(roles, ["super_admin", "faculty", "teacher"]);
  if (!(await canAccessCourse(supabase, params.courseId, settings, isStaff))) {
    return <CourseLocked courseId={params.courseId} />;
  }

  const { data: lesson } = await supabase
    .from("dp_lessons")
    .select("id,title,subtitle,estimated_duration_minutes,module_id,order_index,status")
    .eq("id", params.lessonId)
    .maybeSingle();
  if (!lesson) notFound();

  const { data: module_ } = await supabase.from("dp_modules").select("id,course_id,order_index").eq("id", lesson.module_id).maybeSingle();
  if (!module_ || module_.course_id !== params.courseId) notFound();

  const { data: course } = await supabase.from("dp_courses").select("id,title,instructor_id").eq("id", params.courseId).maybeSingle();
  if (!course) notFound();

  let instructorName: string | null = null;
  if (course.instructor_id) {
    const { data: instructor } = await supabase.from("profiles").select("full_name").eq("id", course.instructor_id).maybeSingle();
    instructorName = instructor?.full_name ?? null;
  }

  const [{ data: blocksRaw }, { data: progress }, { data: bookmark }, { data: reflection }] = await Promise.all([
    supabase.from("dp_lesson_blocks").select("id,lesson_id,block_type,order_index,content").eq("lesson_id", lesson.id).order("order_index"),
    supabase.from("dp_lesson_progress").select("status").eq("user_id", user!.id).eq("lesson_id", lesson.id).maybeSingle(),
    supabase.from("dp_lesson_bookmarks").select("id").eq("user_id", user!.id).eq("lesson_id", lesson.id).maybeSingle(),
    supabase.from("dp_lesson_reflections").select("*").eq("lesson_id", lesson.id).eq("student_id", user!.id).maybeSingle()
  ]);
  // Resolve any protected-media references (storage://…) into short-lived signed
  // URLs, server-side, before content reaches the browser. Signing runs through
  // the caller's session, so it inherits the private bucket's lesson-access RLS;
  // anything the caller can't access resolves to an empty (honest) state.
  const blocks = (await Promise.all(
    (blocksRaw ?? []).map(async (b: any) => ({ ...b, content: await resolveStorageContent(supabase, b.content) }))
  )) as LessonBlock[];

  // Position this lesson within the whole course (across all modules) for "Lesson X of Y"
  // and the header's course-wide progress bar — real numbers, not hard-coded to Episode 2.
  const { data: allModules } = await supabase.from("dp_modules").select("id,order_index").eq("course_id", params.courseId).order("order_index");
  const moduleIds = (allModules ?? []).map((m) => m.id);
  const { data: allLessons } = moduleIds.length
    ? await supabase.from("dp_lessons").select("id,module_id,order_index,status").in("module_id", moduleIds).eq("status", "published")
    : { data: [] };
  const flattened = orderPublishedLessons(allModules ?? [], allLessons ?? []);
  const neighbors = computeLessonNeighbors(flattened, lesson.id);
  const lessonPosition = neighbors.position;
  const totalLessons = neighbors.total;

  const { data: progressRows } = await supabase
    .from("dp_lesson_progress")
    .select("lesson_id,status")
    .eq("user_id", user!.id)
    .in("lesson_id", flattened.map((l) => l.id).length ? flattened.map((l) => l.id) : ["00000000-0000-0000-0000-000000000000"]);
  const completedCount = (progressRows ?? []).filter((p) => p.status === "completed").length;
  const courseProgressPercent = Math.round((completedCount / totalLessons) * 100);

  const isComplete = progress?.status === "completed";
  const statusLabel = isComplete ? "Teaching complete" : progress?.status === "in_progress" ? "In progress" : "Not started";
  const durationLabel = lesson.estimated_duration_minutes ? `${lesson.estimated_duration_minutes} min` : null;
  const reflectionStarted = !!reflection && Object.entries(reflection).some(([k, v]) => typeof v === "string" && !["id", "lesson_id", "student_id"].includes(k) && v.trim().length > 0);

  return (
    <LessonExperience
      lessonId={lesson.id}
      lessonTitle={lesson.title}
      lessonSubtitle={lesson.subtitle}
      eyebrow={`${course.title} · Lesson ${lessonPosition} of ${totalLessons}`}
      courseId={course.id}
      courseTitle={course.title}
      instructorName={instructorName}
      durationLabel={durationLabel}
      statusLabel={statusLabel}
      moduleIndexLabel={String(lessonPosition).padStart(2, "0")}
      courseProgressPercent={courseProgressPercent}
      blocks={blocks}
      userId={user!.id}
      isComplete={isComplete}
      initiallyBookmarked={!!bookmark}
      reflectionStarted={reflectionStarted}
      markCompleteButton={<MarkCompleteButton lessonId={lesson.id} userId={user!.id} initiallyComplete={isComplete} />}
      reflectionForm={<LessonReflectionForm lessonId={lesson.id} userId={user!.id} />}
      lessonStyle={settings.lessonStyle}
      nav={{ previousId: neighbors.previousId, nextId: neighbors.nextId, isLast: neighbors.isLast }}
      myBuildHref={settings.lessonStyle === "practical" ? `/courses/${course.id}/my-build` : undefined}
    />
  );
}
