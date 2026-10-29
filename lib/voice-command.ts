/** Capacity and attention rules for the Voice command center (pure, unit-tested). */
export const CAPACITY = { weekly: 18, biweekly: 12, biweeklyPositions: 6 } as const;

export type Plan = { id: string; student_id: string; cadence: "weekly" | "biweekly"; lesson_minutes: number; weekday: number; lesson_time: string; week_parity: number; timezone: string; status: string };
export type Balance = { installments_total?: number; installments_paid?: number; package_id: string; student_id: string; credits_total: number; credits_remaining: number; payment_status: string; expires_at: string | null; usable: boolean; renewed: boolean; lesson_minutes: number };
export type Inquiry = { id: string; status: string; submitted_at: string; reminder_sent_at: string | null; booked_at: string | null };

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function capacitySummary(plans: Plan[]) {
  const active = plans.filter(p => p.status === "active");
  const weekly = active.filter(p => p.cadence === "weekly").length;
  const biweekly = active.filter(p => p.cadence === "biweekly");
  const positions = new Set(biweekly.map(p => `${p.weekday}|${p.lesson_time}`));
  const lonely = [...positions].filter(k => biweekly.filter(p => `${p.weekday}|${p.lesson_time}` === k).length < 2).length;
  return {
    weekly, biweekly: biweekly.length, positions: positions.size, openPositionHalves: lonely,
    weeklyOpen: Math.max(0, CAPACITY.weekly - weekly), biweeklyOpen: Math.max(0, CAPACITY.biweekly - biweekly.length),
    total: active.length, totalCapacity: CAPACITY.weekly + CAPACITY.biweekly
  };
}

export const slotLabel = (p: Pick<Plan, "weekday" | "lesson_time" | "cadence" | "week_parity" | "lesson_minutes">) =>
  `${WEEKDAYS[p.weekday]} ${formatTime(p.lesson_time)} · ${p.lesson_minutes} min${p.cadence === "biweekly" ? ` · alternating weeks (${p.week_parity === 0 ? "A" : "B"})` : ""}`;

export function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** A student needs renewal when every usable package is almost used up or about to expire, and none has been renewed. */
export function renewalAttention(balances: Balance[], now = new Date()) {
  const byStudent = new Map<string, Balance[]>();
  for (const b of balances) byStudent.set(b.student_id, [...(byStudent.get(b.student_id) ?? []), b]);
  const out: { student_id: string; reason: string; remaining: number }[] = [];
  for (const [student_id, list] of byStudent) {
    const pending = list.some(b => b.payment_status === "pending");
    const usable = list.filter(b => b.usable && b.credits_remaining > 0);
    const remaining = usable.reduce((n, b) => n + b.credits_remaining, 0);
    const soon = usable.filter(b => b.expires_at && new Date(b.expires_at).getTime() - now.getTime() < 14 * 86400000);
    if (pending) out.push({ student_id, reason: "Payment pending", remaining });
    else if (remaining === 0 && list.some(b => b.payment_status === "partial")) out.push({ student_id, reason: "Next installment needed to unlock more lessons", remaining });
    else if (remaining === 0) out.push({ student_id, reason: "No lessons remaining", remaining });
    else if (remaining <= 1) out.push({ student_id, reason: "One lesson remaining", remaining });
    else if (soon.length) out.push({ student_id, reason: "Package expires within 14 days", remaining });
    else if (list.some(b => b.expires_at && new Date(b.expires_at) < now && b.credits_remaining > 0 && !b.renewed)) out.push({ student_id, reason: "Package expired with unused lessons", remaining });
  }
  return out;
}

export const REMINDER_AFTER_HOURS = 48;
/** Consultation follow-up state. Reminders stop once a booking is confirmed. */
export function consultationState(i: Inquiry, now = new Date()) {
  const closed = ["booked", "consulted", "recommended", "enrolled", "closed"].includes(i.status) || !!i.booked_at;
  const hours = (now.getTime() - new Date(i.submitted_at).getTime()) / 3600000;
  const reminderDue = !closed && !i.reminder_sent_at && hours >= REMINDER_AFTER_HOURS;
  return { open: !closed, reminderDue, label: closed ? (i.status === "booked" || i.booked_at ? "Booked" : i.status) : reminderDue ? "Reminder due" : "Awaiting booking", hoursWaiting: Math.floor(hours) };
}
