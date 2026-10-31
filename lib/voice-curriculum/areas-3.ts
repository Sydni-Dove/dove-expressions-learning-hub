import type { AreaSpec } from "./types";

export const AREAS_3: AreaSpec[] = [
{
  key: "interpretation", number: 9, title: "Song interpretation and emotional expression", skillSlug: "interpretation",
  studentSummary: "Understand what a song is saying and let your voice carry its meaning honestly.",
  instructorSummary: "Interpretation is about meaning before technique. Help the student say what the song says, choose where it is quiet or strong, and let sincere expression replace performance habits. For worship songs, keep it honest rather than theatrical.",
  assessment: {
    tasks: ["Ask the student to speak the lyrics of a song as if telling a friend, then sing them.", "Ask what the song means to them and which line matters most.", "Listen for whether the voice matches the meaning."],
    indicators: ["Sings every line the same way", "Cannot say what the song is about", "Expression looks put on or forced", "Eyes and face disconnected from words", "Words are unclear"]
  },
  levels: {
    beginner: { focus: "Know what the song says and sing the words clearly.", goals: ["Explain the song in one sentence", "Sing words clearly", "Choose one line to emphasise"] },
    intermediate: { focus: "Shape phrases for meaning.", goals: ["Mark soft, strong and still moments", "Use pauses and phrase endings deliberately", "Sing with sincere feeling that does not strain the voice"] },
    advanced: { focus: "Own the song.", goals: ["Make confident, personal interpretive choices", "Adapt expression to the room and purpose", "Stay present while singing"] }
  },
  outline: ["Ask: what is this song about, and why do you sing it?", "Speak the lyrics aloud as a message.", "Mark the key words and the turning point.", "Sing with the same sincerity as speaking.", "Record and listen for honesty rather than polish.", "Choose one change to try."],
  exercises: [
    { key: "say-it-first", title: "Say it, then sing it", level: "beginner", minutes: 5,
      student: "Read the lyrics of a song aloud as though you are telling a friend something important. Underline the most important word in each line. Now sing the song and let those words stand out gently. Record and listen: do I sound like I mean it?",
      demonstrate: "Speak a line flatly and sincerely; sing it both ways.",
      coach: "Ask what the song means to them. Praise honest, simple delivery.",
      difficulties: [{ issue: "Student feels silly speaking lyrics", adjust: "Do it together first." }, { issue: "Emphasises too many words", adjust: "Choose just one word per line." }] },
    { key: "map-the-story", title: "Map the story", level: "intermediate", minutes: 8,
      student: "Draw a simple line over the lyrics: where does the song start quiet, where does it build, where does it settle? Write one word beside each section (for example 'longing', 'trust', 'joy'). Sing the song following your map. Record and compare to a version where you ignore it.",
      demonstrate: "Show a quick map on a lyric sheet.",
      coach: "The map should come from the words, not from imitation of the original recording.",
      difficulties: [{ issue: "Copies the original artist", adjust: "Ask what they would say differently." }, { issue: "Expression becomes strained", adjust: "Keep the voice easy and let the words carry the feeling." }] },
    { key: "eyes-and-face", title: "Face and eyes", level: "intermediate", minutes: 5,
      student: "Sing a verse in front of a mirror or phone camera. Notice what your face does. Let it match the words in a natural way, without exaggeration. Record and watch once without sound: does your face tell the same story?",
      demonstrate: "Sing with a blank face then a natural one.",
      coach: "Natural beats dramatic. A relaxed face usually frees the sound.",
      difficulties: [{ issue: "Self-conscious on camera", adjust: "Practice in a mirror first." }, { issue: "Over-acting", adjust: "Reduce to half and see what stays." }] },
    { key: "own-the-song", title: "Make it yours", level: "advanced", minutes: 10,
      student: "Choose a song you will share. Decide the tempo, the key and two places where you will do something different from the recording (such as a pause or a softer line). Sing it twice and record. Pick the version that feels most honest.",
      demonstrate: "Show two small changes that make a song personal.",
      coach: "Support choices that serve the song and the people hearing it.",
      difficulties: [{ issue: "Changes distract from the message", adjust: "Keep one change per verse." }, { issue: "Student wants to copy exactly", adjust: "Practice both and compare." }] }
  ],
  assignments: [
    { key: "interp-say", title: "Say it, then sing it", level: "beginner", minutes: 8, steps: ["Speak the lyrics", "Underline key words", "Sing and record"] },
    { key: "interp-map", title: "Story map", level: "intermediate", minutes: 10, steps: ["Map the song", "Sing with the map", "Write what changed"] },
    { key: "interp-own", title: "Make it yours", level: "advanced", minutes: 12, steps: ["Choose two interpretive changes", "Record two versions", "Choose and explain"] }
  ],
  progress: [
    { indicator: "Student can state the song's message", measure: "Yes / partly / not yet" },
    { indicator: "Clarity of words", measure: "Instructor rating 1-5" },
    { indicator: "Sincerity of delivery", measure: "Instructor and student ratings 1-5" }
  ],
  followUp: { when: "Every 4 weeks.", tasks: ["Re-record a song from the first month.", "Ask what the student would change.", "Compare sincerity and clarity."], looksLike: ["Words clear and purposeful", "Expression natural", "Student can explain their choices"] },
  keywords: ["emotion", "expression", "interpretation", "feeling", "story", "connect", "meaning"]
},
{
  key: "confidence-mic", number: 10, title: "Performance confidence and microphone technique", skillSlug: "performance-mic",
  studentSummary: "Learn to stand, breathe and sing in front of others with steadiness, and to use a microphone well.",
  instructorSummary: "Confidence grows by repeated small, safe exposures. Teach microphone distance, holding position and sound check in practical terms. Build gradually: alone, then a trusted person, then a small group, then the congregation or audience.",
  assessment: {
    tasks: ["Ask the student to sing a verse standing up as if on stage.", "Hand them a microphone; observe how they hold it and the distance.", "Ask what makes them nervous."],
    indicators: ["Shaky voice or breath-holding when watched", "Microphone too close, too far or moving", "Eyes down or closed throughout", "Rushes or speeds up", "Freezes on mistakes"]
  },
  levels: {
    beginner: { focus: "Steady breathing and basic mic handling.", goals: ["Hold the mic at a steady distance", "Sing a verse for the instructor without rushing", "Recover from a mistake and continue"] },
    intermediate: { focus: "Sing for a small audience.", goals: ["Sing for two or three trusted people", "Use the mic to vary loudness", "Handle a sound check"] },
    advanced: { focus: "Perform with presence.", goals: ["Sing for a group with eye contact", "Respond to a sound problem calmly", "Debrief and improve after each performance"] }
  },
  outline: ["Talk about nerves honestly and normalise them.", "Teach mic basics: distance, angle, holding, not covering the grill.", "Practise one verse with the mic.", "Introduce a pre-performance routine: breath, posture, one sentence of purpose.", "Sing for the instructor, then a helper.", "Debrief with one thing done well and one thing to adjust."],
  exercises: [
    { key: "mic-basics", title: "Microphone basics", level: "beginner", minutes: 6,
      student: "Hold a microphone (or a stand-in) about a hand-width from your mouth, pointing at your chin. Say a line quietly and loudly while keeping the same distance. Then sing a line and move the mic slightly away for louder notes and closer for softer ones. Record on your phone to hear the difference.",
      demonstrate: "Show good and poor mic positions and what they sound like.",
      coach: "Keep the mic steady. Don't cover the grill. Explain that the mic does the work so you can sing easily.",
      difficulties: [{ issue: "Mic wanders", adjust: "Rest the elbow against the ribs." }, { issue: "Too close and muffled", adjust: "Add a hand-width of space." }] },
    { key: "pre-performance", title: "Pre-performance routine", level: "beginner", minutes: 4,
      student: "Before you sing for anyone, stand with relaxed shoulders, take two slow breaths, silently say why you are singing in one sentence, and then begin. Practise this routine before each practice recording this week.",
      demonstrate: "Model the routine in front of them.",
      coach: "Keep it short and repeatable.",
      difficulties: [{ issue: "Rushes through it", adjust: "Slow the exhale." }, { issue: "Anxiety remains", adjust: "Lower the stakes: sing for one trusted person." }] },
    { key: "small-audience", title: "Sing for one trusted person", level: "intermediate", minutes: 8,
      student: "Choose a trusted friend or family member. Sing one verse and chorus for them. Afterwards, ask: What did you hear? What was clear? Write down two things. Repeat next week with two listeners.",
      demonstrate: "Model asking for specific feedback.",
      coach: "Praise courage. Keep the debrief gentle.",
      difficulties: [{ issue: "Avoids the task", adjust: "Start with a phone call or voice message." }, { issue: "Freezes", adjust: "Agree a restart signal and a calm breath." }] },
    { key: "recover", title: "Recover from a mistake", level: "intermediate", minutes: 5,
      student: "Choose a song and sing it. When you make a mistake (or pretend to), don't stop. Take a breath and rejoin the next line. Practise this three times. Record and notice how little the listener would have noticed.",
      demonstrate: "Make a deliberate error and continue smoothly.",
      coach: "Show that recovery is a skill, not a failure.",
      difficulties: [{ issue: "Stops and apologises", adjust: "Practise a neutral face and breath." }, { issue: "Loses the beat", adjust: "Tap the beat and rejoin on the next count." }] },
    { key: "sound-check", title: "Sound check routine", level: "advanced", minutes: 6,
      student: "Practise a quick sound check: say a line, sing a few notes in your range, ask the sound person for one adjustment at a time (more of me, less of me, brighter, warmer). Practise the words politely and clearly.",
      demonstrate: "Role-play with the instructor as the sound person.",
      coach: "Help students ask clearly and calmly.",
      difficulties: [{ issue: "Afraid to ask", adjust: "Provide a script." }, { issue: "Over-corrects", adjust: "One request at a time." }] }
  ],
  assignments: [
    { key: "conf-mic", title: "Mic basics at home", level: "beginner", minutes: 8, steps: ["Practise distance", "Record one verse with a mic or phone", "Listen for muffling or distance"] },
    { key: "conf-person", title: "One listener", level: "intermediate", minutes: 10, steps: ["Sing for a trusted person", "Ask two questions", "Write the answers"] },
    { key: "conf-soundcheck", title: "Sound check script", level: "advanced", minutes: 8, steps: ["Write your script", "Practise it aloud", "Use it at the next opportunity"] }
  ],
  progress: [
    { indicator: "Steady mic distance", measure: "Observed: yes / sometimes / not yet" },
    { indicator: "Willingness to sing for others", measure: "Number of listeners this month" },
    { indicator: "Recovery from mistakes", measure: "Observed: continues / pauses / stops" }
  ],
  followUp: { when: "Monthly.", tasks: ["Sing a verse for the instructor with the mic.", "Ask the student to rate their nervousness before and after.", "Review the pre-performance routine."], looksLike: ["Steady mic technique", "Nervousness lower or better managed", "Willing to sing for more people"] },
  instructorCaution: "Be gentle with anxiety. If performance anxiety is severe or affecting daily life, encourage the student to seek support from a qualified professional. Do not push students into public performance before they are ready.",
  keywords: ["confidence", "nervous", "stage", "microphone", "mic", "fear", "anxiety", "performance"]
},
{
  key: "improvisation", number: 11, title: "Improvisation and ad-libbing", skillSlug: "improvisation",
  studentSummary: "Learn to create simple melodies and phrases in the moment, starting with very small steps.",
  instructorSummary: "Improvisation is built from a few safe notes, a steady beat and permission to try. Start with call-and-response (copy, then answer), then limited-note patterns, then simple ad-libs. This area is the general skill; the optional Spontaneous Vocal Expression track extends it. Keep it playful and non-judgmental.",
  assessment: {
    tasks: ["Call and response: sing a two-bar phrase and ask the student to echo it, then answer with something different.", "Give them three notes (1-3-5) and a beat; ask them to make up any pattern.", "Ask how they feel when asked to make something up on the spot."],
    indicators: ["Can echo a phrase accurately", "Can answer with something different", "Stays in the key", "Keeps a steady beat", "Freezes or apologises", "Uses the same pattern every time"]
  },
  levels: {
    beginner: { focus: "Echo and answer with simple ideas.", goals: ["Echo a two-bar phrase", "Answer with a different two-bar phrase", "Use three notes freely over a beat"] },
    intermediate: { focus: "Use a scale and vary rhythm.", goals: ["Improvise over a simple chord loop using a five-note scale", "Vary rhythm and starting note", "Leave space between phrases"] },
    advanced: { focus: "Create with intention.", goals: ["Shape an improvised idea with a beginning, middle and end", "Answer another singer or an instrument", "Reflect on and refine favourites"] }
  },
  outline: ["Normalise: nothing is wrong when improvising, only different.", "Establish a steady beat and a three-note limit.", "Do call-and-response with simple phrases.", "Add a fourth and fifth note.", "Introduce space: one phrase, one rest.", "Record and keep favourite ideas."],
  exercises: [
    { key: "echo-answer", title: "Echo and answer", level: "beginner", minutes: 6,
      student: "With a helper or a recording, listen to a two-bar phrase. First echo it back exactly. Then, next time, answer with something different but with a similar length. Take your time and keep the beat steady. Record your answers.",
      demonstrate: "Sing a phrase and an answer that is different but related.",
      coach: "Reward any answer. Keep the beat steady and the mood playful.",
      difficulties: [{ issue: "Can only copy", adjust: "Change just the last note and build from there." }, { issue: "Freezes", adjust: "Count in and ask for one note at a time." }] },
    { key: "three-notes", title: "Three notes, any order", level: "beginner", minutes: 6,
      student: "Play a slow steady beat or a simple chord on a loop. Choose three notes (do, mi, sol). Sing any pattern you like using only those notes. Try different rhythms. Do not worry about sounding perfect. Record two minutes.",
      demonstrate: "Show a few patterns with three notes, including one that repeats.",
      coach: "Stay with the three notes until the student feels at ease. Praise variety.",
      difficulties: [{ issue: "Repeats the same pattern", adjust: "Ask for a different first note or rhythm." }, { issue: "Loses the key", adjust: "Play the three notes briefly as a guide." }] },
    { key: "five-note-loop", title: "Five-note scale over a loop", level: "intermediate", minutes: 8,
      student: "Use a simple chord loop (instructor-provided or your own). Use a five-note scale (1-2-3-5-6). Improvise a short phrase, rest for one bar, and answer your own phrase. Repeat for three minutes. Record and choose your favourite moment.",
      demonstrate: "Model a phrase, a rest and an answer.",
      coach: "Space matters. Praise the rests.",
      difficulties: [{ issue: "Never stops singing", adjust: "Count a bar of silence." }, { issue: "Notes clash", adjust: "Return to three notes." }] },
    { key: "keep-a-favourite", title: "Keep a favourite", level: "intermediate", minutes: 6,
      student: "Listen to your recording and find a phrase you like. Learn it so you can sing it again. Write how you would describe it. Next time, use it and change one thing.",
      demonstrate: "Pull a phrase from a recording and replay it.",
      coach: "This builds a personal vocabulary.",
      difficulties: [{ issue: "Cannot repeat it", adjust: "Slow the recording down." }, { issue: "Likes nothing", adjust: "Choose the simplest phrase." }] },
    { key: "shape-an-idea", title: "Shape an idea", level: "advanced", minutes: 10,
      student: "Improvise a 16-bar phrase with a clear beginning, middle and end. Decide where it will rise, where it will rest, and how it will finish. Record three attempts and note what changed.",
      demonstrate: "Show how repetition and variation make an idea feel shaped.",
      coach: "Look for intention. Ask the student what they were trying to say.",
      difficulties: [{ issue: "Wanders", adjust: "Repeat the opening idea at the end." }, { issue: "Overthinks", adjust: "Set a timer for 60 seconds." }] }
  ],
  assignments: [
    { key: "imp-echo", title: "Echo and answer", level: "beginner", minutes: 6, steps: ["Echo three phrases", "Answer three phrases differently", "Record the best answer"] },
    { key: "imp-loop", title: "Three minutes over a loop", level: "intermediate", minutes: 8, steps: ["Improvise over a loop", "Keep rests", "Pick a favourite phrase"] },
    { key: "imp-shape", title: "A shaped idea", level: "advanced", minutes: 10, steps: ["Improvise 16 bars", "Repeat with one change", "Describe what you were saying"] }
  ],
  progress: [
    { indicator: "Echoes accurately", measure: "Out of ten" },
    { indicator: "Answers differently", measure: "Out of ten" },
    { indicator: "Uses space", measure: "Observed: rests present / none" },
    { indicator: "Confidence improvising", measure: "Student rating 1-5" }
  ],
  followUp: { when: "Every 4 weeks.", tasks: ["Repeat call-and-response.", "Record two minutes over a loop.", "Compare variety and confidence."], looksLike: ["More variety", "Rests used", "Less hesitation"] },
  keywords: ["improvise", "ad-lib", "adlib", "spontaneous", "free", "melody", "make up", "creative"]
},
{
  key: "worship-leading", number: 12, title: "Worship leadership and creative worship expression", skillSlug: "worship-leadership",
  studentSummary: "A general foundation for leading others in worship: serving the song, serving the people, and staying humble and ready. Optional tracks go deeper in three separate directions.",
  instructorSummary: "This area covers what any singer needs when leading others: preparation, song choice and key, clear cues, a servant posture, and working with a team. It does not assume any particular theology of prophetic ministry. The three Creative Worship Expression tracks are optional, separate and chosen by the student; do not introduce prophetic content to a student who only wants general vocal coaching.",
  assessment: {
    tasks: ["Ask the student what they believe worship leading is for.", "Have them lead a short song for you (a verse and chorus) and observe how they signal changes.", "Ask how they prepare spiritually and practically."],
    indicators: ["Clear starting and ending cues", "Chooses keys that fit the congregation", "Keeps eyes on the people, not only the page", "Prepares songs and transitions", "Works with the team", "Comfortable being led by the Holy Spirit and by the team's plan, in a way consistent with their church"]
  },
  levels: {
    beginner: { focus: "Preparation and clear leading of a song.", goals: ["Prepare a song with key, tempo and sections", "Give clear starting and ending cues", "Sing in a range congregations can follow"] },
    intermediate: { focus: "Lead a short set.", goals: ["Plan a set of two or three songs with transitions", "Speak a brief, clear invitation or Scripture", "Respond calmly if something changes"] },
    advanced: { focus: "Lead and mentor.", goals: ["Lead a set with a team and communicate clearly", "Adapt gracefully to the moment", "Debrief and help others grow"] }
  },
  outline: ["Start with purpose: why do we lead worship (Colossians 3:16)?", "Check preparation: song, key, structure, cues.", "Practise leading one song with clear cues.", "Add a short spoken introduction or Scripture.", "Plan transitions between two songs.", "Debrief with humility and one concrete improvement."],
  exercises: [
    { key: "song-prep-sheet", title: "Song preparation sheet", level: "beginner", minutes: 8,
      student: "For one song, write the key, tempo, song structure (verse, chorus, bridge), where you will breathe, and the first line you will sing. Note one sentence about what this song says. Practise leading it once using only your sheet.",
      demonstrate: "Show a filled-in sheet for a familiar song.",
      coach: "Check the key suits a group. Keep the sheet to one page.",
      difficulties: [{ issue: "Key too high for the group", adjust: "Move down a step or two." }, { issue: "Forgets the structure", adjust: "Write section names large." }] },
    { key: "clear-cues", title: "Clear cues", level: "beginner", minutes: 6,
      student: "Practise giving cues: a nod or hand signal to start, a clear lift into the chorus, a clear sign to end. Sing a verse and chorus alone and mark where each cue happens. Record on video and watch: would someone else understand?",
      demonstrate: "Show clear and unclear cues.",
      coach: "Simple and consistent. Avoid big gestures.",
      difficulties: [{ issue: "Cues are too subtle", adjust: "Make them slightly bigger." }, { issue: "Eyes on the page", adjust: "Memorise the first and last lines." }] },
    { key: "two-song-transition", title: "A two-song set with a transition", level: "intermediate", minutes: 10,
      student: "Choose two songs in related keys. Plan how you will move from one to the next: a held chord, a short spoken line, or a quiet pause. Practise the transition three times and record. Does it feel natural and unhurried?",
      demonstrate: "Model two transitions: spoken and instrumental.",
      coach: "Keep spoken lines short and Scripture-based when appropriate.",
      difficulties: [{ issue: "Dead air feels awkward", adjust: "Plan a four-bar instrumental." }, { issue: "Talks too long", adjust: "Limit to one sentence." }] },
    { key: "adapting", title: "When the plan changes", level: "advanced", minutes: 8,
      student: "Practise a plan B: if the band drops out, if the key changes, if the lyrics screen fails. Sing a verse with one of these changes simulated and recover calmly. Write how you would communicate with the team.",
      demonstrate: "Simulate a lost screen and a calm recovery.",
      coach: "Prepared leaders can be flexible.",
      difficulties: [{ issue: "Panics", adjust: "Practice a calm breath first." }, { issue: "Doesn't communicate", adjust: "Agree simple signals with the team." }] }
  ],
  assignments: [
    { key: "wl-prep", title: "Prepare one song to lead", level: "beginner", minutes: 10, steps: ["Fill out the song sheet", "Practise cues", "Record a video of leading the verse and chorus"] },
    { key: "wl-set", title: "Plan a short set", level: "intermediate", minutes: 12, steps: ["Choose two songs", "Plan the transition", "Record the set"] },
    { key: "wl-adapt", title: "Plan B practice", level: "advanced", minutes: 8, steps: ["Choose a scenario", "Practise recovery", "Write a plan for your team"] }
  ],
  progress: [
    { indicator: "Preparation sheet completed", measure: "Yes / partly / no" },
    { indicator: "Cues clear to an observer", measure: "Instructor rating 1-5" },
    { indicator: "Transitions smooth", measure: "Observed: smooth / awkward" }
  ],
  followUp: { when: "Every 4-6 weeks.", tasks: ["Lead a short set for the instructor.", "Review the prep sheet.", "Ask what the student learned about serving the people."], looksLike: ["Clear cues", "Sensible keys", "Humble, prepared presence"] },
  instructorCaution: "Respect each student's church tradition. Do not assume the student wants prophetic or spontaneous elements; offer the optional tracks only if they are interested. Keep the focus on service and humility.",
  keywords: ["worship leader", "lead worship", "worship team", "congregation", "set list", "church"],
  scripture: [{ ref: "Colossians 3:16", use: "Teaching and admonishing one another with psalms, hymns and spiritual songs, singing with gratitude to God." }]
}
];
