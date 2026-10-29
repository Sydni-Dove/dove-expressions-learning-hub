import { describe, expect, it } from "vitest";
import { capacitySummary, renewalAttention, consultationState, slotLabel, formatTime, type Plan, type Balance } from "@/lib/voice-command";
import { summarizeAssignments, creditsSummary, assignmentState } from "@/lib/voice-dashboard";

const plan = (o: Partial<Plan>): Plan => ({ id: Math.random().toString(), student_id: Math.random().toString(), cadence: "weekly", lesson_minutes: 60, weekday: 1, lesson_time: "10:00:00", week_parity: 0, timezone: "UTC", status: "active", ...o });
const now = new Date("2026-11-01T12:00:00Z");

describe("capacity", () => {
  it("models 18 weekly students and 12 biweekly students sharing six positions", () => {
    const plans = [
      ...Array.from({ length: 18 }, (_, i) => plan({ weekday: (i % 5) + 1, lesson_time: `${9 + Math.floor(i / 5)}:00:00` })),
      ...Array.from({ length: 12 }, (_, i) => plan({ cadence: "biweekly", weekday: 6, lesson_time: `${9 + Math.floor(i / 2)}:00:00`, week_parity: i % 2 }))
    ];
    const c = capacitySummary(plans);
    expect(c).toMatchObject({ weekly: 18, biweekly: 12, positions: 6, openPositionHalves: 0, weeklyOpen: 0, biweeklyOpen: 0, total: 30 });
  });
  it("flags half-filled alternating positions and ignores ended plans", () => {
    const c = capacitySummary([plan({ cadence: "biweekly" }), plan({ status: "ended" })]);
    expect(c).toMatchObject({ biweekly: 1, positions: 1, openPositionHalves: 1, total: 1 });
  });
  it("labels slots for humans", () => {
    expect(slotLabel(plan({ cadence: "biweekly", week_parity: 1, lesson_minutes: 45, weekday: 3, lesson_time: "14:30:00" }))).toBe("Wednesday 2:30 PM · 45 min · alternating weeks (B)");
    expect(formatTime("00:05:00")).toBe("12:05 AM");
  });
});

describe("renewals", () => {
  const b = (o: Partial<Balance>): Balance => ({ package_id: "p", student_id: "s1", credits_total: 4, credits_remaining: 4, payment_status: "paid", expires_at: null, usable: true, renewed: false, lesson_minutes: 60, ...o });
  it("flags low, expiring, exhausted and unpaid packages", () => {
    expect(renewalAttention([b({ credits_remaining: 1 })], now)[0].reason).toBe("One lesson remaining");
    expect(renewalAttention([b({ credits_remaining: 0, usable: true })], now)[0].reason).toBe("No lessons remaining");
    expect(renewalAttention([b({ expires_at: "2026-11-10T00:00:00Z" })], now)[0].reason).toMatch(/expires/);
    expect(renewalAttention([b({ payment_status: "pending", usable: false })], now)[0].reason).toBe("Payment pending");
    expect(renewalAttention([b({})], now)).toEqual([]);
  });
});

describe("consultations", () => {
  const i = (o: object) => ({ id: "1", status: "acknowledged", submitted_at: "2026-10-29T12:00:00Z", reminder_sent_at: null, booked_at: null, ...o });
  it("sends a reminder only after 48 hours without a booking", () => {
    expect(consultationState(i({}), new Date("2026-10-31T11:00:00Z")).reminderDue).toBe(false);
    expect(consultationState(i({}), new Date("2026-10-31T12:00:00Z")).reminderDue).toBe(true);
    expect(consultationState(i({ reminder_sent_at: "2026-10-31T13:00:00Z" }), now).reminderDue).toBe(false);
    expect(consultationState(i({ status: "booked", booked_at: "2026-10-30T00:00:00Z" }), now)).toMatchObject({ reminderDue: false, open: false, label: "Booked" });
    expect(consultationState(i({ booked_at: "2026-10-30T00:00:00Z" }), now).reminderDue).toBe(false);
  });
});

