import { test, expect, type Page } from "@playwright/test";
import { F, login, rest } from "./helpers";

const rpc = async (who: "voiceOnly" | "instructor", name: string, args: object) => {
  const r = await rest(who, `rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
  expect(r.status, `${name}: ${await r.clone().text()}`).toBeLessThan(300);
  const t = await r.text(); return t ? JSON.parse(t) : null; // void functions return an empty body
};
const wav = () => { const n = 4000, b = Buffer.alloc(44 + n * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); return b; };
const dueIn = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const studentLink = (page: Page) => page.getByRole("main").getByRole("link", { name: F.users.voiceOnly.name });

test.describe.serial("gap round: imports, plan revision, ratings, follow-ups, sample drafts", () => {
  test("Google Forms import: suggests a mapping from different wording, previews, saves the mapping, and repeat imports add nothing", async ({ browser }) => {
    const email = F.users.voiceOnly.email;
    const csv = [
      `Timestamp,Email,"Why are you here? What do you want from lessons?","Tell us about your voice background","Which Creative Worship tracks appeal to you?",Favourite colour`,
      `10/30/2026 9:00:00,${email},"Ad-libbing, harmony and confidence","Church choir for 5 years","Spontaneous Vocal Expression",blue`,
      `10/30/2026 9:05:00,nobody@elsewhere.test,"Hello","none","",red`
    ].join("\n");
    const { ctx, page } = await login(browser, "instructor");
    await page.goto("/staff/voice/development");
    await page.getByLabel(/Paste the Google Forms responses/).fill(csv);
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByLabel("Map column Email")).toHaveValue("email");
    await expect(page.getByLabel("Map column Why are you here? What do you want from lessons?")).toHaveValue("goals");
    await expect(page.getByLabel("Map column Tell us about your voice background")).toHaveValue("singing_experience");
    await expect(page.getByLabel("Map column Which Creative Worship tracks appeal to you?")).toHaveValue("creative_worship");
    await expect(page.getByLabel("Map column Favourite colour")).toHaveValue("");
    await expect(page.locator("ul[role=alert]")).toContainText("Favourite colour");
    await expect(page.locator("ul[role=alert]")).toContainText("no matching column");
    await expect(page.getByText(/Preview: 1 new · 0 already imported · 1 not enrolled · 0 invalid/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Import 1 new response" })).toBeVisible();
    // nothing is written by a preview
    expect(await (await rest("instructor", "dp_voice_intakes?select=id")).json()).toEqual([]);
    // instructor corrects a column and saves the mapping
    await page.getByLabel("Map column Favourite colour").selectOption("notes");
    await page.getByLabel("Save this mapping as").fill("Fall intake form");
    await page.getByRole("button", { name: "Save mapping" }).click();
    await expect(page.getByText(/Mapping "Fall intake form" saved/)).toBeVisible();
    await page.getByRole("button", { name: "Import 1 new response" }).click();
    await expect(page.getByLabel("Import results")).toContainText(`${email}: imported`);
    const rows = await (await rest("instructor", "dp_voice_intakes?select=id,source,answers,import_key")).json();
    expect(rows).toHaveLength(1);
    expect(rows[0].answers.goals).toBe("Ad-libbing, harmony and confidence");
    expect(rows[0].answers.notes).toBe("blue");
    // repeat import: previews as already imported and adds nothing
    await page.reload();
    await page.getByLabel("Saved column mapping").selectOption("Fall intake form");
    await page.getByLabel(/Paste the Google Forms responses/).fill(csv);
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByLabel("Map column Favourite colour")).toHaveValue("notes"); // the saved mapping was applied
    await expect(page.getByText(/0 new · 1 already imported/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Import 0 new/ })).toBeDisabled();
    expect(await (await rest("instructor", "dp_voice_intakes?select=id")).json()).toHaveLength(1);
    // an import records the student's own track choice but does NOT approve it
    const prof = (await (await rest("instructor", "dp_voice_profiles?select=selected_tracks,approved_tracks")).json())[0];
    expect(prof).toEqual({ selected_tracks: ["spontaneous_expression"], approved_tracks: [] });
    await ctx.close();
  });

  test("recording review assigns a specific exercise, then another from a reviewed recording", async ({ browser }) => {
    const stu = await login(browser, "voiceOnly");
    await stu.page.goto("/voice/recordings");
    await stu.page.locator("input[type=file]").setInputFiles({ name: "take.wav", mimeType: "audio/wav", buffer: wav() });
    await stu.page.getByRole("button", { name: "Save privately" }).click();
    await expect(stu.page.getByText("Saved privately. Submit it for feedback")).toBeVisible({ timeout: 20000 });
    await stu.page.getByRole("button", { name: "Submit for feedback" }).click();
    await expect(stu.page.getByText("Submitted", { exact: true })).toBeVisible({ timeout: 15000 });
    await stu.ctx.close();

    const inst = await login(browser, "instructor");
    await inst.page.goto("/staff/voice/recordings");
    const waiting = inst.page.getByRole("region", { name: /Waiting for review/ });
    await waiting.getByLabel("Feedback").fill("Lovely tone. Work on a steadier breath.");
    await waiting.getByLabel("Assign an exercise (optional)").selectOption({ label: "Quiet low breath and steady 'ssss'" });
    await expect(waiting.getByRole("button", { name: "Send feedback" })).toBeDisabled(); // an exercise needs a due date
    await waiting.getByLabel("Due").fill(dueIn(5));
    await waiting.getByRole("button", { name: "Send feedback" }).click();
    const reviewed = inst.page.getByRole("region", { name: /Reviewed/ });
    await expect(reviewed.getByText(/Follow-up exercise assigned/)).toBeVisible({ timeout: 15000 });
    // a second exercise from the already-reviewed recording (feedback history is appended, not replaced)
    await reviewed.getByLabel("Assign a follow-up exercise").selectOption({ label: "Counted breath into a hum" });
    await reviewed.getByLabel("Due").fill(dueIn(6));
    await reviewed.getByRole("button", { name: "Assign exercise" }).click();
    await expect(reviewed.getByText("Follow-up exercise assigned.")).toBeVisible({ timeout: 15000 });
    await inst.ctx.close();

    const stu2 = await login(browser, "voiceOnly");
    await stu2.page.goto("/voice/recordings");
    await expect(stu2.page.getByText("Lovely tone. Work on a steadier breath.")).toBeVisible();
    await expect(stu2.page.getByRole("link", { name: "Open the assigned exercise" })).toHaveCount(2);
    const asg = await (await rest("voiceOnly", "dp_assignments?select=title,practice_items&title=like.Follow-up*")).json();
    expect(asg.map((a: any) => a.title).sort()).toEqual(["Follow-up: Counted breath into a hum", "Follow-up: Quiet low breath and steady 'ssss'"]);
    // another student cannot see the feedback or the assignments
    expect(await (await rest("creative", "dp_practice_recording_feedback?select=id")).json()).toEqual([]);
    await stu2.ctx.close();
  });

  test("an optional-track exercise cannot be assigned from a recording unless chosen and approved", async () => {
    const lib = await (await rest("instructor", "dp_voice_exercises?select=id&curriculum_key=eq.abide-time")).json();
    const rec = (await (await rest("voiceOnly", "dp_practice_recordings?select=id&status=eq.reviewed")).json())[0];
    const r = await rest("instructor", "rpc/dp_recording_assign_followup", { method: "POST", body: JSON.stringify({ rid: rec.id, exercise: lib[0].id, due: dueIn(3) }) });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(await r.text()).toMatch(/not available for this student/);
  });

  test("approved plans can be revised with history; assigned and finished lessons stay locked; recordings and assignments remain", async ({ browser }) => {
    const sid = F.ids.voiceOnly;
    await rpc("voiceOnly", "dp_voice_set_my_tracks", { tracks: ["spontaneous_expression"], tongues: false });
    await rpc("instructor", "dp_voice_approve_tracks", { student: sid, tracks: ["spontaneous_expression"] });
    const mk = (seq: number, area: string, title: string, keys: string[]) => ({ seq, week: seq, area_key: area, area_title: title, level: "beginner", objective: `Objective ${seq}`, exercise_keys: keys });
    const plan = await rpc("instructor", "dp_plan_save", { pid: null, student: sid, plan_title: "Development plan", ptype: "monthly", units: [mk(1, "posture-breath", "Posture and breath management", ["stance-check"]), mk(2, "pitch-ear", "Pitch accuracy and ear training", ["match-one-note"]), mk(3, "range", "Vocal range development", ["range-map"])], plan_basis: ["x"], plan_notes: ["n"], rationale: {}, instructor_notes: null });
    await rpc("instructor", "dp_plan_activate", { pid: plan });
    const units = await (await rest("instructor", `dp_voice_plan_units?select=id,seq&plan_id=eq.${plan}&order=seq`)).json();
    await rpc("instructor", "dp_plan_assign_unit", { uid: units[0].id, due: dueIn(7) });
    const before = await (await rest("voiceOnly", "dp_practice_recordings?select=id")).json();

    const { ctx, page } = await login(browser, "instructor");
    await page.goto(`/staff/voice/development/${sid}`);
    const lesson = (n: number) => page.getByRole("listitem").filter({ hasText: new RegExp(`^Lesson ${n}(?!\\d)`) });
    await expect(lesson(1)).toContainText("practice assigned");
    await expect(lesson(1).getByLabel("Objective")).toBeDisabled(); // locked
    await expect(lesson(1).getByRole("button", { name: "Remove lesson" })).toHaveCount(0);
    await expect(lesson(2).getByLabel("Objective")).toBeEnabled(); // still ahead: editable
    await lesson(2).getByLabel("Objective").fill("Match five notes without help");
    await page.getByRole("button", { name: "Add a lesson" }).click();
    await expect(page.getByRole("button", { name: "Save revision" })).toBeDisabled(); // a reason is required
    await page.getByLabel(/Why is the plan changing/).fill("Student progressed faster than expected");
    await page.getByRole("button", { name: "Save revision" }).click();
    await expect(page.getByText(/Plan revised\. The previous version is kept/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Plan history" })).toContainText("Version 1");
    await expect(page.getByRole("region", { name: "Plan history" })).toContainText("As approved: Student progressed faster than expected");
    await page.getByRole("region", { name: "Plan history" }).getByText("Show lessons in this version").click();
    await expect(page.getByRole("region", { name: "Plan history" })).toContainText("Objective 2"); // the old wording is preserved
    await expect(lesson(2).getByLabel("Objective")).toHaveValue("Match five notes without help");
    await expect(page.getByText(/Approved plan, version 2/)).toBeVisible();
    // finished lessons: mark done, then it locks too
    page.once("dialog", (d) => d.accept());
    await lesson(2).getByRole("button", { name: "Mark lesson done" }).click();
    await expect(page.getByText("Lesson 2 marked done.")).toBeVisible();
    await page.reload();
    await expect(lesson(2).getByLabel("Objective")).toBeDisabled();
    // nothing the student owns changed
    expect(await (await rest("voiceOnly", "dp_practice_recordings?select=id")).json()).toHaveLength(before.length);
    const ass = await (await rest("voiceOnly", "dp_assignments?select=id,title&title=like.Week*")).json();
    expect(ass.length).toBe(1);
    // the database also refuses to change the locked lesson even if the page were bypassed
    const all = await (await rest("instructor", `dp_voice_plan_units?select=*&plan_id=eq.${plan}&order=seq`)).json();
    const tamper = all.map((u: any) => ({ ...u, objective: u.seq === 1 ? "tampered" : u.objective }));
    const bad = await rest("instructor", "rpc/dp_plan_revise", { method: "POST", body: JSON.stringify({ pid: plan, units: tamper, reason: "x" }) });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    await ctx.close();
    // the student sees the revised plan, never the history
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice/plan");
    await expect(s.page.getByText("Match five notes without help")).toBeVisible();
    await expect(s.page.locator("body")).not.toContainText("Plan history");
    expect(await (await rest("voiceOnly", "dp_voice_plan_versions?select=id")).json()).toEqual([]);
    await s.ctx.close();
  });

  test("structured ratings: baseline, midpoint and final compare per skill area; students see only what is shared", async ({ browser }) => {
    const { ctx, page } = await login(browser, "instructor");
    await page.goto(`/staff/voice/development/${F.ids.voiceOnly}`);
    const save = async (kind: string, week: string, ratings: Record<string, string>, share: boolean) => {
      await page.getByLabel("Week", { exact: true }).fill(week);
      await page.getByLabel("Kind").selectOption({ label: kind });
      for (const [area, v] of Object.entries(ratings)) await page.getByLabel(`Rating for ${area}`).selectOption({ index: Number(v) });
      if (share) await page.getByLabel("Share with the student now").check(); else await page.getByLabel("Share with the student now").uncheck();
      await page.getByRole("button", { name: "Save progress check" }).click();
      await expect(page.getByText(share ? "Saved and shared." : "Saved privately.")).toBeVisible();
      await page.reload();
    };
    await save("Baseline (starting point)", "1", { "Posture and breath management": "2", "Pitch accuracy and ear training": "3" }, false);
    await save("Mid-program check", "2", { "Posture and breath management": "4", "Pitch accuracy and ear training": "3" }, true);
    const table = page.getByRole("table", { name: /Skill ratings/ });
    await expect(table.getByRole("row", { name: /Posture and breath/ })).toContainText("+2");
    await expect(table.getByRole("row", { name: /Pitch accuracy/ })).toContainText("no change");
    await expect(table.getByRole("row", { name: /Vocal range/ })).toContainText("—"); // not rated
    // an area that is not in the plan is refused by the database
    const bad = await rest("instructor", "rpc/dp_progress_check_save", { method: "POST", body: JSON.stringify({ pid: (await (await rest("instructor", "dp_voice_plans?select=id&status=eq.active&is_sample=eq.false")).json())[0].id, wk: 1, check_kind: "progress", rate: { harmony: 3 }, good: "", focus: "", private_notes: "", share: false }) });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    await ctx.close();
    const s = await login(browser, "voiceOnly");
    await s.page.goto("/voice/plan");
    const st = s.page.getByRole("table", { name: /Skill ratings/ });
    await expect(st.getByRole("row", { name: /Posture and breath/ })).toBeVisible();
    await expect(st.getByRole("row", { name: /Posture and breath/ })).not.toContainText("+2"); // baseline was private, so no comparison yet
    await expect(st.getByRole("row", { name: /Posture and breath/ })).toContainText("4");
    await s.ctx.close();
  });

  test("a sample pathway can start a draft for a student but never becomes their record automatically", async ({ browser }) => {
    const inst = await login(browser, "instructor");
    // use a student with no plan yet: the second voice student is the "multi" fixture
    await inst.page.goto("/staff/voice/development/sample");
    const scenario = inst.page.getByRole("region", { name: "Scenario a" });
    await scenario.getByLabel("Student for scenario a").selectOption({ label: F.users.multi.name });
    await scenario.getByRole("button", { name: "Create draft for review" }).click();
    await inst.page.waitForURL(new RegExp(`/staff/voice/development/${F.ids.multi}`));
    await expect(inst.page.getByRole("note").filter({ hasText: "copied from a sample pathway" })).toBeVisible();
    const drafts = await (await rest("instructor", `dp_voice_plans?select=title,status,is_sample,source_sample_id&student_id=eq.${F.ids.multi}`)).json();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ status: "draft", is_sample: false, title: "Development plan (draft for review)" });
    expect(JSON.stringify(drafts)).not.toMatch(/Stephanie/);
    // not visible to the student, and cannot be approved before the confirmation
    const sees = await (await rest("multi", "dp_voice_plans?select=id")).json();
    expect(sees).toEqual([]);
    inst.page.once("dialog", (d) => d.accept());
    await inst.page.getByRole("button", { name: "Approve and share" }).click();
    await expect(inst.page.getByText(/came from a sample/)).toBeVisible();
    // the sample row itself is staff-only and has no student
    const sample = await (await rest("instructor", "dp_voice_plans?select=student_id,is_sample&is_sample=eq.true")).json();
    expect(sample[0]).toEqual({ student_id: null, is_sample: true });
    expect(await (await rest("multi", "dp_voice_plans?select=id&is_sample=eq.true")).json()).toEqual([]);
    inst.page.once("dialog", (d) => d.accept());
    await inst.page.getByRole("button", { name: /I replaced the sample's assumptions/ }).click();
    await expect(inst.page.getByText(/Confirmed\. You can now approve/)).toBeVisible();
    await inst.ctx.close();
  });
});
