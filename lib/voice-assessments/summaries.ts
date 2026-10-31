import { PERSONAL_TIME } from "./personal-time";
import { CREATIVE_EXPRESSION, OBSERVATION_DIMENSIONS, OBSERVATION_LEVELS } from "./creative-expression";
import { isAnswered, PREFER_NOT, questionsOf, type Answers } from "./types";

export interface SummaryLine { topic: string; label: string; answer: string }
/** Personal Time With God: a plain restatement grouped by purpose. No totals, no ranking, no spiritual rating. Skipped / "prefer not" are shown as such. */
export function summarizePersonalTime(answers: Answers) {
  const lines: SummaryLine[] = [];
  const skipped: string[] = [];
  for (const q of questionsOf(PERSONAL_TIME)) {
    const v = answers[q.id];
    if (!isAnswered(v) || v === PREFER_NOT) { skipped.push(q.text); continue; }
    lines.push({ topic: q.topic ?? "", label: q.text, answer: Array.isArray(v) ? v.join(", ") : v });
  }
  const groups = ["frequency", "structure", "private_worship", "listening", "spontaneous_singing", "expressing_impressions", "declarations", "challenges", "growth", "boundaries", "background"];
  lines.sort((a, b) => groups.indexOf(a.topic) - groups.indexOf(b.topic));
  const growth = (answers.q11 as string[] | undefined) ?? [];
  const avoid = typeof answers.q12 === "string" ? answers.q12.trim() : "";
  return { lines, skipped, wantsToGrowIn: growth, doNotInclude: avoid || null, note: "Self-reported. Time spent is context, not a grade." };
}

const COMFORT_RANK: Record<string, number> = { "Not yet": 0, "Somewhat": 1, "Comfortable": 2, "Very comfortable": 3 };
const ITEM_AREA: Record<string, string> = { s_melody: "improvisation", s_adlib: "track-spontaneous-expression", s_call: "track-spontaneous-expression", s_rhythm: "pitch-ear", s_key: "pitch-ear", s_instr: "track-spontaneous-expression", s_trans: "confidence-mic" };

export function summarizeCreative(answers: Answers, observations: Record<string, string> = {}) {
  const self = questionsOf(CREATIVE_EXPRESSION).filter((q) => q.id.startsWith("s_") && q.type === "single").map((q) => ({ id: q.id, label: q.text, answer: (answers[q.id] as string | undefined) ?? "" }));
  const demos = questionsOf(CREATIVE_EXPRESSION).filter((q) => q.type === "recording").map((q) => ({ id: q.id, label: q.text, recordingId: (answers[q.id] as string | undefined) || null }));
  const observed = OBSERVATION_DIMENSIONS.map((d) => ({ id: d.id, label: d.label, level: OBSERVATION_LEVELS.includes(observations[d.id] as never) ? observations[d.id] : "Not yet observed", area: d.area }));
  /** Areas to look at first: the student says "not yet / somewhat", or the instructor heard "emerging". Suggestions only; the instructor decides. */
  const focus = new Set<string>();
  for (const s of self) if (s.answer in COMFORT_RANK && COMFORT_RANK[s.answer] <= 1) focus.add(ITEM_AREA[s.id]);
  for (const o of observed) if (o.level === "Emerging" || o.level === "Developing") focus.add(o.area);
  return { self, demos, observed, suggestedAreas: [...focus], recordedCount: demos.filter((d) => d.recordingId).length };
}
