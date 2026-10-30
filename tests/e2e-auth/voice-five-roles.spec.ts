import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { F, accessToken, API, ANON, login, rest, type Who } from "./helpers";

test.describe.configure({ mode: "serial" });

const finalPath = async (page: import("@playwright/test").Page, path: string) => {
  await page.goto(path); await page.waitForLoadState("networkidle");
  return new URL(page.url()).pathname;
};
const PLAN = "Week of Nov 2 – foundations";
const REC = Buffer.concat([Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 77, 52, 65, 32]), Buffer.alloc(2048, 7)]);

test.describe("1. Login and dashboard routing", () => {
  const expected: Record<Who, string> = { voiceOnly: "/voice", creative: "/creative-studio", multi: "/dashboard", instructor: "/dashboard", admin: "/dashboard", scopedTeacher: "/dashboard", stranger: "/dashboard" };
  for (const who of Object.keys(expected) as Who[]) {
    test(`${who} lands on ${expected[who]}`, async ({ browser }) => {
      const { ctx, page } = await login(browser, who);
      expect(new URL(page.url()).pathname).toBe(expected[who]);
      await ctx.close();
    });
  }
  test("wrong password is rejected", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type=email]", F.users.voiceOnly.email); await page.fill("input[type=password]", "not-the-password");
    await page.click("button[type=submit]");
    await expect(page.getByRole("alert")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/login");
  });
  test("signed-out visitors are sent to login", async ({ page }) => {
    for (const p of ["/voice", "/voice/resources", "/assignments", "/staff/voice", "/staff/voice/library"]) expect(await finalPath(page, p)).toBe("/login");
  });
});

test.describe("2. Program-specific access", () => {
  test("voice-only student: voice area yes; staff, creative and discipleship no", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    expect(await finalPath(page, "/voice/resources")).toBe("/voice/resources");
    expect(await finalPath(page, "/assignments")).toBe("/assignments");
    for (const p of ["/staff/voice", "/staff/voice/library", "/staff/voice/packages", "/staff/voice/plans", "/staff/voice-reviews", "/staff/dashboard", "/creative-studio", "/discipleship"]) {
      expect(await finalPath(page, p), p).not.toMatch(/^\/(staff|creative-studio|discipleship)/);
    }
    // The unpublished 12-session roadmap is not shown to students.
    expect(await finalPath(page, "/voice/training")).toBe("/voice/resources");
    await ctx.close();
  });
  test("creative-only student cannot enter the voice area", async ({ browser }) => {
    const { ctx, page } = await login(browser, "creative");
    for (const p of ["/voice", "/voice/resources", "/staff/voice"]) expect(await finalPath(page, p), p).toBe("/creative-studio");
    expect(await page.locator("nav").first().innerText()).not.toMatch(/Voice/);
    await ctx.close();
  });
  test("student in both programs reaches both and sees both in navigation", async ({ browser }) => {
    const { ctx, page } = await login(browser, "multi");
    expect(await finalPath(page, "/voice")).toBe("/voice");
    expect(await finalPath(page, "/creative-studio")).toBe("/creative-studio");
    const nav = await page.locator("nav").first().innerText();
    expect(nav).toMatch(/Voice Home/); expect(nav).toMatch(/Creative Studio/);
    expect(await finalPath(page, "/staff/voice")).not.toMatch(/^\/staff/);
    await ctx.close();
  });
  test("instructor and administrator reach the voice staff tools", async ({ browser }) => {
    for (const who of ["instructor", "admin"] as Who[]) {
      const { ctx, page } = await login(browser, who);
      for (const p of ["/staff/voice", "/staff/voice/library", "/staff/voice/plans", "/staff/voice/packages"]) expect(await finalPath(page, p), `${who} ${p}`).toBe(p);
      await ctx.close();
    }
  });
});

test.describe("3. Instructor builds the reusable library, packages, plans and goals", () => {
  test("adds exercises, a template and edits the welcome text", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice/library");
    const add = async (title: string, url: string, skill: string) => {
      await page.getByLabel("Vocal skill").selectOption({ label: skill });
      await page.getByLabel("Title", { exact: true }).fill(title);
      await page.getByLabel("Video link (https, optional)").fill(url);
      await page.getByLabel("What the student should do").fill(`Do ${title} gently.`);
      await page.getByRole("button", { name: "Add exercise" }).click();
      await expect(page.getByRole("status").filter({ hasText: "added to the library" })).toBeVisible();
    };
    await add("Lip trills", "https://www.youtube.com/watch?v=lip-trills", "Breath and posture");
    await add("Five-note scale", "https://vimeo.com/12345", "Pitch and ear training");
    await page.getByLabel("Video link (https, optional)").fill("javascript:alert(1)");
    await page.getByLabel("Title", { exact: true }).fill("Bad link");
    await page.getByRole("button", { name: "Add exercise" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "https://" })).toBeVisible();
    await page.reload();
    await page.getByLabel("Template name").fill("Foundations week");
    await page.getByRole("checkbox", { name: "Lip trills" }).check();
    await page.getByRole("checkbox", { name: "Five-note scale" }).check();
    await page.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Template saved" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Foundations week")).toBeVisible();
    await expect(page.getByText("Bad link")).toHaveCount(0);
    await ctx.close();
  });
  test("creates a package and records it for the voice-only student", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice/packages");
    await page.getByLabel("Name").fill("Monthly 60 (test)");
    await page.getByLabel("Number of lessons").fill("4");
    await page.getByLabel(/Lessons expire after/).fill("45");
    await page.getByLabel("Recording feedback reviews included").fill("2");
    await page.getByLabel("Includes a personalized development plan").check();
    await page.getByRole("button", { name: "Create package" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Package created" })).toBeVisible();
    await page.reload();
    await expect(page.getByText(/4 × 60 min · 45 days · development plan/)).toBeVisible();
    await page.locator('label:has-text("Student") select').selectOption({ label: F.users.voiceOnly.name });
    await page.locator("label", { hasText: /^Package(?!\s+level)/ }).locator("select").selectOption({ label: "Monthly 60 (test)" });
    await page.getByRole("button", { name: "Record package" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Package recorded" })).toBeVisible();
    await ctx.close();
  });
  test("sets a weekly schedule that blocks double-booking", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice");
    const next = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
    const fill = async (student: string) => {
      await page.locator('label:has-text("Student") select').first().selectOption({ label: student });
      await page.getByLabel("First lesson date").fill(next); await page.getByLabel("Start time").fill("10:00");
      await page.getByLabel("Time zone").fill("America/Chicago");
      await page.getByRole("button", { name: "Save schedule" }).click();
    };
    await fill(F.users.voiceOnly.name);
    await expect(page.getByRole("status").filter({ hasText: /Schedule saved and \d+ lesson/ })).toBeVisible();
    await page.reload();
    await fill(F.users.multi.name); // same weekly slot
    await expect(page.getByRole("alert").filter({ hasText: "already taken" })).toBeVisible();
    await ctx.close();
  });
  test("assigns the template as a personal weekly plan, with different goals for different students", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice/plans");
    await page.locator('label:has-text("Student") select').first().selectOption({ label: F.users.voiceOnly.name });
    await page.getByLabel(/Start from a template/).selectOption({ label: "Foundations week" });
    await expect(page.getByRole("checkbox", { name: "Lip trills" })).toBeChecked();
    await page.getByLabel("Plan title").fill(PLAN);
    await page.getByLabel("Note to the student (optional)").fill("Go slowly and stay relaxed.");
    await page.getByLabel("Note for Lip trills").fill("Keep the airflow steady");
    await page.getByRole("button", { name: "Assign plan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Plan assigned" })).toBeVisible();
    await page.reload();
    const goal = async (student: string, text: string) => {
      await page.locator('label:has-text("Student") select').last().selectOption({ label: student });
      await page.getByLabel("Goal", { exact: true }).fill(text);
      await page.getByRole("button", { name: "Add goal" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Goal added" })).toBeVisible();
      await page.reload();
    };
    await goal(F.users.voiceOnly.name, "Sing the bridge in tune");
    await goal(F.users.multi.name, "Build breath stamina");
    await expect(page.getByText(PLAN).first()).toBeVisible();
    await ctx.close();
  });
});

