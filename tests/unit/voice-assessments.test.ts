import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { ASSESSMENTS, PERSONAL_TIME, CREATIVE_EXPRESSION, TONGUES_FOLLOW_UP, assignableKinds, questionsOf, summarizePersonalTime, summarizeCreative,
  parseIntakeCsv, requestedTracks, draftPlan, effectiveTracks, parseHearingGodSource, toDefinition, summarizeHearingGod, INTAKE_QUESTIONS } from "@/lib/voice-assessments";
import { stephanieScenarios } from "@/lib/voice-assessments/stephanie";
import { ALL_AREAS } from "@/lib/voice-curriculum";

describe("Personal Time With God", () => {
  it("keeps the instructor's 13 questions and wording", () => {
    const doc = fs.readFileSync("docs/voice-coaching-curriculum-and-personal-time-assessment.md", "utf8");
    const qs = questionsOf(PERSONAL_TIME);
    expect(qs).toHaveLength(13);
    for (const q of qs) expect(doc, q.id).toContain(q.text);
    for (const o of qs[0].options!.filter((x) => x !== "Prefer not to answer")) expect(doc).toContain(o.split("–").join("–"));
  });
  it("is optional throughout and never scored", () => {
    expect(questionsOf(PERSONAL_TIME).every((q) => !q.required)).toBe(true);
    const s = summarizePersonalTime({ q1: "Rarely", q2: "Prefer not to answer", q4: "Often", q12: "Please no tongues" }) as Record<string, unknown>;
    expect(Object.keys(s).some((k) => /score|total|rank|level/i.test(k))).toBe(false);
    expect(s.doNotInclude).toBe("Please no tongues");
    expect((s.skipped as string[]).length).toBeGreaterThan(5);
  });
  it("is offered only when the student chose Prophetic Worship Development", () => {
    expect(assignableKinds([])).toEqual(["creative_expression"]);
    expect(assignableKinds(["worship_leadership"])).toEqual(["creative_expression"]);
    expect(assignableKinds(["prophetic_worship"])).not.toContain("personal_time"); // the student's choice alone is not enough
    expect(assignableKinds([], ["prophetic_worship"])).not.toContain("personal_time"); // neither is the instructor's approval alone
    expect(assignableKinds(["prophetic_worship"], ["prophetic_worship"])).toContain("personal_time");
  });
  it("keeps the tongues follow-up out of the general intake and the assessment", () => {
    expect(TONGUES_FOLLOW_UP.length).toBe(2);
    const text = JSON.stringify([INTAKE_QUESTIONS, PERSONAL_TIME]).toLowerCase();
    expect(text.includes("tongues")).toBe(false);
  });
});

describe("no separate technical assessment after purchase", () => {
  it("offers only specialized assessments; the technical baseline is the consultation Vocal Demo", () => {
    expect(Object.keys(ASSESSMENTS).sort()).toEqual(["creative_expression", "hearing_god", "personal_time"]);
    const text = JSON.stringify(Object.values(ASSESSMENTS).map((a) => a.title)).toLowerCase();
    expect(text).not.toMatch(/technical|pitch accuracy|breath/);
  });
});

describe("Creative Vocal Expression", () => {
  it("separates ad-libbing over a song from instrumental-only free-flow", () => {
    const ids = questionsOf(CREATIVE_EXPRESSION).filter((q) => q.type === "recording").map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(["d_adlib", "d_instr", "d_call", "d_rhythm", "d_trans"]));
  });
  it("summarizes self-report plus instructor observations into suggestions, not grades", () => {
    const s = summarizeCreative({ s_adlib: "Not yet", s_instr: "Very comfortable", d_adlib: "rec-1" }, { o_call: "Emerging", o_key: "Strong" });
    expect(s.suggestedAreas).toContain("track-spontaneous-expression");
    expect(s.recordedCount).toBe(1);
    expect(s.observed.find((o) => o.id === "o_key")!.level).toBe("Strong");
  });
});

