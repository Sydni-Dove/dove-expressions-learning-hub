import { CREATIVE_EXPRESSION } from "./creative-expression";
import { HEARING_GOD_PENDING } from "./hearing-god";
import { PERSONAL_TIME } from "./personal-time";
import type { AssessmentDef, AssessmentKind } from "./types";

export * from "./types";
export * from "./intake";
export * from "./summaries";
export * from "./plan";
export { PERSONAL_TIME, TONGUES_FOLLOW_UP } from "./personal-time";
export { CREATIVE_EXPRESSION, OBSERVATION_DIMENSIONS, OBSERVATION_LEVELS } from "./creative-expression";
export { HEARING_GOD_PENDING, parseHearingGodSource, toDefinition, summarizeHearingGod } from "./hearing-god";

export const ASSESSMENTS: Record<AssessmentKind, AssessmentDef> = { personal_time: PERSONAL_TIME, creative_expression: CREATIVE_EXPRESSION, hearing_god: HEARING_GOD_PENDING };
/** Kinds an instructor may assign for a student. Prophetic-reception material needs the student's choice of that track. */
export function assignableKinds(selectedTracks: string[]): AssessmentKind[] {
  return (Object.values(ASSESSMENTS)).filter((d) => d.status === "ready" && (!d.requiresTrack || selectedTracks.includes(d.requiresTrack))).map((d) => d.kind);
}
