import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import LessonEditFields from "@/components/LessonEditFields";
import LessonBlockEditor from "@/components/LessonBlockEditor";
import AssignmentQuickForm from "@/components/AssignmentQuickForm";

export default async function LessonBuilderPage({ params }: { params: { courseId: string; lessonId: string } }) {
  const supabase = createClient();
  const { courseId, lessonId } = params;

  const { data: lesson } = await supabase
    .from("dp_lessons")
    .select("id,title,subtitle,status,estimated_duration_minutes")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) {
    return <EmptyState title="Not available" body="This lesson doesn't exist, or you don't have an assigned relationship to it." />;
  }

  const [{ data: blocks }, { data: assignments }] = await Promise.all([
    supabase.from("dp_lesson_blocks").select("id,block_type,order_index,content").eq("lesson_id", lessonId).order("order_index"),
    supabase.from("dp_assignments").select("id,title,assignment_type,due_at").eq("lesson_id", lessonId).order("created_at", { ascending: false })
  ]);

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div>
        <Link href={`/staff/courses/${courseId}/builder`} className="font-ui text-sm text-charcoal/60 underline">
          ← Course
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl text-burgundy">{lesson.title}</h1>
          <Link href={`/courses/${courseId}/lessons/${lessonId}`} target="_blank" className="btn-secondary">
            Preview as student ↗
          </Link>
        </div>
      </div>

      <LessonEditFields
        lessonId={lesson.id}
        initialTitle={lesson.title}
        initialSubtitle={lesson.subtitle}
        initialStatus={lesson.status as "draft" | "scheduled" | "published"}
        initialDuration={lesson.estimated_duration_minutes}
      />

      <div>
        <h2 className="font-display text-xl text-burgundy">Content</h2>
        <div className="mt-3">
          <LessonBlockEditor lessonId={lesson.id} blocks={blocks ?? []} />
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl text-burgundy">Assignments</h2>
        <div className="mt-3">
          <AssignmentQuickForm lessonId={lesson.id} courseId={courseId} assignments={assignments ?? []} />
        </div>
      </div>
    </div>
  );
}