describe("Assessment A (How Does God Speak to You?)", () => {
  it("is not assignable and has no invented questions until the source is supplied", () => {
    expect(ASSESSMENTS.hearing_god.status).toBe("awaiting_source");
    expect(ASSESSMENTS.hearing_god.sections).toEqual([]);
    expect(assignableKinds(["prophetic_worship"], ["prophetic_worship"])).not.toContain("hearing_god");
  });
  it("imports a supplied source verbatim and reports prominent categories, allowing several", () => {
    // Synthetic fixture only: labels are placeholders, NOT the owner's wording or categories.
    const src = parseHearingGodSource({ title: "FIXTURE", categories: [{ id: "c1", name: "Category 1" }, { id: "c2", name: "Category 2" }, { id: "c3", name: "Category 3" }],
      questions: [{ id: "q1", text: "Fixture question 1", options: [{ id: "a", text: "A", category: "c1" }, { id: "b", text: "B", category: "c2" }] },
                  { id: "q2", text: "Fixture question 2", options: [{ id: "a", text: "C", category: "c1" }, { id: "b", text: "D", category: "c3" }] },
                  { id: "q3", text: "Fixture question 3", options: [{ id: "a", text: "E", category: "c2" }, { id: "b", text: "F", category: "c3" }] }] });
    expect(toDefinition(src).status).toBe("ready");
    const r = summarizeHearingGod(src, { q1: ["A", "B"], q2: ["C"], q3: ["E"] });
    expect(r.filter((x) => x.prominent).map((x) => x.id).sort()).toEqual(["c1", "c2"]);
    expect(() => parseHearingGodSource({ title: "x", categories: [{ id: "c1", name: "n" }], questions: [{ id: "q", text: "t", options: [{ id: "a", text: "A", category: "zzz" }, { id: "b", text: "B", category: "c1" }] }] })).toThrow();
  });
});

describe("Google Forms intake import", () => {
  const header = `Timestamp,Email Address,What would you most like to get out of voice coaching?,Creative Worship Expression is optional. Which: if any: interest you?,Favorite color`;
  it("maps columns by question text, handles quotes, ignores unknown columns", () => {
    const csv = `${header.replace("Which: if any:", "Which, if any,")}\n"10/30/2026 9:00",Student@Example.com,"Grow in ""ad-libbing"", and harmony","Spontaneous Vocal Expression; Prophetic Worship Development",blue\n"x",,no email,,`;
    const r = parseIntakeCsv(csv.replace(/^Timestamp,Email Address,What would you most like to get out of voice coaching\?,Creative Worship Expression is optional\. Which, if any, interest you\?/, 'Timestamp,Email Address,What would you most like to get out of voice coaching?,"Creative Worship Expression is optional. Which, if any, interest you?"'));
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].email).toBe("student@example.com");
    expect(r.rows[0].answers.goals).toBe('Grow in "ad-libbing", and harmony');
    expect(requestedTracks(r.rows[0].answers).sort()).toEqual(["prophetic_worship", "spontaneous_expression"]);
    expect(r.rejected).toEqual([{ line: 3, reason: "Missing or invalid email" }]);
    expect(r.unmatchedColumns).toContain("Favorite color");
  });
});

