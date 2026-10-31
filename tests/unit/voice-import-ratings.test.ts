import { describe, expect, it } from "vitest";
import { buildPreview, compareRatings, type CheckRow, describeChange, matchOptions, suggestMapping, importKey, INTAKE_QUESTIONS } from "@/lib/voice-assessments";

const roster = [{ id: "s1", email: "ada@example.com" }, { id: "s2", email: "bo@example.com" }];
const csv = (rows: string[][]) => rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");

describe("import mapping does not depend on exact wording", () => {
  const headers = ["Timestamp", "Email", "Why are you here? What do you want from lessons?", "Tell us about your voice background", "Which areas are you interested in?", "Do any of the optional Creative Worship Expression tracks appeal to you?", "Favourite colour"];
  it("suggests fields from similar wording and leaves the rest unmapped", () => {
    const { mapping, source } = suggestMapping(headers);
    expect(mapping["Email"]).toBe("email");
    expect(mapping["Timestamp"]).toBe("timestamp");
    expect(mapping["Why are you here? What do you want from lessons?"]).toBe("goals");
    expect(mapping["Tell us about your voice background"]).toBe("singing_experience");
    expect(mapping["Which areas are you interested in?"]).toBe("interest_areas");
    expect(mapping["Do any of the optional Creative Worship Expression tracks appeal to you?"]).toBe("creative_worship");
    expect(mapping["Favourite colour"]).toBe("");
    expect(source["Favourite colour"]).toBe("none");
  });
  it("a saved mapping wins over a suggestion, can ignore a column, and survives punctuation/case changes", () => {
    const { mapping, source } = suggestMapping(headers, { "WHY ARE YOU HERE? what do you want from lessons": "notes", "Tell us about your voice background": "" });
    expect(mapping["Why are you here? What do you want from lessons?"]).toBe("notes");
    expect(mapping["Tell us about your voice background"]).toBe("");
    expect(source["Tell us about your voice background"]).toBe("saved");
  });
  it("never maps two columns to one field", () => {
    const m = suggestMapping(["Email", "Your email address"]).mapping;
    expect(Object.values(m).filter((v) => v === "email")).toHaveLength(1);
  });
  it("splits multi-select answers without breaking options that contain commas", () => {
    const opts = (INTAKE_QUESTIONS.find((q) => q.id === "interest_areas") as { options: readonly string[] }).options;
    const got = matchOptions("Vocal Foundations (breath, pitch, tone, range), Harmony and blending, Something new", opts);
    expect(got).toEqual(expect.arrayContaining(["Vocal Foundations (breath, pitch, tone, range)", "Harmony and blending", "Something new"]));
    expect(got).toHaveLength(3);
  });
});

describe("preview before import", () => {
  const text = csv([["Timestamp", "Email", "Why are you here?", "Favourite colour"],
    ["10/30/2026 9:00:00", "ada@example.com", "Ad-libbing", "blue"], ["10/30/2026 9:05:00", "nobody@example.com", "Harmony", "red"], ["10/30/2026 9:06:00", "not-an-email", "x", ""]]);
  it("reports each row, warns about ignored columns and blank questions, and flags repeats", async () => {
    const first = await buildPreview(text, { roster, existingKeys: new Set() });
    expect(first.counts).toEqual({ new: 1, duplicate: 0, not_enrolled: 1, invalid: 1 });
    expect(first.rows[0].answers.goals).toBe("Ad-libbing");
    expect(first.warnings.join(" ")).toMatch(/Favourite colour/);
    expect(first.warnings.join(" ")).toMatch(/no matching column/);
    const key = first.rows[0].key!;
    const second = await buildPreview(text, { roster, existingKeys: new Set([key]) });
    expect(second.counts.new).toBe(0); expect(second.counts.duplicate).toBe(1);
  });
  it("the same row twice in one file imports once; a different submission time is a new response", async () => {
    const dup = csv([["Timestamp", "Email", "Why are you here?"], ["t1", "ada@example.com", "a"], ["t1", "ada@example.com", "a"], ["t2", "ada@example.com", "a"]]);
    const p = await buildPreview(dup, { roster, existingKeys: new Set() });
    expect(p.rows.map((r) => r.status)).toEqual(["new", "duplicate", "new"]);
  });
  it("warns clearly when no email column can be found", async () => {
    const p = await buildPreview(csv([["Why are you here?"], ["x"]]), { roster, existingKeys: new Set() });
    expect(p.warnings[0]).toMatch(/student's email/);
    expect(p.counts.invalid).toBe(1);
  });
  it("an import key is stable and depends on who, when and what", async () => {
    const a = await importKey("A@x.com", "t", { goals: "x" });
    expect(a).toBe(await importKey("a@x.com ", "t", { goals: "x" }));
    expect(a).not.toBe(await importKey("a@x.com", "t2", { goals: "x" }));
    expect(a).not.toBe(await importKey("a@x.com", "t", { goals: "y" }));
    expect(a.length).toBeGreaterThanOrEqual(16);
  });
});

describe("progress rating comparison", () => {
  const checks: CheckRow[] = [
    { kind: "baseline", week: 1, ratings: { "posture-breath": 2, "pitch-ear": 3 } },
    { kind: "midpoint", week: 8, ratings: { "posture-breath": 4, "pitch-ear": 3 } },
    { kind: "final", week: 12, ratings: { "posture-breath": 5 } }
  ];
  it("compares baseline, midpoint and final for the areas in the plan", () => {
    const rows = compareRatings(checks, ["posture-breath", "pitch-ear", "harmony"]);
    expect(rows[0]).toMatchObject({ areaKey: "posture-breath", baseline: 2, midpoint: 4, final: 5, latest: 5, change: 3 });
    expect(rows[1]).toMatchObject({ baseline: 3, midpoint: 3, final: null, latest: 3, change: 0 });
    expect(rows[2]).toMatchObject({ baseline: null, latest: null, change: null });
    expect(describeChange(3)).toBe("+3"); expect(describeChange(0)).toBe("no change"); expect(describeChange(null)).toBe("—");
  });
  it("ignores areas not in the plan and out-of-range values; the latest check of a kind wins", () => {
    const rows = compareRatings([...checks, { kind: "baseline", week: 2, ratings: { "posture-breath": 3, "pitch-ear": 9, other: 2 } }], ["posture-breath", "pitch-ear"]);
    expect(rows).toHaveLength(2);
    expect(rows[0].baseline).toBe(3);
    expect(rows[1].baseline).toBe(3); // 9 is not a valid rating; the earlier 3 stands
  });
});

describe("the Vocal Demo is the baseline (never collected twice)", () => {
  it("uses the demo as baseline when no separate baseline check exists, and says so", () => {
    const rows = compareRatings([{ kind: "midpoint", week: 6, ratings: { range: 4 } }], ["range", "pitch-ear"], { ratings: { range: 2, "pitch-ear": 3 } });
    expect(rows[0]).toMatchObject({ areaKey: "range", baseline: 2, baselineSource: "demo", midpoint: 4, change: 2 });
    expect(rows[1]).toMatchObject({ baseline: 3, baselineSource: "demo", change: 0 });
  });
  it("an explicit baseline check, if one is entered, takes precedence", () => {
    const rows = compareRatings([{ kind: "baseline", week: 1, ratings: { range: 3 } }], ["range"], { ratings: { range: 2 } });
    expect(rows[0]).toMatchObject({ baseline: 3, baselineSource: "check" });
  });
  it("shows no baseline when there is no demo and no check", () => {
    expect(compareRatings([], ["range"], null)[0]).toMatchObject({ baseline: null, baselineSource: null });
  });
});