test.describe("3b. Existing lesson-builder assignment personalization (PR #2 feature)", () => {
  for (const who of ["instructor", "admin"] as Who[]) {
    test(`${who} personalizes an assignment for one student from a draft lesson`, async ({ browser }) => {
      const lessons = await (await rest(who, "dp_lessons?select=id,title,dp_modules!inner(course_id,dp_courses!inner(dp_programs!inner(slug)))&dp_modules.dp_courses.dp_programs.slug=eq.vocal-coaching&status=eq.draft&limit=1")).json();
      const lesson = lessons[0];
      const { ctx, page } = await login(browser, who);
      await page.goto(`/staff/courses/${lesson.dp_modules.course_id}/lessons/${lesson.id}/builder`);
      await page.getByRole("button", { name: "+ Assign practice" }).click();
      await page.getByLabel("Student").selectOption({ label: F.users.voiceOnly.name });
      await page.getByLabel("Title").fill(`Builder assignment by ${who}`);
      await page.getByLabel("Song").fill("Amazing Grace");
      await page.getByLabel("Guided practice steps (one per line)").fill("Warm up\nSing verse one");
      await page.getByRole("button", { name: "Save assignment" }).click();
      await expect(page.getByText(`Builder assignment by ${who}`)).toBeVisible();
      await expect(page.getByRole("alert").filter({ hasText: /security|violat|could not|denied/i })).toHaveCount(0);
      await ctx.close();
    });
  }
});

