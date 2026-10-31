import { CREATIVE_EXPRESSION } from "./creative-expression";
import { HEARING_GOD_PENDING } from "./hearing-god";
import { PERSONAL_TIME } from "./personal-time";
import type { AssessmentDef, AssessmentKind } from "./types";

export * from "./types";
export * from "./intake";
export * from "./summaries";
export * from "./plan";
export * from "./ratings";
export * from "./import-mapping";
export { PERSONAL_TIME, TONGUES_FOLLOW_UP } from "./personal-time";
export { CREATIVE_EXPRESSION, OBSERVATION_DIMENSIONS, OBSERVATION_LEVELS } from "./creative-expression";
export { HEARING_GOD_PENDING, parseHearingGodSource, toDefinition, summarizeHearingGod } from "./hearing-god";

export const ASSESSMENTS: Record<AssessmentKind, AssessmentDef> = { personal_time: PERSONAL_TIME, creative_expression: CREATIVE_EXPRESSION, hearing_god: HEARING_GOD_PENDING };
/** Specialized assessments an instructor may assign. Prophetic-reception material needs the student's choice of that track AND the instructor's authorization.
 *  There is no technical-assessment kind: the technical baseline is the Vocal Demo recorded at the consultation. */
export function assignableKinds(selectedTracks: string[], approvedTracks: string[] = []): AssessmentKind[] {
  return (Object.values(ASSESSMENTS)).filter((d) => d.status === "ready" && (!d.requiresTrack || (selectedTracks.includes(d.requiresTrack) && approvedTracks.includes(d.requiresTrack)))).map((d) => d.kind);
}
