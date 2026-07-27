import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/components/ui";

export default async function CoursesPage() {
  const supabase = createClient();
  const { data: courses } = await supabase
    .from("dp_courses")
    .select("id,title,description,pillar,pathways,is_published,area_id,dp_learning_areas(name,area_key)")
    .eq("is_published", true)
    .order("order_index");

  const PATHWAY_LABEL: Record<string, string> = {
    draw_near: "Draw Near",
    hear_god: "Hear God",
    rooted: "Rooted",
    kingdom_mandate: "Kingdom Mandate"
  };

  const discipleshipCourses = (courses ?? []).filter((c: any) => c.dp_learning_areas?.area_key === "discipleship_hub");

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">My Courses</h1>
        <p className="mt-1 font-body text-charcoal/70">Discipleship Hub courses. Looking for Creative Studio? It has its own home.</p>
        <Link href="/creative-studio" className="mt-2 inline-block font-ui text-sm font-semibold text-sunrise underline">
          Go to Creative Studio →
        </Link>
      </div>

      {discipleshipCourses.length === 0 ? (
        <div className="card p-8 text-center">
          <h3 className="font-display text-lg text-burgundy">No published courses yet</h3>
          <p className="mt-2 font-body text-sm text-charcoal/70">
            Your faculty team is still building this course library. Check back soon.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {discipleshipCourses.map((c: any) => (
            <Link key={c.id} href={`/courses/${c.id}`} className="card block p-6 transition hover:shadow-md">
              {c.pathways && c.pathways.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.pathways.map((code: string) => (
                    <Pill key={code} tone="burgundy">{PATHWAY_LABEL[code] || code}</Pill>
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
