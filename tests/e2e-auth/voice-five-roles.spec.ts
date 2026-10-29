import { test, expect } from "@playwright/test";
import { F, accessToken, API, ANON, login, rest, type Who } from "./helpers";

test.describe.configure({ mode: "serial" });

const finalPath = async (page: import("@playwright/test").Page, path: string) => {
  await page.goto(path); await page.waitForLoadState("networkidle");
  return new URL(page.url()).pathname;
};
const PLAN = "Week of Nov 2 – foundations";
const REC = Buffer.concat([Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 77, 52, 65, 32]), Buffer.alloc(2048, 7)]);

test.describe("1. Login and dashboard routing", () => {
  const expected: Record<Who, string> = { voiceOnly: "/voice", creative: "/creative-studio", multi: "/dashboard", instructor: "/dashboard", admin: "/dashboard", scopedTeacher: "/dashboard" };
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
    await page.locator('label:has-text("Package") select').selectOption({ label: "Monthly 60 (test)" });
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
    await expect(page.getByRole("status").filter({ hasText: /upcoming lesson/ })).toBeVisible();
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
      const lessons = await (await rest(who, "dp_lessons?select=id,title,dp_modules!inner(course_id,dp_courses!inner(dp_programs!inner(slug)))&dp_modules.dp_courses.dp_programs.slug=eq.vocal-coaching&limit=1")).json();
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
