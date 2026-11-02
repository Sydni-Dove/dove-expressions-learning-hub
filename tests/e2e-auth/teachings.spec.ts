import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { F, login, rest } from "./helpers";

/** Worship Development teachings through the real app: instructor-assigned only, student sees student content, instructor notes stay private. */
const M3 = "The Psyche of a Praiser";
const CORE = /The youngest in the Kingdom may face some of the hardest challenges/;

test.describe.serial("worship development teachings", () => {
  test.beforeAll(() => { execSync("node testing/local-supabase/run.mjs seed", { stdio: "pipe", timeout: 120000 }); });

  test("nothing is assigned automatically: a student sees no teaching and no link", async ({ browser }) => {
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice");
    await expect(s.page.getByRole("link", { name: "Worship Development" })).toHaveCount(0);
    await s.page.goto("/voice/worship");
    await expect(s.page.getByText(/has not assigned a teaching yet/)).toBeVisible();
    await s.page.goto("/voice/worship/psyche-of-a-praiser");
    await expect(s.page.getByRole("heading", { name: /Psyche of a Praiser/ })).toHaveCount(0);
    await s.ctx.close();
  });

  test("the instructor sees the library, private notes, and assigns Module 3 to one paid student", async ({ browser }) => {
    const i = await login(browser, "instructor");
    await i.page.goto("/staff/voice/worship");
    for (const t of ["Praise Is What I Do", "The Importance of Being in the Word", M3]) await expect(i.page.getByRole("heading", { name: new RegExp(t) })).toBeVisible();
    await i.page.goto("/staff/voice/worship/psyche-of-a-praiser");
    await expect(i.page.getByRole("heading", { name: "Instructor teaching notes (private)" })).toBeVisible();
    await expect(i.page.getByText("Gifted but Still Growing: When the Platform Comes Before Spiritual Maturity").first()).toBeVisible();
    await expect(i.page.getByText("How to Protect and Develop Spiritually Young Worshipers").first()).toBeVisible();
    const options = await i.page.getByRole("region", { name: "Assign to a student" }).locator("select").locator("option").allTextContents();
    expect(options.join("|")).toContain(F.users.voiceOnly.name);
    expect(options.join("|")).not.toContain(F.users.unpaid.name); // unpaid students cannot be assigned new material
    await i.page.getByRole("region", { name: "Assign to a student" }).locator("select").selectOption({ label: F.users.voiceOnly.name });
    await i.page.getByLabel(/Personal note/).fill("Take your time with this one.");
    await i.page.getByRole("button", { name: "Assign this teaching" }).click();
    await expect(i.page.getByText(/Assigned\. The student can now open this teaching/)).toBeVisible();
    await expect(i.page.getByRole("list").filter({ hasText: F.users.voiceOnly.name }).first()).toBeVisible();
    await i.ctx.close();
  });

  test("the assigned student reads the teaching but never the instructor notes, and it appears as an assignment", async ({ browser }) => {
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice");
    await s.page.getByRole("link", { name: "Worship Development" }).click();
    await expect(s.page.getByRole("heading", { name: /Psyche of a Praiser/ })).toBeVisible();
    await expect(s.page.getByRole("heading", { name: /Praise Is What I Do/ })).toHaveCount(0); // only what was assigned
    await s.page.getByRole("link", { name: "Open this teaching" }).click();
    await expect(s.page.getByRole("heading", { name: "Gifted but Still Growing: When the Platform Comes Before Spiritual Maturity" })).toBeVisible();
    await expect(s.page.getByText(CORE)).toBeVisible();
    await expect(s.page.getByRole("heading", { name: "How to Protect and Develop Spiritually Young Worshipers" })).toBeVisible();
    await expect(s.page.getByRole("heading", { name: "Personal reflection" })).toBeVisible();
    await expect(s.page.getByRole("heading", { name: /Take-home assignment/ })).toBeVisible();
    for (const hidden of [/Instructor teaching notes/, /Facilitation tips/, /Cautions/, /988/]) await expect(s.page.getByText(hidden)).toHaveCount(0);
    await s.page.goto("/assignments");
    await expect(s.page.getByText(/The Psyche of a Praiser/).first()).toBeVisible();
    // the database refuses to return instructor notes to a student
    expect(await (await rest("voiceOnly", "dp_voice_teaching_module_private?select=module_id")).json()).toEqual([]);
    const mods = await (await rest("voiceOnly", "dp_voice_teaching_modules?select=key")).json();
    expect(mods).toEqual([{ key: "psyche-of-a-praiser" }]);
    await s.ctx.close();
  });

  test("another student cannot see it, by page or by direct data request", async ({ browser }) => {
    const o = await login(browser, "multi");
    await o.page.goto("/voice/worship");
    await expect(o.page.getByRole("heading", { name: /Psyche of a Praiser/ })).toHaveCount(0);
    await o.page.goto("/voice/worship/psyche-of-a-praiser");
    await expect(o.page.getByRole("heading", { name: /Psyche of a Praiser/ })).toHaveCount(0);
    expect(await (await rest("multi", "dp_voice_teaching_modules?select=key")).json()).toEqual([]);
    await o.ctx.close();
  });

  test("the teaching is readable on a phone without horizontal scrolling", async ({ browser }) => {
    const s = await login(browser, "voiceOnly");
    await s.page.setViewportSize({ width: 375, height: 800 });
    await s.page.goto("/voice/worship/psyche-of-a-praiser");
    await expect(s.page.getByText(CORE)).toBeVisible();
    expect(await s.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await s.ctx.close();
  });
});
