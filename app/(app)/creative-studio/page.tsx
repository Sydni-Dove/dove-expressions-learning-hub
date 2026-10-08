import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { Pill, ProgressBar } from "@/components/ui";
import NewProjectButton from "@/components/NewProjectButton";

const PHASE_LABEL: Record<string, string> = {
  define: "1. Define",
  specify: "2. Specify",
  design: "3. Design",
  source: "4. Source",
  sell: "5. Sell",
  launch_prep: "6. Prepare for Launch",
  launch: "7. Production &amp; Launch",
  growth: "8. Post-Launch Growth"
};

export default async function CreativeStudioPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: area } = await supabase.from("dp_learning_areas").select("id,name,tagline,description").eq("area_key", "creative_studio").maybeSingle();
  const { data: courses } = await supabase
    .from("dp_courses")
    .select("id,title,description,pillar,order_index,is_standalone,program_id")
    .eq("area_id", area?.id)
    .eq("is_published", true)
    .order("order_index");

  const { data: projects } = await supabase
    .from("dp_creative_projects")
    .select("id,product_name,current_phase,progress_percent,recommended_from_discipleship")
    .eq("student_id", user!.id)
    .order("updated_at", { ascending: false });

  const { data: roadmap } = await supabase.from("dp_programs").select("id")
    .eq("slug", "stationery-product-creation-roadmap").maybeSingle();
  const roadmapCourses = (courses ?? []).filter((c) => roadmap && c.program_id === roadmap.id);
  const standaloneCourses = (courses ?? []).filter((c) => !roadmap || c.program_id !== roadmap.id);

  return (
    <div className="space-y-10 pb-16">
      <div className="rounded-card bg-sunrise/10 p-6">
        <h1 className="font-display text-3xl text-burgundy">{area?.name || "Dove Expressions Creative Studio"}</h1>
        <p className="mt-1 font-body text-charcoal/80">{area?.tagline}</p>
        <p className="mt-3 font-ui text-xs font-semibold uppercase tracking-wide text-[#7a4a00]">
          Receive the Vision → Define It → Design It → Produce It → Launch It
        </p>
        <p className="mt-1 font-body text-xs text-charcoal/60">
          One possible way to fulfill a Kingdom mandate — not the expected path for every disciple.
        </p>
      </div>

      <div>
        <h2 className="font-display text-xl text-burgundy">Stationery Product Creation Roadmap</h2>
        <p className="mt-1 font-body text-sm text-charcoal/70">Take the full 8-course roadmap, or a single course on its own.</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {roadmapCourses.map((c) => (
            <li key={c.id} className="card flex items-center gap-3 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunrise/20 font-ui text-sm font-bold text-[#7a4a00]">
                {c.order_index}
              </span>
              <Link href={`/courses/${c.id}`} className="font-body text-charcoal underline hover:text-burgundy">{c.title}</Link>
            </li>
          ))}
        </ol>
      </div>

      <section aria-labelledby="standalone-courses-heading">
        <h2 id="standalone-courses-heading" className="font-display text-xl text-burgundy">Standalone courses and workshops</h2>
        <p className="mt-1 font-body text-sm text-charcoal/70">Choose a course for the project you want to create.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {standaloneCourses.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`} className="card block p-5 hover:border-sunrise/40">
              <h3 className="font-display text-lg text-burgundy">{course.title}</h3>
              {course.description && <p className="mt-2 font-body text-sm text-charcoal/70">{course.description}</p>}
              <span className="mt-3 block font-ui text-sm font-semibold text-sunrise-dark">View course →</span>
            </Link>
          ))}
          {standaloneCourses.length === 0 && <p className="font-body text-sm text-charcoal/60">Courses and workshops will appear here when they are ready.</p>}
        </div>
      </section>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-burgundy">My Product Project Workspaces</h2>
        </div>
        <div className="mb-4">
          <NewProjectButton userId={user!.id} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(projects ?? []).map((p) => (
            <div key={p.id} className="card p-5">
              {p.recommended_from_discipleship && <Pill tone="burgundy">Recommended from Discipleship Hub</Pill>}
              <h3 className="mt-2 font-display text-lg text-burgundy">{p.product_name}</h3>
              <p className="mt-1 font-ui text-xs text-charcoal/50">{PHASE_LABEL[p.current_phase] || p.current_phase}</p>
              <div className="mt-3">
                <ProgressBar percent={p.progress_percent} />
              </div>
            </div>
          ))}
          {(!projects || projects.length === 0) && (
            <p className="font-body text-sm text-charcoal/60">No product projects yet — start one above.</p>
          )}
        </div>
      </div>
    </div>
  );
}