test.describe("4. Student resource area (voice-only student)", () => {
  test("sees welcome, practice guide, plan, library and own goal only", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice/resources");
    await expect(page.getByRole("heading", { name: "Welcome to your vocal coaching space" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How to practice" })).toBeVisible();
    await expect(page.getByRole("heading", { name: PLAN })).toBeVisible();
    await expect(page.getByText("Keep the airflow steady")).toBeVisible();
    const watch = page.getByRole("link", { name: /Watch demonstration \(youtube\.com\)/ });
    await expect(watch).toHaveAttribute("href", "https://www.youtube.com/watch?v=lip-trills");
    await expect(watch).toHaveAttribute("rel", /noopener/);
    await expect(page.getByRole("heading", { name: "Breath and posture" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pitch and ear training" })).toBeVisible();
    await expect(page.getByText("Sing the bridge in tune")).toBeVisible();
    await expect(page.getByText("Build breath stamina")).toHaveCount(0);
    await ctx.close();
  });
  test("dashboard shows next lesson, assignments and remaining lessons from real records", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice");
    await expect(page.getByRole("heading", { name: "Next lesson" })).toBeVisible();
    await expect(page.locator('section[aria-labelledby="next-lesson"]').getByText("60-minute private lesson")).toBeVisible();
    await expect(page.getByText("Lessons remaining").locator("..").locator("..")).toContainText("4");
    await expect(page.getByRole("heading", { name: "Current assignments" }).locator("../..").getByText(PLAN)).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/12-session|12 session/i);
    await ctx.close();
  });
  test("a different student never sees this student's plan, goal or lessons", async ({ browser }) => {
    const { ctx, page } = await login(browser, "multi");
    await page.goto("/voice/resources");
    await expect(page.getByText(PLAN)).toHaveCount(0);
    await expect(page.getByText("Sing the bridge in tune")).toHaveCount(0);
    await expect(page.getByText("Build breath stamina")).toBeVisible();
    await page.goto("/voice");
    await expect(page.getByText("Lessons remaining").locator("..").locator("..")).toContainText("—");
    await ctx.close();
  });
});

test.describe("5. Homework: save, restore, record, submit, review, revise, approve", () => {
  let studentPage: import("@playwright/test").Page, studentCtx: import("@playwright/test").BrowserContext;
  test("saves practice, restores it after reload, uploads a private recording and submits", async ({ browser }) => {
    ({ ctx: studentCtx, page: studentPage } = await login(browser, "voiceOnly"));
    const p = studentPage;
    await p.goto("/assignments");
    const card = p.locator("article", { hasText: PLAN });
    await expect(card.getByRole("list", { name: "Exercises in this plan" })).toContainText("Lip trills");
    await card.getByRole("checkbox", { name: /Lip trills/ }).check();
    await card.getByLabel("Practice minutes").fill("12");
    await card.getByLabel("Practice reflection").fill("Airflow felt steadier today.");
    await card.getByRole("button", { name: "Save progress" }).click();
    await expect(card.getByRole("status")).toContainText("Progress saved");
    await p.reload();
    const again = p.locator("article", { hasText: PLAN });
    await expect(again.getByRole("checkbox", { name: /Lip trills/ })).toBeChecked();
    await expect(again.getByLabel("Practice minutes")).toHaveValue("12");
    await expect(again.getByLabel("Practice reflection")).toHaveValue("Airflow felt steadier today.");
    // too-large and wrong-type files are refused before any upload
    await again.getByLabel(/Record or upload your singing/).setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") });
    await expect(again.getByRole("alert")).toContainText("audio or video");
    await again.getByLabel(/Record or upload your singing/).setInputFiles({ name: "take1.m4a", mimeType: "audio/mp4", buffer: REC });
    await expect(again.getByRole("status")).toContainText("uploaded privately");
    await again.getByRole("checkbox", { name: /Five-note scale/ }).check();
    await again.getByRole("button", { name: "Submit practice" }).click();
    await expect(again.getByRole("status")).toContainText("Practice submitted");
    await p.reload();
    await expect(p.locator("article", { hasText: PLAN }).getByText("Submitted — awaiting instructor review.")).toBeVisible();
    await expect(p.locator("article", { hasText: PLAN }).getByText(/^Attempt 1 · \d/)).toBeVisible();
    await expect(p.locator("article", { hasText: PLAN }).locator("audio")).toHaveCount(1);
    // A student cannot approve their own submitted work, even by calling the API directly.
    const mine = await (await rest("voiceOnly", "dp_submissions?select=id,status")).json();
    const attempt = await rest("voiceOnly", `dp_submissions?id=eq.${mine[0].id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) });
    expect(attempt.status).toBeGreaterThanOrEqual(400);
    expect((await (await rest("voiceOnly", "dp_submissions?select=status")).json())[0].status).toBe("submitted");
  });
  test("instructor sees it in the queue, plays the recording, saves a private note and returns it", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice");
    const row = page.getByRole("heading", { name: "Assignments awaiting review" }).locator("..");
    await expect(row).toContainText(PLAN);
    await row.getByRole("link", { name: new RegExp(PLAN) }).click();
    await page.waitForLoadState("networkidle");
    const src = await page.locator("audio").first().getAttribute("src");
    expect(src).toBeTruthy();
    const res = await page.request.get(src!);
    expect(res.status()).toBe(200);
    expect((await res.body()).length).toBe(REC.length);
    await page.getByLabel("Private note").fill("INSTRUCTOR-ONLY: tends to push on the high note.");
    await page.getByRole("button", { name: "Save private note" }).click();
    await expect(page.getByText("Private note saved")).toBeVisible();
    await page.getByLabel("Feedback shared with the student").fill("Lovely start. Soften the onset on the long note.");
    await page.getByLabel("Update status to").selectOption("returned");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByText("Shared with student")).toBeVisible();
    await ctx.close();
  });
  test("student sees shared feedback but not the private note, revises and resubmits", async () => {
    const p = studentPage;
    await p.goto("/assignments");
    const card = p.locator("article", { hasText: PLAN });
    await expect(card.getByText("Lovely start. Soften the onset on the long note.")).toBeVisible();
    await expect(p.locator("body")).not.toContainText("INSTRUCTOR-ONLY");
    await card.getByLabel("Practice reflection").fill("Softened the onset; felt better.");
    await card.getByRole("button", { name: "Resubmit practice" }).click();
    await expect(card.getByRole("status")).toContainText("Practice submitted");
    await p.reload();
    await expect(p.locator("article", { hasText: PLAN }).getByText(/^Attempt 2 · \d/)).toBeVisible();
    await expect(p.locator("article", { hasText: PLAN }).getByText(/^Attempt 1 · \d/)).toBeVisible();
  });
  test("instructor approves and the student's progress updates automatically", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice");
    await page.getByRole("heading", { name: "Assignments awaiting review" }).locator("..").getByRole("link", { name: new RegExp(PLAN) }).click();
    await expect(page.getByText("Attempt history")).toBeVisible();
    await page.getByLabel("Feedback shared with the student").fill("Well done. Approved.");
    await page.getByLabel("Update status to").selectOption("approved");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByText("Well done. Approved.")).toBeVisible();
    await ctx.close();
    const p = studentPage;
    await p.goto("/voice");
    await expect(p.getByText("Assignments complete").locator("..").locator("..")).toContainText("1/1");
    await expect(p.getByRole("heading", { name: "Instructor feedback" }).locator("../..")).toContainText("Well done. Approved.");
    await expect(p.getByRole("heading", { name: "Your submitted recordings" }).locator("..").locator("audio").first()).toBeVisible();
    await p.goto("/assignments");
    await expect(p.locator("article", { hasText: PLAN }).getByText("Approved by your instructor.")).toBeVisible();
    await studentCtx.close();
  });
  test("student logs progress on a goal", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice/resources#goals");
    const goal = page.locator("article", { hasText: "Sing the bridge in tune" });
    await goal.getByLabel(/How is this going/).fill("Hit the bridge twice this week.");
    await goal.getByRole("radio", { name: /Rating 4/ }).check({ force: true });
    await goal.getByRole("button", { name: "Save progress" }).click();
    await expect(goal.getByRole("status")).toContainText("Progress saved");
    await expect(goal.getByText("Latest self-rating:")).toContainText("4/5");
    await ctx.close();
  });
});

test.describe("6. Unauthorized access prevention", () => {
  test("another student cannot read recordings, submissions, plans, goals or progress", async () => {
    const vid = F.ids.voiceOnly;
    const subs = await (await rest("multi", "dp_submissions?select=id")).json();
    const plans = await (await rest("multi", `dp_assignments?select=id&assigned_to_user_id=eq.${vid}`)).json();
    const goals = await (await rest("multi", `dp_voice_goals?select=id&student_id=eq.${vid}`)).json();
    const attempts = await (await rest("multi", "dp_submission_attempts?select=id")).json();
    expect([subs, plans, goals, attempts].map((x) => x.length)).toEqual([0, 0, 0, 0]);
    const own = await (await rest("voiceOnly", "dp_submissions?select=id,file_urls")).json();
    expect(own.length).toBe(1);
    const ref = (own[0].file_urls[0] as string).replace("storage://", "");
    for (const who of ["multi", "creative", "scopedTeacher"] as Who[]) {
      const t = await accessToken(who);
      const r = await fetch(`${API}/storage/v1/object/authenticated/${ref}`, { headers: { apikey: ANON, authorization: `Bearer ${t}` } });
      expect(r.status, `${who} must not download the recording`).toBeGreaterThanOrEqual(400);
      const sign = await fetch(`${API}/storage/v1/object/sign/${ref}`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 60 }) });
      expect(sign.status, `${who} must not obtain a signed URL`).toBeGreaterThanOrEqual(400);
    }
    const anon = await fetch(`${API}/storage/v1/object/public/${ref}`);
    expect(anon.status).toBeGreaterThanOrEqual(400);
    const owner = await fetch(`${API}/storage/v1/object/authenticated/${ref}`, { headers: { apikey: ANON, authorization: `Bearer ${await accessToken("voiceOnly")}` } });
    expect(owner.status).toBe(200);
  });
  test("a student cannot approve their own work, publish a testimonial, or edit instructor data", async () => {
    const ex = await rest("voiceOnly", "dp_voice_exercises", { method: "POST", body: JSON.stringify({ skill_id: (await (await rest("voiceOnly", "dp_voice_skills?select=id&limit=1")).json())[0].id, title: "Student exercise" }) });
    expect(ex.status).toBeGreaterThanOrEqual(400);
    const pkg = await rest("voiceOnly", "dp_coaching_packages", { method: "POST", body: JSON.stringify({ student_id: F.ids.voiceOnly, program_id: "00000000-0000-0000-0000-000000000000", lesson_minutes: 60, credits_total: 99, payment_status: "paid" }) });
    expect(pkg.status).toBeGreaterThanOrEqual(400);
    const content = await rest("voiceOnly", "dp_voice_resource_content?key=eq.welcome", { method: "PATCH", body: JSON.stringify({ body: "hacked" }) });
    expect(await content.json()).toEqual([]);
  });
  test("an instructor scoped to another program sees no voice students or work", async ({ browser }) => {
    const { ctx, page } = await login(browser, "scopedTeacher");
    await page.goto("/staff/voice"); await page.waitForLoadState("networkidle");
    await expect(page.getByText("No active students yet")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assignments awaiting review" }).locator("..")).not.toContainText(PLAN);
    const roster = await (await rest("scopedTeacher", "rpc/dp_program_students", { method: "POST", body: JSON.stringify({ target_program_slug: "vocal-coaching" }) })).json();
    expect(roster).toEqual([]);
    const subs = await (await rest("scopedTeacher", "dp_submissions?select=id")).json();
    expect(subs).toEqual([]);
    await ctx.close();
  });
});

test.describe("7. Testimonials need consent and approval", () => {
  test("student submits with consent; a second without; creative student cannot submit", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice");
    const form = page.locator("form", { hasText: "Submit for review" });
    await form.getByLabel("Your experience").fill("My confidence has grown so much.");
    await form.getByLabel(/Video testimonial/).setInputFiles({ name: "story.mp4", mimeType: "video/mp4", buffer: REC });
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Submit for review" }).click();
    await expect(form.getByRole("status")).toContainText("submitted for review");
    await form.getByLabel("Your experience").fill("Private thank-you note, not for publication.");
    await form.getByRole("button", { name: "Submit for review" }).click();
    await expect(form.getByRole("status")).toContainText("submitted privately");
    await ctx.close();
    const denied = await rest("creative", "dp_voice_testimonials", { method: "POST", body: JSON.stringify({ student_id: F.ids.creative, review_text: "Not a voice student" }) });
    expect(denied.status).toBeGreaterThanOrEqual(400);
  });
  test("administrator approves both; only the consented one can be published", async ({ browser }) => {
    const { ctx, page } = await login(browser, "admin");
    await page.goto("/staff/voice-reviews");
    const consented = page.locator("article", { hasText: "My confidence has grown so much." });
    const privateOne = page.locator("article", { hasText: "Private thank-you note" });
    await expect(consented.locator("video")).toHaveCount(1);
    await expect(consented.getByRole("button", { name: "Mark as published" })).toHaveCount(0); // not approved yet
    await consented.getByRole("button", { name: "Approve" }).click();
    await expect(consented.getByRole("button", { name: "Mark as published" })).toBeVisible();
    await privateOne.getByRole("button", { name: "Approve" }).click();
    await expect(privateOne.getByText("Public-use permission: not granted")).toBeVisible();
    await expect(privateOne.getByRole("button", { name: "Mark as published" })).toHaveCount(0);
    await consented.getByRole("button", { name: "Mark as published" }).click();
    await expect(consented.getByText("Published")).toBeVisible();
    await consented.getByRole("button", { name: "Unpublish" }).click();
    await expect(consented.getByRole("button", { name: "Mark as published" })).toBeVisible();
    await ctx.close();
    // Even the database refuses a forced publish without consent.
    const rows = await (await rest("admin", "dp_voice_testimonials?select=id,allow_public_use")).json();
    const noConsent = rows.find((r: { allow_public_use: boolean }) => !r.allow_public_use);
    const forced = await rest("admin", `dp_voice_testimonials?id=eq.${noConsent.id}`, { method: "PATCH", body: JSON.stringify({ published_at: new Date().toISOString() }) });
    expect(forced.status).toBeGreaterThanOrEqual(400);
  });
});

test.describe("8. Public testimonial page and consent withdrawal", () => {
  const PUBLIC_TEXT = "Public page words: I found my voice.";
  async function publicVisit(browser: import("@playwright/test").Browser) {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.goto("/testimonials"); await page.waitForLoadState("networkidle");
    return { ctx, page };
  }
  test("a signed-out visitor sees nothing before publication", async ({ browser }) => {
    const { ctx, page } = await publicVisit(browser);
    await expect(page.getByRole("heading", { name: "Student voices" })).toBeVisible();
    await expect(page.getByText("No student stories have been shared yet.")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("My confidence has grown so much.");
    await ctx.close();
  });
  test("student submits, admin approves and publishes, and a visitor can read and watch it", async ({ browser }) => {
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice");
    const form = s.page.locator("form", { hasText: "Submit for review" });
    await form.getByLabel("Your experience").fill(PUBLIC_TEXT);
    await form.getByLabel(/Video testimonial/).setInputFiles({ name: "public.mp4", mimeType: "video/mp4", buffer: REC });
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Submit for review" }).click();
    await expect(form.getByRole("status")).toContainText("submitted for review");
    await s.page.reload();
    await expect(s.page.getByText("Submitted. Waiting for review. Nothing is public until it is approved.").first()).toBeVisible();
    await s.ctx.close();
    const a = await login(browser, "admin");
    await a.page.goto("/staff/voice-reviews");
    const card = a.page.locator("article", { hasText: PUBLIC_TEXT });
    await card.getByRole("button", { name: "Approve" }).click();
    await card.getByRole("button", { name: "Mark as published" }).click();
    await expect(card.getByText("Published")).toBeVisible();
    await a.ctx.close();
    const { ctx, page } = await publicVisit(browser);
    const item = page.locator("li", { hasText: PUBLIC_TEXT });
    await expect(item).toBeVisible();
    await expect(item.getByText("Vera", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Vera Voice"); // first name only
    await expect(page.locator("body")).not.toContainText("Private thank-you note"); // unconsented stays private
    await expect(page.locator("body")).not.toContainText("My confidence has grown so much."); // earlier one was unpublished
    const src = await item.locator("video").getAttribute("src");
    expect((await page.request.get(src!)).status()).toBe(200);
    await ctx.close();
    // The website embed and the JSON feed show the same live list and are never cached.
    const embed = await fetch("http://localhost:3111/testimonials/embed");
    expect(await embed.text()).toContain(PUBLIC_TEXT);
    expect(embed.headers.get("content-security-policy")).toMatch(/frame-ancestors 'self' https:\/\/doveexpressions\.org https:\/\/www\.doveexpressions\.org/);
    expect(embed.headers.get("cache-control")).toMatch(/no-store/);
    expect((await fetch("http://localhost:3111/testimonials")).headers.get("content-security-policy")).toBe("frame-ancestors 'self'");
    const feed = await fetch("http://localhost:3111/api/testimonials", { headers: { origin: "https://doveexpressions.org" } });
    expect(feed.headers.get("access-control-allow-origin")).toBe("https://doveexpressions.org");
    expect(feed.headers.get("cache-control")).toMatch(/no-store/);
    const json = await feed.json();
    expect(json.testimonials.map((t: { text: string }) => t.text)).toContain(PUBLIC_TEXT);
    expect(JSON.stringify(json)).not.toContain("Vera Voice");
    const stranger = await fetch("http://localhost:3111/api/testimonials", { headers: { origin: "https://evil.example" } });
    expect(stranger.headers.get("access-control-allow-origin")).toBeNull();
  });
  test("student withdraws permission in the app and the page and video stop being served", async ({ browser }) => {
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice");
    const mine = s.page.locator("li", { hasText: PUBLIC_TEXT });
    await expect(mine.getByText("Published on the public page.")).toBeVisible();
    await mine.getByRole("button", { name: "Withdraw public permission" }).click();
    await expect(s.page.getByRole("status").filter({ hasText: "Permission withdrawn" })).toBeVisible();
    await s.page.reload();
    await expect(s.page.locator("li", { hasText: PUBLIC_TEXT }).getByText("You withdrew permission. It is not shown publicly.")).toBeVisible();
    await expect(s.page.locator("li", { hasText: PUBLIC_TEXT }).getByRole("button", { name: "Withdraw public permission" })).toHaveCount(0);
    await s.ctx.close();
    const { ctx, page } = await publicVisit(browser);
    await expect(page.locator("body")).not.toContainText(PUBLIC_TEXT);
    await expect(page.getByText("No student stories have been shared yet.")).toBeVisible();
    // the website embed and the JSON feed drop it at once too
    expect(await (await fetch("http://localhost:3111/testimonials/embed")).text()).not.toContain(PUBLIC_TEXT);
    expect((await (await fetch("http://localhost:3111/api/testimonials", { headers: { origin: "https://doveexpressions.org" } })).json()).testimonials).toEqual([]);
    // a new signed link for the video can no longer be obtained by anyone signed out
    const rows = await (await rest("admin", "dp_voice_testimonials?select=video_path,consent_withdrawn_at&consent_withdrawn_at=not.is.null")).json();
    expect(rows).toHaveLength(1);
    const sign = await fetch(`${API}/storage/v1/object/sign/voice-testimonials/${rows[0].video_path}`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 60 }) });
    expect(sign.status).toBeGreaterThanOrEqual(400);
    await ctx.close();
    // the administrator sees the withdrawal and cannot publish it, even by calling the API
    const a = await login(browser, "admin");
    await a.page.goto("/staff/voice-reviews");
    const card = a.page.locator("article", { hasText: PUBLIC_TEXT });
    await expect(card.getByText("Public-use permission: withdrawn by the student")).toBeVisible();
    await expect(card.getByRole("button", { name: "Mark as published" })).toHaveCount(0);
    const id = (await (await rest("admin", `dp_voice_testimonials?select=id&review_text=eq.${encodeURIComponent(PUBLIC_TEXT)}`)).json())[0].id;
    expect((await rest("admin", `dp_voice_testimonials?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ published_at: new Date().toISOString() }) })).status).toBeGreaterThanOrEqual(400);
    expect((await rest("admin", `dp_voice_testimonials?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ allow_public_use: true, consent_withdrawn_at: null }) })).status).toBeGreaterThanOrEqual(400);
    await a.ctx.close();
  });
  test("student can delete a testimonial entirely", async ({ browser }) => {
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice");
    const form = s.page.locator("form", { hasText: "Submit for review" });
    await form.getByLabel("Your experience").fill("Temporary note to delete.");
    await form.getByRole("button", { name: "Submit for review" }).click();
    await expect(form.getByRole("status")).toContainText("submitted privately");
    await s.page.reload();
    s.page.once("dialog", (d) => d.accept());
    await s.page.locator("li", { hasText: "Temporary note to delete." }).getByRole("button", { name: "Delete" }).click();
    await expect(s.page.getByRole("status").filter({ hasText: "Testimonial deleted" })).toBeVisible();
    await s.page.reload();
    await expect(s.page.getByText("Temporary note to delete.")).toHaveCount(0);
    await s.ctx.close();
  });
});

test.describe("9. Store payments: installments are matched to their purchase and never over-grant (real webhook route)", () => {
  const SECRET = "local-test-webhook-secret";
  const post = async (order: object, secret = SECRET) => {
    const body = JSON.stringify(order);
    const sig = createHmac("sha256", secret).update(body).digest("base64");
    return fetch("http://localhost:3111/api/webhooks/woocommerce", { method: "POST", headers: { "content-type": "application/json", "x-wc-webhook-signature": sig }, body });
  };
  const order = (id: number, status: string, product: number, o: { email?: string; qty?: number; parent?: number; meta?: string } = {}) => ({
    id, status, billing: { email: o.email ?? F.users.multi.email }, parent_id: o.parent ?? 0,
    meta_data: o.meta ? [{ key: "dove_plan_order", value: o.meta }] : [], line_items: [{ id: id * 10, product_id: product, quantity: o.qty ?? 1 }] });
  const plan = async () => {
    const o = await (await rest("multi", "rpc/dp_my_coaching_overview", { method: "POST", body: JSON.stringify({ target_program_slug: "vocal-coaching" }) })).json();
    return o.packages.find((p: { installments_total: number }) => p.installments_total === 3);
  };
  test("an instructor links a 12-lesson, 3-payment package to a store product", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice/packages");
    await page.getByLabel("Name").fill("12-week 60 (test)");
    await page.getByLabel("Store product IDs (comma separated)").fill("9002");
    await page.getByLabel("Number of lessons").fill("12");
    await page.getByLabel("Number of payments in the store").fill("3");
    await page.getByRole("button", { name: "Create package" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Package created" })).toBeVisible();
    await page.reload();
    await expect(page.getByText(/12 × 60 min · no expiry · 3 payments/)).toBeVisible();
    await page.getByLabel("Name").fill("Duplicate link");
    await page.getByLabel("Store product IDs (comma separated)").fill("9002");
    await page.getByRole("button", { name: "Create package" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "only one active package" })).toBeVisible();
    await ctx.close();
  });
  test("rejects unsigned, wrongly signed and unknown-product requests", async () => {
    expect((await post(order(7000, "completed", 9002), "wrong-secret")).status).toBe(401);
    expect((await fetch("http://localhost:3111/api/webhooks/woocommerce", { method: "POST", body: JSON.stringify(order(7000, "completed", 9002)) })).status).toBe(401);
    const unknown = await post(order(7001, "completed", 424242));
    expect(unknown.status).toBe(200);
    expect((await unknown.json()).recorded).toBe(0);
    expect(await plan()).toBeUndefined();
    expect((await post(order(7002, "completed", 9002, { email: "nobody@fixture.test" }))).status).toBe(422);
  });
  test("payment 1 unlocks 4 of 12; payment 2 (parent order) unlocks 8; payment 3 (plan reference) unlocks all", async () => {
    expect((await post(order(7100, "on-hold", 9002))).status).toBe(200);
    expect(await plan()).toMatchObject({ credits_total: 12, credits_unlocked: 0, remaining: 0, payment_status: "pending" });
    expect((await post(order(7100, "processing", 9002))).status).toBe(200);
    expect(await plan()).toMatchObject({ credits_unlocked: 4, remaining: 4, installments_paid: 1, payment_status: "partial" });
    await post(order(7100, "processing", 9002)); // replay
    expect(await plan()).toMatchObject({ credits_unlocked: 4, installments_paid: 1 });
    expect((await post(order(7101, "completed", 9002, { parent: 7100 }))).status).toBe(200); // installment 2 is a child of the first order
    expect(await plan()).toMatchObject({ credits_unlocked: 8, remaining: 8, installments_paid: 2 });
    expect((await post(order(7102, "completed", 9002, { meta: "7100" }))).status).toBe(200); // installment 3 carries the plan reference in order meta
    expect(await plan()).toMatchObject({ credits_unlocked: 12, remaining: 12, installments_paid: 3, payment_status: "paid" });
    expect(await (await rest("admin", `dp_coaching_packages?select=id&student_id=eq.${F.ids.multi}`)).json()).toHaveLength(1);
    const attribution = await (await rest("admin", "dp_package_payments?select=external_order_id,attribution&order=external_order_id")).json();
    expect(attribution.map((a: { attribution: string }) => a.attribution)).toEqual(["new", "reference", "reference"]);
    expect((await post(order(7102, "refunded", 9002))).status).toBe(200);
    expect(await plan()).toMatchObject({ credits_unlocked: 8, installments_paid: 2, payment_status: "partial" });
    expect((await post(order(7200, "completed", 9002, { qty: 2 }))).status).toBe(500);
  });
  test("an unreferenced payment is never guessed: it waits, the student is told what is unlocked, the instructor matches it", async ({ browser }) => {
    // payment 3 was refunded above, so the plan is open (2 of 3). A payment with no reference could be installment 3 or a new purchase.
    const waiting = await post(order(7300, "completed", 9002));
    expect(waiting.status).toBe(202);
    expect((await waiting.json()).waitingForMatch).toBe(1);
    expect(await plan()).toMatchObject({ credits_unlocked: 8, installments_paid: 2 }); // untouched
    const student = await login(browser, "multi");
    await student.page.goto("/voice");
    await expect(student.page.getByRole("note").filter({ hasText: "Payment 2 of 3 received: 8 of 12 lessons unlocked." })).toBeVisible();
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice");
    const panel = page.locator("section", { hasText: "Store payments waiting to be matched" });
    await expect(panel).toContainText("store order #7300");
    await panel.getByLabel(/Match order 7300 to/).selectOption({ index: 2 }); // the student's open plan
    await panel.getByRole("button", { name: "Match payment" }).click();
    await expect(panel.getByText("Every store payment has been matched to a purchase.")).toBeVisible({ timeout: 15000 });
    await ctx.close();
    expect(await plan()).toMatchObject({ credits_unlocked: 12, installments_paid: 3, payment_status: "paid" });
    expect(await (await rest("admin", `dp_coaching_packages?select=id&student_id=eq.${F.ids.multi}`)).json()).toHaveLength(1);
    await student.page.goto("/voice");
    await expect(student.page.getByRole("note").filter({ hasText: /Payment \d of 3 received/ })).toHaveCount(0);
    await student.ctx.close();
  });
});

test.describe("10. Scheduling the whole program is separate from payment", () => {
  test("lessons can be scheduled for 12 weeks; a lesson beyond paid lessons cannot be recorded as taught without a waiver reason", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice");
    await page.getByRole("button", { name: "Schedule through 12 weeks" }).first().click();
    await expect(page.getByRole("status").filter({ hasText: /new lesson/ }).first()).toBeVisible();
    const lessons = await (await rest("admin", `dp_sessions?select=id,scheduled_at&student_id=eq.${F.ids.voiceOnly}&appointment_status=eq.scheduled&order=scheduled_at`)).json();
    expect(lessons.length).toBeGreaterThanOrEqual(11);
    // Vera has 4 paid lessons from the package recorded earlier: the first four can be recorded, the fifth cannot.
    for (const l of lessons.slice(0, 4)) {
      const r = await rest("admin", "rpc/dp_set_lesson_status", { method: "POST", body: JSON.stringify({ target_id: l.id, next_status: "completed" }) });
      expect(r.status, "paid lesson").toBeLessThan(300);
    }
    const fifth = lessons[4].id;
    const blocked = await rest("admin", "rpc/dp_set_lesson_status", { method: "POST", body: JSON.stringify({ target_id: fifth, next_status: "completed" }) });
    expect(blocked.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(await blocked.json())).toContain("No paid lesson is available");
    const direct = await rest("admin", `dp_sessions?id=eq.${fifth}`, { method: "PATCH", body: JSON.stringify({ appointment_status: "completed" }) });
    expect(direct.status).toBeGreaterThanOrEqual(400);
    // The command center warns about it and offers the waiver path.
    await page.reload();
    await expect(page.getByText(/scheduled beyond paid lessons/).first()).toBeVisible();
    await rest("admin", `dp_sessions?id=eq.${fifth}`, { method: "PATCH", body: JSON.stringify({ scheduled_at: new Date(Date.now() - 86400000).toISOString() }) });
    await page.reload();
    const box = page.locator("div", { hasText: /Record the outcome for \d+ past lesson/ }).first();
    await box.getByRole("button", { name: "Completed", exact: true }).first().click();
    await expect(box.getByRole("alert").first()).toContainText("no paid, unlocked lesson");
    await expect(box.getByRole("button", { name: "Waive payment and record" }).first()).toBeDisabled();
    await box.getByLabel("Reason for waiving payment").first().fill("Complimentary make-up lesson");
    await box.getByRole("button", { name: "Waive payment and record" }).first().click();
    // the lesson leaves the "needs an outcome" list once recorded, so confirm from the record itself
    await expect.poll(async () => (await (await rest("admin", `dp_sessions?select=credit_waived,waive_reason,package_id,appointment_status&id=eq.${fifth}`)).json())[0],
      { timeout: 15000 }).toMatchObject({ credit_waived: true, waive_reason: "Complimentary make-up lesson", package_id: null, appointment_status: "completed" });
    // and the waiver stays visible afterwards as an audit entry in the command center
    await page.reload();
    const audit = page.locator("section", { hasText: "Lessons recorded with payment waived" });
    await expect(audit).toContainText("Reason: Complimentary make-up lesson");
    await expect(audit).toContainText("Vera Voice");
    await ctx.close();
  });
});


const lessonUrl = (f: { courseId: string; lessons: Record<"open" | "gated", { id: string }> }, k: "open" | "gated") => `/courses/${f.courseId}/lessons/${f.lessons[k].id}`;
const V = F.fixtures.voice, CR = F.fixtures.creative;
const SECRET = { voiceOpen: "SECRET-VOICE-OPEN teaching content", voiceGated: "SECRET-VOICE-GATED teaching content", creativeOpen: "SECRET-CREATIVE-OPEN teaching content" };
const download = async (who: Who, file: string) => fetch(`${API}/storage/v1/object/authenticated/course-media-private/${file}`, { headers: { apikey: ANON, authorization: `Bearer ${await accessToken(who)}` } });
const signUrl = async (who: Who, file: string) => fetch(`${API}/storage/v1/object/sign/course-media-private/${file}`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${await accessToken(who)}`, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 60 }) });
const wooPost = async (order: object) => {
  const body = JSON.stringify(order);
  return fetch("http://localhost:3111/api/webhooks/woocommerce", { method: "POST", headers: { "content-type": "application/json", "x-wc-webhook-signature": createHmac("sha256", "local-test-webhook-secret").update(body).digest("base64") }, body });
};
const wooOrder = (id: number, status: string, email: string, product: number, parent = 0) => ({ id, status, parent_id: parent, billing: { email }, line_items: [{ id: id * 10, product_id: product, quantity: 1 }] });

test.describe("11. Students reach only the programs they are enrolled in: direct URLs, database, files and lesson content", () => {
  test("a voice-only student opens a voice lesson but nothing in Creative Studio", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto(lessonUrl(V, "open")); await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(SECRET.voiceOpen);
    await page.goto(lessonUrl(CR, "open")); await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText(SECRET.creativeOpen);
    await page.goto(`/courses/${CR.courseId}`); await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Fixture creative");
    await ctx.close();
  });
  test("a creative-only student cannot open a voice lesson by URL", async ({ browser }) => {
    const { ctx, page } = await login(browser, "creative");
    await page.goto(lessonUrl(CR, "open")); await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(SECRET.creativeOpen);
    await page.goto(lessonUrl(V, "open")); await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText(SECRET.voiceOpen);
    await ctx.close();
  });
  test("a student in both programs opens both; a signed-in stranger opens neither", async ({ browser }) => {
    const m = await login(browser, "multi");
    for (const [f, secret] of [[V, SECRET.voiceOpen], [CR, SECRET.creativeOpen]] as const) {
      await m.page.goto(lessonUrl(f, "open")); await m.page.waitForLoadState("networkidle");
      await expect(m.page.locator("body")).toContainText(secret);
    }
    await m.ctx.close();
    const x = await login(browser, "stranger");
    for (const [f, secret] of [[V, SECRET.voiceOpen], [CR, SECRET.creativeOpen]] as const) {
      await x.page.goto(lessonUrl(f, "open")); await x.page.waitForLoadState("networkidle");
      await expect(x.page.locator("body")).not.toContainText(secret);
    }
    for (const p of ["/voice", "/voice/resources", "/creative-studio", "/staff/voice"]) { await x.page.goto(p); await x.page.waitForLoadState("networkidle"); expect(new URL(x.page.url()).pathname, p).toBe("/dashboard"); }
    await x.ctx.close();
  });
  test("database rows, lesson content and private files follow enrollment for every role", async () => {
    const rows = async (who: Who, table: string, filter: string) => (await (await rest(who, `${table}?select=id&${filter}`)).json()) as unknown[];
    const matrix: [Who, boolean, boolean][] = [["voiceOnly", true, false], ["creative", false, true], ["multi", true, true], ["stranger", false, false], ["instructor", true, true], ["admin", true, true]];
    for (const [who, seesVoice, seesCreative] of matrix) {
      for (const [f, expected, label] of [[V, seesVoice, "voice"], [CR, seesCreative, "creative"]] as const) {
        const n = expected ? 1 : 0;
        expect((await rows(who, "dp_courses", `id=eq.${f.courseId}`)).length, `${who} ${label} course`).toBe(n);
        expect((await rows(who, "dp_lessons", `id=eq.${f.lessons.open.id}`)).length, `${who} ${label} lesson`).toBe(n);
        expect((await rows(who, "dp_lesson_blocks", `lesson_id=eq.${f.lessons.open.id}`)).length, `${who} ${label} teaching content`).toBe(n);
        const dl = await download(who, f.lessons.open.file); const sg = await signUrl(who, f.lessons.open.file);
        expect(dl.status === 200, `${who} downloads ${label} file`).toBe(expected);
        expect(sg.status < 300, `${who} signs ${label} file`).toBe(expected);
      }
    }
    // signed-out visitors get nothing at all
    const anon = await (await fetch(`${API}/rest/v1/dp_lesson_blocks?select=id`, { headers: { apikey: ANON } })).json();
    expect(Array.isArray(anon) ? anon.length : 0).toBe(0);
    expect((await fetch(`${API}/storage/v1/object/public/course-media-private/${V.lessons.open.file}`)).status).toBeGreaterThanOrEqual(400);
  });
});

