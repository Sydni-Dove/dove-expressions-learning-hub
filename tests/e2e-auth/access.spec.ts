import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { API, ANON, F, login, rest } from "./helpers";

/** Onboarding and payment-access rules through the real app and database: intake and the Vocal Demo before payment; assessments, recordings and resources after verified payment. */
const SERVICE = fs.readFileSync(path.join(__dirname, "../../testing/local-supabase/service.txt"), "utf8").trim();
const svc = async (fn: string, args: object) => {
  const r = await fetch(`${API}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${SERVICE}`, "content-type": "application/json" }, body: JSON.stringify(args) });
  expect(r.status, `${fn}: ${await r.clone().text()}`).toBeLessThan(300);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const tryRpc = async (who: "instructor" | "unpaid" | "voiceOnly", fn: string, args: object) => { const r = await rest(who, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) }); return { status: r.status, text: await r.text() }; };

test.describe.serial("onboarding and payment access", () => {
  let tierId = "";
  test.beforeAll(async () => {
    execSync("node testing/local-supabase/run.mjs seed", { stdio: "pipe", timeout: 120000 });
    const programs = await (await rest("instructor", "dp_programs?select=id&slug=eq.vocal-coaching")).json();
    const made = await rest("instructor", "dp_coaching_tiers", { method: "POST", body: JSON.stringify({ program_id: programs[0].id, slug: "access-test", name: "Access test package", lesson_minutes: 60, lesson_count: 4, installments: 1, assessments_included: 2, woo_product_ids: ["wc-access-test"] }) });
    expect(made.status, await made.clone().text()).toBeLessThan(300);
    tierId = (await made.json())[0].id;
  });

  test("before an invitation, a person who only had a consultation cannot reach the intake; after one they can, with no payment and no enrollment", async ({ browser }) => {
    const p = await login(browser, "prospect");
    await p.page.goto("/voice/intake");
    await expect(p.page).not.toHaveURL(/\/voice\/intake/); // sent away: not enrolled, not invited
    await p.ctx.close();

    const inst = await login(browser, "instructor");
    await inst.page.goto("/staff/voice/development");
    await inst.page.getByLabel(/Person's account email/).fill(F.users.prospect.email);
    await inst.page.getByRole("button", { name: "Invite to complete intake" }).click();
    await expect(inst.page.getByText(/Invited\. They can open \/voice\/intake now/)).toBeVisible();
    await inst.ctx.close();

    const s = await login(browser, "prospect");
    await s.page.goto("/voice/intake");
    await expect(s.page.getByRole("heading", { name: "Tell us your goals" })).toBeVisible();
    await s.page.getByLabel("What would you most like to get out of voice coaching?").fill("I want to lead worship with confidence.");
    await s.page.getByRole("button", { name: "Send to my instructor" }).click();
    await s.page.waitForURL((u) => !u.pathname.startsWith("/voice/intake"));
    expect(await (await rest("instructor", `dp_voice_intakes?select=id&student_id=eq.${F.ids.prospect}`)).json()).toHaveLength(1);
    // completing the intake enrolled nobody and unlocked nothing
    expect(await (await rest("instructor", `dp_enrollments?select=id&user_id=eq.${F.ids.prospect}`)).json()).toEqual([]);
    for (const path of ["/voice/assessments", "/voice/recordings", "/voice/resources", "/voice/plan"]) {
      await s.page.goto(path);
      await expect(s.page, path).not.toHaveURL(new RegExp(path.replace("/", "\\/") + "$"));
    }
    await s.ctx.close();
  });

  test("the instructor records the Vocal Demo at the consultation, before payment; it becomes the baseline and shows who is paid", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto(`/staff/voice/development/${F.ids.prospect}`);
    await expect(page.getByText(/Invited for intake · no verified payment/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vocal Demo (consultation baseline)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Vocal Demo" })).toBeDisabled(); // nothing rated yet
    await page.getByLabel("Demo rating for Pitch accuracy and ear training").selectOption({ index: 2 });
    await page.getByLabel("Demo rating for Posture and breath management").selectOption({ index: 2 });
    await page.getByLabel("Demo rating for Vocal range development").selectOption({ index: 3 });
    await page.getByLabel("Demo rating for Agility, riffs, and runs").selectOption({ index: 1 });
    await page.getByLabel("Strengths").fill("Warm, natural tone.");
    await page.getByRole("button", { name: "Save Vocal Demo" }).click();
    await expect(page.getByText("Vocal Demo recorded as the baseline.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Vocal Demo history")).toContainText("Current baseline");
    await expect(page.getByLabel("Vocal Demo history")).toContainText("Agility, riffs, and runs: 1");
    // no assessment can be given yet: not enrolled and not paid
    await expect(page.getByRole("note").filter({ hasText: "not enrolled in Voice yet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Assign", exact: true })).toBeDisabled();
    // the demo is staff-only until shared
    expect(await (await rest("prospect" as never, "dp_voice_demos?select=id")).json()).toEqual([]);
    expect((await tryRpc("instructor", "dp_voice_record_demo", { student: F.ids.prospect, rate: { "pitch-ear": 9 }, good: "", focus: "", private_notes: "", share: false })).status).toBeGreaterThanOrEqual(400);
    await ctx.close();
  });

  test("an enrolled student who has not paid completes intake but sees assessments, recordings and resources locked; the database says no too", async ({ browser }) => {
    const u = await login(browser, "unpaid");
    for (const [path, what] of [["/voice/assessments", "Assessments"], ["/voice/recordings", "Recording"], ["/voice/resources", "Your coaching resources"]] as const) {
      await u.page.goto(path);
      await expect(u.page.getByRole("note").filter({ hasText: `${what} opens after your payment is confirmed` }), path).toBeVisible();
    }
    await u.page.goto("/voice/recordings");
    await expect(u.page.getByRole("button", { name: "Start recording" })).toHaveCount(0);
    await expect(u.page.locator("input[type=file]")).toHaveCount(0);
    await u.page.goto("/voice/intake");
    await u.page.getByLabel("What would you most like to get out of voice coaching?").fill("Harmony.");
    await u.page.getByRole("button", { name: "Send to my instructor" }).click();
    await u.page.waitForURL((url) => !url.pathname.startsWith("/voice/intake"));
    await u.ctx.close();
    expect(await (await rest("instructor", `dp_voice_intakes?select=id&student_id=eq.${F.ids.unpaid}`)).json()).toHaveLength(1);
    // direct database calls are refused, whatever the screens show
    const asg = await tryRpc("instructor", "dp_assessment_assign", { student: F.ids.unpaid, assessment_kind: "creative_expression", reason: "Fits" });
    expect(asg.status).toBeGreaterThanOrEqual(400); expect(asg.text).toMatch(/verified payment/);
    const rec = await tryRpc("unpaid", "dp_recording_begin", { asg: null, lesson: null, rec_label: "Verse", rec_title: "", part: 1, ctype: "audio/mp4", bytes: 1000, seconds: 10 });
    expect(rec.status).toBeGreaterThanOrEqual(400); expect(rec.text).toMatch(/paid, current/);
    expect(await (await rest("unpaid", "dp_voice_resource_content?select=key")).json()).toEqual([]);
    expect(await (await rest("unpaid", "dp_voice_skills?select=id")).json()).toEqual([]);
    const pg = await tryRpc("instructor", "dp_assign_weekly_plan", { student: F.ids.unpaid, plan_title: "Week", notes: "", goal_text: "", due: "2030-01-01", items: [{ exercise_id: (await (await rest("instructor", "dp_voice_exercises?select=id&curriculum_key=eq.stance-check")).json())[0].id }] });
    expect(pg.status).toBeGreaterThanOrEqual(400); expect(pg.text).toMatch(/verified payment/);
  });

  test("the instructor's screen shows the unpaid state and refuses to assign; a manual package is not verified payment", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto(`/staff/voice/development/${F.ids.unpaid}`);
    await expect(page.getByText(/Enrolled · no verified payment/)).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "open after verified payment" })).toBeVisible();
    await expect(page.getByLabel("Assign an assessment")).toBeDisabled();
    await ctx.close();
    await (await rest("instructor", "rpc/dp_create_package", { method: "POST", body: JSON.stringify({ student: F.ids.unpaid, tier: tierId, pay_status: "paid" }) })).text();
    const still = await tryRpc("instructor", "dp_assessment_assign", { student: F.ids.unpaid, assessment_kind: "creative_expression", reason: "Fits" });
    expect(still.status).toBeGreaterThanOrEqual(400);
  });

  test("a verified WooCommerce payment attributed to the student unlocks eligibility, not assignment; the instructor then chooses with a reason", async ({ browser }) => {
    // someone else's payment changes nothing for this student
    await svc("dp_record_package_purchase", { student: F.ids.multi, tier: tierId, quantity: 1, order_id: "acc-other-1", line_item_id: "1", sku: "wc-access-test", pay_status: "paid", plan_ref: null });
    expect(((await (await rest("unpaid", "rpc/dp_voice_my_access", { method: "POST", body: "{}" })).json()) as { paid: boolean }).paid).toBe(false);
    await svc("dp_record_package_purchase", { student: F.ids.unpaid, tier: tierId, quantity: 1, order_id: "acc-unpaid-1", line_item_id: "1", sku: "wc-access-test", pay_status: "paid", plan_ref: null });
    expect(((await (await rest("unpaid", "rpc/dp_voice_my_access", { method: "POST", body: "{}" })).json()) as { paid: boolean }).paid).toBe(true);
    expect(await (await rest("instructor", `dp_voice_assessments?select=id&student_id=eq.${F.ids.unpaid}`)).json()).toEqual([]); // nothing assigned automatically

    const { ctx, page } = await login(browser, "instructor");
    await page.goto(`/staff/voice/development/${F.ids.unpaid}`);
    await expect(page.getByText(/Enrolled · paid access verified/)).toBeVisible();
    await page.getByLabel("Assign an assessment").selectOption({ label: "Creative Vocal Expression" });
    await expect(page.getByRole("button", { name: "Assign", exact: true })).toBeDisabled(); // reason required
    await page.getByLabel(/Why this fits the student/).fill("She wants to grow in ad-libbing.");
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText("Assigned.")).toBeVisible();
    // the prophetic assessment stays unavailable until the student chooses it AND the instructor authorizes it
    await expect(page.getByRole("option", { name: /Personal Time With God/ })).toHaveAttribute("disabled", "");
    await ctx.close();

    const u = await login(browser, "unpaid");
    await u.page.goto("/voice/assessments");
    await expect(u.page.getByRole("note").filter({ hasText: "opens after your payment" })).toHaveCount(0);
    await expect(u.page.getByText("Your coach chose this because: She wants to grow in ad-libbing.")).toBeVisible();
    await expect(u.page.getByText("Waiting for your decision")).toBeVisible();
    await u.page.getByRole("link", { name: "Review the invitation" }).click();
    // an assignment is only an invitation: the student accepts before anything can be started
    await expect(u.page.getByRole("heading", { name: "Your coach is inviting you to take this" })).toBeVisible();
    await expect(u.page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
    await u.page.getByRole("button", { name: "Yes, I'd like to take it" }).click();
    await expect(u.page.getByRole("button", { name: "Save draft" })).toBeVisible();
    await u.ctx.close();
  });

  test("the prophetic assessment still needs the student's choice and the instructor's authorization, even for a paid student", async () => {
    // the package includes 2: one is assigned; assign the second, then the allowance is spent
    const ok = await tryRpc("instructor", "dp_assessment_assign", { student: F.ids.unpaid, assessment_kind: "personal_time", reason: "x" });
    expect(ok.status).toBeGreaterThanOrEqual(400); // prophetic needs the student's choice and the instructor's authorization first
    expect(ok.text).toMatch(/choice of Prophetic Worship Development and your authorization/);
  });

  test("a student can decline an invitation at no cost; the instructor can then suggest something else", async ({ browser }) => {
    await svc("dp_record_package_purchase", { student: F.ids.multi, tier: tierId, quantity: 1, order_id: "acc-other-1", line_item_id: "1", sku: "wc-access-test", pay_status: "paid", plan_ref: null });
    const made = await rest("instructor", "rpc/dp_assessment_assign", { method: "POST", body: JSON.stringify({ student: F.ids.multi, assessment_kind: "creative_expression", reason: "Fits her goals" }) });
    expect(made.status, await made.clone().text()).toBeLessThan(300);
    const s = await login(browser, "multi");
    await s.page.goto("/voice/assessments");
    await s.page.getByRole("link", { name: "Review the invitation" }).click();
    await s.page.getByRole("button", { name: "No thanks" }).click();
    await expect(s.page.getByText("You chose not to take this one. Nothing is lost")).toBeVisible();
    await s.ctx.close();
    const row = (await (await rest("instructor", `dp_voice_assessments?select=status&student_id=eq.${F.ids.multi}`)).json())[0];
    expect(row.status).toBe("declined");
  });

  test("a refund closes the new work but keeps everything that exists; the student's answers and the instructor's notes are untouched", async ({ browser }) => {
    const before = await (await rest("instructor", `dp_voice_assessments?select=id,status,assign_reason&student_id=eq.${F.ids.unpaid}`)).json();
    expect(before).toHaveLength(1);
    await svc("dp_record_package_purchase", { student: F.ids.unpaid, tier: tierId, quantity: 1, order_id: "acc-unpaid-1", line_item_id: "1", sku: "wc-access-test", pay_status: "refunded", plan_ref: null });
    const access = (await (await rest("unpaid", "rpc/dp_voice_my_access", { method: "POST", body: "{}" })).json()) as { paid: boolean; status: string };
    expect(access).toMatchObject({ paid: false, status: expect.stringMatching(/refunded|paid/) });
    expect(await (await rest("instructor", `dp_voice_assessments?select=id,status,assign_reason&student_id=eq.${F.ids.unpaid}`)).json()).toEqual(before); // nothing deleted
    const u = await login(browser, "unpaid");
    await u.page.goto("/voice/assessments");
    await expect(u.page.getByRole("note").filter({ hasText: "Assessments opens after your payment is confirmed" })).toBeVisible();
    await expect(u.page.getByText("Your coach chose this because")).toBeVisible(); // the record is still there
    await u.page.getByRole("link", { name: "Start" }).click();
    await expect(u.page.getByRole("note").filter({ hasText: "This assessment opens after your payment is confirmed" })).toBeVisible();
    await expect(u.page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
    await u.ctx.close();
  });

  test("the Vocal Demo is the baseline for progress checks: no separate baseline is collected, and the comparison says so", async ({ browser }) => {
    const sid = F.ids.voiceOnly;
    await rest("instructor", "rpc/dp_voice_record_demo", { method: "POST", body: JSON.stringify({ student: sid, rate: { "posture-breath": 2, "pitch-ear": 3 }, good: "Nice tone", focus: "Breath", private_notes: "", share: true }) });
    const mk = (seq: number, area: string, title: string, keys: string[]) => ({ seq, week: seq, area_key: area, area_title: title, level: "beginner", objective: `Objective ${seq}`, exercise_keys: keys });
    const plan = await (await rest("instructor", "rpc/dp_plan_save", { method: "POST", body: JSON.stringify({ pid: null, student: sid, plan_title: "Plan", ptype: "monthly", units: [mk(1, "posture-breath", "Posture and breath management", ["stance-check"]), mk(2, "pitch-ear", "Pitch accuracy and ear training", ["match-one-note"])], plan_basis: [], plan_notes: [], rationale: {}, instructor_notes: null }) })).json();
    expect((await tryRpc("voiceOnly", "dp_plan_activate", { pid: plan })).status).toBeGreaterThanOrEqual(400); // only the instructor approves
    expect(await (await rest("voiceOnly", "dp_voice_plans?select=id")).json()).toEqual([]); // a draft is invisible to the student
    await rest("instructor", "rpc/dp_plan_activate", { method: "POST", body: JSON.stringify({ pid: plan }) });
    expect(await (await rest("voiceOnly", "dp_voice_plans?select=id")).json()).toHaveLength(1);

    const { ctx, page } = await login(browser, "instructor");
    await page.goto(`/staff/voice/development/${sid}`);
    await page.getByLabel("Week", { exact: true }).fill("6");
    await page.getByLabel("Kind").selectOption({ label: "Mid-program check" });
    await page.getByLabel("Rating for Posture and breath management", { exact: true }).selectOption({ index: 4 });
    await page.getByLabel("Rating for Pitch accuracy and ear training", { exact: true }).selectOption({ index: 3 });
    await page.getByLabel("Share with the student now").check();
    await page.getByRole("button", { name: "Save progress check" }).click();
    await expect(page.getByText("Saved and shared.")).toBeVisible();
    await page.reload();
    const table = page.getByRole("table", { name: /Skill ratings/ });
    await expect(table.getByRole("row", { name: /Posture and breath/ })).toContainText("+2"); // 2 at the demo, 4 now
    await expect(table.getByRole("row", { name: /Pitch accuracy/ })).toContainText("no change");
    await ctx.close();
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice/plan");
    await expect(s.page.getByText("Your Vocal Demo: where you started")).toBeVisible();
    await expect(s.page.getByRole("table", { name: /Skill ratings/ }).getByRole("row", { name: /Posture and breath/ })).toContainText("+2");
    await s.ctx.close();
  });
});

