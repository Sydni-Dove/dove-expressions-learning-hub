import { draftPlan, type DraftPlan, type PlanInput } from "./plan";

/**
 * SAMPLE PATHWAY — NOT A STUDENT RECORD. Stephanie's known interest is prophetic flow and ad-libbing. Nothing else about her is assumed:
 * not how she receives impressions, her private worship practice, whether she sings in tongues, or her technical level. The instructor picks
 * activities from what is actually found, so the same interest leads to different plans for different findings. Every scenario below is
 * hypothetical and exists to show that selection logic. It is kept apart from any real student record until the instructor reviews it.
 */
export const STEPHANIE_INTEREST = "prophetic flow, ad-libbing, worship expression";

export interface Scenario { id: string; finding: string; input: PlanInput; plan: DraftPlan }
const base: Omit<PlanInput, "observed"> = {
  packageType: "twelve_week",
  consultationNotes: `Interested in ${STEPHANIE_INTEREST}.`,
  intake: { goals: `I'd like to grow in ${STEPHANIE_INTEREST}.` },
  selectedTracks: ["spontaneous_expression", "prophetic_worship"]
};
function scenario(id: string, finding: string, observed: PlanInput["observed"], approvedTracks: PlanInput["approvedTracks"]): Scenario {
  const input = { ...base, observed, approvedTracks };
  return { id, finding, input, plan: draftPlan(input) };
}
export function stephanieScenarios(): Scenario[] {
  return [
    scenario("a", "If, once reviewed, she is confident improvising over instrumentals but loses the key when she ad-libs over a song with a lead singer",
      { "track-spontaneous-expression": "intermediate", improvisation: "intermediate", "pitch-ear": "beginner" }, ["spontaneous_expression", "prophetic_worship"]),
    scenario("b", "If, once reviewed, she hesitates to make up melodies at all, so improvising is where support starts",
      { improvisation: "beginner", "track-spontaneous-expression": "beginner" }, ["spontaneous_expression", "prophetic_worship"]),
    scenario("c", "If she wants prophetic worship but the instructor has not approved that track yet (the plan then holds it back and says why)",
      { improvisation: "intermediate" }, ["spontaneous_expression"])
  ];
}
