import { describe, expect, it } from "vitest";
import { ALL_AREAS, CORE_AREAS, TRACK_AREAS, offeredAreas, allExercises, LEVELS } from "@/lib/voice-curriculum";

describe("voice curriculum content", () => {
  it("has the 12 required skill areas in order plus 3 separate optional tracks", () => {
    expect(CORE_AREAS.map((a) => a.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(TRACK_AREAS.map((a) => a.track).sort()).toEqual(["prophetic_worship", "spontaneous_expression", "worship_leadership"]);
  });
  it("gives every area every required component", () => {
    for (const a of ALL_AREAS) {
      expect(a.assessment.tasks.length, a.key).toBeGreaterThan(0);
      expect(a.assessment.indicators.length, a.key).toBeGreaterThan(2);
      for (const l of LEVELS) expect(a.levels[l].goals.length, `${a.key} ${l}`).toBeGreaterThan(0);
      expect(a.outline.length, a.key).toBeGreaterThan(3);
      expect(a.exercises.length, a.key).toBeGreaterThanOrEqual(3);
      expect(a.assignments.length, a.key).toBeGreaterThan(0);
      expect(a.progress.length, a.key).toBeGreaterThan(1);
      expect(a.followUp.tasks.length, a.key).toBeGreaterThan(0);
      for (const e of a.exercises) {
        expect(e.student.length, e.key).toBeGreaterThan(40);
        expect(e.demonstrate && e.coach && e.difficulties.length, e.key).toBeTruthy();
      }
    }
  });
  it("has unique keys", () => {
    const keys = allExercises().map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("does not require lip trills", () => {
    for (const e of allExercises()) {
      const text = `${e.title} ${e.student}`.toLowerCase();
      expect(text.includes("lip trill") || text.includes("lip roll"), e.key).toBe(false);
    }
  });
  it("only offers optional tracks the student selected", () => {
    expect(offeredAreas([]).every((a) => !a.track)).toBe(true);
    expect(offeredAreas(["spontaneous_expression"]).filter((a) => a.track).map((a) => a.track)).toEqual(["spontaneous_expression"]);
  });
  it("keeps singing in tongues optional and explicit-request only", () => {
    const t = allExercises().filter((e) => /tongues/i.test(e.title + e.student));
    expect(t.length).toBe(1);
    expect(t[0].area.track).toBe("prophetic_worship");
    expect(t[0].student).toMatch(/only if you have asked/i);
    expect(t[0].safety).toMatch(/explicitly requested/i);
  });
  it("cites the required Scripture in the prophetic track", () => {
    const refs = TRACK_AREAS.find((a) => a.track === "prophetic_worship")!.scripture!.map((s) => s.ref);
    for (const r of ["John 15:4-5", "1 Corinthians 14:3", "1 Corinthians 14:15", "Colossians 3:16"]) expect(refs).toContain(r);
  });
  it("distinguishes instrumental-only free-flow from ad-libbing over a song", () => {
    const t = TRACK_AREAS.find((a) => a.track === "spontaneous_expression")!;
    expect(t.exercises.some((e) => /over a song/i.test(e.title))).toBe(true);
    expect(t.exercises.some((e) => /instrumental-only/i.test(e.title))).toBe(true);
  });
});

import fs from "node:fs";
import { buildSeedSql } from "@/scripts/generate-curriculum-seed";
describe("curriculum seed migration", () => {
  it("matches the generator (no hand edits, no drift from the TypeScript source)", () => {
    expect(fs.readFileSync("supabase/migrations/20261030110000_dp_voice_curriculum_seed.sql", "utf8")).toBe(buildSeedSql());
  });
});
