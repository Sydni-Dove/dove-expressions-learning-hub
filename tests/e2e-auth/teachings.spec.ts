import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { F, expectNoHorizontalOverflow, login, rest } from "./helpers";

/** The Teaching Editor through the real app: editing, autosave, review and publishing, instructor-only notes, versions, assignment and student visibility. */
const KEY = "praise-is-what-i-do";
const CORE = /The youngest in the Kingdom may face some of the hardest challenges/;
const saved = (p: Page) => expect(p.getByTestId("save-indicator")).toContainText(/All changes saved/, { timeout: 15000 });
const open = async (p: Page, name: string) => { const b = p.getByRole("button", { name: new RegExp(`^\\d+\\s+${name}`) }).first(); if ((await b.getAttribute("aria-expanded")) !== "true") await b.click(); };
const tab = (p: Page, name: string) => p.getByRole("tab", { name }).click();
const accept = (p: Page) => p.on("dialog", (d) => void d.accept());

test.describe.serial("teaching editor", () => {
  test.beforeAll(() => { execSync("node testing/local-supabase/run.mjs seed", { stdio: "pipe", timeout: 120000 }); });

  test("the three manuscripts arrive for review, hidden from students, and categorized", async ({ browser }) => {
    const i = await login(browser, "instructor");
    await i.page.goto("/staff/voice/worship");
    await expect(i.page.getByText(/3 teachings are waiting for your review/)).toBeVisible();
    for (const t of ["Praise Is What I Do", "The Importance of Being in the Word", "The Psyche of a Praiser"]) await expect(i.page.getByRole("heading", { name: new RegExp(t) }).first()).toBeVisible();
    await expect(i.page.getByRole("heading", { name: "Spiritual Foundations" })).toBeVisible();
    await expect(i.page.getByRole("heading", { name: "Personal and Ministry Development" })).toBeVisible();
    await expect(i.page.locator("ul li").getByText("Published", { exact: true })).toHaveCount(0);
    await i.ctx.close();
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice/worship"); await expect(s.page.getByText(/has not assigned a teaching yet/)).toBeVisible();
    await s.page.goto("/voice"); await expect(s.page.getByRole("link", { name: "Worship Development" })).toHaveCount(0);
    expect(await (await rest("voiceOnly", "dp_voice_teaching_drafts?select=title")).json()).toEqual([]);
    expect(await (await rest("voiceOnly", "dp_voice_teachings?select=key")).json()).toEqual([]);
    expect(await (await rest("voiceOnly", "dp_voice_teaching_versions?select=id")).json()).toEqual([]);
    await s.ctx.close();
  });

  test("a scoped teacher without Voice access cannot open the editor", async ({ browser }) => {
    const t = await login(browser, "scopedTeacher");
    await t.page.goto(`/staff/voice/worship/${KEY}`);
    await expect(t.page.getByTestId("teaching-editor")).toHaveCount(0);
    await t.ctx.close();
  });

  test("just opening a teaching (and all its tabs) never changes it: no save, no new history, status stays ready for review", async ({ browser }) => {
    const i = await login(browser, "instructor");
    for (const k of ["praise-is-what-i-do", "being-in-the-word", "psyche-of-a-praiser"]) {
      await i.page.goto(`/staff/voice/worship/${k}`); await expect(i.page.getByTestId("status-badge")).toHaveText("Ready for review");
      for (const t of ["Instructor notes", "Details", "Preview", "History", "Student lesson"]) await tab(i.page, t);
      await i.page.waitForTimeout(2500);
      await expect(i.page.getByTestId("save-indicator")).toContainText("All changes saved"); await expect(i.page.getByTestId("status-badge")).toHaveText("Ready for review");
    }
    const rows = await (await rest("instructor", "dp_voice_teachings?select=key,status,draft_rev&order=key")).json();
    expect(rows.map((r: any) => [r.status, r.draft_rev])).toEqual([["ready_for_review", 1], ["ready_for_review", 1], ["ready_for_review", 1]]);
    expect((await (await rest("instructor", "dp_voice_teaching_revisions?select=id")).json()).length).toBe(3); // only the three imports
    await i.ctx.close();
  });

  test("edits autosave with clear indicators, survive a reload, and instructor notes stay in their own tab", async ({ browser }) => {
    const i = await login(browser, "instructor");
    await i.page.goto(`/staff/voice/worship/${KEY}`);
    await expect(i.page.getByTestId("status-badge")).toHaveText("Ready for review");
    await expect(i.page.getByLabel("Title", { exact: true })).toHaveValue(/Praise Is What I Do/);
    await i.page.getByLabel("Title", { exact: true }).fill("Praise Is What I Do (edited)");
    await expect(i.page.getByTestId("save-indicator")).toContainText(/Unsaved changes|Saving/);
    await saved(i.page);
    await expect(i.page.getByTestId("status-badge")).toHaveText("Draft"); // editing a teaching that was waiting for review sends it back to draft
    // rich text: type into the Introduction section
    await open(i.page, "Introduction");
    const box = i.page.getByRole("textbox", { name: "Introduction text" });
    await box.click(); await i.page.keyboard.press("Control+End"); await i.page.keyboard.type(" Added by the instructor.");
    await saved(i.page);
    // formatting buttons work
    await box.click(); await i.page.keyboard.press("ControlOrMeta+A"); await i.page.getByRole("button", { name: "Bold" }).click();
    await saved(i.page);
    await i.page.reload();
    await expect(i.page.getByLabel("Title", { exact: true })).toHaveValue("Praise Is What I Do (edited)");
    await open(i.page, "Introduction");
    await expect(i.page.getByRole("textbox", { name: "Introduction text" })).toContainText("Added by the instructor.");
    await expect(i.page.getByRole("textbox", { name: "Introduction text" }).locator("strong").first()).toBeVisible();
    // instructor notes live in their own tab, labelled private
    await tab(i.page, "Instructor notes");
    await expect(i.page.getByText(/never published or shown to students/)).toBeVisible();
    await expect(i.page.getByText("Facilitation tips").first()).toBeVisible();
    await i.ctx.close();
  });

  test("sections can be added, duplicated, reordered and removed; media addresses must be https", async ({ browser }) => {
    const i = await login(browser, "instructor");
    await i.page.goto(`/staff/voice/worship/${KEY}`); accept(i.page);
    const count = () => i.page.getByRole("button", { name: /^\d+\s/ }).count();
    const before = await count();
    await i.page.getByLabel("Section type").first().selectOption("scripture");
    await i.page.getByRole("button", { name: "+ Add section" }).first().click();
    await i.page.getByPlaceholder("Section heading").fill("Psalm 150");
    await i.page.getByRole("textbox", { name: /Psalm 150 text/ }).click(); await i.page.keyboard.type("Let everything that has breath praise the Lord.");
    await expect.poll(count).toBe(before + 1);
    await i.page.getByRole("button", { name: "Duplicate section" }).first().click();
    await expect.poll(count).toBe(before + 2);
    await expect(i.page.getByRole("button", { name: /Psalm 150 \(copy\)/ })).toBeVisible();
    await i.page.getByRole("button", { name: "Move down" }).first().click(); // reorder
    // media
    await i.page.getByRole("button", { name: "+ Add media" }).first().click();
    await i.page.getByLabel("Media address").first().fill("javascript:alert(1)");
    await expect(i.page.getByText(/must be a valid https/)).toBeVisible();
    await i.page.getByLabel("Media address").first().fill("https://youtu.be/dQw4w9WgXcQ");
    await i.page.getByLabel("Media title").first().fill("Demonstration");
    await saved(i.page);
    await i.page.getByRole("button", { name: "Delete section" }).nth(1).click(); // remove the original, keep the copy that carries the media
    await expect.poll(count).toBe(before + 1);
    await saved(i.page);
    await i.page.reload(); expect(await count()).toBe(before + 1);
    await i.ctx.close();
  });

  test("preview shows exactly the student lesson and never the instructor notes", async ({ browser }) => {
    const i = await login(browser, "instructor");
    await i.page.goto(`/staff/voice/worship/${KEY}`); await tab(i.page, "Preview");
    await expect(i.page.getByRole("heading", { name: "Praise Is What I Do (edited)" })).toBeVisible();
    await expect(i.page.getByText("Added by the instructor.")).toBeVisible();
    await expect(i.page.locator("iframe[src*='youtube-nocookie.com/embed/dQw4w9WgXcQ']")).toHaveCount(1);
    for (const hidden of [/Facilitation tips/, /Suggested timing/, /Teaching script/]) await expect(i.page.getByText(hidden)).toHaveCount(0);
    await i.ctx.close();
  });

  test("approval and publishing are explicit; nothing is assignable or visible until then", async ({ browser }) => {
    const i = await login(browser, "instructor");
    await i.page.goto(`/staff/voice/worship/${KEY}`);
    await tab(i.page, "Assign"); await expect(i.page.getByText(/not published, so it cannot be assigned/)).toBeVisible();
    await i.page.getByRole("button", { name: "Mark ready for review" }).click();
    await expect(i.page.getByRole("alertdialog")).toBeVisible();
    await i.page.getByRole("button", { name: "Yes, continue" }).click();
    await expect(i.page.getByTestId("status-badge")).toHaveText("Ready for review");
    expect(await (await rest("voiceOnly", "dp_voice_teaching_versions?select=id")).json()).toEqual([]);
    await i.page.getByRole("button", { name: "Approve and publish" }).click();
    await expect(i.page.getByRole("alertdialog")).toContainText(/never your instructor notes/);
    await i.page.getByRole("button", { name: "Yes, continue" }).click();
    await expect(i.page.getByTestId("status-badge")).toHaveText("Published");
    await expect(i.page.getByText("Published version 1")).toBeVisible();
    expect(await (await rest("voiceOnly", "dp_voice_teaching_versions?select=id")).json()).toEqual([]); // published is still not assigned
    await i.ctx.close();
  });

  test("the instructor assigns it with personal customization; only that student receives it", async ({ browser }) => {
    const i = await login(browser, "instructor");
    await i.page.goto(`/staff/voice/worship/${KEY}`); await tab(i.page, "Assign");
    const options = await i.page.getByRole("region", { name: "Assign to a student" }).locator("select").locator("option").allTextContents();
    expect(options.join("|")).toContain(F.users.voiceOnly.name); expect(options.join("|")).not.toContain(F.users.unpaid.name);
    await i.page.getByRole("region", { name: "Assign to a student" }).locator("select").selectOption({ label: F.users.voiceOnly.name });
    await i.page.getByLabel(/Personal instructions/).fill("Take your time with this one.");
    await i.page.getByLabel(/Reflection questions/).fill("What does worship look like on a Monday?");
    await i.page.getByLabel(/Homework/).fill("Sing a psalm to God daily\nJournal what you notice");
    await i.page.getByRole("button", { name: "+ Add resource" }).click();
    await i.page.getByLabel("Resource 1 title").fill("Worship playlist"); await i.page.getByLabel("Resource 1 address").fill("https://example.org/playlist");
    await i.page.getByRole("button", { name: "Assign this teaching" }).click();
    await expect(i.page.getByText(/Assigned\. The student can now open/)).toBeVisible();
    await expect(i.page.getByText(/received version 1/)).toBeVisible();
    await i.ctx.close();

    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice"); await s.page.getByRole("link", { name: "Worship Development" }).click();
    await s.page.getByRole("link", { name: "Open this teaching" }).click();
    await expect(s.page.getByRole("heading", { name: "Praise Is What I Do (edited)" })).toBeVisible();
    await expect(s.page.getByText("Version 1")).toBeVisible();
    await expect(s.page.getByText("Take your time with this one.")).toBeVisible();
    await expect(s.page.getByText("What does worship look like on a Monday?")).toBeVisible();
    await expect(s.page.getByText("Sing a psalm to God daily")).toBeVisible();
    await expect(s.page.getByRole("link", { name: "Worship playlist" })).toHaveAttribute("href", "https://example.org/playlist");
    for (const hidden of [/Facilitation tips/, /Suggested timing/, /Cautions/]) await expect(s.page.getByText(hidden)).toHaveCount(0);
    expect(await (await rest("voiceOnly", "dp_voice_teaching_drafts?select=title")).json()).toEqual([]);
    const rows = await (await rest("voiceOnly", "dp_voice_teaching_versions?select=*")).json();
    expect(Object.keys(rows[0])).not.toContain("instructor"); expect(JSON.stringify(rows)).not.toMatch(/Facilitation tips|Suggested timing|Teaching script/);
    await s.page.goto("/assignments"); await expect(s.page.getByText(/Praise Is What I Do \(edited\)/).first()).toBeVisible();
    await s.ctx.close();
    const m = await login(browser, "multi");
    await m.page.goto("/voice/worship"); await expect(m.page.getByRole("heading", { name: /Praise Is What I Do/ })).toHaveCount(0);
    expect(await (await rest("multi", "dp_voice_teaching_versions?select=id")).json()).toEqual([]);
    await m.ctx.close();
  });

  test("editing after students have it: they keep their version and their work; the update is published explicitly", async ({ browser }) => {
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/assignments");
    const a = await (await rest("voiceOnly", "dp_assignments?select=id&teaching_id=not.is.null")).json();
    const sub = await rest("voiceOnly", "dp_submissions", { method: "POST", body: JSON.stringify({ assignment_id: a[0].id, student_id: F.ids.voiceOnly, content: { text: "My finished reflection" }, status: "submitted" }) });
    expect(sub.status, await sub.clone().text()).toBeLessThan(300);
    await s.ctx.close();

    const i = await login(browser, "instructor");
    await i.page.goto(`/staff/voice/worship/${KEY}`);
    await i.page.getByLabel("Title", { exact: true }).fill("Praise Is What I Do — second edition"); await saved(i.page);
    await expect(i.page.getByTestId("status-badge")).toHaveText("Published");
    await expect(i.page.getByText("Unpublished changes")).toBeVisible();
    await i.page.getByRole("button", { name: "Publish update" }).click(); await i.page.getByRole("button", { name: "Yes, continue" }).click();
    await expect(i.page.getByText("Published version 2")).toBeVisible();
    await i.ctx.close();

    const s2 = await login(browser, "voiceOnly");
    await s2.page.goto("/voice/worship");
    await expect(s2.page.getByRole("heading", { name: "Praise Is What I Do (edited)" })).toBeVisible(); // still the version they received
    await expect(s2.page.getByRole("heading", { name: /second edition/ })).toHaveCount(0);
    const subs = await (await rest("voiceOnly", "dp_submissions?select=content")).json();
    expect(subs.map((x: any) => x.content)).toContainEqual({ text: "My finished reflection" });
    await s2.ctx.close();
  });

  test("history lists earlier versions and restores one into the draft without touching published versions", async ({ browser }) => {
    const i = await login(browser, "instructor"); accept(i.page);
    await i.page.goto(`/staff/voice/worship/${KEY}`); await tab(i.page, "History");
    await expect(i.page.getByText("Imported from the original manuscript").first()).toBeVisible();
    await expect(i.page.getByText(/Published — Version 2/)).toBeVisible();
    await i.page.getByRole("listitem").filter({ hasText: "Imported from the original manuscript" }).getByRole("button", { name: "Restore this version" }).click();
    await i.page.getByRole("button", { name: "Confirm restore" }).click();
    await expect(i.page.getByText(/Restored into your draft/)).toBeVisible();
    await expect(i.page.getByLabel("Title", { exact: true })).toHaveValue("Praise Is What I Do: Developing a Lifestyle of True Worship");
    await tab(i.page, "History"); await expect(i.page.getByText("Saved before a restore")).toBeVisible();
    await expect(i.page.getByText("Unpublished changes")).toBeVisible(); // restored text is a draft until published
    await i.ctx.close();
    const versions = await (await rest("instructor", `dp_voice_teaching_versions?select=version_no,title&order=version_no`)).json();
    expect(versions.map((v: any) => v.title)).toEqual(["Praise Is What I Do (edited)", "Praise Is What I Do — second edition"]);
  });

  test("archiving stops new assignments but the student keeps the teaching", async ({ browser }) => {
    const i = await login(browser, "instructor");
    await i.page.goto(`/staff/voice/worship/${KEY}`);
    await i.page.getByRole("button", { name: "Archive" }).click(); await i.page.getByRole("button", { name: "Yes, continue" }).click();
    await expect(i.page.getByTestId("status-badge")).toHaveText("Archived");
    await expect(i.page.getByLabel("Title", { exact: true })).toBeDisabled();
    await tab(i.page, "Assign"); await expect(i.page.getByText(/not published, so it cannot be assigned/)).toBeVisible();
    await i.ctx.close();
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice/worship"); await expect(s.page.getByRole("heading", { name: "Praise Is What I Do (edited)" })).toBeVisible();
    await s.ctx.close();
  });

  test("a new teaching can be created from a template or a blank page, stays a draft, and is invisible to students", async ({ browser }) => {
    const i = await login(browser, "instructor");
    await i.page.goto("/staff/voice/worship");
    await i.page.getByRole("button", { name: "+ New teaching" }).click();
    for (const t of ["Bible teaching", "Vocal exercise lesson", "Worship leadership development", "Practical coaching lesson", "Scripture-to-song activity", "Blank page"]) await expect(i.page.getByText(t, { exact: true })).toBeVisible();
    await i.page.getByLabel("Title", { exact: true }).fill("Singing the Psalms");
    await i.page.getByText("Scripture-to-song activity", { exact: true }).click();
    await i.page.getByLabel("Creative Worship Expression").check();
    await i.page.getByLabel("Worship Leadership", { exact: true }).check();
    await i.page.getByRole("button", { name: "Create draft" }).click();
    await i.page.waitForURL(/\/staff\/voice\/worship\/singing-the-psalms-/);
    await expect(i.page.getByTestId("status-badge")).toHaveText("Draft");
    await expect(i.page.getByRole("button", { name: /Scripture-to-song steps/ })).toBeVisible();
    await tab(i.page, "Details");
    await expect(i.page.getByLabel("Creative Worship Expression")).toBeChecked(); await expect(i.page.getByLabel("Worship Leadership", { exact: true })).toBeChecked();
    await tab(i.page, "Instructor notes"); await expect(i.page.getByRole("button", { name: /Teaching script/ })).toBeVisible();
    await i.page.goto("/staff/voice/worship");
    await expect(i.page.getByRole("heading", { name: "Creative Worship Expression" })).toBeVisible();
    await expect(i.page.getByRole("heading", { name: "Singing the Psalms" })).toHaveCount(2); // one teaching, listed under both categories (not duplicated)
    expect((await (await rest("instructor", "dp_voice_teachings?select=id&key=like.singing-the-psalms-*")).json()).length).toBe(1);
    await i.ctx.close();
    expect(await (await rest("voiceOnly", "dp_voice_teachings?select=key&key=like.singing*")).json()).toEqual([]);
  });

  test("an empty student section blocks publishing, and an editor can mark ready but a student cannot call the workflow", async ({ browser }) => {
    const i = await login(browser, "instructor");
    await i.page.goto("/staff/voice/worship"); await i.page.getByRole("link", { name: "Open editor" }).filter({ hasText: "" }).first().click().catch(() => {});
    await i.page.goto("/staff/voice/worship?status=draft");
    await i.page.getByRole("link", { name: "Open editor" }).first().click();
    await i.page.getByRole("button", { name: "Mark ready for review" }).click(); await i.page.getByRole("button", { name: "Yes, continue" }).click();
    await expect(i.page.getByTestId("status-badge")).toHaveText("Ready for review");
    await i.page.getByRole("button", { name: "Approve and publish" }).click();
    await expect(i.page.getByRole("alertdialog")).toContainText(/These student sections are empty/);
    await expect(i.page.getByRole("alertdialog").getByRole("button", { name: "Yes, continue" })).toBeDisabled();
    await i.ctx.close();
    const r = await rest("voiceOnly", "rpc/dp_teaching_status", { method: "POST", body: JSON.stringify({ p_id: F.ids.voiceOnly, p_action: "publish" }) });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  test("the editor works on a phone: quick text changes autosave without sideways scrolling", async ({ browser }) => {
    const i = await login(browser, "instructor", { width: 390, height: 800 });
    await i.page.goto("/staff/voice/worship/being-in-the-word");
    await expectNoHorizontalOverflow(i.page);
    await i.page.getByLabel("Short description").fill("Quick edit from my phone."); await saved(i.page);
    await open(i.page, "Introduction"); await expectNoHorizontalOverflow(i.page);
    await i.page.getByRole("textbox", { name: "Introduction text" }).click(); await i.page.keyboard.type(" Phone edit.");
    await saved(i.page);
    await tab(i.page, "Preview"); await expectNoHorizontalOverflow(i.page);
    await i.page.goto("/staff/voice/worship"); await expectNoHorizontalOverflow(i.page);
    await i.ctx.close();
  });
});
