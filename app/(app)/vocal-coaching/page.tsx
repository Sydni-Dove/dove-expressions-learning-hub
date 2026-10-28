import Link from "next/link";
import VoiceReviewForm from "@/components/VoiceReviewForm";
import { getStudentPrograms } from "@/lib/student-programs";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { BookOpen, CalendarDays, ClipboardList, MessageSquare, Music2, Video, ArrowUpRight, Sparkles, Headphones, CheckCircle2 } from "lucide-react";

export default async function VocalCoachingPage() {
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  const programs = await getStudentPrograms(user.id);
  const isStaff = roles.some(r => ["faculty", "teacher", "super_admin"].includes(r));
  if (!isStaff && !programs.includes("voice")) redirect("/dashboard");
  const supabase = createClient();

  // RLS determines which student sessions and course enrollments are readable.
  const [{ data: sessions }, { data: enrollments }] = await Promise.all([
    supabase.from("dp_sessions")
      .select("id,scheduled_at,session_type,student_visible_notes,follow_up_date")
      .eq("student_id", user.id)
      .order("scheduled_at", { ascending: false })
      .limit(12),
    supabase.from("dp_enrollments")
      .select("scope_id,status")
      .eq("user_id", user.id)
      .eq("scope_type", "course")
      .eq("status", "active")
  ]);
  const courseIds = (enrollments ?? []).map((e) => e.scope_id);
  const { data: courses } = courseIds.length
    ? await supabase.from("dp_courses").select("id,title,description").in("id", courseIds)
    : { data: [] as { id: string; title: string; description: string | null }[] };

  const firstName = ((user.user_metadata as {full_name?:string})?.full_name || "Student").split(" ")[0];
  const visibleNotes = (sessions ?? []).filter(s => s.student_visible_notes);
  const nextSession = (sessions ?? []).filter(s => s.scheduled_at && new Date(s.scheduled_at) >= new Date()).sort((a,b) => new Date(a.scheduled_at!).getTime()-new Date(b.scheduled_at!).getTime())[0];
  const cards = [
    { href: "/voice/training", title: "12-session vocal program", detail: "Explore technique, song coaching, practice activities, and progress checkpoints.", icon: BookOpen },
    { href: "/assignments", title: "Practice & assignments", detail: "Submit your assigned exercises, songs, and recording links.", icon: ClipboardList },
    { href: "/live", title: "Sessions & workshops", detail: "See instructor-led sessions and learning events.", icon: CalendarDays },
    { href: "/library", title: "Training resources", detail: "Browse available learning materials and vocal resources.", icon: BookOpen },
    { href: "/messages", title: "Contact your instructor", detail: "Ask questions and follow up on your coaching.", icon: MessageSquare }
  ];

  return (
    <div className="space-y-9 pb-20">
      <header className="relative isolate overflow-hidden rounded-[30px] bg-[#630000] p-6 text-[#FDFDFD] shadow-xl sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border-[44px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[-110px] right-[12%] h-64 w-64 rounded-full bg-[#D96248]/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2DFD8]">Dove Expressions · Voice Studio</p>
            <h1 className="mt-6 font-display text-4xl leading-tight text-white sm:text-5xl">Find your voice.<br/><span className="italic text-[#F2DFD8]">Develop your gift.</span></h1>
            <p className="mt-4 max-w-md font-body text-base leading-relaxed text-white/80">Welcome, {firstName}. Your personal space for vocal growth, intentional practice, and confident expression.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/courses" className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#FDFDFD] px-5 py-3 font-ui text-sm font-bold text-[#630000] hover:bg-[#F2DFD8]">My learning <ArrowUpRight className="h-4 w-4"/></Link>
              <Link href="/assignments" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/30 px-5 py-3 font-ui text-sm font-semibold text-white hover:bg-white/10">Practice assignments</Link>
            </div>
          </div>

        </div>
      </header>

      <section aria-label="Voice studio overview" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#630000]/10 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-[#630000]"><BookOpen className="h-5 w-5"/><span className="font-ui text-xs font-semibold uppercase tracking-wider">Learning</span></div><p className="mt-3 font-display text-3xl text-[#630000]">{(courses ?? []).length}</p><p className="font-body text-sm text-charcoal/60">Active courses</p></div>
        <div className="rounded-2xl border border-[#630000]/10 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-[#630000]"><CheckCircle2 className="h-5 w-5"/><span className="font-ui text-xs font-semibold uppercase tracking-wider">Coaching</span></div><p className="mt-3 font-display text-3xl text-[#630000]">{visibleNotes.length}</p><p className="font-body text-sm text-charcoal/60">Session summaries</p></div>
        <div className="rounded-2xl border border-[#630000]/10 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-[#630000]"><CalendarDays className="h-5 w-5"/><span className="font-ui text-xs font-semibold uppercase tracking-wider">Next step</span></div><p className="mt-3 font-display text-xl text-[#630000]">{nextSession?.scheduled_at ? new Date(nextSession.scheduled_at).toLocaleDateString(undefined,{month:"short",day:"numeric"}) : "Not scheduled"}</p><p className="font-body text-sm text-charcoal/60">Upcoming session</p></div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="font-ui text-xs font-semibold uppercase tracking-[0.18em] text-[#D96248]">Explore your studio</p><h2 className="mt-1 font-display text-2xl text-[#630000] sm:text-3xl">Everything you need to grow</h2></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ href,title,detail,icon:Icon },i)=>(
            <Link href={href} key={href} className="group rounded-3xl border border-[#630000]/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-start justify-between"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${i%2 ? "bg-[#F2DFD8] text-[#630000]" : "bg-[#630000] text-white"}`}><Icon className="h-6 w-6"/></span><ArrowUpRight className="h-5 w-5 text-[#630000]/40 transition group-hover:text-[#630000]"/></div>
              <h3 className="mt-5 font-display text-xl text-[#630000]">{title}</h3><p className="mt-2 font-body text-sm leading-relaxed text-charcoal/65">{detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-[#1B1717] p-6 text-white sm:p-8">
        <div className="mb-5 flex items-center gap-3"><span className="rounded-2xl bg-white/10 p-3"><Headphones className="h-6 w-6 text-[#E6A742]"/></span><div><p className="font-ui text-[11px] uppercase tracking-[0.17em] text-[#E6A742]">Your curriculum</p><h2 className="font-display text-2xl text-white">My learning journey</h2></div></div>
        {(courses ?? []).length ? <div className="grid gap-3 sm:grid-cols-2">{(courses ?? []).map(course=>(
          <Link key={course.id} href={`/courses/${course.id}`} className="rounded-2xl border border-white/15 bg-white/10 p-5 transition hover:bg-white/15"><h3 className="font-display text-lg text-white">{course.title}</h3>{course.description&&<p className="mt-2 font-body text-sm text-white/65">{course.description}</p>}<span className="mt-4 inline-flex items-center gap-1 font-ui text-sm font-semibold text-[#E6A742]">Open course <ArrowUpRight className="h-4 w-4"/></span></Link>
        ))}</div>:<div className="rounded-2xl border border-dashed border-white/25 p-5"><p className="font-body text-sm text-white/75">Your instructor will add your courses here once enrollment is ready. Your learning space is prepared for you.</p></div>}
      </section>

      <section className="grid gap-5 lg:grid-cols-5">
        <div className="rounded-3xl border border-[#630000]/10 bg-white p-6 lg:col-span-3"><div className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-[#630000]"/><h2 className="font-display text-2xl text-[#630000]">From your coach</h2></div><p className="mt-2 font-body text-sm text-charcoal/60">Feedback and takeaways shared after your sessions.</p>
        {visibleNotes.length?<div className="mt-5 space-y-3">{visibleNotes.slice(0,3).map(s=><article key={s.id} className="rounded-xl bg-[#F2DFD8]/35 p-4"><p className="font-ui text-xs font-bold uppercase text-[#630000]">{s.session_type.replace(/_/g," ")} {s.scheduled_at&&" · "+new Date(s.scheduled_at).toLocaleDateString()}</p><p className="mt-2 whitespace-pre-wrap font-body text-sm text-charcoal/75">{s.student_visible_notes}</p></article>)}</div>:<p className="mt-5 rounded-xl bg-[#F2DFD8]/30 p-5 font-body text-sm text-charcoal/70">When your coach shares your first session summary, it will appear here.</p>}</div>
        <div className="rounded-3xl border border-[#630000]/10 bg-[#F2DFD8]/40 p-6 lg:col-span-2"><Sparkles className="h-7 w-7 text-[#630000]"/><h2 className="mt-4 font-display text-2xl text-[#630000]">Your next breakthrough</h2><p className="mt-3 font-body text-sm leading-relaxed text-charcoal/75">Growth happens through consistent practice. Revisit your assignments, apply your feedback, and bring your questions to your next session.</p><Link href="/assignments" className="mt-6 inline-flex items-center gap-2 font-ui text-sm font-bold text-[#630000] underline">Go to my practice <ArrowUpRight className="h-4 w-4"/></Link></div>
      </section>

      <section className="rounded-3xl border border-[#630000]/10 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-[#F2DFD8] p-3"><Video className="h-6 w-6 text-[#630000]"/></span><div><p className="font-ui text-[11px] font-semibold uppercase tracking-widest text-[#D96248]">Share your story</p><h2 className="font-display text-2xl text-[#630000]">Your voice. Your experience.</h2></div></div>
        <p className="mt-4 font-body text-sm text-charcoal/70">Leave a written review or share a video link about your coaching journey. Reviews are private until reviewed. Public use requires separate permission.</p>
        <VoiceReviewForm studentId={user.id}/>
      </section>
    </div>
  );
}