describe("personalized plan draft", () => {
  it("supports single, monthly and 12-week plans with checkpoints", () => {
    expect(draftPlan({ packageType: "single" }).units).toHaveLength(1);
    const m = draftPlan({ packageType: "monthly" });
    expect(m.units).toHaveLength(4);
    expect(m.units[3].checkpoint).toBe("final");
    const t = draftPlan({ packageType: "twelve_week", intake: { goals: "I want better breath and pitch" } });
    expect(t.units).toHaveLength(12);
    expect(t.units.filter((u) => u.checkpoint).map((u) => [u.week, u.checkpoint])).toEqual([[4, "progress"], [8, "midpoint"], [12, "final"]]);
    expect(t.units.every((u) => u.segmentAdvice.includes("3–5 minute"))).toBe(true);
  });
  it("is not an identical sequence: different findings give different plans", () => {
    const a = draftPlan({ packageType: "twelve_week", observed: { "range": "beginner", harmony: "beginner" } });
    const b = draftPlan({ packageType: "twelve_week", intake: { goals: "stamina and confidence on stage" } });
    expect(a.units.map((u) => u.areaKey)).not.toEqual(b.units.map((u) => u.areaKey));
    expect(a.units[0].areaKey).toBe("range");
  });
  it("includes an optional track only when the student chose it AND the instructor approved it", () => {
    const goals = { goals: "ad-libbing and prophetic worship" };
    const none = draftPlan({ packageType: "twelve_week", intake: goals });
    expect(none.units.some((u) => ALL_AREAS.find((a) => a.key === u.areaKey)?.track)).toBe(false);
    const chosenOnly = draftPlan({ packageType: "twelve_week", intake: goals, selectedTracks: ["prophetic_worship"] });
    expect(chosenOnly.units.some((u) => u.areaKey === "track-prophetic-worship")).toBe(false);
    expect(chosenOnly.tracksHeldBack[0].reason).toMatch(/not approved/);
    const approvedOnly = draftPlan({ packageType: "twelve_week", intake: goals, approvedTracks: ["prophetic_worship"] });
    expect(approvedOnly.units.some((u) => u.areaKey === "track-prophetic-worship")).toBe(false);
    const both = draftPlan({ packageType: "twelve_week", intake: goals, selectedTracks: ["prophetic_worship"], approvedTracks: ["prophetic_worship"] });
    expect(both.units.some((u) => u.areaKey === "track-prophetic-worship")).toBe(true);
    expect(effectiveTracks(["prophetic_worship"], [])).toEqual([]);
  });
  it("never picks exercises outside the area, and singing-in-tongues is never auto-assigned", () => {
    const p = draftPlan({ packageType: "twelve_week", selectedTracks: ["prophetic_worship"], approvedTracks: ["prophetic_worship"], intake: { goals: "prophetic" }, observed: { "track-prophetic-worship": "advanced" } });
    for (const u of p.units) {
      const area = ALL_AREAS.find((a) => a.key === u.areaKey)!;
      expect(u.exerciseKeys.every((k) => area.exercises.some((e) => e.key === k))).toBe(true);
      expect(u.exerciseKeys).not.toContain("optional-tongues");
    }
  });
});

describe("plan built from the Vocal Demo baseline", () => {
  it("starts where the demo found the student, and the demo is overridden only by the instructor's own observations", () => {
    const p = draftPlan({ packageType: "monthly", demo: { range: 1, "pitch-ear": 2, "posture-breath": 5, agility: 4 } });
    expect(p.units[0].areaKey).toMatch(/range|pitch-ear/);
    expect(p.units[0].level).toBe("beginner");
    expect(p.basis).toContain("Vocal Demo (baseline)");
    const override = draftPlan({ packageType: "monthly", demo: { range: 1 }, observed: { range: "advanced" } });
    expect(override.units.find((u) => u.areaKey === "range")?.level ?? "advanced").not.toBe("beginner");
  });
});

describe("Stephanie sample pathway", () => {
  const sc = stephanieScenarios();
  it("changes with the findings and does not assume anything about her", () => {
    expect(new Set(sc.map((s) => s.plan.units.map((u) => u.areaKey).join())).size).toBe(3);
    expect(JSON.stringify(sc.map((s) => s.input)).toLowerCase()).not.toMatch(/tongue/);
    expect(sc[2].plan.tracksHeldBack.some((h) => h.track === "prophetic_worship")).toBe(true);
    expect(sc[2].plan.units.some((u) => u.areaKey === "track-prophetic-worship")).toBe(false);
  });
});
