import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { ProgressBar, Pill, IconBadge, EmptyState } from "@/components/ui";
import { PATHWAY_ICONS, PATHWAY_STYLES, formationStage } from "@/lib/pathways";
import { mockResources } from "@/lib/mock-data";
import type { PathwayCode } from "@/lib/types";
import { ArrowRight, BookOpen, Clock3 } from "lucide-react";

const PATHWAY_CODES: PathwayCode[] = ["draw_near", "hear_god", "rooted", "kingdom_mandate"];

export default async function PathwayDetailPage({ params }: { params: { pathway: string } }) {
  const code = params.pathway as PathwayCode;
  if (!PATHWAY_CODES.includes(code)) notFound();

  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: pathway } = await supabase.from("dp_pathways").select("*").eq("code", code).maybeSingle();
  if (!pathway) notFound();

  const { data: courses } = await supabase
    .from("dp_courses")
    .select("id,title,subtitle,slug,description,content_format,content_status,difficulty_level,estimated_duration,is_published,order_index")
    .contains("pathways", [code])
    .order("order_index");

  // Archived content is excluded from both lists — it's no longer active, not upcoming.
  const publishedCourses = (courses ?? []).filter((c) => c.is_published && c.content_status !== "archived");
  const comingSoonCourses = (courses ?? []).filter((c) => !c.is_published && c.content_status === "coming_soon");

  const courseIds = publishedCourses.map((c) => c.id);
  const { data: modules } = courseIds.length
    ? await supabase.from("dp_modules").select("id,course_id").in("course_id", courseIds)
    : { data: [] };
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length
    ? await supabase.from("dp_lessons").select("id,module_id").eq("status", "published").in("module_id", moduleIds)
    : { data: [] };
  const { data: progressRows } = await supabase
    .from("dp_lesson_progress")
    .select("lesson_id,status")
    .eq("user_id", user!.id)
    .eq("status", "completed");

  const moduleToCourse = new Map((modules ?? []).map((m) => [m.id, m.course_id]));
  const lessonsByCourse = new Map<string, string[]>();
  for (const l of lessons ?? []) {
    const cid = moduleToCourse.get(l.module_id);
    if (!cid) continue;
    if (!lessonsByCourse.has(cid)) lessonsByCourse.set(cid, []);
    lessonsByCourse.get(cid)!.push(l.id);
  }
  const completedIds = new Set((progressRows ?? []).map((p) => p.lesson_id));

  const totalLessons = [...lessonsByCourse.values()].flat().length;
  const completedLessons = [...lessonsByCourse.values()].flat().filter((id) => completedIds.has(id)).length;
  const percent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const relatedResources = mockResources.filter((r) => r.pathways.includes(code));

  const style = PATHWAY_STYLES[code];
  const Icon = PATHWAY_ICONS[code];
  const isRooted = code === "rooted";

  return (
    <div className="space-y-8 pb-16">
      <div>
        <Link href="/discipleship" className="font-ui text-sm text-charcoal/60 underline">
          ← All Pathways
        </Link>
        <div className={`mt-3 card ${style.band} ${style.wash} overflow-hidden`}>
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <IconBadge icon={Icon} className={style.badge} />
              {totalLessons > 0 && <Pill tone="gold">{formationStage(percent)}</Pill>}
            </div>
            <h1 className="mt-4 font-display text-3xl text-burgundy">{pathway.name}</h1>
            <p className="font-ui text-sm font-semibold uppercase tracking-wide text-charcoal/40">{pathway.subtitle}</p>
            <p className="mt-3 max-w-2xl font-body text-charcoal/80">{pathway.description}</p>
            {pathway.scripture_ref && <p className="mt-3 font-body italic text-charcoal/60">{pathway.scripture_ref}</p>}
            {totalLessons > 0 && (
              <div className="mt-5 max-w-sm">
                <ProgressBar percent={percent} label="Progress in this pathway" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purpose & outcomes */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-lg text-burgundy">Purpose</h2>
          <p className="mt-2 font-body text-sm text-charcoal/75">{pathway.purpose}</p>
        </div>
        <div className="card p-6">
          <h2 className="font-display text-lg text-burgundy">Expected Spiritual Outcomes</h2>
          <ul className="mt-2 space-y-1.5">
            {(pathway.expected_outcomes ?? []).map((o: string, i: number) => (
              <li key={i} className="font-body text-sm text-charcoal/75">· {o}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Rooted gets extra detail per current build priority */}
      {isRooted && (
        <div className="card card-band-gold p-6 sm:p-8">
          <Pill tone="gold">Featured Series</Pill>
          <h2 className="mt-3 font-display text-2xl text-burgundy">Rooted: The Mind of Christ</h2>
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">
            Learning to Think, Discern, and Respond From Christ's Perspective
          </p>
          <p className="mt-3 max-w-2xl font-body text-charcoal/75">
            The first teaching series under Rooted. It will include teaching lessons, reflection exercises,
            Scripture study, declarations, journal prompts, and practical activation — all centered on
            learning to think, discern, and respond the way Christ does. Lessons are being developed and will
            be released here as they're ready.
          </p>
          <Pill tone="neutral">Coming soon</Pill>
        </div>
      )}

      {/* Available courses / series */}
      <div>
        <h2 className="font-display text-xl text-burgundy">Available Courses &amp; Series</h2>
        <p className="mt-1 font-body text-sm text-charcoal/60">Shown in the recommended order for this pathway.</p>
        {publishedCourses.length === 0 && comingSoonCourses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Content coming soon"
            body="Your faculty team is still building this pathway's courses and series. Check back soon."
          />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {publishedCourses.map((c, i) => {
              const courseLessons = lessonsByCourse.get(c.id) ?? [];
              const courseCompleted = courseLessons.filter((id) => completedIds.has(id)).length;
              const coursePercent = courseLessons.length ? Math.round((courseCompleted / courseLessons.length) * 100) : 0;
              return (
                <Link key={c.id} href={`/courses/${c.id}`} className="card card-hover block p-6">
                  <div className="flex items-center justify-between">
                    <span className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">
                      {i + 1}. {c.content_format === "series" ? "Series" : "Course"}
                    </span>
                    {c.difficulty_level && <Pill tone="neutral">{c.difficulty_level}</Pill>}
                  </div>
                  <h3 className="mt-2 font-display text-lg text-burgundy">{c.title}</h3>
                  {c.subtitle && <p className="font-ui text-xs text-charcoal/50">{c.subtitle}</p>}
                  {c.description && <p className="mt-2 font-body text-sm text-charcoal/70">{c.description}</p>}
                  {c.estimated_duration && (
                    <p className="mt-2 flex items-center gap-1.5 font-ui text-xs text-charcoal/50">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {c.estimated_duration}
                    </p>
                  )}
                  {courseLessons.length > 0 && <div className="mt-3"><ProgressBar percent={coursePercent} /></div>}
                </Link>
              );
            })}
            {comingSoonCourses.map((c) => (
              <div key={c.id} className="card p-6 opacity-80">
                <Pill tone="neutral">Coming soon</Pill>
                <h3 className="mt-2 font-display text-lg text-burgundy">{c.title}</h3>
                {c.subtitle && <p className="font-ui text-xs text-charcoal/50">{c.subtitle}</p>}
                {c.description && <p className="mt-2 font-body text-sm text-charcoal/70">{c.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Related resources */}
      {relatedResources.length > 0 && (
        <div>
          <h2 className="font-display text-xl text-burgundy">Related Resources</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {relatedResources.map((r) => (
              <div key={r.id} className="card p-5">
                <Pill tone="neutral">{r.category}</Pill>
                <h3 className="mt-2 font-display text-base text-burgundy">{r.title}</h3>
              </div>
            ))}
          </div>
          <Link href="/library" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
            View in Library <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Reflection & Activation */}
      <div className="card card-band-burgundy p-6 sm:p-8">
        <h2 className="font-display text-lg text-burgundy">Reflection &amp; Activation</h2>
        <p className="mt-1 font-body text-sm text-charcoal/70">
          Every lesson in this pathway moves through the same process: Receive → Record → Understand → Respond →
          Build. As you go, your notes and activation steps for {pathway.name} will show up in your{" "}
          <Link href="/notes" className="font-semibold text-burgundy underline">Notes &amp; Journal</Link> and your{" "}
          <Link href="/discipleship/journey" className="font-semibold text-burgundy underline">Discipleship Journey</Link>.
        </p>
      </div>
    </div>
  );
}
