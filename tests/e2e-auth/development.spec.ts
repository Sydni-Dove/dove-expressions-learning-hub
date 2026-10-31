import { test, expect } from "@playwright/test";
import { F, login, rest, expectNoHorizontalOverflow } from "./helpers";
const studentLink = (page: import("@playwright/test").Page) => page.getByRole("main").getByRole("link", { name: F.users.voiceOnly.name });

test.describe.serial("intake, assessments, plan, progress checks", () => {
  test("student completes the intake and chooses optional tracks; tongues question appears only for the prophetic track", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice/plan");
    await expect(page.getByRole("heading", { name: "My development plan" })).toBeVisible();
    await expect(page.getByText("Your instructor is preparing your plan")).toBeVisible();
    await expect(page.getByText(/singing in tongues/i)).toHaveCount(0);
    await page.getByRole("link", { name: "Tell us your goals" }).click();
    await page.getByLabel("What would you most like to get out of voice coaching?").fill("I want to grow in ad-libbing and prophetic flow in worship.");
    await page.getByRole("group", { name: /Creative Worship Expression is optional/ }).getByLabel("Spontaneous Vocal Expression").check();
    await page.getByRole("group", { name: /Creative Worship Expression is optional/ }).getByLabel("Prophetic Worship Development").check();
    await page.getByRole("button", { name: "Send to my instructor" }).click();
    await page.waitForURL(/\/voice\/plan/);
    await expect(page.getByText("waiting for your instructor").first()).toBeVisible();
    // the tongues option is available only because the prophetic track is ticked, and is optional
    await expect(page.getByLabel(/singing in tongues/i)).toBeVisible();
    await page.getByLabel("Prophetic Worship Development").uncheck();
    await expect(page.getByLabel(/singing in tongues/i)).toHaveCount(0);
    await page.getByLabel("Prophetic Worship Development").check();
    await ctx.close();
  });

  test("instructor approves tracks and assigns assessments; Assessment A is blocked", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice/development");
    await studentLink(page).click();
    await expect(page.getByText("I want to grow in ad-libbing")).toBeVisible();
    await page.getByRole("checkbox", { name: "Spontaneous Vocal Expression" }).check();
    await page.getByRole("checkbox", { name: "Prophetic Worship Development" }).check();
    await page.getByRole("button", { name: "Save approvals" }).click();
    await expect(page.getByText("Approvals saved.")).toBeVisible();
    const opt = page.getByRole("option", { name: /How Does God Speak to You/ });
    await expect(opt).toHaveAttribute("disabled", "");
    await expect(opt).toContainText("awaiting the source document");
    for (const title of ["Personal Time With God", "Creative Vocal Expression"]) {
      await page.getByLabel("Assign an assessment").selectOption({ label: title });
      await expect(page.getByRole("button", { name: "Assign", exact: true })).toBeDisabled(); // an instructor's reason is required
      await page.getByLabel(/Why this fits the student/).fill(`Chosen for this student's goals: ${title}`);
      await page.getByRole("button", { name: "Assign", exact: true }).click();
      await expect(page.getByText("Assigned.")).toBeVisible();
      await page.reload();
    }
    await ctx.close();
  });

  test("student saves a draft, resumes it, and submits; answers stay private", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice/assessments");
    await expect(page.getByText("Personal Time With God", { exact: true })).toBeVisible();
    await page.getByRole("listitem").filter({ hasText: "Personal Time With God" }).getByRole("link", { name: "Start" }).click();
    await expect(page.getByText("You may skip any question")).toBeVisible();
    await page.getByRole("radiogroup", { name: /How often do you currently make intentional time/ }).getByText("Daily", { exact: true }).click();
    await page.getByLabel(/What helps you connect with God/).fill("Quiet instrumental music.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/What helps you connect with God/)).toHaveValue("Quiet instrumental music.");
    await expect(page.getByRole("radiogroup", { name: /How often/ }).locator("input:checked")).toHaveCount(1);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText(/Submitted\. Your instructor will review it privately/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
    // locked: the database refuses edits after submission
    const row = (await (await rest("voiceOnly", "dp_voice_assessments?select=id,status&kind=eq.personal_time")).json())[0];
    expect(row.status).toBe("submitted");
    const upd = await rest("voiceOnly", `rpc/dp_assessment_save`, { method: "POST", body: JSON.stringify({ aid: row.id, a: { q1: "Rarely" } }) });
    expect(upd.status).toBeGreaterThanOrEqual(400);
    // complete the creative assessment too
    await page.goto("/voice/assessments");
    await page.getByRole("listitem").filter({ hasText: "Creative Vocal Expression" }).getByRole("link", { name: "Start" }).click();
    await page.getByRole("radiogroup", { name: /Adding ad-libs over a song/ }).getByText("Not yet", { exact: true }).click();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText(/Submitted/)).toBeVisible();
    await ctx.close();
  });

  test("other people cannot read or open this student's answers", async ({ browser }) => {
    const row = (await (await rest("instructor", "dp_voice_assessments?select=id&kind=eq.personal_time")).json())[0];
    for (const who of ["creative", "stranger", "multi"] as const) {
      expect(await (await rest(who, "dp_voice_assessments?select=id")).json()).toEqual([]);
      expect(await (await rest(who, "dp_voice_intakes?select=id")).json()).toEqual([]);
      const { ctx, page } = await login(browser, who);
      const res = await page.goto(`/voice/assessments/${row.id}`);
      expect(page.url().includes("/voice/assessments/") && res?.status() === 200 && (await page.getByText("Quiet instrumental music").count())).toBeFalsy();
      await ctx.close();
    }
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/staff/voice/development");
    await expect(page).not.toHaveURL(/\/staff\/voice\/development$/);
    await ctx.close();
  });

  test("instructor reviews privately, shares a summary, drafts a plan from findings, approves it and assigns practice", async ({ browser }) => {
    const inst = await login(browser, "instructor");
    await inst.page.goto("/staff/voice/development");
    await expect(inst.page.getByText(/2 to review|\(2 to review\)/)).toBeVisible();
    await studentLink(inst.page).click();
    const personal = inst.page.getByRole("listitem").filter({ hasText: "Personal Time With God" });
    await expect(personal.getByText("Quiet instrumental music.")).toBeVisible();
    await personal.getByLabel(/Private notes/).fill("Private: prefers instrumental flow.");
    await personal.getByLabel(/Summary to share/).fill("You connect best with quiet instrumental music; we will build on that.");
    await personal.getByRole("button", { name: "Save review" }).click();
    await expect(personal.getByText("Review saved.")).toBeVisible();
    await inst.page.reload();
    await inst.page.getByLabel("Program").selectOption("monthly");
    await inst.page.getByRole("button", { name: "Draft from findings" }).click();
    await expect(inst.page.getByText(/^Lesson \d/).first()).toBeVisible();
    await expect(inst.page.getByText("Why (private)").first()).toBeVisible();
    await inst.page.getByRole("button", { name: "Save draft" }).click();
    await expect(inst.page.getByText(/Draft saved\. Nothing is visible to the student/)).toBeVisible();
    await inst.page.reload();
    expect(await (await rest("voiceOnly", "dp_voice_plans?select=id")).json()).toEqual([]); // draft is staff-only
    inst.page.once("dialog", (d) => d.accept());
    await inst.page.getByRole("button", { name: "Approve and share" }).click();
    await expect(inst.page.getByText("Plan approved and shared with the student.")).toBeVisible();
    await inst.page.reload();
    const due = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    await inst.page.getByLabel("Due").first().fill(due);
    await inst.page.getByRole("button", { name: /Assign this lesson's practice/ }).first().click();
    await expect(inst.page.getByText(/Practice assigned for lesson 1/)).toBeVisible();
    await inst.ctx.close();
  });

  test("student sees the approved plan and the shared summary, never the private notes; instructor shares a progress check", async ({ browser }) => {
    const inst = await login(browser, "instructor");
    await inst.page.goto("/staff/voice/development");
    await studentLink(inst.page).click();
    await inst.page.getByLabel("Going well").fill("Breath is steadier.");
    await inst.page.getByLabel("Next focus").fill("Longer phrases.");
    await inst.page.getByLabel(/Private notes \(staff only\)/).last().fill("staff-only progress note");
    await inst.page.getByLabel("Share with the student now").check();
    await inst.page.getByRole("button", { name: "Save progress check" }).click();
    await expect(inst.page.getByText("Saved and shared.")).toBeVisible();
    await inst.ctx.close();

    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice/plan");
    await expect(page.getByText(/Lesson 1 ·/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Open this week's practice/ })).toBeVisible();
    await expect(page.getByText("3–5 minute segments").first()).toBeVisible();
    await expect(page.getByText("Breath is steadier.")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("staff-only progress note");
    await expect(page.locator("body")).not.toContainText("Why (private)");
    expect(await (await rest("voiceOnly", "dp_voice_plan_private?select=*")).json()).toEqual([]);
    expect(await (await rest("voiceOnly", "dp_voice_progress_check_private?select=*")).json()).toEqual([]);
    expect(await (await rest("voiceOnly", "dp_voice_assessment_private?select=*")).json()).toEqual([]);
    await page.goto("/voice/assessments");
    await page.getByRole("listitem").filter({ hasText: "Personal Time With God" }).getByRole("link", { name: "View" }).click();
    await expect(page.getByText("You connect best with quiet instrumental music")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Private: prefers instrumental flow");
    // the assigned practice is the existing assignment workflow
    await page.goto("/assignments");
    await expect(page.getByText(/Week 1/).first()).toBeVisible();
    await ctx.close();
  });

  test("curriculum browser filters and shows the teaching content; sample pathway is labelled and assumes nothing", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice/curriculum");
    await expect(page.getByText("15 areas")).toBeVisible();
    await page.getByLabel("Show").selectOption("tracks");
    await expect(page.getByText("3 areas")).toBeVisible();
    await page.getByLabel("Show").selectOption("all");
    await page.getByLabel("Search").fill("breath");
    await page.getByText("1. Posture and breath management").click();
    await expect(page.getByText("Initial assessment").first()).toBeVisible();
    await expect(page.getByText("Follow-up assessment").first()).toBeVisible();
    await page.goto("/staff/voice/development/sample");
    await expect(page.getByRole("note")).toContainText("not a student record");
    await expect(page.getByRole("note")).toContainText("not assumed");
    for (const sec of await page.getByRole("region", { name: /Scenario/ }).all()) await expect(sec).not.toContainText(/tongues/i); // no scenario plans or assumes it
    await ctx.close();
  });

  test("new pages fit a phone-sized screen with large touch targets", async ({ browser }) => {
    for (const [who, paths] of [["voiceOnly", ["/voice/plan", "/voice/assessments", "/voice/intake"]], ["instructor", ["/staff/voice/development", "/staff/voice/curriculum", "/staff/voice/development/sample"]]] as const) {
      const { ctx, page } = await login(browser, who, { width: 390, height: 844 });
      for (const p of paths) {
        await page.goto(p); await page.waitForLoadState("networkidle");
        await expect(page.locator("h1").first()).toBeVisible();
        await expectNoHorizontalOverflow(page);
        const tiny = await page.evaluate(() => [...document.querySelectorAll("main a, main button, main label")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 24; }).length);
        expect(tiny, p).toBe(0);
      }
      await ctx.close();
    }
  });
});
