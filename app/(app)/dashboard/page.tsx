import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { ProgressBar, ProgressRing, Pill, IconBadge } from "@/components/ui";
import { mockConversations, mockCommunityPosts } from "@/lib/mock-data";
import { getPathwayProgress } from "@/lib/pathway-progress";
import { PATHWAY_ICONS, PATHWAY_STYLES, formationStage } from "@/lib/pathways";
import type { PathwayCode } from "@/lib/types";
import { Wind, Target, Radio, NotebookPen, MessageCircle, Users2, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const supabase = createClient();
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  const displayName = (user?.user_metadata as { full_name?: string })?.full_name?.split(" ")[0] || "Friend";

  const [{ data: course }, { data: plan }, { data: wiringResult }, { data: liveSessions }, { data: notes }] =
    await Promise.all([
      supabase.from("dp_courses").select("id,title,slug").eq("slug", "foundations-drawing-near").maybeSingle(),
      supabase
        .from("dp_discipleship_plans")
        .select("id,current_season,status")
        .eq("student_id", user!.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("dp_wiring_results")
        .select("id,generated_at,result_status")
        .eq("student_id", user!.id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("dp_live_sessions").select("id,title,starts_at").gte("starts_at", new Date().toISOString()).order("starts_at").limit(1),
      supabase.from("dp_notes").select("id,title,updated_at,save_status").eq("author_id", user!.id).order("updated_at", { ascending: false }).limit(3)
    ]);

  const { pathways, stats } = await getPathwayProgress(supabase, user!.id);

  let lessons: { id: string; title: string; slug: string | null; module_id: string }[] = [];
  let completedCount = 0;
  if (course) {
    const { data: modules } = await supabase.from("dp_modules").select("id").eq("course_id", course.id);
    const moduleIds = (modules ?? []).map((m) => m.id);
    if (moduleIds.length) {
      const { data: lessonRows } = await supabase
        .from("dp_lessons")
        .select("id,title,slug,module_id,order_index")
        .in("module_id", moduleIds)
        .eq("status", "published")
        .order("order_index");
      lessons = lessonRows ?? [];
    }
    const { data: progressRows } = await supabase
      .from("dp_lesson_progress")
      .select("lesson_id,status")
      .eq("user_id", user!.id)
      .eq("status", "completed");
    completedCount = (progressRows ?? []).filter((p) => lessons.some((l) => l.id === p.lesson_id)).length;
  }

  const nextLesson = lessons[completedCount] ?? lessons[0];
  const percent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;
  const upcomingSession = liveSessions?.[0];

  return (
    <div className="space-y-8 pb-16">
      {/* Welcome banner */}
      <div className="rounded-card-lg bg-burgundy-gradient p-6 text-soft shadow-card sm:p-8">
        <h1 className="font-display text-3xl text-soft">Welcome back, {displayName}.</h1>
        <p className="mt-2 max-w-xl font-body italic text-soft/85">
          "Being confident of this, that he who began a good work in you will carry it on to completion." —
          Philippians 1:6
        </p>
      </div>

      {/* Four Pathways snapshot — brief on purpose; full detail lives on /discipleship */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">Your Pathways</p>
          <Link href="/discipleship" className="font-ui text-xs font-semibold text-burgundy underline">
            View Discipleship home →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {pathways.map((p) => {
            const s = stats[p.code];
            const percent = s && s.totalLessons ? Math.round((s.completedLessons / s.totalLessons) * 100) : 0;
            const style = PATHWAY_STYLES[p.code as PathwayCode];
            const Icon = PATHWAY_ICONS[p.code as PathwayCode];
            return (
              <Link key={p.id} href={`/discipleship/${p.code}`} className={`card card-hover ${style.band} p-4`}>
                <div className="flex items-center gap-3">
                  <IconBadge icon={Icon} className={`h-9 w-9 ${style.badge}`} />
                  <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">{p.name}</p>
                </div>
                <p className="mt-2 font-body text-sm text-charcoal">{formationStage(percent)}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Priority: the next action */}
      <div className="card card-band-burgundy overflow-hidden">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          {course && (
            <div className="shrink-0">
              <ProgressRing percent={percent} label="Course progress" />
            </div>
          )}
          <div className="flex-1">
            <p className="font-ui text-xs font-semibold uppercase tracking-wide text-sunrise-dark">Continue your journey</p>
            {course ? (
              <>
                <h2 className="mt-2 font-display text-2xl text-burgundy">{course.title}</h2>
                {nextLesson ? (
                  <>
                    <p className="mt-3 font-body text-charcoal/80">
                      Next lesson: <strong>{nextLesson.title}</strong>
                    </p>
                    <Link href={`/courses/${course.id}/lessons/${nextLesson.id}`} className="btn-primary mt-4">
                      Continue Learning
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </>
                ) : (
                  <p className="mt-4 font-body text-charcoal/70">You've completed every published lesson in this course. 🎉</p>
                )}
              </>
            ) : (
              <>
                <h2 className="mt-2 font-display text-2xl text-burgundy">Let's get you started</h2>
                <p className="mt-2 font-body text-charcoal/80">
                  Complete your intake and take the Spiritual Wiring Assessment so your mentor can help build your
                  discipleship plan.
                </p>
                <Link href="/wiring" className="btn-primary mt-4">
                  Start with Spiritual Wiring
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card card-hover p-6">
          <div className="flex items-start gap-3">
            <IconBadge icon={Wind} className="bg-pale-pink text-burgundy" />
            <div className="flex-1">
              <h3 className="font-display text-lg text-burgundy">Spiritual Wiring</h3>
              {wiringResult ? (
                <>
                  <p className="mt-1 font-body text-sm text-charcoal/70">
                    Your results are ready to reflect on and discuss with your mentor.
                  </p>
                  <Link href="/wiring/results" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
                    View my results <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-1 font-body text-sm text-charcoal/70">
                    Not started yet. This discernment tool helps you and your mentor talk through your gifts, burdens,
                    and reception style.
                  </p>
                  <Link href="/wiring/assessment" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
                    Take the assessment <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card card-hover p-6">
          <div className="flex items-start gap-3">
            <IconBadge icon={Target} className="bg-gold/15 text-gold-dark" />
            <div className="flex-1">
              <h3 className="font-display text-lg text-burgundy">My Discipleship Plan</h3>
              {plan ? (
                <>
                  <p className="mt-1 font-body text-sm text-charcoal/70">
                    Current season: <strong>{plan.current_season || "Being defined with your mentor"}</strong>
                  </p>
                  <Link href="/plan" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
                    View my plan <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <p className="mt-1 font-body text-sm text-charcoal/70">
                  Your mentor will build this with you after your discovery session and Spiritual Wiring review.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="card card-hover p-6">
          <div className="flex items-start gap-3">
            <IconBadge icon={Radio} className="bg-coral/15 text-coral-dark" />
            <div className="flex-1">
              <h3 className="font-display text-lg text-burgundy">Upcoming Live Session</h3>
              {upcomingSession ? (
                <>
                  <p className="mt-1 font-body text-sm text-charcoal/70">{upcomingSession.title}</p>
                  <p className="font-ui text-xs text-charcoal/50">
                    {new Date(upcomingSession.starts_at as string).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                  <Link href="/live" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
                    View details <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <p className="mt-1 font-body text-sm text-charcoal/70">Nothing scheduled yet — check back soon.</p>
              )}
            </div>
          </div>
        </div>

        <div className="card card-hover p-6">
          <div className="flex items-start gap-3">
            <IconBadge icon={NotebookPen} className="bg-sunrise/15 text-sunrise-dark" />
            <div className="flex-1">
              <h3 className="font-display text-lg text-burgundy">Recent Notes</h3>
              {notes && notes.length > 0 ? (
                <ul className="mt-1 space-y-1.5">
                  {notes.map((n) => (
                    <li key={n.id} className="font-body text-sm text-charcoal/80">
                      {n.title || "Untitled note"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 font-body text-sm text-charcoal/70">No notes yet.</p>
              )}
              <Link href="/notes" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
                Go to Notes &amp; Journal <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconBadge icon={MessageCircle} className="bg-pale-pink text-burgundy" />
              <h3 className="font-display text-lg text-burgundy">Messages</h3>
            </div>
            <Pill tone="neutral">Preview</Pill>
          </div>
          <ul className="space-y-3">
            {mockConversations.slice(0, 2).map((c) => (
              <li key={c.id} className="font-body text-sm">
                <span className="font-semibold text-charcoal">{c.name}</span>
                <p className="truncate text-charcoal/60">{c.lastMessage}</p>
              </li>
            ))}
          </ul>
          <Link href="/messages" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
            Open Messages <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconBadge icon={Users2} className="bg-gold/15 text-gold-dark" />
              <h3 className="font-display text-lg text-burgundy">Community</h3>
            </div>
            <Pill tone="neutral">Preview</Pill>
          </div>
          <p className="font-body text-sm text-charcoal/70">
            "{mockCommunityPosts[0].body.slice(0, 90)}…" — {mockCommunityPosts[0].author}
          </p>
          <Link href="/community" className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-semibold text-burgundy">
            Visit Community <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