test.describe.serial("offline payments, complimentary access and enrollment (authorized staff only, audited)", () => {
  test.beforeAll(() => { execSync("node testing/local-supabase/run.mjs seed", { stdio: "pipe", timeout: 120000 }); });

  test("a scoped teacher can see the student but cannot verify payments, grant access or enroll", async ({ browser }) => {
    const t = await login(browser, "scopedTeacher");
    await t.page.goto(`/staff/voice/development/${F.ids.unpaid}`);
    // a teacher with no Voice responsibility gets no student page at all, and in no case a payment or enrollment control
    await expect(t.page.getByRole("button", { name: /Verify and record payment|Grant complimentary access|Enroll in Voice/ })).toHaveCount(0);
    const r = await rest("scopedTeacher" as never, "rpc/dp_voice_record_access_grant", { method: "POST", body: JSON.stringify({ student: F.ids.unpaid, tier: "00000000-0000-4000-8000-000000000001", grant_kind: "offline_payment", grant_method: "cash", grant_reference: "x", grant_reason: "", paid_on: "2026-11-01", amount: null, assessments: null, expiry: null }) });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await rest("scopedTeacher" as never, "rpc/dp_voice_enroll_student", { method: "POST", body: JSON.stringify({ student: F.ids.prospect, enroll_note: null }) })).status).toBeGreaterThanOrEqual(400);
    await t.ctx.close();
  });

  test("faculty verifies a cash payment: the person becomes eligible but is NOT enrolled until the instructor enrolls them", async ({ browser }) => {
    const programs = await (await rest("instructor", "dp_programs?select=id&slug=eq.vocal-coaching")).json();
    const made = await rest("instructor", "dp_coaching_tiers", { method: "POST", body: JSON.stringify({ program_id: programs[0].id, slug: "offline-test", name: "Offline test package", lesson_minutes: 60, lesson_count: 4, installments: 1, woo_product_ids: [] }) });
    expect(made.status, await made.clone().text()).toBeLessThan(300);
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice/development");
    await page.getByLabel(/Person's account email/).fill(F.users.prospect.email);
    await page.getByRole("button", { name: "Invite to complete intake" }).click();
    await expect(page.getByText(/Invited\./)).toBeVisible();
    await page.goto(`/staff/voice/development/${F.ids.prospect}`);
    await expect(page.getByText("No verified payment or complimentary access yet.")).toBeVisible();
    const verify = page.getByRole("button", { name: "Verify and record payment" });
    await expect(verify).toBeDisabled(); // a reference is required
    await page.getByLabel("How was it paid?").selectOption({ label: "Cash" });
    await page.getByLabel(/Receipt, check or transaction reference/).fill("Receipt #204, cash at the studio");
    await page.getByLabel(/Amount received/).fill("180");
    await verify.click();
    await expect(page.getByText("Offline payment verified and recorded.")).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Access is open through a verified offline payment/)).toBeVisible();
    await expect(page.getByText(/Eligible, but not enrolled: enrollment is your decision/)).toBeVisible();
    await expect(page.getByLabel("Access records")).toContainText("Offline payment · Cash");
    await expect(page.getByLabel("Access records")).toContainText("Reference: Receipt #204, cash at the studio · $180.00");
    expect(await (await rest("instructor", `dp_enrollments?select=id&user_id=eq.${F.ids.prospect}`)).json()).toEqual([]); // eligibility is not enrollment
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Enroll in Voice" }).click();
    await expect(page.getByText("Enrolled in Voice.")).toBeVisible();
    expect(await (await rest("instructor", `dp_enrollments?select=id&user_id=eq.${F.ids.prospect}`)).json()).toHaveLength(1);
    await page.reload();
    await page.getByText(/Audit trail \(2\)/).click();
    await expect(page.getByText(/payment recorded/)).toBeVisible();
    await expect(page.getByText(/enrolled/).first()).toBeVisible();
    await ctx.close();
    // the student now has access to what opens after payment
    const s = await login(browser, "prospect");
    await s.page.goto("/voice/assessments");
    await expect(s.page.getByRole("note").filter({ hasText: "opens after your payment" })).toHaveCount(0);
    await s.ctx.close();
  });

  test("complimentary access is recorded as complimentary, with a reason, and can be revoked without deleting anything", async ({ browser }) => {
    const { ctx, page } = await login(browser, "admin");
    await page.goto(`/staff/voice/development/${F.ids.unpaid}`);
    await page.getByLabel("What is this?").selectOption({ label: "Complimentary access (no payment)" });
    const grant = page.getByRole("button", { name: "Grant complimentary access" });
    await expect(grant).toBeDisabled(); // a reason is required
    await expect(page.getByLabel(/Amount received/)).toHaveCount(0); // never presented as a payment
    await page.getByLabel(/Why is this complimentary/).fill("Worship team scholarship");
    await grant.click();
    await expect(page.getByText("Complimentary access recorded.")).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Access is open through complimentary access \(not a payment\)/)).toBeVisible();
    await expect(page.getByLabel("Access records")).toContainText("Complimentary access (not a payment)");
    await expect(page.getByLabel("Access records")).toContainText("Reason: Worship team scholarship");
    page.once("dialog", (d) => d.accept("Scholarship ended"));
    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText(/Access revoked\. Everything the student has already done stays\./)).toBeVisible();
    await page.reload();
    await expect(page.getByText("No verified payment or complimentary access yet.")).toBeVisible();
    await expect(page.getByLabel("Access records")).toContainText("REVOKED");
    await ctx.close();
    // the student can still read their own record
    expect(await (await rest("unpaid", "dp_voice_intakes?select=id")).json()).toBeDefined();
  });

  test("a package can leave assessments to the instructor (blank) instead of defaulting to zero", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice/packages");
    await page.getByLabel("Name", { exact: true }).fill("Blank entitlement test");
    const field = page.getByLabel(/Assessments included/);
    await expect(field).toHaveValue("");
    await expect(field).toHaveAttribute("placeholder", "Blank = instructor decides");
    await page.getByRole("button", { name: "Create package" }).click();
    await expect(page.getByText("Package created.")).toBeVisible();
    const rows = await (await rest("instructor", "dp_coaching_tiers?select=assessments_included&name=eq.Blank entitlement test")).json();
    expect(rows).toEqual([{ assessments_included: null }]);
    await ctx.close();
  });
});
