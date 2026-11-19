import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import GuidedImportForm from "@/components/GuidedImportForm";

export default async function GuidedImportPage({ params }: { params: { courseId: string } }) {
  const supabase = createClient();
  const { data: course } = await supabase.from("dp_courses").select("id,title,is_published").eq("id", params.courseId).maybeSingle();
  if (!course) return <EmptyState title="Not available" body="This course doesn't exist, or you don't have an assigned relationship to it." />;
  return (
    <div className="max-w-2xl space-y-5 pb-16">
      <div>
        <Link href={`/staff/courses/${course.id}/builder`} className="font-ui text-sm text-charcoal/60 underline">← Course builder</Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">Import a guided course</h1>
        <p className="mt-1 font-body text-charcoal/70">Replace this course&rsquo;s lessons with a new edition from a course file. Everything arrives as a <strong>draft</strong>, and the previous content is archived, not deleted.</p>
      </div>
      {course.is_published && (
        <p role="alert" className="rounded-card border border-sunrise/40 bg-sunrise/10 p-3 font-ui text-sm">This course is published. Lessons that are already published keep their published status, so an import changes what students see.</p>
      )}
      <GuidedImportForm courseId={course.id} courseTitle={course.title} />
    </div>
  );
}