test.describe("12. Full lesson workflow: assign, practise, submit, feedback, and progress that persists", () => {
  const TITLE = "Lesson practice (workflow)";
  test("the instructor personalizes practice for one student on a published lesson", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto(`/staff/courses/${V.courseId}/lessons/${V.lessons.open.id}/builder`);
    await page.getByRole("button", { name: "+ Assign practice" }).click();
    await page.getByLabel("Student").selectOption({ label: F.users.voiceOnly.name });
    await page.getByLabel("Title").fill(TITLE);
    await page.getByLabel("Guided practice steps (one per line)").fill("Gentle hum on one comfortable note\nSing the first line twice");
    await page.getByRole("button", { name: "Save assignment" }).click();
    await expect(page.getByText(TITLE)).toBeVisible();
    await ctx.close();
  });
  test("the student sees it from the lesson, saves progress that survives a reload, and submits", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto(lessonUrl(V, "open")); await page.waitForLoadState("networkidle");
    await expect(page.getByText(SECRET.voiceOpen)).toBeVisible();
    await page.getByRole("link", { name: TITLE }).first().click();
    await page.waitForURL(/\/assignments/);
    const card = page.locator("article", { hasText: TITLE });
    await card.getByRole("checkbox", { name: /Gentle hum/ }).check();
    await card.getByLabel("Practice minutes").fill("8");
    await card.getByLabel("Practice reflection").fill("The hum felt easy.");
    await card.getByRole("button", { name: "Save progress" }).click();
    await expect(card.getByRole("status")).toContainText("Progress saved");
    await page.reload();
    const again = page.locator("article", { hasText: TITLE });
    await expect(again.getByRole("checkbox", { name: /Gentle hum/ })).toBeChecked();
    await expect(again.getByLabel("Practice reflection")).toHaveValue("The hum felt easy.");
    await again.getByRole("checkbox", { name: /Sing the first line/ }).check();
    await again.getByRole("button", { name: "Submit practice" }).click();
    await expect(again.getByRole("status")).toContainText("Practice submitted");
    // the student cannot mark a Voice lesson complete themselves
    const forced = await rest("voiceOnly", "dp_lesson_progress", { method: "POST", body: JSON.stringify({ user_id: F.ids.voiceOnly, lesson_id: V.lessons.open.id, status: "completed", completion_method: "student_marked" }) });
    expect(forced.status).toBeGreaterThanOrEqual(400);
    await ctx.close();
  });
  test("the instructor reviews it privately, shares feedback and approves", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice");
    await page.getByRole("heading", { name: "Assignments awaiting review" }).locator("..").getByRole("link", { name: TITLE }).click();
    await page.getByLabel("Private note").fill("INSTRUCTOR-ONLY: confident start.");
    await page.getByRole("button", { name: "Save private note" }).click();
    await expect(page.getByText("Private note saved")).toBeVisible();
    await page.getByLabel("Feedback shared with the student").fill("Lovely, relaxed hum. Keep the same ease on the line.");
    await page.getByLabel("Update status to").selectOption("approved");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByText("Lovely, relaxed hum.")).toBeVisible();
    await ctx.close();
  });
  test("a brand new session still shows the feedback, the approved work and the completed lesson", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/assignments");
    const card = page.locator("article", { hasText: TITLE });
    await expect(card.getByText("Approved by your instructor.")).toBeVisible();
    await expect(card.getByText("Lovely, relaxed hum.")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("INSTRUCTOR-ONLY");
    await page.goto(lessonUrl(V, "open")); await page.waitForLoadState("networkidle");
    await expect(page.getByText("Teaching complete").first()).toBeVisible();
    const progress = await (await rest("voiceOnly", `dp_lesson_progress?select=status,completion_method&lesson_id=eq.${V.lessons.open.id}`)).json();
    expect(progress).toEqual([{ status: "completed", completion_method: "instructor_review" }]);
    await ctx.close();
  });
});

