import { PREFER_NOT, type AssessmentDef } from "./types";

const P = PREFER_NOT;
/** Wording and answer options are the instructor's 13-question draft (docs/voice-coaching-curriculum-and-personal-time-assessment.md), unchanged.
 *  Offered ONLY to students who explicitly chose Prophetic Worship Development. Not scored, ranked or used to label spiritual maturity. */
export const PERSONAL_TIME: AssessmentDef = {
  kind: "personal_time",
  title: "Personal Time With God",
  intro: "This helps your coach understand your current practices and tailor support. There are no right answers and no judgment. You may skip any question. Your responses are visible only to you and your coach, not other students.",
  status: "ready",
  requiresTrack: "prophetic_worship",
  sections: [{
    id: "main", title: "Personal Time With God",
    questions: [
      { id: "q1", topic: "frequency", type: "single", text: "How often do you currently make intentional time for prayer, worship, Scripture, or quiet reflection?", options: ["Daily", "4–6 days weekly", "2–3 days weekly", "About weekly", "Occasionally", "Rarely", P] },
      { id: "q2", topic: "structure", type: "single", text: "How much time do you usually spend in a session?", options: ["Under 10 minutes", "10–20", "21–40", "More than 40", "Varies", P] },
      { id: "q3", topic: "structure", type: "multi", text: "What activities are part of that time?", options: ["Prayer", "Scripture reading", "Scripture study", "Singing or worship music", "Quiet listening", "Journaling", "Other", P] },
      { id: "q4", topic: "spontaneous_singing", type: "single", text: "How often do you sing spontaneously or improvise during private worship?", options: ["Often", "Sometimes", "Rarely", "Never", "Unsure", P] },
      { id: "q5", topic: "private_worship", type: "single", text: "Do you currently use instrumental worship music in your personal time?", options: ["Often", "Sometimes", "Rarely", "Never", P] },
      { id: "q6", topic: "declarations", type: "single", text: "How comfortable are you with expressing a Scripture through your own sung words?", options: ["Very", "Somewhat", "Not yet", "Unsure", P] },
      { id: "q7", topic: "expressing_impressions", type: "single", text: "Have you experienced what you personally understand as prophetic impressions, words, images, or utterances?", options: ["Often", "Sometimes", "Rarely", "Never", "Unsure", P] },
      { id: "q8", topic: "listening", type: "text", text: "When you believe you receive something from God, how do you usually reflect on or discern it?", help: "Optional short answer" },
      { id: "q9", topic: "private_worship", type: "text", text: "What helps you connect with God during personal worship?", help: "Optional short answer" },
      { id: "q10", topic: "challenges", type: "text", text: "What, if anything, feels challenging about personal worship or spontaneous singing?", help: "Optional short answer" },
      { id: "q11", topic: "growth", type: "multi", text: "What would you like to grow in through coaching?", options: ["consistency in private worship", "Scripture-to-song", "spontaneous melody", "lyrical ad-libs", "call & response", "discernment", "leading a congregation", "other"] },
      { id: "q12", topic: "boundaries", type: "text", text: "Are there any spiritual practices or topics you do NOT want included in your coaching?", help: "Optional short answer" },
      { id: "q13", topic: "background", type: "text", text: "Is there anything else you want your instructor to know about your worship background or beliefs?", help: "Optional short answer" }
    ]
  }]
};

/** Separate, conditional follow-up. Shown ONLY after a student chose Prophetic Worship Development AND asked about singing in tongues.
 *  It is stored on the student's voice profile, never on the general intake, and participation is never treated as a competence requirement. */
export const TONGUES_FOLLOW_UP = [
  { id: "tongues_request", text: "Would you like coaching on singing in tongues as part of your worship practice?", options: ["Yes", "No", "Unsure"] },
  { id: "tongues_respect", text: "Is there anything about your church tradition or beliefs you'd like your coach to respect?", help: "Optional short answer" }
] as const;
