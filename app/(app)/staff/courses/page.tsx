import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Pill } from "@/components/ui";
import { pathwayDisplayLabel } from "@/lib/pathways";
import CreateCourseForm from "@/components/CreateCourseForm";

export default async function StaffCoursesPage() {
  const supabase = createClient();

  const [{ data: courses }, { data: area }] = await Promise.all([
    supabase
      .from("dp_courses")
      .select("id,title,is_published,is_standalone,content_status,pathways,area_id,dp_learning_areas(name)")
      .order("created_at", { ascending: false }),
    supabase.from("dp_learning_areas").select("id").eq("area_key", "discipleship_hub").maybeSingle()
  ]);

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">Courses</h1>
        <p className="mt-1 font-body text-charcoal/70">
          Create a course here and assign it to a pathway, or open one to build its modules, lessons, and content.
        </p>
        <Link href="/staff/programs" className="btn-secondary mt-3 inline-flex">
          Manage Programs
        </Link>
      </div>

      {area?.id ? (
        <CreateCourseForm areaId={area.id} />
      ) : (
        <EmptyState title="Learning area missing" body="The Discipleship Hub learning area wasn't found, so courses can't be created here yet." />
      )}

      <div className="space-y-3">
        {(courses ?? []).map((c: any) => (
          <Link key={c.id} href={`/staff/courses/${c.id}/builder`} className="card flex items-center justify-between p-4 hover:border-burgundy/40">
            <div>
              <p className="font-body text-charcoal">{c.title}</p>
              <p className="font-ui text-xs text-charcoal/50">{c.dp_learning_areas?.name}</p>
              {c.pathways && c.pathways.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.pathways.map((code: string) => (
                    <Pill key={code} tone="gold">{pathwayDisplayLabel(code)}</Pill>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {c.is_standalone && <Pill tone="sunrise">standalone</Pill>}
              <Pill tone={c.is_published ? "success" : "neutral"}>{c.content_status ? c.content_status.replace(/_/g, " ") : c.is_published ? "published" : "draft"}</Pill>
            </div>
          </Link>
        ))}
        {(!courses || courses.length === 0) && <EmptyState title="No courses yet" body="Create your first course above, then add modules and lessons to it." />}
      </div>
    </div>
  );
}
