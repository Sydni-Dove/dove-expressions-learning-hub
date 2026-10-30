/** Pure helpers that turn existing assignment/submission/draft rows into dashboard state. */
export type AssignmentRow = { id: string; title: string; due_at: string | null; song?: string | null; goal?: string | null; practice_steps?: string[] | null; lesson_id?: string | null; course_id?: string | null };
export type SubmissionRow = { assignment_id: string; status: string };
export type DraftRow = { assignment_id: string; checked_steps: number[] | null; minutes: number | null };

export type AssignmentState = { label: string; done: boolean; needsAction: boolean; stepsDone: number; stepsTotal: number; overdue: boolean };

export function assignmentState(a: AssignmentRow, sub: SubmissionRow | undefined, draft: DraftRow | undefined, now = new Date()): AssignmentState {
  const stepsTotal = a.practice_steps?.length ?? 0;
  const stepsDone = Math.min(stepsTotal, draft?.checked_steps?.length ?? 0);
  const status = sub?.status;
  const done = status === "approved" || status === "exempt";
  const label = status === "approved" ? "Complete" : status === "exempt" ? "Exempt" : status === "returned" ? "Needs revision"
    : status === "submitted" || status === "revised" ? "Awaiting review" : draft ? "In practice" : "Assigned";
  const needsAction = !done && !(status === "submitted" || status === "revised");
  const overdue = needsAction && !!a.due_at && new Date(a.due_at) < now;
  return { label, done, needsAction, stepsDone, stepsTotal, overdue };
}

export function summarizeAssignments(assignments: AssignmentRow[], submissions: SubmissionRow[], drafts: DraftRow[], now = new Date()) {
  const rows = assignments.map(a => {
    const sub = submissions.find(s => s.assignment_id === a.id);
    const draft = drafts.find(d => d.assignment_id === a.id);
    return { assignment: a, state: assignmentState(a, sub, draft, now) };
  });
  return {
    rows,
    open: rows.filter(r => !r.state.done),
    complete: rows.filter(r => r.state.done).length,
    total: rows.length,
    awaitingReview: rows.filter(r => r.state.label === "Awaiting review").length,
    needsRevision: rows.filter(r => r.state.label === "Needs revision").length,
    practiceMinutes: drafts.reduce((n, d) => n + (d.minutes ?? 0), 0),
    percent: rows.length ? Math.round((rows.filter(r => r.state.done).length / rows.length) * 100) : 0
  };
}

export type CoachingOverview = {
  plan: { cadence: "weekly" | "biweekly"; lesson_minutes: number; lesson_time: string; timezone: string } | null;
  upcoming: { id: string; scheduled_at: string; lesson_minutes: number }[];
  history: { id: string; scheduled_at: string; lesson_minutes: number; appointment_status: string }[];
  credits_by_minutes: Record<string, number>;
  packages: { credits_total: number; remaining: number; credits_unlocked?: number; installments_total?: number; installments_paid?: number; lesson_minutes: number; payment_status: string; expires_at: string | null; purchased_at: string }[];
};

export function creditsSummary(o: CoachingOverview | null, now = new Date()) {
  const packages = o?.packages ?? [];
  const usable = packages.filter(p => ["paid", "partial", "complimentary"].includes(p.payment_status) && (!p.expires_at || new Date(p.expires_at) > now) && p.remaining > 0);
  const expiries = usable.filter(p => p.expires_at).map(p => new Date(p.expires_at!)).sort((a, b) => a.getTime() - b.getTime());
  const byMinutes = Object.entries(o?.credits_by_minutes ?? {}).map(([m, n]) => ({ minutes: Number(m), count: Number(n) })).filter(x => x.count > 0).sort((a, b) => a.minutes - b.minutes);
  const total = byMinutes.reduce((n, x) => n + x.count, 0);
  const soonest = expiries[0] ?? null;
  return {
    hasPackages: packages.length > 0, total, byMinutes, soonestExpiry: soonest,
    expiringSoon: !!soonest && soonest.getTime() - now.getTime() < 14 * 86400000,
    pendingPayment: packages.some(p => p.payment_status === "pending"),
    installments: packages.filter(p => (p.installments_total ?? 1) > 1 && (p.installments_paid ?? 0) < (p.installments_total ?? 1) && p.payment_status === "partial")
      .map(p => ({ paid: p.installments_paid ?? 0, total: p.installments_total ?? 1, unlocked: p.credits_unlocked ?? 0, lessons: p.credits_total })),
    low: packages.length > 0 && total <= 1
  };
}

export const LESSON_STATUS_LABEL: Record<string, string> = {
  completed: "Completed", cancelled: "Cancelled", late_cancelled: "Late cancellation", no_show: "Missed", scheduled: "Scheduled"
};

/** Where "Renew or add lessons" goes, by lesson length. 65 has no page until the store owner creates one; never invent a URL. */
export function renewalLink(minutes: number | undefined, env: { book65?: string } = { book65: process.env.NEXT_PUBLIC_BOOKING_URL_65 }): { href: string; external: boolean } {
  if (minutes === 45) return { href: "https://doveexpressions.org/book-45/", external: true };
  if (minutes === 60) return { href: "https://doveexpressions.org/book-60/", external: true }; // earlier offering, existing page
  if (minutes === 65 && env.book65 && /^https:\/\/\S+$/.test(env.book65)) return { href: env.book65, external: true };
  return { href: "/messages", external: false };
}
