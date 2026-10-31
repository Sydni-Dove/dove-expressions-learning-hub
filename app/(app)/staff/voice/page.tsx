import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/roles";
import { Pill, EmptyState } from "@/components/ui";
import LocalTime from "@/components/LocalTime";
import { LessonStatusButtons, PlanForm, GenerateButton, ConsultationStatus, MarkReminderSent, UnmatchedPayments } from "@/components/voice/CommandForms";
import { CAPACITY, capacitySummary, renewalAttention, consultationState, slotLabel, fundingGap, type Plan, type Balance } from "@/lib/voice-command";

export const dynamic = "force-dynamic";

type Student = { id: string; full_name: string | null; email: string | null; enrolled_at: string };

export default async function VoiceCommandCenter() {
  const { user } = await requireRoles(["faculty", "teacher", "super_admin"]);
  const supabase = createClient();
  const now = new Date();
  const { data: program } = await supabase.from("dp_programs").select("id").eq("slug", "vocal-coaching").maybeSingle();
  const programId = program?.id as string | undefined;

  const [rosterRes, coursesRes] = await Promise.all([
    supabase.rpc("dp_program_students", { target_program_slug: "vocal-coaching" }),
    programId ? supabase.from("dp_courses").select("id").eq("program_id", programId) : Promise.resolve({ data: [], error: null })
  ]);
  const students = (rosterRes.data ?? []) as Student[];
  const courseIds = (coursesRes.data ?? []).map((c: { id: string }) => c.id);
  const [courseAssignments, planAssignments] = await Promise.all([
    courseIds.length ? supabase.from("dp_assignments").select("id,title,course_id").in("course_id", courseIds) : Promise.resolve({ data: [] }),
    supabase.from("dp_assignments").select("id,title,course_id").not("practice_items", "is", null)
  ]);
  const assignments = [...(courseAssignments.data ?? []), ...(planAssignments.data ?? [])].filter((a, i, all) => all.findIndex(b => b.id === a.id) === i);
  const assignmentIds = (assignments ?? []).map(a => a.id);
  const titleOf = (id: string) => assignments?.find(a => a.id === id)?.title ?? "Assignment";

  const [plansRes, balancesRes, lessonsRes, subsRes, attemptsRes, inquiriesRes, testimonialsRes, waitingRes, waivedRes] = await Promise.all([
    supabase.from("dp_coaching_plans").select("id,student_id,cadence,lesson_minutes,weekday,lesson_time,week_parity,timezone,status").eq("status", "active"),
    supabase.from("dp_package_balances").select("package_id,student_id,tier_id,installments_paid,installments_total,purchased_at,credits_total,credits_remaining,payment_status,expires_at,usable,renewed,lesson_minutes"),
    programId ? supabase.from("dp_sessions").select("id,student_id,scheduled_at,lesson_minutes,appointment_status").eq("program_id", programId).eq("appointment_status", "scheduled")
      .lte("scheduled_at", new Date(now.getTime() + 120 * 86400000).toISOString()).order("scheduled_at") : Promise.resolve({ data: [], error: null }),
    assignmentIds.length ? supabase.from("dp_submissions").select("id,student_id,assignment_id,status,submitted_at").in("assignment_id", assignmentIds) : Promise.resolve({ data: [], error: null }),
    assignmentIds.length ? supabase.from("dp_submission_attempts").select("id,submission_id,student_id,assignment_id,attempt_no,file_urls,submitted_at").in("assignment_id", assignmentIds).order("submitted_at", { ascending: false }).limit(60) : Promise.resolve({ data: [], error: null }),
    supabase.from("dp_consultation_inquiries").select("id,full_name,email,interest,status,submitted_at,reminder_sent_at,booked_at").not("status", "in", "(enrolled,closed)").order("submitted_at"),
    supabase.from("dp_voice_testimonials").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("dp_unmatched_payments").select("id,student_id,tier_id,external_order_id,status,reason,received_at").is("resolved_at", null).order("received_at"),
    programId ? supabase.from("dp_sessions").select("id,student_id,scheduled_at,appointment_status,waive_reason").eq("program_id", programId).eq("credit_waived", true).order("scheduled_at", { ascending: false }).limit(10) : Promise.resolve({ data: [], error: null })
  ]);
  const plans = (plansRes.data ?? []) as Plan[];
  const balances = (balancesRes.data ?? []) as Balance[];
  const lessons = lessonsRes.data ?? [];
  const submissions = subsRes.data ?? [];
  const recordings = (attemptsRes.data ?? []).filter(a => (a.file_urls ?? []).length).slice(0, 6);
  const nameOf = (id: string) => { const s = students.find(x => x.id === id); return s?.full_name || s?.email || "Student"; };
  const cap = capacitySummary(plans);
  const renewals = renewalAttention(balances, now);
  const awaiting = submissions.filter(s => ["submitted", "revised"].includes(s.status)).sort((a, b) => +new Date(a.submitted_at) - +new Date(b.submitted_at));
  const outcomesNeeded = lessons.filter(l => new Date(l.scheduled_at as string) < now);
  const upcoming = lessons.filter(l => new Date(l.scheduled_at as string) >= now && new Date(l.scheduled_at as string) <= new Date(now.getTime() + 14 * 86400000));
  const future = lessons.filter(l => new Date(l.scheduled_at as string) >= now);
  const waiting = (waitingRes.data ?? []) as never[];
  const inquiries = (inquiriesRes.data ?? []).map(i => ({ ...i, state: consultationState(i, now) }));
  const loadErrors = [rosterRes.error, plansRes.error, balancesRes.error, lessonsRes.error, subsRes.error, waitingRes.error].filter(Boolean);
  const creditsFor = (id: string) => balances.filter(b => b.student_id === id && b.usable).reduce((n, b) => n + b.credits_remaining, 0);
  const nextExpiry = (id: string) => balances.filter(b => b.student_id === id && b.usable && b.expires_at && b.credits_remaining > 0).map(b => b.expires_at!).sort()[0];

  return <div className="space-y-8 pb-20">
    <header>
      <p className="font-ui text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">Dove Expressions · Voice Studio</p>
      <h1 className="font-display text-3xl text-burgundy">Voice command center</h1>
      <p className="mt-1 font-body text-sm text-charcoal/70">Students, schedule, lesson credits, reviews and recordings from the same records the student sees.</p>
    </header>
    {loadErrors.length > 0 && <p role="alert" className="card p-4 text-sm">Some data could not be loaded ({loadErrors.map(e => e?.message).join("; ")}). The Voice scheduling migration may not be applied yet.</p>}

    <section aria-label="Capacity" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Metric label="Active students" value={`${students.length}`} note={`${cap.total} scheduled of ${cap.totalCapacity}`} />
      <Metric label="Weekly" value={`${cap.weekly}/${CAPACITY.weekly}`} note={`${cap.weeklyOpen} open`} />
      <Metric label="Alternating weeks" value={`${cap.biweekly}/${CAPACITY.biweekly}`} note={`${cap.positions}/${CAPACITY.biweeklyPositions} positions${cap.openPositionHalves ? ` · ${cap.openPositionHalves} half-filled` : ""}`} />
      <Metric label="Awaiting review" value={`${awaiting.length}`} note="submitted practice" />
      <Metric label="Renewals" value={`${renewals.length}`} note="need attention" />
      <Metric label="Consultations" value={`${inquiries.filter(i => i.state.open).length}`} note={`${inquiries.filter(i => i.state.reminderDue).length} reminders due`} />
    </section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5" aria-labelledby="review-h"><h2 id="review-h" className="font-display text-xl text-burgundy">Assignments awaiting review</h2>
        {awaiting.length ? <ul className="mt-3 divide-y divide-charcoal/10">{awaiting.slice(0, 10).map(s => <li key={s.id}><Link href={`/staff/submissions/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-pale-pink/30"><span><span className="block font-body text-sm text-charcoal">{titleOf(s.assignment_id)}</span><span className="font-ui text-xs text-charcoal/60">{nameOf(s.student_id)} · {new Date(s.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span></span><Pill tone="sunrise">{s.status === "revised" ? "Revised" : "New"}</Pill></Link></li>)}</ul>
          : <EmptyState title="All caught up" body="No practice is waiting for review." />}</section>

      <section className="card p-5" aria-labelledby="lessons-h"><h2 id="lessons-h" className="font-display text-xl text-burgundy">Upcoming lessons (next 14 days)</h2>
        {outcomesNeeded.length > 0 && <div className="mt-3 rounded-xl border border-gold/50 bg-gold/10 p-3"><p className="font-ui text-sm font-semibold">Record the outcome for {outcomesNeeded.length} past lesson{outcomesNeeded.length > 1 ? "s" : ""}</p>
          <ul className="mt-2 space-y-3">{outcomesNeeded.slice(0, 5).map(l => <li key={l.id}><p className="font-body text-sm">{nameOf(l.student_id)} · <LocalTime iso={l.scheduled_at as string} /></p><LessonStatusButtons lessonId={l.id} /></li>)}</ul></div>}
        {upcoming.length ? <ul className="mt-3 divide-y divide-charcoal/10">{upcoming.slice(0, 12).map(l => <li key={l.id} className="py-2"><p className="font-body text-sm"><span className="font-semibold">{nameOf(l.student_id)}</span> · {l.lesson_minutes} min</p><p className="font-ui text-xs text-charcoal/60"><LocalTime iso={l.scheduled_at as string} /></p><details className="mt-1"><summary className="cursor-pointer font-ui text-xs underline">Cancel or record</summary><div className="mt-2"><LessonStatusButtons lessonId={l.id} /></div></details></li>)}</ul>
          : <EmptyState title="Nothing scheduled" body="Create a student schedule below to generate lessons." />}</section>
    </div>

    <section className="card overflow-x-auto p-5" aria-labelledby="students-h"><h2 id="students-h" className="font-display text-xl text-burgundy">Students</h2>
      {students.length ? <table className="mt-3 w-full min-w-[720px] text-left font-body text-sm"><thead className="font-ui text-xs uppercase text-charcoal/60"><tr><th className="py-2 pr-3">Student</th><th className="pr-3">Schedule</th><th className="pr-3">Lessons left</th><th className="pr-3">Reviewed / waiting</th><th className="pr-3">Next lesson</th><th /></tr></thead>
        <tbody className="divide-y divide-charcoal/10">{students.map(s => { const plan = plans.find(p => p.student_id === s.id); const next = lessons.find(l => l.student_id === s.id && new Date(l.scheduled_at as string) >= now);
          const mine = submissions.filter(x => x.student_id === s.id); const exp = nextExpiry(s.id);
          return <tr key={s.id} className="align-top"><td className="py-3 pr-3"><Link href={`/staff/students/${s.id}`} className="inline-flex min-h-[44px] items-center font-semibold text-burgundy hover:underline">{s.full_name || s.email}</Link></td>
            <td className="pr-3">{plan ? <>{slotLabel(plan)}<br /><GenerateButton planId={plan.id} /></> : <span className="text-charcoal/50">Not scheduled</span>}</td>
            <td className="pr-3">{creditsFor(s.id)}{exp && <span className="block text-xs text-charcoal/60">expires {new Date(exp).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>}
              {(() => { const g = fundingGap(future.filter(l => l.student_id === s.id), creditsFor(s.id)); return g.unfunded > 0 ? <span className="mt-1 block text-xs font-semibold text-[#7a2c1c]">{g.unfunded} scheduled beyond paid lessons, first on <LocalTime iso={g.firstUnfunded as string} options={{ month: "short", day: "numeric" }} />. Payment needed before it can be recorded as taught.</span> : null; })()}</td>
            <td className="pr-3">{mine.filter(x => ["approved", "exempt"].includes(x.status)).length} / {mine.filter(x => ["submitted", "revised"].includes(x.status)).length}</td>
            <td className="pr-3">{next ? <LocalTime iso={next.scheduled_at as string} options={{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} /> : "—"}</td>
            <td>{renewals.find(r => r.student_id === s.id) && <Pill tone="sunrise">Renewal</Pill>}</td></tr>; })}</tbody></table>
        : <EmptyState title="No active students yet" body="Students appear here after they are enrolled in the Voice program." />}</section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5" aria-labelledby="renew-h"><h2 id="renew-h" className="font-display text-xl text-burgundy">Renewals needing attention</h2>
        {renewals.length ? <ul className="mt-3 divide-y divide-charcoal/10">{renewals.map(r => <li key={r.student_id} className="flex items-center justify-between py-2"><span className="font-body text-sm">{nameOf(r.student_id)}</span><span className="font-ui text-xs text-charcoal/70">{r.reason}</span></li>)}</ul> : <p className="mt-3 font-body text-sm text-charcoal/70">No student needs a renewal right now.</p>}</section>

      <section className="card p-5" aria-labelledby="consult-h"><h2 id="consult-h" className="font-display text-xl text-burgundy">Pending consultations</h2>
        {inquiries.length ? <ul className="mt-3 divide-y divide-charcoal/10">{inquiries.map(i => <li key={i.id} className="py-3"><p className="font-body text-sm"><span className="font-semibold">{i.full_name}</span> · {i.email}</p><p className="font-ui text-xs text-charcoal/60">{i.interest ? `${i.interest} · ` : ""}waiting {i.state.hoursWaiting}h · {i.state.label}</p><div className="mt-1 flex flex-wrap items-center gap-3"><ConsultationStatus id={i.id} status={i.status} />{i.state.reminderDue && <MarkReminderSent id={i.id} />}</div></li>)}</ul>
          : <p className="mt-3 font-body text-sm text-charcoal/70">No open consultation inquiries. Inquiries from the consultation form appear here once the form connection is enabled (see docs/voice-integrations.md). Visible to faculty and administrators only.</p>}</section>
    </div>

    <section className="card p-5" aria-labelledby="waived-h"><h2 id="waived-h" className="font-display text-xl text-burgundy">Lessons recorded with payment waived</h2>
      {(waivedRes.data ?? []).length ? <ul className="mt-3 divide-y divide-charcoal/10">{(waivedRes.data ?? []).map(w => <li key={w.id} className="py-2 font-body text-sm"><span className="font-semibold">{nameOf(w.student_id)}</span> · <LocalTime iso={w.scheduled_at as string} options={{ month: "short", day: "numeric", year: "numeric" }} /> · {w.appointment_status === "completed" ? "taught" : w.appointment_status === "late_cancelled" ? "late cancellation" : "missed"}<span className="block font-ui text-xs text-charcoal/70">Reason: {w.waive_reason}</span></li>)}</ul>
        : <p className="mt-3 font-body text-sm text-charcoal/70">No lesson has been recorded without payment. A waiver always needs a reason and is listed here.</p>}</section>

    <section className="card p-5" aria-labelledby="unm-h"><h2 id="unm-h" className="font-display text-xl text-burgundy">Store payments waiting to be matched{waiting.length ? ` (${waiting.length})` : ""}</h2><div className="mt-3"><UnmatchedPayments waiting={waiting} plans={balances as never} nameOf={Object.fromEntries(students.map(x => [x.id, x.full_name || x.email || "Student"]))} /></div></section>

    <section className="card p-5" aria-labelledby="rec-h"><h2 id="rec-h" className="font-display text-xl text-burgundy">Recent student recordings</h2>
      {recordings.length ? <ul className="mt-3 divide-y divide-charcoal/10">{recordings.map(r => <li key={r.id}><Link href={`/staff/submissions/${r.submission_id}`} className="flex items-center justify-between py-2 hover:bg-pale-pink/30"><span className="font-body text-sm">{nameOf(r.student_id)} · {titleOf(r.assignment_id)}</span><span className="font-ui text-xs text-charcoal/60">attempt {r.attempt_no} · {new Date(r.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span></Link></li>)}</ul>
        : <p className="mt-3 font-body text-sm text-charcoal/70">Submitted recordings will be listed here, newest first. Open one to listen and give feedback.</p>}</section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5" aria-labelledby="plan-h"><h2 id="plan-h" className="font-display text-xl text-burgundy">Set a student’s lesson schedule</h2><div className="mt-3">{programId ? <PlanForm students={students} programId={programId} instructorId={user.id} /> : <p className="text-sm">Voice program not found.</p>}</div></section>
      <section className="card p-5" aria-labelledby="pkg-h"><h2 id="pkg-h" className="font-display text-xl text-burgundy">Packages</h2><p className="mt-3 font-body text-sm text-charcoal/70">Define what each package includes and record packages for students.</p><Link href="/staff/voice/packages" className="btn-secondary mt-4 inline-block">Manage packages and library access</Link></section>
    </div>

    <nav aria-label="Related" className="flex flex-wrap gap-4 font-ui text-sm"><Link className="link-action" href="/staff/voice/plans">Plans and goals</Link><Link className="link-action" href="/staff/voice/library">Exercise library and guides</Link><Link className="link-action" href="/staff/voice-reviews">Testimonials{(testimonialsRes.count ?? 0) > 0 ? ` (${testimonialsRes.count} pending)` : ""}</Link><Link className="link-action" href="/staff/courses">Curriculum and lessons</Link><Link className="link-action" href="/staff/assignments">Assignments</Link></nav>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-2xl border border-burgundy/10 bg-white p-4"><p className="font-ui text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">{label}</p><p className="mt-1 font-display text-2xl text-burgundy">{value}</p>{note && <p className="font-ui text-xs text-charcoal/60">{note}</p>}</div>;
}
