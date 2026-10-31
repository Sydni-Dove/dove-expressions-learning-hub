import { ALL_AREAS, LEVELS, areaByKey, type AreaSpec, type Level, type TrackKey } from "@/lib/voice-curriculum";
import { interestAreaKeys, type IntakeAnswers } from "./intake";

export type PackageType = "single" | "monthly" | "twelve_week";
export const PACKAGE_LESSONS: Record<PackageType, number> = { single: 1, monthly: 4, twelve_week: 12 };

export interface PlanInput {
  packageType: PackageType;
  intake?: IntakeAnswers;
  /** Free text from the consultation or the instructor's own goals for this student. */
  consultationNotes?: string;
  /** Tracks the STUDENT chose and tracks the INSTRUCTOR approved. A track enters a plan only if it is in both. */
  selectedTracks?: TrackKey[];
  approvedTracks?: TrackKey[];
  /** Instructor's observed level per area key (from the initial evaluation). Missing = not yet observed. */
  observed?: Record<string, Level | "secure">;
  /** Vocal Demo ratings (1-5 per skill area) recorded at the consultation: the technical baseline. Instructor observations, if given, override it. */
  demo?: Record<string, number>;
  /** Areas suggested by the Creative Vocal Expression summary. */
  creativeSuggestions?: string[];
  instructorNotes?: string;
}
export interface PlanUnit {
  seq: number; week: number; areaKey: string; areaTitle: string; level: Level;
  objective: string; exerciseKeys: string[]; assignmentKey: string | null;
  segmentAdvice: string; rationale: string[]; checkpoint: "progress" | "midpoint" | "final" | null; followUp: string[];
}
export interface DraftPlan {
  packageType: PackageType; units: PlanUnit[]; tracksIncluded: TrackKey[]; tracksHeldBack: { track: TrackKey; reason: string }[];
  basis: string[]; notes: string[];
}

export const effectiveTracks = (selected: TrackKey[] = [], approved: TrackKey[] = []) => selected.filter((t) => approved.includes(t));

function score(area: AreaSpec, input: PlanInput, interest: Set<string>, tracks: TrackKey[]) {
  const why: string[] = []; let s = 0;
  const lvl = input.observed?.[area.key];
  if (lvl === "beginner") { s += 4; why.push("instructor observed this as a starting point"); }
  else if (lvl === "intermediate") { s += 2; why.push("instructor observed room to develop"); }
  else if (lvl === "advanced") { s += 1; why.push("instructor observed this as already developing well"); }
  const text = `${input.intake?.goals ?? ""} ${input.intake?.styles ?? ""} ${input.consultationNotes ?? ""} ${input.instructorNotes ?? ""}`.toLowerCase();
  const hit = area.keywords.find((k) => text.includes(k.toLowerCase()));
  if (hit) { s += 3; why.push(`goals mention "${hit}"`); }
  if (interest.has(area.key)) { s += 2; why.push("chosen on the intake"); }
  if (input.creativeSuggestions?.includes(area.key)) { s += 2; why.push("Creative Vocal Expression suggested it"); }
  if (!input.observed?.[area.key] && ["posture-breath", "pitch-ear"].includes(area.key) && !s) { s += 1; why.push("foundation not yet observed"); }
  if (area.track && !tracks.includes(area.track)) return { s: -1, why };
  return { s, why };
}

function pickExercises(area: AreaSpec, level: Level, n = 3) {
  const order: Level[] = level === "beginner" ? ["beginner", "intermediate"] : level === "intermediate" ? ["intermediate", "beginner", "advanced"] : ["advanced", "intermediate"];
  const keys: string[] = [];
  for (const l of order) for (const e of area.exercises) if (!e.onlyOnRequest && (e.level === l || e.level === "all") && !keys.includes(e.key)) keys.push(e.key);
  return keys.slice(0, n);
}

