import type { AssessmentDef } from "./types";

const COMFORT = ["Not yet", "Somewhat", "Comfortable", "Very comfortable", "Unsure"];
/** Practical creative-vocal ability. Not faith-related, so any student may be assigned it. Self-report plus recorded demonstrations;
 *  the instructor adds an observation rubric (staff-only) after listening. Ad-libbing over a song and instrumental-only free-flow are separate tasks. */
export const CREATIVE_EXPRESSION: AssessmentDef = {
  kind: "creative_expression",
  title: "Creative Vocal Expression",
  intro: "This shows your coach where you are with creating melodies and responding musically. There are no wrong answers. Record each demonstration in My Practice Recordings (short is fine, about 3–5 minutes at most), then choose it below.",
  status: "ready",
  sections: [
    { id: "self", title: "How it feels right now", description: "Choose what fits today. You can skip any item.", questions: [
      { id: "s_melody", topic: "improvising", type: "single", text: "Making up a new melody on the spot", options: COMFORT },
      { id: "s_adlib", topic: "ad_lib", type: "single", text: "Adding ad-libs over a song that already has a lead singer", options: COMFORT },
      { id: "s_call", topic: "call_response", type: "single", text: "Call-and-response (answering a phrase with your own)", options: COMFORT },
      { id: "s_rhythm", topic: "rhythm", type: "single", text: "Keeping rhythm accurate while improvising", options: COMFORT },
      { id: "s_key", topic: "key", type: "single", text: "Staying in the key while making things up", options: COMFORT },
      { id: "s_instr", topic: "instrumental", type: "single", text: "Singing freely over instrumental-only music (no lead singer)", options: COMFORT },
      { id: "s_trans", topic: "transitions", type: "single", text: "Moving smoothly from one song or section to the next", options: COMFORT },
      { id: "s_notes", topic: "notes", type: "text", text: "What would you most like to be able to do?", help: "Optional short answer" }
    ] },
    { id: "demos", title: "Recorded demonstrations", description: "Do only the ones you want to. Each is a separate skill.", questions: [
      { id: "d_call", topic: "call_response", type: "recording", text: "Call and response: answer each phrase your coach gives you with a short phrase of your own." },
      { id: "d_adlib", topic: "ad_lib", type: "recording", text: "Ad-lib over a song: choose a song with a lead singer and add two or three short phrases in the gaps. Keep your volume below the lead." },
      { id: "d_instr", topic: "instrumental", type: "recording", text: "Free-flow over instrumental-only music: sing any melody you like for one to two minutes over the track your coach provides." },
      { id: "d_rhythm", topic: "rhythm", type: "recording", text: "Rhythm: sing a short repeated phrase with a steady beat (tap or use a metronome)." },
      { id: "d_trans", topic: "transitions", type: "recording", text: "Transition: sing the end of one song into the start of another, with a clear, smooth change." }
    ] }
  ]
};

/** Instructor observation after listening. Staff-only; descriptive levels, never a grade of the person. */
export const OBSERVATION_LEVELS = ["Not yet observed", "Emerging", "Developing", "Secure", "Strong"] as const;
export const OBSERVATION_DIMENSIONS = [
  { id: "o_melody", label: "Invents melodies", area: "improvisation" },
  { id: "o_adlib", label: "Ad-libs over a song without covering the lead", area: "track-spontaneous-expression" },
  { id: "o_call", label: "Call-and-response", area: "track-spontaneous-expression" },
  { id: "o_instr", label: "Free-flow over an instrumental", area: "track-spontaneous-expression" },
  { id: "o_rhythm", label: "Rhythmic accuracy", area: "pitch-ear" },
  { id: "o_key", label: "Stays in key", area: "pitch-ear" },
  { id: "o_trans", label: "Transitions and confidence", area: "confidence-mic" }
] as const;
