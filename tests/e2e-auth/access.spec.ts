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
    await u.page.getByRole("link", { name: "Start" }).click();
    await expect(u.page.getByRole("button", { name: "Save draft" })).toBeVisible();
    await u.ctx.close();
  });

  test("the prophetic assessment still needs the student's choice and the instructor's authorization, even for a paid student", async () => {
    // the package includes 2: one is assigned; assign the second, then the allowance is spent
    const ok = await tryRpc("instructor", "dp_assessment_assign", { student: F.ids.unpaid, assessment_kind: "personal_time", reason: "x" });
    expect(ok.status).toBeGreaterThanOrEqual(400); // prophetic needs the student's choice and the instructor's authorization first
    expect(ok.text).toMatch(/choice of Prophetic Worship Development and your authorization/);
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