/** Draft only. The instructor edits everything. Deterministic: the same inputs give the same draft, and different findings give different plans. */
export const levelFromRating = (n: number): Level => (n <= 2 ? "beginner" : n === 3 ? "intermediate" : "advanced");
export function draftPlan(raw: PlanInput): DraftPlan {
  const fromDemo = Object.fromEntries(Object.entries(raw.demo ?? {}).filter(([, v]) => Number.isInteger(v) && v >= 1 && v <= 5).map(([k, v]) => [k, levelFromRating(v)]));
  const input: PlanInput = { ...raw, observed: { ...fromDemo, ...(raw.observed ?? {}) } };
  const tracks = effectiveTracks(input.selectedTracks, input.approvedTracks);
  const held = (input.selectedTracks ?? []).filter((t) => !tracks.includes(t)).map((t) => ({ track: t, reason: "Student chose it, but the instructor has not approved it yet" }));
  for (const t of input.approvedTracks ?? []) if (!(input.selectedTracks ?? []).includes(t)) held.push({ track: t, reason: "Approved, but the student has not chosen it" });
  const interest = new Set(interestAreaKeys(input.intake ?? {}));
  const ranked = ALL_AREAS.map((a) => ({ a, ...score(a, input, interest, tracks) })).filter((x) => x.s >= 0)
    .sort((x, y) => y.s - x.s || x.a.number - y.a.number);
  const lessons = PACKAGE_LESSONS[input.packageType];
  const withSignal = ranked.filter((x) => x.s > 0);
  const pool = withSignal.length >= Math.min(3, lessons) ? withSignal : ranked;
  const units: PlanUnit[] = [];
  for (let i = 0; i < lessons; i++) {
    // Second half of a 12-week plan revisits the highest-priority areas at the next level; otherwise move down the ranking.
    const revisit = input.packageType === "twelve_week" && i >= 6;
    const pick = revisit ? pool[(i - 6) % Math.min(pool.length, 4)] : pool[i % pool.length];
    const observed = input.observed?.[pick.a.key];
    let level: Level = observed && observed !== "secure" ? (observed as Level) : "beginner";
    if (revisit || (i >= pool.length && !revisit)) level = LEVELS[Math.min(LEVELS.indexOf(level) + 1, 2)];
    const lv = pick.a.levels[level];
    const week = i + 1;
    const checkpoint = input.packageType === "twelve_week" ? (week === 4 ? "progress" : week === 8 ? "midpoint" : week === 12 ? "final" : null)
      : input.packageType === "monthly" ? (week === 4 ? "final" : null) : null;
    units.push({
      seq: i + 1, week, areaKey: pick.a.key, areaTitle: pick.a.title, level, objective: lv.goals[0],
      exerciseKeys: pickExercises(pick.a, level), assignmentKey: (pick.a.assignments.find((x) => x.level === level) ?? pick.a.assignments[0])?.key ?? null,
      segmentAdvice: "Record practice in 3–5 minute segments; save each part separately.",
      rationale: pick.why.length ? pick.why : ["balanced selection while more is learned about the student"],
      checkpoint, followUp: checkpoint ? pick.a.followUp.tasks.slice(0, 2) : []
    });
  }
  const basis = [input.intake?.goals ? "Intake goals" : "", input.consultationNotes ? "Consultation notes" : "", raw.demo && Object.keys(raw.demo).length ? "Vocal Demo (baseline)" : "", raw.observed && Object.keys(raw.observed).length ? "Instructor observations" : "", input.creativeSuggestions?.length ? "Creative Vocal Expression" : "", tracks.length ? "Approved optional tracks" : ""].filter(Boolean);
  const notes = [
    input.packageType === "twelve_week" ? "Progress checks at weeks 4 and 8 (mid-program), final evaluation in week 12. Revisit and adjust after each." : "",
    input.packageType === "monthly" ? "Follow-up check in lesson 4." : "",
    "This is a draft for the instructor to edit. Nothing is shown to the student until it is approved."
  ].filter(Boolean);
  return { packageType: input.packageType, units, tracksIncluded: tracks, tracksHeldBack: held, basis, notes };
}

export { areaByKey };
