import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { ProgressBar, Pill, IconBadge, EmptyState } from "@/components/ui";
import { getPathwayProgress, statusForStats } from "@/lib/pathway-progress";
import { PATHWAY_ICONS, PATHWAY_STYLES, formationStage } from "@/lib/pathways";
import type { PathwayCode } from "@/lib/types";
import { BookOpen, NotebookPen, Target, CheckCircle2, ArrowRight } from "lucide-react";

export default async function DiscipleshipJourneyPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const [{ pathways, courses, stats }, { data: plan }, { data: notes }, { data: assignments }] = await Promise.all([
    getPathwayProgress(supabase, user!.id),
    supabase
      .from("dp_discipleship_plans")
      .select("id,current_season,status")
      .eq("student_id", user!.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("dp_notes")
      .select("id,title,note_kind,updated_at")
      .eq("author_id", user!.id)
      .eq("note_kind", "journal")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("dp_assignments")
      .select("id,title,assignment_type,due_at")
      .eq("assigned_to_user_id", user!.id)
      .order("due_at", { ascending: true })
      .limit(6)
  ]);

  const { data: goals } = plan
    ? await supabase.from("dp_goals").select("id,title,pillar,status,desired_growth").eq("plan_id", plan.id)
    : { data: [] };

  // Archived courses are excluded even if still marked published — they're no longer active.
  const visibleCourses = courses.filter((c) => c.is_published && c.content_status !== "archived");
  const activeCourses = visibleCourses.filter((c) => c.totalLessons > 0 && c.completedLessons < c.totalLessons && c.completedLessons > 0);
  const savedLessons = visibleCourses.filter((c) => c.completedLessons === 0 && c.totalLessons > 0);
  const completedCourses = visibleCourses.filter((c) => c.totalLessons > 0 && c.completedLessons === c.totalLessons);

  const journeyOrdered = [...pathways].sort((a, b) => a.journey_order_index - b.journey_order_index);
  const currentPathway =
    journeyOrdered.find((p) => stats[p.code] && stats[p.code].publishedCourseCount > 0 && statusForStats(stats[p.code]) === "In Progress") ??
    journeyOrdered.find((p) => stats[p.code] && stats[p.code].publishedCourseCount > 0 && statusForStats(stats[p.code]) === "Not Started");

  const totalAll = Object.values(stats).reduce((s, v) => s + v.totalLessons, 0);
  const completedAll = Object.values(stats).reduce((s, v) => s + v.completedLessons, 0);

  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">My Discipleship Journey</h1>
        <p className="mt-1 font-body text-charcoal/70">
          One place to see where you are, what you're carrying, and what's next — across all four pathways.
        </p>
      </div>

      {/* Progress across all four pathways */}
      <div>
        <h2 className="font-display text-lg text-burgundy">Progress Across the Four Pathways</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {journeyOrdered.map((p) => {
            const s = stats[p.code];
            const percent = s && s.totalLessons ? Math.round((s.completedLessons / s.totalLessons) * 100) : 0;
            const style = PATHWAY_STYLES[p.code as PathwayCode];
            const Icon = PATHWAY_ICONS[p.code as PathwayCode];
            return (
              <Link key={p.id} href={`/discipleship/${p.code}`} className={`card card-hover ${style.band} p-4`}>
                <IconBadge icon={Icon} className={`h-9 w-9 ${style.badge}`} />
                <h3 className="mt-2 font-display text-sm text-burgundy">{p.name}</h3>
                <div className="mt-2"><ProgressBar percent={percent} /></div>
                <p className="mt-1 font-ui text-xs text-charcoal/50">{formationStage(percent)}</p>
              </Link>
            );
          })}
        </div>
        {totalAll > 0 && (
          <p className="mt-3 font-ui text-xs text-charcoal/50">
            {completedAll} of {totalAll} lessons complete across every pathway you've begun.
          </p>
        )}
      </div>

      {/* Current pathway + recommended next step */}
      {currentPathway && (
        <div className={`card ${PATHWAY_STYLES[currentPathway.code as PathwayCode].band} p-6`}>
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">Current pathway</p>
          <h2 className="mt-1 font-display text-xl text-burgundy">{currentPathway.name}</h2>
          <p className="mt-2 font-body text-sm text-charcoal/70">Recommended next step: continue where you left off.</p>
          <Link href={`/discipleship/${currentPathway.code}`} className="btn-primary mt-4">
            Go to {currentPathway.name} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Active courses */}
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-3">
            <IconBadge icon={BookOpen} className="bg-pale-pink text-burgundy" />
            <h3 className="font-display text-lg text-burgundy">Active Courses</h3>
          </div>
          {activeCourses.length > 0 ? (
            <ul className="space-y-3">
              {activeCourses.map((c) => (
                <li key={c.id}>
                  <Link href={`/courses/${c.id}`} className="font-body text-sm font-semibold text-charcoal hover:text-burgundy">{c.title}</Link>
                  <ProgressBar percent={c.percent} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-charcoal/70">Nothing in progress right now.</p>
          )}
        </div>

        {/* Completed courses */}
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-3">
            <IconBadge icon={CheckCircle2} className="bg-green-100 text-green-800" />
            <h3 className="font-display text-lg text-burgundy">Completed Courses</h3>
          </div>
          {completedCourses.length > 0 ? (
            <ul className="space-y-1.5">
              {completedCourses.map((c) => (
                <li key={c.id} className="font-body text-sm text-charcoal/80">{c.title}</li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-charcoal/70">None completed yet — every pathway starts with Exploring.</p>
          )}
        </div>

        {/* Saved lessons (available, not yet started) */}
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-3">
            <IconBadge icon={BookOpen} className="bg-gold/15 text-gold-dark" />
            <h3 className="font-display text-lg text-burgundy">Saved for Later</h3>
          </div>
          {savedLessons.length > 0 ? (
            <ul className="space-y-1.5">
              {savedLessons.map((c) => (
                <li key={c.id}>
                  <Link href={`/courses/${c.id}`} className="font-body text-sm text-charcoal/80 hover:text-burgundy">{c.title}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-charcoal/70">Available courses you haven't started yet will show up here.</p>
          )}
        </div>

        {/* Personal reflections */}
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-3">
            <IconBadge icon={NotebookPen} className="bg-coral/15 text-coral-dark" />
            <h3 className="font-display text-lg text-burgundy">Personal Reflections</h3>
          </div>
          {notes && notes.length > 0 ? (
            <ul className="space-y-1.5">
              {notes.map((n) => (
                <li key={n.id} className="font-body text-sm text-charcoal/80">{n.title || "Untitled reflection"}</li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-charcoal/70">No journal reflections yet.</p>
          )}
          <Link href="/notes" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
            Go to Notes &amp; Journal <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Activation assignments + goals */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-3">
            <IconBadge icon={Target} className="bg-sunrise/15 text-sunrise-dark" />
            <h3 className="font-display text-lg text-burgundy">Activation Assignments</h3>
          </div>
          {assignments && assignments.length > 0 ? (
            <ul className="space-y-2">
              {assignments.map((a) => (
                <li key={a.id} className="font-body text-sm text-charcoal/80">
                  {a.title}
                  {a.due_at && <span className="ml-2 font-ui text-xs text-charcoal/50">due {new Date(a.due_at).toLocaleDateString()}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-charcoal/70">No activation assignments right now.</p>
          )}
          <Link href="/assignments" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
            View all assignments <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="card p-6">
          <div className="mb-3 flex items-center gap-3">
            <IconBadge icon={Target} className="bg-burgundy/10 text-burgundy" />
            <h3 className="font-display text-lg text-burgundy">Goals</h3>
          </div>
          {goals && goals.length > 0 ? (
            <ul className="space-y-2">
              {goals.map((g) => (
                <li key={g.id} className="font-body text-sm text-charcoal/80">
                  {g.title} <Pill tone={g.status === "completed" ? "success" : "neutral"}>{g.status}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-charcoal/70">Your mentor will build seasonal goals with you here.</p>
          )}
          <Link href="/plan" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
            View my plan <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {courses.length === 0 && (
        <EmptyState icon={BookOpen} title="Your journey is just beginning" body="Once you enroll in a pathway, your progress will show up here." />
      )}
    </div>
  );
}
