import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { ProgressBar, ProgressRing, Pill, IconBadge, EmptyState } from "@/components/ui";
import {
  getPrimaryPathwayCode,
  isPrimaryPathwayCode,
  PATHWAY_ICONS,
  PATHWAY_STYLES,
  ROOTED_TRACK,
  formationStage,
  pathwayHref
} from "@/lib/pathways";
import type { PathwayCode } from "@/lib/types";
import { ArrowRight, NotebookPen, Radio, Compass } from "lucide-react";

type PathwayStats = {
  publishedCourseCount: number;
  comingSoonCount: number;
  totalLessons: number;
  completedLessons: number;
};

export default async function DiscipleshipHomePage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const [{ data: pathways }, { data: courses }, { data: modules }, { data: lessons }, { data: progressRows }, { data: notes }, { data: liveSessions }] =
    await Promise.all([
      supabase.from("dp_pathways").select("*").order("order_index"),
      supabase.from("dp_courses").select("id,title,slug,pathways,is_published,content_status,content_format"),
      supabase.from("dp_modules").select("id,course_id"),
      supabase.from("dp_lessons").select("id,module_id,status").eq("status", "published"),
      supabase.from("dp_lesson_progress").select("lesson_id,status").eq("user_id", user!.id).eq("status", "completed"),
      supabase.from("dp_notes").select("id,title,updated_at").eq("author_id", user!.id).order("updated_at", { ascending: false }).limit(3),
      supabase.from("dp_live_sessions").select("id,title,starts_at").gte("starts_at", new Date().toISOString()).order("starts_at").limit(2)
    ]);

  const moduleToCourse = new Map((modules ?? []).map((m) => [m.id, m.course_id]));
  const lessonsByCourse = new Map<string, string[]>();
  for (const l of lessons ?? []) {
    const courseId = moduleToCourse.get(l.module_id);
    if (!courseId) continue;
    if (!lessonsByCourse.has(courseId)) lessonsByCourse.set(courseId, []);
    lessonsByCourse.get(courseId)!.push(l.id);
  }
  const completedLessonIds = new Set((progressRows ?? []).map((p) => p.lesson_id));

  const primaryPathways = (pathways ?? []).filter((p) => isPrimaryPathwayCode(p.code));
  const stats: Record<string, PathwayStats> = {};
  for (const p of primaryPathways) {
    stats[p.code] = { publishedCourseCount: 0, comingSoonCount: 0, totalLessons: 0, completedLessons: 0 };
  }
  for (const c of courses ?? []) {
    const primaryCodes = new Set<PathwayCode>((c.pathways ?? []).map((code: string) => getPrimaryPathwayCode(code)));
    for (const code of primaryCodes) {
      if (!stats[code]) continue;
      // Archived content is excluded from both "available" and "coming soon" counts.
      if (c.content_status === "archived") continue;
      if (c.is_published) {
        stats[code].publishedCourseCount += 1;
        const courseLessons = lessonsByCourse.get(c.id) ?? [];
        stats[code].totalLessons += courseLessons.length;
        stats[code].completedLessons += courseLessons.filter((id) => completedLessonIds.has(id)).length;
      } else if (c.content_status === "coming_soon") {
        stats[code].comingSoonCount += 1;
      }
    }
  }

  function statusFor(s: PathwayStats): "Not Started" | "In Progress" | "Completed" {
    if (s.totalLessons === 0 || s.completedLessons === 0) return "Not Started";
    if (s.completedLessons >= s.totalLessons) return "Completed";
    return "In Progress";
  }

  const totalLessonsAll = Object.values(stats).reduce((sum, s) => sum + s.totalLessons, 0);
  const completedLessonsAll = Object.values(stats).reduce((sum, s) => sum + s.completedLessons, 0);
  const overallPercent = totalLessonsAll ? Math.round((completedLessonsAll / totalLessonsAll) * 100) : 0;

  // Recommended next step: first pathway (in journey order) that isn't complete and has published content.
  const journeyOrdered = [...primaryPathways].sort((a, b) => a.journey_order_index - b.journey_order_index);
  const recommended = journeyOrdered.find((p) => {
    const s = stats[p.code];
    return s && s.publishedCourseCount > 0 && statusFor(s) !== "Completed";
  }) ?? journeyOrdered.find((p) => stats[p.code]?.publishedCourseCount > 0);

  const displayName = (user?.user_metadata as { full_name?: string })?.full_name?.split(" ")[0] || "Friend";

  return (
    <div className="space-y-8 pb-16">
      {/* Welcome */}
      <div className="rounded-card-lg bg-burgundy-gradient p-6 text-soft shadow-card sm:p-8">
        <p className="font-ui text-xs font-semibold uppercase tracking-widest text-gold">Discipleship</p>
        <h1 className="mt-2 font-display text-3xl text-soft">Welcome back, {displayName}.</h1>
        <p className="mt-2 max-w-xl font-body italic text-soft/85">
          This is your guided formation environment — not a course catalog. Each pathway meets you where you are and
          walks you toward what God is building in you.
        </p>
        {totalLessonsAll > 0 && (
          <div className="mt-5 max-w-sm">
            <ProgressBar percent={overallPercent} label="Overall discipleship progress" tone="gold" />
          </div>
        )}
      </div>

      {/* Recommended next step */}
      {recommended && (
        <div className={`card ${PATHWAY_STYLES[recommended.code as PathwayCode].band} overflow-hidden`}>
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
            <ProgressRing percent={stats[recommended.code] ? Math.round((stats[recommended.code].completedLessons / Math.max(stats[recommended.code].totalLessons, 1)) * 100) : 0} label="This pathway" />
            <div className="flex-1">
              <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">Recommended next step</p>
              <h2 className="mt-2 font-display text-2xl text-burgundy">{recommended.name}: {recommended.subtitle}</h2>
              <p className="mt-2 font-body text-charcoal/75">{recommended.purpose}</p>
              <Link href={pathwayHref(recommended.code as PathwayCode)} className="btn-primary mt-4">
                {statusFor(stats[recommended.code]) === "Not Started" ? "Begin this pathway" : "Continue Learning"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Three Pathway cards */}
      <div>
        <h2 className="font-display text-xl text-burgundy">The Three Pathways</h2>
        <p className="mt-1 font-body text-sm text-charcoal/60">
          The journey isn't rigid, but it generally moves Draw Near → Hear God → Kingdom Mandate.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {primaryPathways.map((p) => {
            const s = stats[p.code] ?? { publishedCourseCount: 0, comingSoonCount: 0, totalLessons: 0, completedLessons: 0 };
            const percent = s.totalLessons ? Math.round((s.completedLessons / s.totalLessons) * 100) : 0;
            const status = statusFor(s);
            const style = PATHWAY_STYLES[p.code as PathwayCode];
            const Icon = PATHWAY_ICONS[p.code as PathwayCode];
            return (
              <div key={p.id} className={`card card-hover ${style.band} p-6`}>
                <div className="flex items-start justify-between">
                  <IconBadge icon={Icon} className={style.badge} />
                  <Pill tone={status === "Completed" ? "success" : status === "In Progress" ? "gold" : "neutral"}>{status}</Pill>
                </div>
                <h3 className="mt-4 font-display text-xl text-burgundy">{p.name}</h3>
                <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">{p.subtitle}</p>
                <p className="mt-2 font-body text-sm text-charcoal/70">{p.description}</p>
                {p.scripture_ref && (
                  <p className="mt-3 font-body text-sm italic text-charcoal/60">{p.scripture_ref}</p>
                )}
                <div className="mt-4">
                  <ProgressBar percent={percent} />
                  <p className="mt-1 font-ui text-xs text-charcoal/50">{formationStage(percent)}</p>
                </div>
                <p className="mt-3 font-ui text-xs text-charcoal/50">
                  {s.publishedCourseCount} course{s.publishedCourseCount === 1 ? "" : "s"} available
                  {s.comingSoonCount > 0 ? ` · ${s.comingSoonCount} coming soon` : ""}
                </p>
                <Link href={pathwayHref(p.code as PathwayCode)} className="btn-secondary mt-4">
                  {status === "Not Started" ? "Explore" : "Continue"}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            );
          })}
        </div>
        <div id="rooted" className="mt-5 card card-band-gold p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Pill tone="gold">Formation track within Draw Near</Pill>
              <h3 className="mt-3 font-display text-2xl text-burgundy">{ROOTED_TRACK.title}</h3>
              <p className="mt-2 max-w-2xl font-body text-sm text-charcoal/75">{ROOTED_TRACK.description}</p>
            </div>
            <Link href="/discipleship/draw_near#rooted" className="btn-secondary shrink-0">
              View Rooted
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-5 rounded-card bg-pale-pink/35 p-5">
            <Pill tone="neutral">Coming soon</Pill>
            <h4 className="mt-2 font-display text-xl text-burgundy">{ROOTED_TRACK.seriesTitle}</h4>
            <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">
              {ROOTED_TRACK.seriesSubtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Recent activity + upcoming */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-3">
            <IconBadge icon={NotebookPen} className="bg-pale-pink text-burgundy" />
            <h3 className="font-display text-lg text-burgundy">Recent Reflection Activity</h3>
          </div>
          {notes && notes.length > 0 ? (
            <ul className="space-y-1.5">
              {notes.map((n) => (
                <li key={n.id} className="font-body text-sm text-charcoal/80">{n.title || "Untitled reflection"}</li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-charcoal/70">No reflections yet — they'll show up here as you go.</p>
          )}
          <Link href="/notes" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
            Go to Notes &amp; Journal <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="card p-6">
          <div className="mb-3 flex items-center gap-3">
            <IconBadge icon={Radio} className="bg-coral/15 text-coral-dark" />
            <h3 className="font-display text-lg text-burgundy">Upcoming Live Sessions</h3>
          </div>
          {liveSessions && liveSessions.length > 0 ? (
            <ul className="space-y-2">
              {liveSessions.map((s) => (
                <li key={s.id} className="font-body text-sm text-charcoal/80">
                  <span className="font-semibold">{s.title}</span>
                  <p className="font-ui text-xs text-charcoal/50">
                    {new Date(s.starts_at as string).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-charcoal/70">Nothing scheduled yet — check back soon.</p>
          )}
          <Link href="/live" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
            View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {(!primaryPathways || primaryPathways.length === 0) && (
        <EmptyState icon={Compass} title="Pathways not configured" body="Your discipleship pathways will appear here once set up." />
      )}
    </div>
  );
}
