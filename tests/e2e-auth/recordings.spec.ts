import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { F, login, rest, expectNoHorizontalOverflow } from "./helpers";

/** Tiny valid WAV (0.5 s of silence) so the upload path is real without large fixtures. */
function wav(seconds = 0.5) {
  const rate = 8000, n = Math.floor(rate * seconds), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  return buf;
}
const ASSIGNMENT = randomUUID();
const file = (name: string) => ({ name, mimeType: "audio/wav", buffer: wav() });

async function pickAndSave(page: Page, name: string, label: string, part: number) {
  await page.locator("input[type=file]").setInputFiles(file(name));
  await page.getByLabel("Label").selectOption(label);
  await page.getByLabel("Part number").fill(String(part));
  await expect(page.getByRole("button", { name: "Save privately" })).toBeVisible();
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page.getByText("Saved privately. Submit it for feedback")).toBeVisible({ timeout: 20000 });
}

test.describe.serial("private practice recording library", () => {
  test.beforeAll(async () => {
    const r = await rest("instructor", "dp_assignments", { method: "POST", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ id: ASSIGNMENT, course_id: F.fixtures.voice.courseId, assigned_to_user_id: F.ids.voiceOnly, title: "Recording fixture: breath", practice_steps: ["Warm up"] }) });
    expect(r.status, await r.text()).toBeLessThan(300);
  });

  test("student saves privately, then submits; several numbered parts per assignment", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice/recordings");
    await expect(page.getByRole("heading", { name: "My Practice Recordings" })).toBeVisible();
    await expect(page.getByText("We recommend recording in 3–5 minute segments")).toBeVisible();
    await page.getByLabel("Assignment").selectOption({ label: "Recording fixture: breath" });
    await pickAndSave(page, "verse.wav", "Verse", 1);
    await pickAndSave(page, "chorus.wav", "Chorus", 2);
    const group = page.getByRole("region", { name: "Recording fixture: breath" });
    await expect(group.getByText("Saved privately").first()).toBeVisible();
    await expect(group.getByText(/Part 1/)).toBeVisible();
    await expect(group.getByText(/Part 2/)).toBeVisible();
    // a duplicate part number is refused with a helpful message
    await page.locator("input[type=file]").setInputFiles(file("again.wav"));
    await page.getByLabel("Part number").fill("1");
    await page.getByLabel("Assignment").selectOption({ label: "Recording fixture: breath" });
    await page.getByRole("button", { name: "Save privately" }).click();
    await expect(page.getByText(/already has a recording/i)).toBeVisible({ timeout: 15000 });
    // submit part 1 only; part 2 stays a private draft
    await group.getByRole("listitem").filter({ hasText: "Verse" }).getByRole("button", { name: "Submit for feedback" }).click();
    await expect(group.getByRole("listitem").filter({ hasText: "Verse" }).getByText("Submitted", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(group.getByRole("listitem").filter({ hasText: "Chorus" }).getByText("Saved privately")).toBeVisible();
    await ctx.close();
  });

  test("playback is authenticated and ownership-checked before anything is signed", async ({ browser, request }) => {
    const rows = await (await rest("voiceOnly", "dp_practice_recordings?select=id,status&order=part_no")).json();
    expect(rows.length).toBe(2);
    expect((await request.get(`/api/recordings/${rows[0].id}/playback`)).status()).toBe(401);
    for (const who of ["creative", "stranger"] as const) {
      const { ctx, page } = await login(browser, who);
      const res = await page.request.get(`/api/recordings/${rows[0].id}/playback`);
      expect(res.status(), who).toBe(404);
      // the database also hides the rows and refuses cross-student actions
      expect(await (await rest(who, "dp_practice_recordings?select=id")).json()).toEqual([]);
      expect((await page.request.post("/api/recordings/submit", { data: { ids: [rows[1].id] } })).status()).toBeGreaterThanOrEqual(400);
      expect((await page.request.post("/api/recordings/discard", { data: { id: rows[1].id } })).status()).toBeGreaterThanOrEqual(400);
      await ctx.close();
    }
    const { ctx, page } = await login(browser, "voiceOnly");
    const own = await page.request.get(`/api/recordings/${rows[0].id}/playback`);
    expect(own.status()).toBe(200);
    const { url } = await own.json();
    expect(url).toContain("X-Amz-Signature=");
    expect(url).not.toContain("local-secret");
    // tampering with the signed key is rejected by the object store
    expect((await fetch(url.replace(rows[0].id, rows[1].id))).status).toBe(403);
    expect((await fetch(url)).status).toBe(200);
    await ctx.close();
  });

  test("a dropped connection keeps the take and can be retried", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice/recordings");
    await page.route("http://127.0.0.1:9100/**", (r) => r.abort("connectionreset"));
    await page.getByLabel("Label").selectOption("Warmup");
    await page.locator("input[type=file]").setInputFiles(file("flaky.wav"));
    await page.getByRole("button", { name: "Save privately" }).click();
    await expect(page.getByText(/connection dropped/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Waiting to upload (1)")).toBeVisible();
    await page.unroute("http://127.0.0.1:9100/**");
    await page.reload();
    await expect(page.getByText("Waiting to upload (1)")).toBeVisible(); // survives a reload (IndexedDB)
    await page.getByRole("button", { name: "Retry upload" }).click();
    await expect(page.getByText("Saved privately. Submit it for feedback")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Waiting to upload/)).toHaveCount(0);
    await ctx.close();
  });

  test("records in the app with the microphone", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice/recordings");
    await page.getByRole("button", { name: "Start recording" }).click();
    await expect(page.getByRole("timer")).toBeVisible();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.locator("audio").first()).toBeVisible();
    await page.getByLabel("Label").selectOption("Pitch exercise");
    await page.getByRole("button", { name: "Save privately" }).click();
    await expect(page.getByText("Saved privately. Submit it for feedback")).toBeVisible({ timeout: 20000 });
    await ctx.close();
  });

  test("instructor plays, returns for revision; student revises; original and feedback are preserved", async ({ browser }) => {
    const inst = await login(browser, "instructor");
    await inst.page.goto("/staff/voice/recordings");
    const waiting = inst.page.getByRole("region", { name: /Waiting for review/ });
    await expect(waiting.getByRole("listitem")).toHaveCount(1);
    await waiting.getByRole("button", { name: "Play" }).click();
    await expect(waiting.locator("audio")).toHaveAttribute("src", /127\.0\.0\.1:9100.*X-Amz-Signature/);
    await waiting.getByLabel("Feedback").fill("Good start. Slow the breath and try again.");
    await waiting.getByLabel(/Follow-up exercise/).fill("Quiet low breath x4 before you sing");
    await waiting.getByRole("button", { name: "Return for revision" }).click();
    await expect(inst.page.getByRole("region", { name: /Returned for revision/ }).getByText(/Slow the breath/)).toBeVisible({ timeout: 15000 });
    await inst.ctx.close();

    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice/recordings");
    const group = s.page.getByRole("region", { name: "Recording fixture: breath" });
    const returned = group.getByRole("listitem").filter({ hasText: "Verse" });
    await expect(returned.getByText("Returned for revision", { exact: true })).toBeVisible();
    await expect(returned.getByText(/Quiet low breath x4/)).toBeVisible();
    await returned.getByRole("button", { name: "Record a revised take" }).click();
    await expect(s.page.getByRole("heading", { name: "Record a revised take" })).toBeVisible();
    await s.page.locator("input[type=file]").setInputFiles(file("verse-take2.wav"));
    await s.page.getByRole("button", { name: "Save privately" }).click();
    await expect(s.page.getByText("Saved privately. Submit it for feedback")).toBeVisible({ timeout: 20000 });
    await expect(group.getByText(/Revision 2/)).toBeVisible();
    // original still there, still returned, feedback intact
    await expect(group.getByRole("listitem").filter({ hasText: "Verse" }).filter({ hasText: "Returned for revision" })).toHaveCount(1);
    await expect(group.getByText(/Slow the breath/)).toBeVisible();
    // a returned recording can be revised only once
    const db = await (await rest("voiceOnly", "dp_practice_recordings?select=id,revision_no,revision_of,status&order=created_at")).json();
    expect(db.filter((r: any) => r.revision_no === 2).length).toBe(1);
    await s.ctx.close();
  });

  test("unsubmitted drafts can be removed; submitted recordings cannot", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly");
    await page.goto("/voice/recordings");
    const submitted = await (await rest("voiceOnly", "dp_practice_recordings?select=id&status=in.(submitted,reviewed,returned)")).json();
    for (const r of submitted) expect((await page.request.post("/api/recordings/discard", { data: { id: r.id } })).status()).toBeGreaterThanOrEqual(400);
    page.once("dialog", (d) => d.accept());
    const draft = page.getByRole("listitem").filter({ hasText: "Warmup" }).first();
    await draft.getByRole("button", { name: "Remove draft" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Warmup" })).toHaveCount(0, { timeout: 15000 });
    expect(await (await rest("voiceOnly", "dp_practice_recordings?select=id&status=in.(submitted,reviewed,returned)")).json()).toHaveLength(submitted.length);
    await ctx.close();
  });

  test("cleanup route requires the secret and keeps submitted recordings", async ({ request }) => {
    expect((await request.post("/api/recordings/cleanup")).status()).toBe(401);
    const ok = await request.post("/api/recordings/cleanup", { headers: { authorization: "Bearer local-cron-secret" } });
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body.purged).toBeGreaterThanOrEqual(1);
    const kept = await (await rest("voiceOnly", "dp_practice_recordings?select=id,status&status=in.(submitted,returned)")).json();
    expect(kept.map((r: any) => r.status)).toContain("returned"); // the original returned recording is untouched
  });

  test("works on a phone-sized screen", async ({ browser }) => {
    const { ctx, page } = await login(browser, "voiceOnly", { width: 390, height: 844 });
    await page.goto("/voice/recordings");
    await expect(page.getByRole("heading", { name: "My Practice Recordings" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const tiny = await page.evaluate(() => [...document.querySelectorAll("main a, main button, main label")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 24; }).length);
    expect(tiny).toBe(0);
    await ctx.close();
  });
});
