import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import CourseEditFields from "@/components/CourseEditFields";
import { getCourseSettingsRaw } from "@/lib/course-access";
import ModulesEditor from "@/components/ModulesEditor";

export default async function CourseBuilderPage({ params }: { params: { courseId: string } }) {
  const supabase = createClient();
  const courseId = params.courseId;

  const { data: course } = await supabase
    .from("dp_courses")
    .select("id,title,subtitle,description,is_published,is_standalone,program_id,pathways,track_key,series_key,content_status,content_format,difficulty_level,estimated_duration,cover_image_url")
    .eq("id", courseId)
    .maybeSingle();

  const rawSettings = await getCourseSettingsRaw(supabase, courseId);

  if (!course) {
    return <EmptyState title="Not available" body="This course doesn't exist, or you don't have an assigned relationship to it." />;
  }

  const { data: modules } = await supabase
    .from("dp_modules")
    .select("id,title,order_index,dp_lessons(id,title,status)")
    .eq("course_id", courseId)
    .order("order_index");

  const modulesForEditor = (modules ?? []).map((m: any) => ({
    id: m.id,
    title: m.title,
    order_index: m.order_index,
    lessons: (m.dp_lessons ?? []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
  }));

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div>
        {course.program_id && (
          <Link href={`/staff/programs/${course.program_id}/builder`} className="font-ui text-sm text-charcoal/60 underline">
            ← Program
          </Link>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl text-burgundy">{course.title}</h1>
          <Link href={`/courses/${course.id}`} target="_blank" className="btn-secondary">
            Preview as student ↗
          </Link>
        </div>
      </div>

      <CourseEditFields
        courseId={course.id}
        initialTitle={course.title}
        initialSubtitle={course.subtitle || ""}
        initialDescription={course.description || ""}
        initialPublished={course.is_published}
        initialStandalone={course.is_standalone}
        initialPathways={course.pathways || []}
        initialContentStatus={course.content_status || "draft"}
        initialContentFormat={course.content_format || "course"}
        initialDifficultyLevel={course.difficulty_level || ""}
        initialEstimatedDuration={course.estimated_duration || ""}
        initialTrackKey={course.track_key || ""}
        initialSeriesKey={course.series_key || ""}
        initialCoverImageUrl={course.cover_image_url || ""}
        initialAccessMode={rawSettings?.access_mode ?? "open"}
        initialLessonStyle={rawSettings?.lesson_style ?? "reflective"}
        settingsAvailable={!!rawSettings}
      />

      <div>
        <h2 className="font-display text-xl text-burgundy">Modules &amp; lessons</h2>
        <div className="mt-3">
          <ModulesEditor courseId={course.id} modules={modulesForEditor} />
        </div>
      </div>
    </div>
  );
}
