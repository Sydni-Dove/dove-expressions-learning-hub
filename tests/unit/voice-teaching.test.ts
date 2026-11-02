import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { TEACHING_MODULES, CORE_STATEMENT, moduleByKey, studentView, wordCount } from "../../lib/voice-teaching";
import { buildTeachingSeedSql, SEED_FILE } from "../../scripts/generate-teaching-seed";

const all = (m: (typeof TEACHING_MODULES)[number]) => JSON.stringify(m);
describe("Worship Development teaching content", () => {
  it("has the three modules in order with unique keys", () => {
    expect(TEACHING_MODULES.map((m) => m.number)).toEqual([1, 2, 3]);
    expect(new Set(TEACHING_MODULES.map((m) => m.key)).size).toBe(3);
    expect(TEACHING_MODULES.map((m) => m.key)).toEqual(["praise-is-what-i-do", "being-in-the-word", "psyche-of-a-praiser"]);
  });
  it.each(TEACHING_MODULES.map((m) => [m.key, m] as const))("%s has every required component and is session-sized", (_k, m) => {
    expect(m.title && m.summary && m.mainMessage).toBeTruthy();
    expect(m.objectives.length).toBeGreaterThanOrEqual(4);
    expect(m.scriptures.length).toBeGreaterThanOrEqual(5);
    for (const s of m.scriptures) { expect(s.context.length).toBeGreaterThan(80); expect(s.paraphrase.length).toBeGreaterThan(30); }
    expect(m.student.points.length).toBeGreaterThanOrEqual(8);
    expect(m.student.discussion.length).toBeGreaterThanOrEqual(5);
    expect(m.student.activity.steps.length).toBeGreaterThanOrEqual(4);
    expect(m.student.reflection.length).toBeGreaterThanOrEqual(4);
    expect(m.student.assignment.steps.length).toBeGreaterThanOrEqual(4);
    expect(m.student.application.length).toBeGreaterThanOrEqual(4);
    expect(m.instructor.notes.length).toBeGreaterThanOrEqual(3);
    expect(m.instructor.cautions.length).toBeGreaterThanOrEqual(3);
    const mins = m.instructor.timing.reduce((n, t) => n + t.minutes, 0);
    expect(mins).toBeGreaterThanOrEqual(30); expect(mins).toBeLessThanOrEqual(45); expect(m.estimatedMinutes).toBeGreaterThanOrEqual(30); expect(m.estimatedMinutes).toBeLessThanOrEqual(45);
    expect(wordCount(m.student)).toBeGreaterThan(1500);
    expect(wordCount(m.instructor)).toBeGreaterThan(600);
  });
  it("includes the required scriptures for each module", () => {
    const need: Record<string, string[]> = {
      "praise-is-what-i-do": ["John 4:23", "Romans 12:1", "Psalm 34:1", "Colossians 3:16", "Philippians 2:3"],
      "being-in-the-word": ["Psalm 119:11", "Joshua 1:8", "2 Timothy 3:16", "Colossians 3:16", "John 15:4", "Hebrews 5:13"],
      "psyche-of-a-praiser": ["2 Corinthians 10:3", "Ephesians 6:10", "1 Peter 5:8", "Romans 8:1", "Philippians 4:6", "2 Timothy 1:7", "1 Kings 19", "Luke 22:31"]
    };
    for (const [k, refs] of Object.entries(need)) { const refsHave = moduleByKey(k)!.scriptures.map((s) => s.ref); for (const r of refs) expect(refsHave.some((h) => h.startsWith(r)), `${k} ${r}`).toBe(true); }
  });
  it("Module 3 has the featured subsection with the verbatim core statement and the careful scripture use", () => {
    const m = moduleByKey("psyche-of-a-praiser")!;
    expect(m.student.featured?.title).toBe("Gifted but Still Growing: When the Platform Comes Before Spiritual Maturity");
    expect(m.student.featured?.coreStatement).toBe("The youngest in the Kingdom may face some of the hardest challenges in praise and worship ministry because they’re still developing the spiritual maturity and discernment needed to withstand the pressures they encounter.");
    expect(CORE_STATEMENT).toBe(m.student.featured?.coreStatement);
    expect(m.student.featured!.sections.length).toBeGreaterThanOrEqual(6);
    const f = JSON.stringify(m.student.featured);
    for (const r of ["Ephesians 4:14", "Hebrews 5:13", "1 Timothy 3:6", "1 Peter 5:8", "Luke 22:31"]) expect(f).toContain(r);
    expect(f).toMatch(/does not say that the devil always targets the youngest/);
    expect(f).toMatch(/about overseers/);
    expect(f).toMatch(/not a direct command|not treat it as a command/);
    expect(m.student.leaders?.title).toBe("How to Protect and Develop Spiritually Young Worshipers");
    const l = JSON.stringify(m.student.leaders).toLowerCase();
    for (const w of ["mentor", "encourag", "teach", "responsibility", "accountab"]) expect(l).toContain(w);
    expect(l).toMatch(/fear-based/); expect(l).toMatch(/every hard day is a demonic attack/);
    expect(m.instructor.featuredNotes?.length).toBeGreaterThan(3);
    expect(m.instructor.leaderNotes?.length).toBeGreaterThan(0);
    expect(JSON.stringify(m.instructor.cautions)).toMatch(/988/);
  });
  it("covers every battle topic required in Module 3, with before/during/after", () => {
    const t = all(moduleByKey("psyche-of-a-praiser")!).toLowerCase();
    for (const w of ["fear", "shame", "condemnation", "comparison", "insecurity", "rejection", "criticism", "performance anxiety", "perfectionism", "discouragement", "weariness", "distraction", "pride", "spiritual opposition", "discern", "before", "during", "after"]) expect(t).toContain(w);
  });
  it("never reproduces song lyrics and keeps instructor notes out of the student view", () => {
    for (const m of TEACHING_MODULES) {
      const v = JSON.stringify(studentView(m));
      expect(Object.keys(studentView(m))).not.toContain("instructor"); expect(v).not.toContain('"cautions"'); expect(v).not.toContain('"facilitation"'); expect(v).not.toContain('"timing"');
      for (const n of [...m.instructor.notes, ...(m.instructor.featuredNotes ?? [])]) expect(v).not.toContain(n.body[0]);
      expect(m.instructor.cautions.join(" ")).toMatch(/lyrics/i);
    }
    expect(all(moduleByKey("praise-is-what-i-do")!)).toMatch(/theme/i);
  });
  it("the generated seed migration matches the source (no drift)", () => {
    expect(fs.readFileSync(SEED_FILE, "utf8")).toBe(buildTeachingSeedSql());
  });
});
