import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { getStudentPrograms } from "@/lib/student-programs";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/components/ui";
import { pathwayDisplayLabel } from "@/lib/pathways";

export default async function CoursesPage() {
  const supabase = createClient();
  const {user} = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  const programs = await getStudentPrograms(user.id);
  const allowedAreas = [programs.includes("discipleship") ? "discipleship_hub" : "", programs.includes("voice") ? "voice_studio" : "", programs.includes("creative") ? "creative_studio" : ""].filter(Boolean);
  const { data: courses } = await supabase
    .from("dp_courses")
    .select("id,title,description,pillar,pathways,is_published,area_id,dp_learning_areas(name,area_key)")
    .eq("is_published", true)
    .order("order_index");

  const visibleCourses = (courses ?? []).filter((c: any) => allowedAreas.includes(c.dp_learning_areas?.area_key));

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">My Courses</h1>
        <p className="mt-1 font-body text-charcoal/70">Published courses from your enrolled learning programs.</p>

      </div>

      {visibleCourses.length === 0 ? (
        <div className="card p-8 text-center">
          <h3 className="font-display text-lg text-burgundy">No published courses yet</h3>
          <p className="mt-2 font-body text-sm text-charcoal/70">
            Your faculty team is still building this course library. Check back soon.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleCourses.map((c: any) => (
            <Link key={c.id} href={`/courses/${c.id}`} className="card block p-6 transition hover:shadow-md">
              {c.pathways && c.pathways.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.pathways.map((code: string) => (
                    <Pill key={code} tone="burgundy">{pathwayDisplayLabel(code)}</Pill>
                  ))}
                </div>
              ) : (
                c.pillar && <Pill tone="burgundy">{c.pillar.replace(/_/g, " ")}</Pill>
              )}
              <h2 className="mt-3 font-display text-xl text-burgundy">{c.title}</h2>
              {c.description && <p className="mt-2 font-body text-sm text-charcoal/70">{c.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