test.describe("13. Locked lessons follow payments and refunds never delete records", () => {
  const email = F.users.voiceOnly.email;
  test("the instructor sets the gated lesson to open after eight paid lessons", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice/packages");
    const input = page.getByLabel("Paid lessons needed for Fixture voice lesson gated");
    await input.fill("8"); await input.blur();
    await expect(page.getByRole("status").filter({ hasText: "Access updated" })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Paid lessons needed for Fixture voice lesson gated")).toHaveValue("8");
    await ctx.close();
  });
  test("payment 1 (4 lessons) leaves it locked: closed page, no content, no file", async ({ browser }) => {
    expect((await wooPost(wooOrder(7500, "completed", email, 9002))).status).toBe(200);
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto(lessonUrl(V, "gated")); await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "This lesson is not open yet" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("opens once 8 lessons of your package are paid for");
    await expect(page.getByRole("status")).toContainText("Right now 4 are unlocked");
    await expect(page.locator("body")).not.toContainText(SECRET.voiceGated);
    expect(await (await rest("voiceOnly", `dp_lesson_blocks?select=id&lesson_id=eq.${V.lessons.gated.id}`)).json()).toEqual([]);
    expect((await download("voiceOnly", V.lessons.gated.file)).status).toBeGreaterThanOrEqual(400);
    expect((await signUrl("voiceOnly", V.lessons.gated.file)).status).toBeGreaterThanOrEqual(400);
    // the ungated lesson, its progress and the assignment feedback from section 12 are untouched
    await page.goto(lessonUrl(V, "open")); await page.waitForLoadState("networkidle");
    await expect(page.getByText(SECRET.voiceOpen)).toBeVisible();
    await ctx.close();
  });
  test("payment 2 (8 lessons) opens it; a refund closes it again; nothing is deleted", async ({ browser }) => {
    expect((await wooPost(wooOrder(7501, "completed", email, 9002, 7500))).status).toBe(200);
    const open = await login(browser, "voiceOnly");
    await open.page.goto(lessonUrl(V, "gated")); await open.page.waitForLoadState("networkidle");
    await expect(open.page.getByText(SECRET.voiceGated)).toBeVisible();
    expect((await download("voiceOnly", V.lessons.gated.file)).status).toBe(200);
    expect((await wooPost(wooOrder(7501, "refunded", email, 9002, 7500))).status).toBe(200);
    await open.page.goto(lessonUrl(V, "gated")); await open.page.waitForLoadState("networkidle");
    await expect(open.page.getByRole("heading", { name: "This lesson is not open yet" })).toBeVisible();
    await expect(open.page.locator("body")).not.toContainText(SECRET.voiceGated);
    // records preserved: approved work, shared feedback, completed lesson progress, and the private note stays hidden
    await open.page.goto("/assignments");
    await expect(open.page.locator("article", { hasText: "Lesson practice (workflow)" }).getByText("Approved by your instructor.")).toBeVisible();
    await expect(open.page.locator("article", { hasText: "Lesson practice (workflow)" }).getByText("Lovely, relaxed hum.")).toBeVisible();
    expect(await (await rest("voiceOnly", `dp_lesson_progress?select=status&lesson_id=eq.${V.lessons.open.id}`)).json()).toEqual([{ status: "completed" }]);
    await open.ctx.close();
    const admin = await (await rest("admin", `dp_feedback?select=content,is_private&is_private=eq.true`)).json();
    expect(admin.some((f: { content: string }) => /INSTRUCTOR-ONLY/.test(f.content))).toBe(true);
  });
});