describe("student dashboard state", () => {
  const a = (id: string, steps = 2, due: string | null = null) => ({ id, title: id, due_at: due, practice_steps: Array(steps).fill("s") });
  it("derives assignment status, progress and overdue work from existing rows", () => {
    expect(assignmentState(a("x"), undefined, undefined, now).label).toBe("Assigned");
    expect(assignmentState(a("x"), undefined, { assignment_id: "x", checked_steps: [0], minutes: 5 }, now)).toMatchObject({ label: "In practice", stepsDone: 1, stepsTotal: 2 });
    expect(assignmentState(a("x"), { assignment_id: "x", status: "returned" }, undefined, now).label).toBe("Needs revision");
    expect(assignmentState(a("x", 2, "2026-10-01T00:00:00Z"), undefined, undefined, now).overdue).toBe(true);
    expect(assignmentState(a("x", 2, "2026-10-01T00:00:00Z"), { assignment_id: "x", status: "submitted" }, undefined, now).overdue).toBe(false);
    const s = summarizeAssignments([a("1"), a("2"), a("3")], [{ assignment_id: "1", status: "approved" }, { assignment_id: "2", status: "submitted" }], [{ assignment_id: "3", checked_steps: [], minutes: 20 }], now);
    expect(s).toMatchObject({ complete: 1, total: 3, awaitingReview: 1, practiceMinutes: 20, percent: 33 });
  });
  it("summarizes lesson credits without counting unpaid or expired packages", () => {
    const o: any = { credits_by_minutes: { "60": 2, "45": 0 }, packages: [
      { credits_total: 4, remaining: 2, lesson_minutes: 60, payment_status: "paid", expires_at: "2026-11-05T00:00:00Z", purchased_at: "" },
      { credits_total: 4, remaining: 4, lesson_minutes: 60, payment_status: "pending", expires_at: null, purchased_at: "" }] };
    const c = creditsSummary(o, now);
    expect(c).toMatchObject({ total: 2, expiringSoon: true, pendingPayment: true, hasPackages: true });
    expect(c.byMinutes).toEqual([{ minutes: 60, count: 2 }]);
    expect(creditsSummary(null, now)).toMatchObject({ hasPackages: false, total: 0, low: false });
  });
});

describe("installment plans", () => {
  const pkg = (o: object): any => ({ credits_total: 12, credits_remaining: 0, payment_status: "partial", expires_at: null, usable: true, renewed: false, lesson_minutes: 60, student_id: "s", package_id: "p", ...o });
  it("tells the instructor when the next installment is what is holding lessons back", () => {
    expect(renewalAttention([pkg({})], now)[0].reason).toMatch(/installment/i);
    expect(renewalAttention([pkg({ credits_remaining: 3 })], now)).toEqual([]);
  });
  it("tells the student how many lessons a partial payment has unlocked", () => {
    const c = creditsSummary({ credits_by_minutes: { "60": 4 }, packages: [{ credits_total: 12, remaining: 4, credits_unlocked: 4, installments_total: 3, installments_paid: 1, lesson_minutes: 60, payment_status: "partial", expires_at: null, purchased_at: "" }] } as any, now);
    expect(c.installments).toEqual([{ paid: 1, total: 3, unlocked: 4, lessons: 12 }]);
    expect(c.total).toBe(4);
  });
});

import { fundingGap } from "@/lib/voice-command";
import { embedOrigins, DEFAULT_EMBED_ORIGINS } from "@/lib/public-testimonials";
describe("scheduling beyond paid lessons", () => {
  const lessons = ["2026-11-20", "2026-11-06", "2026-11-13", "2026-11-27"].map(d => ({ scheduled_at: `${d}T16:00:00Z` }));
  it("flags the first scheduled lesson the paid lessons do not reach, without blocking scheduling", () => {
    expect(fundingGap(lessons, 2)).toEqual({ scheduled: 4, unfunded: 2, firstUnfunded: "2026-11-20T16:00:00Z" });
    expect(fundingGap(lessons, 4)).toMatchObject({ unfunded: 0, firstUnfunded: null });
    expect(fundingGap(lessons, 0).unfunded).toBe(4);
    expect(fundingGap([], 3).unfunded).toBe(0);
  });
});
describe("website embed origins", () => {
  it("allows only configured https origins and falls back to the website", () => {
    expect(embedOrigins(undefined)).toEqual(DEFAULT_EMBED_ORIGINS);
    expect(embedOrigins("https://a.example, http://insecure.example, javascript:x, https://b.example:8443")).toEqual(["https://a.example", "https://b.example:8443"]);
    expect(embedOrigins("*")).toEqual(DEFAULT_EMBED_ORIGINS);
  });
});
