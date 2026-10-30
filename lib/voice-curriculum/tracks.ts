import type { AreaSpec, TrackKey } from "./types";

/** Three SEPARATE, optional Creative Worship Expression tracks. A student picks one, several or none; nothing here is introduced
 *  to a student who only wants general vocal coaching. Denominational differences are respected: the instructor adapts to the
 *  student's own beliefs and church practice and never assigns a practice the student has not chosen. */
export const TRACK_META: Record<TrackKey, { title: string; blurb: string; studentOptIn: string }> = {
  worship_leadership: { title: "Worship Leadership and Flow", blurb: "Leading congregational worship: exhortation and transitions, confidence and responsiveness, musical and spiritual sensitivity, and leading without unnecessarily interrupting.", studentOptIn: "I want help leading others in worship." },
  spontaneous_expression: { title: "Spontaneous Vocal Expression", blurb: "Ad-libbing over a song, call-and-response, spontaneous phrases and new melodies, and free-flow over instrumental-only music.", studentOptIn: "I want to grow in ad-libbing and spontaneous singing." },
  prophetic_worship: { title: "Prophetic Worship Development", blurb: "Private worship and prayer practices, biblical discernment, turning Scripture into sung declarations, and growing in private before ministering publicly.", studentOptIn: "I want to grow in prophetic worship, in line with my own beliefs." }
};

