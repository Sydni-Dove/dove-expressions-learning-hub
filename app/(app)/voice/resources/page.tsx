import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { getStudentPrograms } from "@/lib/student-programs";
import GoalProgressForm from "@/components/voice/GoalProgressForm";
import { ProgressBar, Pill } from "@/components/ui";
import { ArrowUpRight, BookOpen, ClipboardList, Target, PlayCircle } from "lucide-react";
import { groupBySkill, isWeeklyPlan, linkHost, ratingTrend, safeLink, type Exercise, type Goal, type GoalUpdate, type PlanItem, type Skill } from "@/lib/voice-resources";

export const dynamic = "force-dynamic";

export default async function VoiceResourcesPage() {
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  const isStaff = roles.some(r => ["faculty", "teacher", "super_admin"].includes(r));
  const isStudent = (await getStudentPrograms(user.id)).includes("voice");
  if (!isStaff && !isStudent) redirect("/dashboard");
  const supabase = createClient();

  const [content, skillsRes, exRes, plansRes, goalsRes] = await Promise.all([
    supabase.from("dp_voice_resource_content").select("key,title,body"),
    supabase.from("dp_voice_skills").select("id,slug,name,sort_order").eq("is_active", true),
    supabase.from("dp_voice_exercises").select("id,skill_id,title,instructions,video_url,source_name,minutes,is_active").eq("is_active", true),
    isStudent ? supabase.from("dp_assignments").select("id,title,description,goal,due_at,practice_items,practice_steps").eq("assigned_to_user_id", user.id).not("practice_items", "is", null).order("due_at", { ascending: false, nullsFirst: false }) : Promise.resolve({ data: [], error: null }),
    isStudent ? supabase.from("dp_voice_goals").select("id,skill_id,title,detail,target_date,status,achieved_at").eq("student_id", user.id).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null })
  ]);
  const goals = (goalsRes.data ?? []) as Goal[];
  const goalIds = goals.map(g => g.id);
  const [updatesRes, subsRes, draftsRes] = await Promise.all([
    goalIds.length ? supabase.from("dp_voice_goal_updates").select("id,goal_id,author_id,note,rating,created_at").in("goal_id", goalIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    isStudent ? supabase.from("dp_submissions").select("assignment_id,status").eq("student_id", user.id) : Promise.resolve({ data: [], error: null }),
    isStudent ? supabase.from("dp_assignment_progress").select("assignment_id,checked_steps").eq("student_id", user.id) : Promise.resolve({ data: [], error: null })
  ]);
  const loadError = [content.error, skillsRes.error, exRes.error, plansRes.error, goalsRes.error, updatesRes.error].some(Boolean);
  const text = (key: string) => content.data?.find(c => c.key === key);
  const welcome = text("welcome"), guide = text("practice_guide");
  const groups = groupBySkill((skillsRes.data ?? []) as Skill[], (exRes.data ?? []) as Exercise[]);
  const plans = (plansRes.data ?? []).filter(isWeeklyPlan);
  const updates = (updatesRes.data ?? []) as GoalUpdate[];
  const status = (id: string) => subsRes.data?.find(s => s.assignment_id === id)?.status;
  const openPlans = plans.filter(p => !["approved", "exempt"].includes(status(p.id) ?? ""));
  const pastPlans = plans.filter(p => ["approved", "exempt"].includes(status(p.id) ?? ""));

  return <div className="space-y-8 pb-20">
    <header className="rounded-[28px] bg-[#630000] p-6 text-[#FDFDFD] sm:p-9">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2DFD8]">Dove Expressions · Voice Studio</p>
      <h1 className="mt-3 font-display text-3xl text-white sm:text-4xl">Your practice resources</h1>
      <p className="mt-2 max-w-xl font-body text-white/80">Your weekly plan, the exercises your instructor chose, your goals, and your homework, in one place.</p>
      <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2 font-ui text-sm">{[["#welcome", "Welcome"], ["#plan", "This week"], ["#library", "Exercise library"], ["#goals", "Goals and progress"], ["#homework", "Homework"]].map(([h, l]) =>
        <a key={h} href={h} className="rounded-full border border-white/30 px-4 py-2 text-white hover:bg-white/10">{l}</a>)}</nav>
    </header>
    {loadError && <p role="alert" className="rounded-2xl border border-[#630000]/30 bg-[#F2DFD8]/50 p-4 font-body text-sm">Some resources could not be loaded. Reload the page, or message your instructor if this continues.</p>}
    {!isStudent && <p role="note" className="rounded-2xl border border-[#E6A742]/50 bg-[#E6A742]/10 p-4 font-body text-sm">Staff preview. Manage this area in <Link className="underline" href="/staff/voice/library">Library and guides</Link> and <Link className="underline" href="/staff/voice/plans">Plans and goals</Link>.</p>}

    <section id="welcome" aria-labelledby="welcome-h" className="grid gap-5 lg:grid-cols-2">
      <article className="rounded-3xl border border-[#630000]/10 bg-white p-6"><h2 id="welcome-h" className="font-display text-2xl text-[#630000]">{welcome?.title ?? "Welcome"}</h2><p className="mt-3 whitespace-pre-wrap font-body text-sm leading-relaxed">{welcome?.body ?? "Your instructor will add a welcome note here."}</p></article>
      <article className="rounded-3xl bg-[#F2DFD8]/50 p-6"><h2 className="font-display text-2xl text-[#630000]">{guide?.title ?? "How to practice"}</h2><p className="mt-3 whitespace-pre-wrap font-body text-sm leading-relaxed">{guide?.body ?? ""}</p></article>
    </section>

    <section id="plan" aria-labelledby="plan-h" className="space-y-4"><div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-[#630000]" /><h2 id="plan-h" className="font-display text-2xl text-[#630000]">This week’s practice plan</h2></div>
      {openPlans.length ? openPlans.map(plan => { const items = plan.practice_items as PlanItem[]; const done = (draftsRes.data?.find(d => d.assignment_id === plan.id)?.checked_steps ?? []).length;
        return <article key={plan.id} className="rounded-3xl border border-[#630000]/10 bg-white p-6">
          <div className="flex flex-wrap items-center gap-2"><Pill tone="burgundy">{status(plan.id) === "returned" ? "Needs revision" : status(plan.id) ? "Awaiting review" : "Assigned"}</Pill>{plan.due_at && <span className="font-ui text-xs text-[#1B1717]/60">Due {new Date(plan.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>}</div>
          <h3 className="mt-2 font-display text-xl text-[#630000]">{plan.title}</h3>
          {plan.description && <p className="mt-1 whitespace-pre-wrap font-body text-sm">{plan.description}</p>}
          {plan.goal && <p className="mt-1 font-body text-sm"><span className="font-semibold">Goal:</span> {plan.goal}</p>}
          <div className="mt-4"><ProgressBar percent={Math.round((Math.min(done, items.length) / items.length) * 100)} label={`${Math.min(done, items.length)} of ${items.length} exercises done`} tone="gold" /></div>
          <ol className="mt-4 space-y-3">{items.map((it, i) => { const href = safeLink(it.video_url); return <li key={i} className="rounded-2xl bg-[#F2DFD8]/30 p-4"><p className="font-ui text-sm font-bold text-[#630000]">{i + 1}. {it.title}{it.minutes ? ` · ${it.minutes} min` : ""}</p>{it.note && <p className="mt-1 font-body text-sm italic">{it.note}</p>}{it.instructions && <p className="mt-1 whitespace-pre-wrap font-body text-sm">{it.instructions}</p>}
            {href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-ui text-sm font-bold text-[#630000] underline"><PlayCircle className="h-4 w-4" />Watch demonstration ({linkHost(href)})</a>}</li>; })}</ol>
          <Link href={`/assignments#assignment-${plan.id}`} className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#630000] px-5 py-3 font-ui text-sm font-bold text-white">Check off, record and submit <ArrowUpRight className="h-4 w-4" /></Link>
        </article>; })
        : <p className="rounded-2xl bg-[#F2DFD8]/40 p-5 font-body text-sm">{isStudent ? "No practice plan is open right now. Your instructor will assign your next plan after your lesson." : "Students see their assigned weekly plan here."}</p>}
      {pastPlans.length > 0 && <details className="rounded-2xl border border-[#630000]/10 bg-white p-4"><summary className="cursor-pointer font-ui text-sm font-semibold">Completed plans ({pastPlans.length})</summary><ul className="mt-2 space-y-1 font-body text-sm">{pastPlans.map(p => <li key={p.id}><Link className="underline" href={`/assignments#assignment-${p.id}`}>{p.title}</Link></li>)}</ul></details>}
    </section>

    <section id="library" aria-labelledby="library-h" className="space-y-4"><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-[#630000]" /><h2 id="library-h" className="font-display text-2xl text-[#630000]">Exercise library</h2></div>
      <p className="font-body text-sm text-[#1B1717]/70">Exercises your instructor has chosen. Videos open on the website that hosts them.</p>
      {groups.length ? groups.map(g => <div key={g.skill.id} className="rounded-3xl border border-[#630000]/10 bg-white p-5"><h3 className="font-display text-xl text-[#630000]">{g.skill.name}</h3>
        <ul className="mt-3 divide-y divide-[#630000]/10">{g.exercises.map(ex => { const href = safeLink(ex.video_url); return <li key={ex.id} className="py-3"><p className="font-ui text-sm font-bold">{ex.title}{ex.minutes ? <span className="font-normal text-[#1B1717]/60"> · {ex.minutes} min</span> : null}</p>{ex.instructions && <p className="mt-1 whitespace-pre-wrap font-body text-sm">{ex.instructions}</p>}
          {href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-ui text-sm font-bold text-[#630000] underline"><PlayCircle className="h-4 w-4" />Watch ({ex.source_name || linkHost(href)})</a>}</li>; })}</ul></div>)
        : <p className="rounded-2xl bg-[#F2DFD8]/40 p-5 font-body text-sm">Your instructor is still adding exercises. Check back soon.</p>}
    </section>

    <section id="goals" aria-labelledby="goals-h" className="space-y-4"><div className="flex items-center gap-2"><Target className="h-5 w-5 text-[#630000]" /><h2 id="goals-h" className="font-display text-2xl text-[#630000]">Your goals and progress</h2></div>
      {goals.length ? goals.map(goal => { const ups = updates.filter(u => u.goal_id === goal.id); const trend = ratingTrend(ups); return <article key={goal.id} className="rounded-3xl border border-[#630000]/10 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2"><Pill tone={goal.status === "achieved" ? "success" : "burgundy"}>{goal.status === "achieved" ? "Achieved" : goal.status === "paused" ? "Paused" : "In progress"}</Pill>{goal.target_date && <span className="font-ui text-xs text-[#1B1717]/60">Target {new Date(goal.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>}</div>
        <h3 className="mt-2 font-display text-xl text-[#630000]">{goal.title}</h3>{goal.detail && <p className="mt-1 font-body text-sm">{goal.detail}</p>}
        {trend.count > 0 && <p className="mt-2 font-ui text-sm">Latest self-rating: <strong>{trend.latest}/5</strong>{trend.change != null && trend.change !== 0 ? ` (${trend.change > 0 ? "+" : ""}${trend.change} since your first rating)` : ""}</p>}
        {ups.length > 0 && <ul className="mt-3 space-y-2">{ups.slice(0, 4).map(u => <li key={u.id} className={`rounded-xl p-3 font-body text-sm ${u.author_id === user.id ? "bg-[#F2DFD8]/40" : "bg-[#E6A742]/10"}`}><span className="font-ui text-xs font-bold">{u.author_id === user.id ? "You" : "Instructor"} · {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}{u.rating ? ` · ${u.rating}/5` : ""}</span>{u.note && <span className="mt-1 block whitespace-pre-wrap">{u.note}</span>}</li>)}</ul>}
        {isStudent && goal.status !== "achieved" && <GoalProgressForm goalId={goal.id} authorId={user.id} />}
      </article>; }) : <p className="rounded-2xl bg-[#F2DFD8]/40 p-5 font-body text-sm">{isStudent ? "Your instructor will set your vocal goals with you. They will appear here, and you can log your progress." : "Students see their personal goals here."}</p>}
    </section>

    <section id="homework" aria-labelledby="homework-h" className="rounded-3xl bg-[#1B1717] p-6 text-white"><h2 id="homework-h" className="font-display text-2xl text-white">Homework and feedback</h2>
      <p className="mt-2 font-body text-sm text-white/75">Record or upload your singing, submit it privately, and read your instructor’s feedback.</p>
      <Link href="/assignments" className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#FDFDFD] px-5 py-3 font-ui text-sm font-bold text-[#630000]">Open my assignments <ArrowUpRight className="h-4 w-4" /></Link></section>
  </div>;
}
