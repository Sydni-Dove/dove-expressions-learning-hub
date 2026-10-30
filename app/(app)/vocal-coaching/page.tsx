import Link from "next/link";
import VoiceReviewForm from "@/components/VoiceReviewForm";
import RecordingPlayer from "@/components/RecordingPlayer";
import MyTestimonials, { type MyTestimonial } from "@/components/voice/MyTestimonials";
import LocalTime from "@/components/LocalTime";
import { ProgressBar, Pill } from "@/components/ui";
import { getStudentPrograms } from "@/lib/student-programs";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { signMediaList } from "@/lib/storage";
import { recordingLabel } from "@/lib/recordings";
import { summarizeAssignments, creditsSummary, LESSON_STATUS_LABEL, type AssignmentRow, type CoachingOverview, type DraftRow, type SubmissionRow } from "@/lib/voice-dashboard";
import { BookOpen, CalendarDays, ClipboardList, MessageSquare, ArrowUpRight, Sparkles, Headphones, CheckCircle2, Clock, History } from "lucide-react";

type SessionSummary = { id: string; scheduled_at: string | null; session_type: string; student_visible_notes: string | null };

export default async function VocalCoachingPage() {
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  const programs = await getStudentPrograms(user.id);
  const isStaff = roles.some(r => ["faculty", "teacher", "super_admin"].includes(r));
  const isStudent = programs.includes("voice");
  if (!isStaff && !isStudent) redirect("/dashboard");
  const supabase = createClient();

  // Every query below is answered by existing tables/RPCs under the student's own RLS.
  const [{ data: sessions }, { data: courses }, overviewRes] = await Promise.all([
    supabase.rpc("dp_my_session_summaries", { target_program_slug: "vocal-coaching" }),
    supabase.from("dp_courses").select("id,title,description,dp_programs!inner(slug)").eq("dp_programs.slug", "vocal-coaching").order("order_index"),
    isStudent ? supabase.rpc("dp_my_coaching_overview", { target_program_slug: "vocal-coaching" }) : Promise.resolve({ data: null })
  ]);
  const overview = (overviewRes.data ?? null) as CoachingOverview | null;

  let assignments: AssignmentRow[] = [], submissions: (SubmissionRow & { id: string })[] = [], drafts: DraftRow[] = [];
  let attempts: { id: string; assignment_id: string; attempt_no: number; file_urls: string[]; submitted_at: string }[] = [];
  let feedback: { id: string; submission_id: string; content: string | null; created_at: string }[] = [];
  let loadError = false;
  if (isStudent) {
    const [a, s, d, t] = await Promise.all([
      supabase.from("dp_assignments").select("id,title,due_at,song,goal,practice_steps,lesson_id,course_id").order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("dp_submissions").select("id,assignment_id,status").eq("student_id", user.id),
      supabase.from("dp_assignment_progress").select("assignment_id,checked_steps,minutes").eq("student_id", user.id),
      supabase.from("dp_submission_attempts").select("id,assignment_id,attempt_no,file_urls,submitted_at").eq("student_id", user.id).order("submitted_at", { ascending: false })
    ]);
    loadError = !!(a.error || s.error || d.error || t.error);
    assignments = (a.data ?? []) as AssignmentRow[]; submissions = s.data ?? []; drafts = d.data ?? []; attempts = t.data ?? [];
    const ids = submissions.map(x => x.id);
    if (ids.length) {
      const f = await supabase.from("dp_feedback").select("id,submission_id,content,created_at").in("submission_id", ids).eq("is_private", false).order("created_at", { ascending: false }).limit(5);
      feedback = f.data ?? [];
    }
  }

  const mine = isStudent ? ((await supabase.from("dp_voice_testimonials").select("id,review_text,video_path,allow_public_use,status,published_at,consent_withdrawn_at,created_at").eq("student_id", user.id).order("created_at", { ascending: false })).data ?? []) as MyTestimonial[] : [];
  const summary = summarizeAssignments(assignments, submissions, drafts);
  const credits = creditsSummary(overview);
  const recordingAttempts = attempts.filter(t => (t.file_urls ?? []).length).slice(0, 3);
  const signed = await signMediaList(supabase, [...new Set(recordingAttempts.flatMap(t => t.file_urls))]);
  const titleFor = (assignmentId: string) => assignments.find(a => a.id === assignmentId)?.title ?? "Assignment";
  const submissionAssignment = (sid: string) => submissions.find(s => s.id === sid)?.assignment_id ?? "";
  const nextLesson = overview?.upcoming?.[0];
  const completedLessons = (overview?.history ?? []).filter(h => h.appointment_status === "completed").length;
  const nextSteps = summary.open.flatMap(r => (r.assignment.practice_steps ?? []).map((step, i) => ({ step, i, r })).filter(x => isUnchecked(x.i, drafts, x.r.assignment.id))).slice(0, 5);
  const firstName = ((user.user_metadata as { full_name?: string })?.full_name || "Student").split(" ")[0];
  const visibleNotes = ((sessions ?? []) as SessionSummary[]).filter(s => s.student_visible_notes);

  return (
    <div className="space-y-8 pb-20">
      <header className="relative isolate overflow-hidden rounded-[30px] bg-[#630000] p-6 text-[#FDFDFD] shadow-xl sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border-[44px] border-white/5" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-3">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2DFD8]">Dove Expressions · Voice Studio</p>
            <h1 className="mt-5 font-display text-4xl leading-tight text-white sm:text-5xl">Find your voice.<br /><span className="italic text-[#F2DFD8]">Develop your gift.</span></h1>
            <p className="mt-4 max-w-md font-body text-base leading-relaxed text-white/80">Welcome, {firstName}. Your personal space for vocal growth, intentional practice, and confident expression.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/assignments" className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#FDFDFD] px-5 py-3 font-ui text-sm font-bold text-[#630000] hover:bg-[#F2DFD8]">Open my practice <ArrowUpRight className="h-4 w-4" /></Link>
              <Link href="/voice/resources" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/30 px-5 py-3 font-ui text-sm font-semibold text-white hover:bg-white/10">Practice resources</Link>
            </div>
          </div>
          <section aria-labelledby="next-lesson" className="rounded-3xl bg-[#FDFDFD] p-6 text-[#1B1717] shadow-lg lg:col-span-2">
            <div className="flex items-center gap-2 text-[#630000]"><CalendarDays className="h-5 w-5" /><h2 id="next-lesson" className="font-ui text-xs font-bold uppercase tracking-wider">Next lesson</h2></div>
            {nextLesson ? <>
              <p className="mt-3 font-display text-2xl text-[#630000]"><LocalTime iso={nextLesson.scheduled_at} /></p>
              <p className="mt-1 font-body text-sm text-[#1B1717]/70">{nextLesson.lesson_minutes}-minute private lesson{overview?.plan ? ` · ${overview.plan.cadence === "weekly" ? "weekly" : "every other week"}` : ""}</p>
            </> : <p className="mt-3 font-body text-sm text-[#1B1717]/70">{isStudent ? "Your next lesson will appear here once your instructor schedules it." : "Staff preview: students see their next scheduled lesson here."}</p>}
            <Link href="/messages" className="mt-2 inline-flex min-h-[44px] items-center gap-1 font-ui text-sm font-bold text-[#630000] underline">Message your instructor <ArrowUpRight className="h-4 w-4" /></Link>
          </section>
        </div>
      </header>

      {!isStudent && <p role="note" className="rounded-2xl border border-[#E6A742]/50 bg-[#E6A742]/10 p-4 font-body text-sm">Staff preview. Student assignments, recordings and lesson credits appear here for enrolled Voice students. Manage the studio from the <Link href="/staff/voice" className="font-semibold underline">Voice command center</Link>.</p>}
      {loadError && <p role="alert" className="rounded-2xl border border-[#630000]/30 bg-[#F2DFD8]/50 p-4 font-body text-sm">Some of your dashboard could not be loaded. Reload the page before making changes.</p>}

      <section aria-label="Voice studio overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<CheckCircle2 className="h-5 w-5" />} label="Assignments complete" value={`${summary.complete}/${summary.total}`} />
        <Stat icon={<Clock className="h-5 w-5" />} label="Practice minutes logged" value={String(summary.practiceMinutes)} />
        <Stat icon={<History className="h-5 w-5" />} label="Lessons completed" value={String(completedLessons)} />
        <Stat icon={<BookOpen className="h-5 w-5" />} label="Lessons remaining" value={credits.hasPackages ? String(credits.total) : "—"}
          note={credits.hasPackages ? (credits.byMinutes.map(x => `${x.count} × ${x.minutes} min`).join(" · ") || "No lessons available") : "Appears when your coaching package is recorded"} />
      </section>
      {credits.hasPackages && (credits.low || credits.expiringSoon || credits.pendingPayment || credits.installments.length > 0) && <p role="note" className="rounded-2xl border border-[#E6A742]/50 bg-[#E6A742]/10 p-4 font-body text-sm">
        {credits.pendingPayment && "Your payment is still being confirmed. "}
        {credits.installments.map((n, i) => <span key={i}>Payment {n.paid} of {n.total} received: {n.unlocked} of {n.lessons} lessons unlocked. </span>)}
        {credits.low && !credits.pendingPayment && "You have one or no lessons left. "}
        {credits.expiringSoon && credits.soonestExpiry && <>A package expires {credits.soonestExpiry.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}. </>}
        <a href={`https://doveexpressions.org/book-${overview?.packages?.[0]?.lesson_minutes === 45 ? 45 : 60}/`} className="mt-1 flex min-h-[44px] items-center font-semibold underline">Renew or add lessons</a>
      </p>}

      <div className="grid gap-5 lg:grid-cols-5">
        <section aria-labelledby="assignments-h" className="rounded-3xl border border-[#630000]/10 bg-white p-6 lg:col-span-3">
          <div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-[#630000]" /><h2 id="assignments-h" className="font-display text-2xl text-[#630000]">Current assignments</h2></div>
          {summary.open.length ? <ul className="mt-4 space-y-3">{summary.open.slice(0, 5).map(({ assignment: a, state }) => (
            <li key={a.id}><Link href={`/assignments#assignment-${a.id}`} className="block rounded-2xl border border-[#630000]/10 p-4 transition hover:bg-[#F2DFD8]/30">
              <div className="flex flex-wrap items-center gap-2"><Pill tone={state.overdue || state.label === "Needs revision" ? "sunrise" : "burgundy"}>{state.label}</Pill>{a.due_at && <span className="font-ui text-xs text-[#1B1717]/60">Due {new Date(a.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}{state.overdue ? " · overdue" : ""}</span>}</div>
              <h3 className="mt-2 font-display text-lg text-[#630000]">{a.title}</h3>
              {(a.song || a.goal) && <p className="mt-1 font-body text-sm text-[#1B1717]/70">{[a.song && `Song: ${a.song}`, a.goal && `Goal: ${a.goal}`].filter(Boolean).join(" · ")}</p>}
              {state.stepsTotal > 0 && <div className="mt-3"><ProgressBar percent={Math.round((state.stepsDone / state.stepsTotal) * 100)} label={`${state.stepsDone} of ${state.stepsTotal} practice steps`} tone="gold" /></div>}
            </Link></li>))}</ul>
            : <p className="mt-4 rounded-2xl bg-[#F2DFD8]/40 p-5 font-body text-sm">{summary.total ? "You are caught up. Your instructor will add your next assignment after your lesson." : "Your instructor will add personalized work here when it is ready."}</p>}
          {summary.awaitingReview > 0 && <p className="mt-3 font-ui text-sm text-[#1B1717]/70">{summary.awaitingReview} submitted practice{summary.awaitingReview > 1 ? "s are" : " is"} awaiting your instructor’s review.</p>}
        </section>

        <section aria-labelledby="exercises-h" className="rounded-3xl bg-[#1B1717] p-6 text-white lg:col-span-2">
          <div className="flex items-center gap-2"><Headphones className="h-5 w-5 text-[#E6A742]" /><h2 id="exercises-h" className="font-display text-2xl text-white">Practice exercises</h2></div>
          {nextSteps.length ? <ul className="mt-4 space-y-3">{nextSteps.map(({ step, i, r }) => (
            <li key={`${r.assignment.id}-${i}`}><Link href={`/assignments#assignment-${r.assignment.id}`} className="block rounded-2xl border border-white/15 bg-white/5 p-4 hover:bg-white/10"><p className="font-body text-sm text-white">{step}</p><p className="mt-1 font-ui text-xs text-[#E6A742]">{r.assignment.title}</p></Link></li>))}</ul>
            : <p className="mt-4 font-body text-sm text-white/75">No practice steps are waiting. New exercises appear after your instructor assigns them.</p>}
          {courses && courses.length > 0 && <Link href={`/courses/${courses[0].id}`} className="mt-3 inline-flex min-h-[44px] items-center gap-1 font-ui text-sm font-bold text-[#E6A742]">Open lessons and demonstrations <ArrowUpRight className="h-4 w-4" /></Link>}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="progress-h" className="rounded-3xl border border-[#630000]/10 bg-white p-6">
          <h2 id="progress-h" className="font-display text-2xl text-[#630000]">Vocal progress</h2>
          <div className="mt-4"><ProgressBar percent={summary.percent} label="Reviewed and complete" tone="gold" /></div>
          <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-[#F2DFD8]/40 p-3"><dt className="font-ui text-[11px] uppercase tracking-wide text-[#1B1717]/60">Attempts</dt><dd className="font-display text-2xl text-[#630000]">{attempts.length}</dd></div>
            <div className="rounded-2xl bg-[#F2DFD8]/40 p-3"><dt className="font-ui text-[11px] uppercase tracking-wide text-[#1B1717]/60">Revisions</dt><dd className="font-display text-2xl text-[#630000]">{Math.max(0, attempts.length - new Set(attempts.map(t => t.assignment_id)).size)}</dd></div>
            <div className="rounded-2xl bg-[#F2DFD8]/40 p-3"><dt className="font-ui text-[11px] uppercase tracking-wide text-[#1B1717]/60">Recordings</dt><dd className="font-display text-2xl text-[#630000]">{attempts.filter(t => t.file_urls?.length).length}</dd></div>
          </dl>
          <Link href="/progress" className="mt-3 inline-flex min-h-[44px] items-center gap-1 font-ui text-sm font-bold text-[#630000] underline">See full progress <ArrowUpRight className="h-4 w-4" /></Link>
        </section>

        <section aria-labelledby="feedback-h" className="rounded-3xl border border-[#630000]/10 bg-white p-6">
          <div className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-[#630000]" /><h2 id="feedback-h" className="font-display text-2xl text-[#630000]">Instructor feedback</h2></div>
          {feedback.length || visibleNotes.length ? <div className="mt-4 space-y-3">
            {feedback.slice(0, 3).map(f => <article key={f.id} className="rounded-xl bg-[#F2DFD8]/40 p-4"><p className="font-ui text-xs font-bold uppercase text-[#630000]">{titleFor(submissionAssignment(f.submission_id))} · {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</p><p className="mt-2 whitespace-pre-wrap font-body text-sm">{f.content}</p></article>)}
            {visibleNotes.slice(0, 2).map(s => <article key={s.id} className="rounded-xl bg-[#E6A742]/10 p-4"><p className="font-ui text-xs font-bold uppercase text-[#630000]">Lesson summary{s.scheduled_at ? ` · ${new Date(s.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}</p><p className="mt-2 whitespace-pre-wrap font-body text-sm">{s.student_visible_notes}</p></article>)}
          </div> : <p className="mt-4 rounded-xl bg-[#F2DFD8]/30 p-5 font-body text-sm">When your instructor reviews your practice or shares a lesson summary, it will appear here.</p>}
        </section>
      </div>

      <section aria-labelledby="recordings-h" className="rounded-3xl border border-[#630000]/10 bg-white p-6">
        <h2 id="recordings-h" className="font-display text-2xl text-[#630000]">Your submitted recordings</h2>
        <p className="mt-1 font-body text-sm text-[#1B1717]/70">Private to you and your instructor. Compare attempts to hear your growth.</p>
        {recordingAttempts.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{recordingAttempts.map(t => <div key={t.id} className="space-y-2 rounded-2xl bg-[#F2DFD8]/30 p-4">
          <p className="font-ui text-xs font-bold text-[#630000]">{titleFor(t.assignment_id)} · attempt {t.attempt_no} · {new Date(t.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</p>
          {t.file_urls.map(u => <RecordingPlayer key={u} label={recordingLabel(u)} original={u} signedUrl={signed.find(x => x.original === u)?.signed ?? ""} />)}</div>)}</div>
          : <p className="mt-4 rounded-xl bg-[#F2DFD8]/30 p-5 font-body text-sm">Record or upload your singing from an assignment and it will be kept here, privately.</p>}
        <Link href="/assignments" className="mt-2 inline-flex min-h-[44px] items-center gap-1 font-ui text-sm font-bold text-[#630000] underline">All attempts and feedback <ArrowUpRight className="h-4 w-4" /></Link>
      </section>

      <section aria-labelledby="history-h" className="rounded-3xl border border-[#630000]/10 bg-white p-6">
        <h2 id="history-h" className="font-display text-2xl text-[#630000]">Lesson history</h2>
        {overview?.history?.length ? <ul className="mt-4 divide-y divide-[#630000]/10">{overview.history.map(h => <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="font-body text-sm"><LocalTime iso={h.scheduled_at} options={{ weekday: "short", month: "short", day: "numeric", year: "numeric" }} /> · {h.lesson_minutes} min</span><Pill tone={h.appointment_status === "completed" ? "success" : "neutral"}>{LESSON_STATUS_LABEL[h.appointment_status] ?? h.appointment_status}</Pill></li>)}</ul>
          : <p className="mt-4 rounded-xl bg-[#F2DFD8]/30 p-5 font-body text-sm">Your completed lessons will be listed here.</p>}
      </section>

      {courses && courses.length > 0 && <section className="rounded-3xl bg-[#630000] p-6 text-white sm:p-8">
        <div className="flex items-center gap-3"><Sparkles className="h-6 w-6 text-[#E6A742]" /><h2 className="font-display text-2xl text-white">My learning journey</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{courses.map(course => (
          <Link key={course.id} href={`/courses/${course.id}`} className="rounded-2xl border border-white/15 bg-white/10 p-5 transition hover:bg-white/15"><h3 className="font-display text-lg text-white">{course.title}</h3>{course.description && <p className="mt-2 font-body text-sm text-white/70">{course.description}</p>}<span className="mt-4 inline-flex items-center gap-1 font-ui text-sm font-semibold text-[#E6A742]">Open course <ArrowUpRight className="h-4 w-4" /></span></Link>))}</div>
      </section>}

      <section className="rounded-3xl border border-[#630000]/10 bg-white p-6 sm:p-8">
        <p className="font-ui text-[11px] font-semibold uppercase tracking-widest text-[#630000]">Share your story</p>
        <h2 className="font-display text-2xl text-[#630000]">Your voice. Your experience.</h2>
        <p className="mt-3 font-body text-sm text-[#1B1717]/70">Submit a written or video testimonial. It stays private until your instructor approves it, and it is only used publicly if you give permission below.</p>
        <VoiceReviewForm studentId={user.id} />
        <MyTestimonials items={mine} />
      </section>
    </div>
  );
}

function isUnchecked(i: number, drafts: DraftRow[], assignmentId: string) {
  return !(drafts.find(d => d.assignment_id === assignmentId)?.checked_steps ?? []).includes(i);
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note?: string }) {
  return <div className="rounded-2xl border border-[#630000]/10 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-[#630000]">{icon}<span className="font-ui text-xs font-semibold uppercase tracking-wider">{label}</span></div><p className="mt-3 font-display text-3xl text-[#630000]">{value}</p>{note && <p className="font-body text-xs text-[#1B1717]/60">{note}</p>}</div>;
}