export const TRACKS: AreaSpec[] = [
{
  key: "track-worship-leadership", number: 13, track: "worship_leadership", title: "Worship Leadership and Flow", skillSlug: "track-worship-leadership",
  studentSummary: TRACK_META.worship_leadership.blurb,
  instructorSummary: "Optional track building on area 12. Focus on serving the congregation: speaking briefly and clearly between songs, moving smoothly, reading the room, and staying flexible with the team without interrupting the flow unnecessarily. Teach what leaders do, not a theology; adapt to the student's church.",
  assessment: {
    tasks: ["Ask the student to lead one song and add one sentence of encouragement or Scripture before the last chorus.", "Ask how they decide when to speak and when to let the music carry.", "Observe how they respond when you change something unexpectedly (key, repeat, ending)."],
    indicators: ["Speaks briefly and clearly", "Waits for natural pauses", "Keeps the band or track informed", "Eyes on the room", "Does not over-talk", "Recovers calmly from changes"]
  },
  levels: {
    beginner: { focus: "Short, clear spoken lines and calm transitions.", goals: ["Say one short prepared sentence between songs", "Cue a repeat or ending clearly", "Stay calm when the plan shifts"] },
    intermediate: { focus: "Read the room.", goals: ["Choose when to speak, repeat or move on", "Lead a repeat of a chorus on purpose", "Give a short Scripture-based exhortation"] },
    advanced: { focus: "Flow with the team and the moment.", goals: ["Lead a 20-minute set with unforced flow", "Communicate with the team with simple signals", "Debrief and train others"] }
  },
  outline: ["Revisit purpose: serving the people toward God (Colossians 3:16).", "Practise one-sentence exhortations.", "Rehearse transitions: spoken, instrumental, silent.", "Practise a repeat and tag with the team's agreed signals.", "Role-play changes and recoveries.", "Debrief: what helped the people engage?"],
  exercises: [
    { key: "one-sentence", title: "One-sentence exhortation", level: "beginner", minutes: 6,
      student: "Choose a song. Write one sentence you could say before the last chorus that points to what the song says (using Scripture if it fits your church practice). Say it aloud three times, then sing the chorus straight after. Record and listen: was it short, clear and unhurried?",
      demonstrate: "Model a short line that leads into the chorus.",
      coach: "Short beats clever. Aim for under ten seconds.",
      difficulties: [{ issue: "Rambles", adjust: "Cut it to the single most important phrase." }, { issue: "Sounds scripted", adjust: "Say it in everyday language." }] },
    { key: "flow-transition", title: "Moving without interrupting", level: "intermediate", minutes: 10,
      student: "Plan three ways to move from one song to the next: (1) hold the last chord and begin the next song, (2) one spoken line over soft music, (3) a short pause. Practise each, recording yourself. Which kept the sense of worship unbroken?",
      demonstrate: "Show each of the three options.",
      coach: "Look for flow. Silence can be right; so can a short line.",
      difficulties: [{ issue: "Feels abrupt", adjust: "Add four bars of soft instrumental." }, { issue: "Speaks over the singing", adjust: "Wait for a pause in the music." }] },
    { key: "repeat-and-tag", title: "Lead a repeat or tag", level: "intermediate", minutes: 8,
      student: "Practise cueing a repeat of the chorus or a tag (repeating the last line). Agree a hand signal and a spoken backup. Sing with a backing track, choose one place to repeat, and give the cue early enough for others to follow. Record.",
      demonstrate: "Cue a repeat using a hand signal and eye contact.",
      coach: "Cues must be early and consistent.",
      difficulties: [{ issue: "Cue arrives late", adjust: "Cue one bar earlier." }, { issue: "Team misreads", adjust: "Agree signals before the set." }] },
    { key: "read-the-room", title: "Read the room", level: "advanced", minutes: 8,
      student: "After a set (or a practice with others), write what you noticed: did people sing, sit quietly, or look lost? What would you do differently? Plan one change for next time.",
      demonstrate: "Model reflective debriefing.",
      coach: "Encourage honest, humble observation.",
      difficulties: [{ issue: "Self-critical", adjust: "Ask for one thing that worked." }, { issue: "No observation", adjust: "Ask a trusted team member." }] }
  ],
  assignments: [
    { key: "wlt-sentence", title: "Write and say one sentence", level: "beginner", minutes: 8, steps: ["Write the sentence", "Say it three times", "Record leading into the chorus"] },
    { key: "wlt-flow", title: "Three transitions", level: "intermediate", minutes: 12, steps: ["Practise three transitions", "Record each", "Choose the one that kept the flow"] },
    { key: "wlt-debrief", title: "Debrief a set", level: "advanced", minutes: 10, steps: ["Write what you noticed", "Name one change", "Share with your leader or instructor"] }
  ],
  progress: [
    { indicator: "Spoken line length", measure: "Seconds; target under 10" },
    { indicator: "Cues understood by others", measure: "Observed: yes / sometimes / no" },
    { indicator: "Flow between songs", measure: "Instructor rating 1-5" }
  ],
  followUp: { when: "Every 4-6 weeks.", tasks: ["Lead a two-song set with a transition.", "Review the recording together."], looksLike: ["Short, clear spoken lines", "Smooth transitions", "Calm responsiveness"] },
  instructorCaution: "Leading practices differ between churches. Ask what is normal in the student's setting, and never require a style that conflicts with their leadership or beliefs.",
  keywords: ["lead worship", "transition", "exhort", "flow", "worship leader", "congregation"],
  scripture: [{ ref: "Colossians 3:16", use: "Singing, teaching and encouraging one another in the word with gratitude." }]
},
{
  key: "track-spontaneous-expression", number: 14, track: "spontaneous_expression", title: "Spontaneous Vocal Expression", skillSlug: "track-spontaneous-expression",
  studentSummary: TRACK_META.spontaneous_expression.blurb,
  instructorSummary: "Optional track extending area 11. Two clearly different settings are taught: (1) ad-libbing OVER A SONG, where a lead vocalist already carries melody and words, so your part stays supportive, short and in the key; and (2) free-flow over INSTRUMENTAL-ONLY music, where there is no lead vocal, so you may create fuller melodies and phrases. Do not mix the expectations of the two.",
  assessment: {
    tasks: ["Ad-lib over a song: play a familiar song with a lead vocal; ask the student to add a short phrase in the gaps.", "Call and response: sing a short phrase; ask them to answer.", "Instrumental free-flow: play an instrumental loop; ask for any melody for one minute.", "Ask what is easier and what is harder."],
    indicators: ["Stays in key", "Leaves space for the lead vocal", "Keeps time", "Phrases have a shape", "Different behaviour in the two settings", "Confidence and comfort"]
  },
  levels: {
    beginner: { focus: "Short supportive phrases and call-and-response.", goals: ["Add a one-bar phrase in a gap of a song", "Answer a call with a related phrase", "Sing any melody over a loop for 30 seconds"] },
    intermediate: { focus: "Build phrases and vary them.", goals: ["Add several ad-libs across a song without covering the lead", "Create a new melody over an instrumental for two minutes", "Use repetition and variation"] },
    advanced: { focus: "Flow with intention.", goals: ["Move naturally between supporting and leading in a spontaneous set", "Shape longer improvised passages", "Adapt to different musical settings"] }
  },
  outline: ["Explain the two settings and the different rules.", "Start with call and response.", "Ad-lib in gaps of a song: short and in key.", "Switch to instrumental-only free-flow: longer phrases allowed.", "Compare recordings of both settings.", "Choose one skill to deepen."],
  exercises: [
    { key: "ad-lib-gaps", title: "Ad-lib in the gaps (over a song)", level: "beginner", minutes: 8,
      student: "Choose a song with a lead vocal. Listen and find the gaps between lines. Pick two gaps. Sing a very short phrase (two to four notes) in each, using notes from the key. Keep your volume below the lead singer. Record the song and listen: did your ad-lib support the lead?",
      demonstrate: "Show a good ad-lib and one that covers the lead.",
      coach: "Quiet, short, in key. This is a supporting role.",
      difficulties: [{ issue: "Sings over the lead", adjust: "Only sing in the gaps." }, { issue: "Notes clash", adjust: "Use three safe notes from the chord." }] },
    { key: "call-response", title: "Call and response", level: "beginner", minutes: 6,
      student: "Listen to a short call phrase (from a track, a helper, or your instructor). Answer it with a related phrase of the same length. Repeat ten times, changing your answer each time. Record the best three.",
      demonstrate: "Model related and unrelated answers.",
      coach: "Answers should feel like a conversation.",
      difficulties: [{ issue: "Answer ignores the call", adjust: "Copy the rhythm, change the notes." }, { issue: "Freezes", adjust: "Use one note first." }] },
    { key: "instrumental-flow", title: "Free-flow over instrumental-only music", level: "intermediate", minutes: 10,
      student: "Play an instrumental track with no vocal (provided by your instructor). Because no one else is singing, you can create full phrases. Start with two notes, add a third, and let a melody grow. Sing for two minutes without stopping. Record and listen for a phrase you liked.",
      demonstrate: "Start with two notes and grow a melody over the loop.",
      coach: "There is no lead to avoid, so allow longer phrases. Still leave breathing space.",
      difficulties: [{ issue: "Stops after a few seconds", adjust: "Use a countdown and repeat the same phrase." }, { issue: "Wanders", adjust: "Return to the opening phrase." }] },
    { key: "compare-settings", title: "Compare the two settings", level: "intermediate", minutes: 6,
      student: "Listen to your two recordings: an ad-lib over a song and a free-flow over instrumental. Write three differences in how you sang (length, volume, space). Write one thing you would change in each.",
      demonstrate: "Model listening critically.",
      coach: "Help the student articulate the different roles.",
      difficulties: [{ issue: "Sees no difference", adjust: "Point out phrase length and space." }, { issue: "Self-critical", adjust: "Start with a strength." }] },
    { key: "shaped-spontaneous", title: "Shaped spontaneous passage", level: "advanced", minutes: 10,
      student: "Over an instrumental, create a passage with a quiet beginning, a rising middle and a settled ending. Record three takes. Choose one and describe what shaped it.",
      demonstrate: "Show how repetition gives shape.",
      coach: "Look for shape without scripting.",
      difficulties: [{ issue: "Peaks too soon", adjust: "Plan to save the high point." }, { issue: "No ending", adjust: "Return to the first phrase." }] }
  ],
  assignments: [
    { key: "se-gaps", title: "Two ad-libs in a song", level: "beginner", minutes: 8, steps: ["Choose two gaps", "Sing short phrases", "Record and listen"] },
    { key: "se-instr", title: "Two minutes over an instrumental", level: "intermediate", minutes: 10, steps: ["Use the assigned instrumental", "Sing without stopping", "Record"] },
    { key: "se-shape", title: "A shaped passage", level: "advanced", minutes: 12, steps: ["Record three takes", "Choose one", "Describe its shape"] }
  ],
  progress: [
    { indicator: "Ad-libs stay in key and below the lead", measure: "Out of total ad-libs" },
    { indicator: "Instrumental free-flow continuous time", measure: "Seconds" },
    { indicator: "Confidence in the two settings", measure: "Student rating 1-5 each" }
  ],
  followUp: { when: "Every 4 weeks.", tasks: ["Repeat ad-lib over the same song.", "Record a new free-flow over an instrumental.", "Compare."], looksLike: ["Fewer clashes", "Longer continuous flow", "Clear difference between the two settings"] },
  keywords: ["ad-lib", "adlib", "spontaneous", "free flow", "call and response", "improvise"]
},
{
  key: "track-prophetic-worship", number: 15, track: "prophetic_worship", title: "Prophetic Worship Development", skillSlug: "track-prophetic-worship",
  studentSummary: TRACK_META.prophetic_worship.blurb,
  instructorSummary: "Optional track, offered only to students who ask for it. It is grounded in Scripture and respects denominational differences: churches understand prophecy, spontaneous song and tongues in different ways. Begin in private, not public. Help the student notice how they believe they receive impressions, test them biblically, and express them responsibly. Do not assume the student's reception type, practices or experience. Never present your own experience as the only valid pattern.",
  assessment: {
    tasks: ["Ask what the student believes about the Spirit's guidance in worship and where they are from (church tradition).", "Ask about their private prayer and worship practice (use Assessment B).", "Optionally use Assessment A (self-reported ways of receiving impressions).", "Ask what they want from this track."],
    indicators: ["Student's own words about how they sense God's leading", "Habit of private prayer and Scripture", "Comfort expressing an impression", "Familiarity with testing by Scripture and leaders", "Any concerns or boundaries the student names"]
  },
  levels: {
    beginner: { focus: "Private prayer and Scripture-shaped singing.", goals: ["Establish a short private worship time", "Sing a Scripture verse as a declaration", "Journal what they sensed, without labelling it"] },
    intermediate: { focus: "Responsible expression in private.", goals: ["Practise spontaneous singing in private for several minutes", "Test impressions by Scripture and, where appropriate, trusted leaders", "Describe an impression clearly and humbly"] },
    advanced: { focus: "Prepared for shared settings, under church order.", goals: ["Express an impression briefly and clearly in a small, safe group when invited by leaders", "Stay under the authority and order of their church", "Review and learn from each experience"] }
  },
  outline: ["Listen first: how does the student understand prophetic worship? What is their church's practice?", "Foundations from Scripture: John 15:4-5 (abiding), 1 Corinthians 14:3 (prophecy builds up, encourages, comforts), 1 Corinthians 14:15 (pray and sing with the spirit and with the mind), Colossians 3:16 (word of Christ dwelling richly, psalms, hymns, spiritual songs).", "Build a private practice: a short time of prayer, Scripture, quiet, and singing.", "Practise turning a verse into a sung declaration.", "Journal and test: what was received, how does it line up with Scripture, who could help weigh it?", "Only after private growth, discuss if and how to share, with leader approval."],
  exercises: [
    { key: "abide-time", title: "Abiding time (private)", level: "beginner", minutes: 10,
      student: "Choose a quiet time and place. Read John 15:4-5 slowly twice. Spend a few minutes in prayer, thanking God and asking him to speak in the way he chooses. Sit quietly for two minutes. Then sing or hum something simple in response if you wish. Afterwards write what you noticed. You do not need to label or force anything.",
      demonstrate: "Model a short, quiet time. Share that the aim is closeness, not performance.",
      coach: "Do not tell the student what they should experience. Ask open questions: What did you notice? How did it compare to Scripture?",
      difficulties: [{ issue: "Nothing seems to happen", adjust: "Affirm faithfulness; shorten the time and keep Scripture central." }, { issue: "Distracted", adjust: "Write distractions down and return to the verse." }] },
    { key: "scripture-to-song", title: "Scripture to sung declaration", level: "beginner", minutes: 10,
      student: "Choose a short verse (for example Colossians 3:16 or a psalm line). Say it aloud slowly. Find a simple melody of three or four notes. Sing the verse as a declaration, repeating it several times and letting the melody settle. Record a short take if you like, for your own review.",
      demonstrate: "Sing a verse on three notes.",
      coach: "Keep the words faithful to Scripture. Simple melodies are better than clever ones.",
      difficulties: [{ issue: "Changes the meaning of the verse", adjust: "Read it again from the Bible and sing the exact words." }, { issue: "Cannot find a melody", adjust: "Chant it on one note first." }] },
    { key: "pray-and-sing", title: "Praying and singing with spirit and mind", level: "intermediate", minutes: 10,
      student: "Read 1 Corinthians 14:15. Spend five minutes in private worship. Alternate between praying in your own words and singing a simple line from Scripture. Write down one impression or phrase that came, and a verse that supports or tests it.",
      demonstrate: "Model alternating a short prayer and a sung line.",
      coach: "Both mind and spirit are valued; help the student keep understanding.",
      difficulties: [{ issue: "Overthinks", adjust: "Set a timer and sing a line before analysing." }, { issue: "Unsure about an impression", adjust: "Test it by Scripture and share it with a trusted leader or mentor." }] },
    { key: "test-and-describe", title: "Test and describe an impression", level: "intermediate", minutes: 10,
      student: "Choose one impression or phrase from your journal. Write: What did I sense? What Scripture speaks to it? What would be the effect if it were true (see 1 Corinthians 14:3 - does it build up, encourage or comfort)? How would I say it in one or two humble sentences?",
      demonstrate: "Model a short, humble description.",
      coach: "Encourage humility and Scripture. Remind the student that church leaders and their tradition guide how it may be shared.",
      difficulties: [{ issue: "Overconfident language", adjust: "Practise phrases like 'I sensed ... does this line up?'" }, { issue: "Fear of being wrong", adjust: "Practise in private first and with a trusted mentor." }] },
    { key: "optional-tongues", title: "Optional: singing in tongues", level: "advanced", minutes: 10, onlyOnRequest: true,
      student: "This is offered only if you have asked for it and it fits your own beliefs and church tradition. You can skip it without any consequence. If you choose to, spend a short time in private worship and sing in the way you are already accustomed to, in line with 1 Corinthians 14:15. Note how you felt and whether it fits your understanding of Scripture.",
      demonstrate: "No demonstration is required. Never pressure or imitate. Only discuss if the student raises it.",
      coach: "Do not introduce, teach or expect this. Respect traditions that do not practise it. Follow the student's lead and your church's guidance.",
      difficulties: [{ issue: "Student unsure", adjust: "Set it aside; there is no loss in not doing it." }, { issue: "Tradition differs", adjust: "Honour the student's convictions." }],
      safety: "Never assign or encourage this unless the student explicitly requested it and it matches their beliefs." }
  ],
  assignments: [
    { key: "pw-abide", title: "Three short abiding times", level: "beginner", minutes: 10, steps: ["Read John 15:4-5", "Pray, sit quietly, and sing if you wish", "Write what you noticed"] },
    { key: "pw-declare", title: "Sing a verse", level: "beginner", minutes: 10, steps: ["Choose a verse", "Find a simple melody", "Sing it several times"] },
    { key: "pw-test", title: "Test one impression", level: "intermediate", minutes: 10, steps: ["Choose one impression", "Find Scripture that speaks to it", "Write a humble one-sentence description"] }
  ],
  progress: [
    { indicator: "Regular private time", measure: "Days per week" },
    { indicator: "Scripture-based declarations created", measure: "Count" },
    { indicator: "Student's own confidence expressing impressions", measure: "Student rating 1-5 (self-report; not an instructor judgement of spiritual maturity)" }
  ],
  followUp: { when: "Every 4-6 weeks, or when the student asks.", tasks: ["Review the journal with the student (only what they choose to share).", "Check the practice still fits their beliefs and church guidance."], looksLike: ["Consistent private practice", "Scripture-grounded expression", "Humility and openness to testing"] },
  instructorCaution: "Student spiritual information is private (student plus authorised staff only). Never publish a student's journal, testimony or recording without their explicit consent. Do not diagnose a student's spiritual condition from assessment results. Singing in tongues is optional and appears ONLY on explicit student request.",
  keywords: ["prophetic", "prophecy", "spirit", "private worship", "declaration", "tongues", "sing the scripture"],
  scripture: [
    { ref: "John 15:4-5", use: "Abide in Christ; fruit comes from remaining in him." },
    { ref: "1 Corinthians 14:3", use: "Prophecy speaks for building up, encouragement and consolation." },
    { ref: "1 Corinthians 14:15", use: "Pray and sing with the spirit and also with the mind." },
    { ref: "Colossians 3:16", use: "Let the word of Christ dwell richly; teach and admonish with psalms, hymns and spiritual songs." }
  ]
}
];
