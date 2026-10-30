import type { AreaSpec } from "./types";

export const AREAS_2: AreaSpec[] = [
{
  key: "registers", number: 5, title: "Chest, mixed, and head voice", skillSlug: "registers",
  studentSummary: "Learn how your voice feels and sounds in its lower, middle and higher areas, and how to move between them smoothly.",
  instructorSummary: "Treat registers as sensations and sounds, not anatomy lessons. Help the student hear and feel the lower (chest-like), middle (mixed) and higher (head-like) areas and move between them without pushing. Teach from what you can hear and demonstrate honestly; if a student needs more specialised guidance on the higher voice than you can offer, say so and refer on.",
  assessment: {
    tasks: ["Glide gently from a low comfortable note to a high one on 'oo' or 'ng' and listen for breaks, flips or pushing.", "Speak a line in a normal voice, then in a light, gentle higher voice (like calling to a child across a room).", "Sing a phrase that crosses the middle of the range."],
    indicators: ["A noticeable flip or crack between low and higher notes", "Pushing the low sound upward and getting louder and tighter", "Higher notes feel weak or airy", "Neck or jaw tightness as pitch rises", "Student can feel a difference between lower and higher sounds"]
  },
  levels: {
    beginner: { focus: "Notice the different feelings and sounds across the range.", goals: ["Describe how low, middle and high notes feel", "Glide across the range without pushing", "Identify where the voice changes"] },
    intermediate: { focus: "Smooth the change and strengthen the middle.", goals: ["Reduce flips or cracks in a simple phrase", "Sing the middle notes with an even, easy tone", "Use a lighter sound on the way up"] },
    advanced: { focus: "Use the whole range in songs with balance.", goals: ["Move between areas in a song without a noticeable break unless chosen as a style", "Choose lighter or fuller sounds on purpose", "Keep ease at the top and bottom of the range"] }
  },
  outline: ["Explain in plain words: your voice has different 'areas' and it is normal to feel them change.", "Demonstrate a speech-like low sound, a light high sound, and a smooth glide.", "Student tries gentle glides on 'ng' or 'oo'. Listen for pushing.", "Practice the lighter sound on the way up and a softer landing on the way down.", "Apply to a phrase from a song that crosses the change.", "Record and listen together; choose one adjustment for the week."],
  exercises: [
    { key: "speak-to-sing", title: "Speak to sing", level: "beginner", minutes: 4,
      student: "Say a short line (like 'Hello, how are you today?') in your normal voice. Say it again slightly higher and lighter, as if calling to someone across the room. Now sing the line on one note, then on a gentle rise. Notice what changes in your throat and chest. Keep everything easy.",
      demonstrate: "Speak the line low and then light and higher; show how the sound moves forward and gets lighter without pushing.",
      coach: "Ask what they feel. Praise a lighter sound. If they push, reduce volume.",
      difficulties: [{ issue: "Student gets louder as the pitch rises", adjust: "Ask for 'half volume' and a smaller range." }, { issue: "The higher voice sounds airy", adjust: "Keep the light sound but add a gentle, steady 'ng' to find connection." }] },
    { key: "gentle-glide-oo", title: "Gentle glides on 'oo' and 'ng'", level: "beginner", minutes: 5,
      student: "Sing a soft 'oo' on a low comfortable note and glide slowly up as high as is easy, then slide back down. Keep the sound light and quiet. If your voice flips, that is okay: go slower and softer. Do four glides and note where the sound changes.",
      demonstrate: "Show a smooth glide and a slight flip so they know both are normal.",
      coach: "Slow and soft. Do not try to 'fix' the break; stay relaxed across it and let it smooth with practice.",
      difficulties: [{ issue: "A strong break at the same note each time", adjust: "Practice small glides across just that area, then expand." }, { issue: "Throat feels tight on the way up", adjust: "Lower the starting note and reduce volume." }] },
    { key: "mid-voice-vowels", title: "Middle-voice vowel phrases", level: "intermediate", minutes: 6,
      student: "Choose five middle-range notes in a comfortable pattern (for example 1-2-3-2-1). Sing them on 'neh' or 'nah' with a light, connected sound. Keep the volume medium-low and the jaw easy. Move the pattern up and down by one note each time. Record and listen for a smooth, even sound.",
      demonstrate: "Sing the pattern with a smooth connected sound, then with a pushy sound so they can hear the difference.",
      coach: "Aim for evenness across the notes. If one note sticks out, slow down and sing it softer.",
      difficulties: [{ issue: "Sound is pressed in the middle", adjust: "Add more air and less volume; use 'ng' to find a lighter setting." }, { issue: "Sound thins out", adjust: "Add a little more firmness on 'neh' while keeping the same volume." }] },
    { key: "light-landing", title: "Light on the way up, soft on the way down", level: "intermediate", minutes: 6,
      student: "Sing a simple rising phrase from a song. On the way up, lighten your sound instead of pushing. On the way down, keep the same softness. Record and listen for any sudden louder bump on the high notes.",
      demonstrate: "Show the difference between a lighter ascent and a pushed one.",
      coach: "Light and steady. If the high notes squeak, lower the volume further.",
      difficulties: [{ issue: "High notes squeak or crack", adjust: "Reduce volume and try on 'ng' first." }, { issue: "The phrase loses energy", adjust: "Keep the intention strong while the sound stays light." }] },
    { key: "register-in-song", title: "Move through registers in a song", level: "advanced", minutes: 10,
      student: "Choose a song with a wide range. Mark where the melody moves to your higher area. Practice that move slowly, then in rhythm. Try it two ways: a smoother, connected sound and a fuller sound. Record both and choose the one that fits the song.",
      demonstrate: "Show both options briefly within a safe volume.",
      coach: "Both are acceptable; teach choice. If the student strains, stop and lighten.",
      difficulties: [{ issue: "Distinct break in the middle of a favourite song", adjust: "Choose another key or practice only the transition for a few days." }, { issue: "Fatigue", adjust: "Short sessions with water and rest." }] }
  ],
  assignments: [
    { key: "reg-speak-sing", title: "Speak it, sing it", level: "beginner", minutes: 5, steps: ["Speak a line normal and light", "Sing it on one note and on a gentle rise", "Write down what changed in how it felt"] },
    { key: "reg-glide", title: "Three gentle glides a day", level: "intermediate", minutes: 6, steps: ["Glide on 'oo' x 3", "Note where the sound changes", "Record the smoothest glide"] },
    { key: "reg-song", title: "One song transition", level: "advanced", minutes: 12, steps: ["Mark the register change in a song", "Practise it slowly, then in rhythm", "Record two versions and choose"] }
  ],
  progress: [
    { indicator: "Flips or cracks in a glide", measure: "Count in a recorded glide" },
    { indicator: "Evenness across middle notes", measure: "Student and instructor rating 1-5" },
    { indicator: "Pushing as pitch rises", measure: "Observed: often / sometimes / rarely" }
  ],
  followUp: { when: "Every 4 weeks.", tasks: ["Re-record the same glide and phrase.", "Compare number of flips and tension.", "Student describes how the higher notes feel now."], looksLike: ["Smoother glide", "Less pushing on higher notes", "More confidence in the middle"] },
  instructorCaution: "Be honest about your own experience. If you do not feel confident teaching the higher voice or advanced registration, teach the gentle, safe basics here (lighten, soften, go slowly) and refer students who want more to a vocal specialist. Do not force a 'break' to disappear or promise a specific sound.",
  keywords: ["head voice", "chest voice", "mixed", "crack", "break", "flip", "high notes", "falsetto"]
},
{
  key: "agility", number: 6, title: "Agility, riffs, and runs", skillSlug: "agility",
  studentSummary: "Learn to move between notes quickly and cleanly, one small step at a time.",
  instructorSummary: "Agility is built slowly from clean, simple patterns. Lip trills are not required; use staccato notes, five-note patterns and slow runs on 'noo' or 'yah'. Accuracy first, speed second. Use listening and copying from recordings.",
  assessment: {
    tasks: ["Echo a three-note and a five-note pattern slowly.", "Sing a simple pattern at two tempos.", "Copy a short, slow run from a song they like."],
    indicators: ["Notes blur or are skipped", "Student slows or loses pitch at faster tempo", "Pitch drifts in runs", "Jaw and neck tension", "Student can hear the pattern but not reproduce it"]
  },
  levels: {
    beginner: { focus: "Clean, slow patterns.", goals: ["Sing a five-note pattern cleanly at a slow tempo", "Hear the notes in a short run", "Keep the jaw loose"] },
    intermediate: { focus: "Add speed and variation.", goals: ["Sing five-note and nine-note patterns at a moderate tempo", "Copy a short run slowly then faster", "Return to a steady note after the run"] },
    advanced: { focus: "Create and use runs musically.", goals: ["Use short runs tastefully in a song", "Create a simple original riff", "Keep timing and tone clean at speed"] }
  },
  outline: ["Explain: speed comes after clarity.", "Demonstrate a five-note pattern in slow, separate notes (staccato), then connected.", "Student copies; coach one note at a time.", "Break a run into groups of three or four notes; sing each group, then join.", "Use a metronome app at a slow tempo; increase gradually.", "Record and compare tempos."],
  exercises: [
    { key: "staccato-five", title: "Staccato five-note pattern", level: "beginner", minutes: 5,
      student: "Sing a five-note scale up and down on short, light 'ha ha ha ha ha' notes, each separate, at a slow tempo. Keep your belly and jaw loose. When it feels clean, connect the notes smoothly on 'nah'. Record the staccato version and the connected version.",
      demonstrate: "Show separate light notes first. Then connect them. Use a tempo app.",
      coach: "Clean and even. Avoid pushing. If notes blur, slow down.",
      difficulties: [{ issue: "Notes blur together", adjust: "Return to staccato and a slower tempo." }, { issue: "Tension", adjust: "Shake out shoulders and jaw between rounds." }] },
    { key: "slow-run-groups", title: "Slow run in small groups", level: "beginner", minutes: 6,
      student: "Pick a short run from a song you love. Slow down the recording or hum it slowly. Break it into groups of three notes. Sing each group on 'noo' until it is clean. Then join two groups. Keep it slow until you can sing it ten times in a row without mistakes.",
      demonstrate: "Break a run into small chunks on a keyboard and sing each.",
      coach: "Accuracy first. Celebrate each clean group.",
      difficulties: [{ issue: "Can't hear the individual notes", adjust: "Use a keyboard to play each note, one at a time." }, { issue: "Run falls apart when joined", adjust: "Add a tiny pause between groups, then shorten the pause." }] },
    { key: "nine-note-tempo", title: "Nine-note pattern with a metronome", level: "intermediate", minutes: 8,
      student: "Sing a nine-note pattern (1-2-3-4-5-4-3-2-1) on 'yah' or 'noo' with a metronome at a slow tempo. After three clean rounds, increase the tempo by a small amount. Stop when notes become messy. Write your best tempo.",
      demonstrate: "Show the pattern slowly and then a slightly faster version.",
      coach: "Stop before the sound gets messy. Record the cleanest tempo.",
      difficulties: [{ issue: "Pitch drifts at speed", adjust: "Go back to the cleanest tempo and practise there for several days." }, { issue: "Out of breath", adjust: "Break the pattern into two breaths." }] },
    { key: "copy-and-vary", title: "Copy a riff, then change one note", level: "intermediate", minutes: 8,
      student: "Choose a short riff you enjoy. Learn it slowly until it is clean. Then change just one note and sing it again. Record both versions and decide which you like.",
      demonstrate: "Sing a simple riff, then show how one note changed gives a new colour.",
      coach: "Keep within the key. Praise simple, tasteful choices.",
      difficulties: [{ issue: "Student only wants to copy", adjust: "Give permission: one note change is already creativity." }, { issue: "Changes clash with the chord", adjust: "Play the chord and show 'safe' notes of the scale." }] },
    { key: "riff-in-song", title: "Place a run in a song", level: "advanced", minutes: 10,
      student: "Pick a song. Choose one place at the end of a phrase for a short run. Practise it slowly, then with the track. Keep the run short and clear, and make sure the main melody still stands out. Record and listen: did the run serve the song?",
      demonstrate: "Place a simple run at a phrase ending. Compare with and without.",
      coach: "Less is more. Teach the student to ask if the run serves the song.",
      difficulties: [{ issue: "Runs everywhere", adjust: "Allow one run per verse only." }, { issue: "Timing slips", adjust: "Count the beat aloud while practicing." }] }
  ],
  assignments: [
    { key: "agi-staccato", title: "Clean five-note pattern", level: "beginner", minutes: 6, steps: ["Staccato five-note x 3", "Connected version x 3", "Record the cleanest"] },
    { key: "agi-metro", title: "Metronome ladder", level: "intermediate", minutes: 8, steps: ["Nine-note pattern at a slow tempo", "Increase slightly after 3 clean rounds", "Write your best clean tempo"] },
    { key: "agi-song", title: "One tasteful run", level: "advanced", minutes: 12, steps: ["Choose a place for a short run", "Practise slowly then with the track", "Record and write if it served the song"] }
  ],
  progress: [
    { indicator: "Clean tempo of a nine-note pattern", measure: "Beats per minute" },
    { indicator: "Notes in a copied run sung cleanly", measure: "Out of total" },
    { indicator: "Jaw and neck tension", measure: "Observed: yes / sometimes / not yet" }
  ],
  followUp: { when: "Every 4 weeks.", tasks: ["Repeat the nine-note pattern at the previous best tempo and a notch faster.", "Re-record the run from the start.", "Compare clarity."], looksLike: ["Higher clean tempo", "Cleaner copied run", "Runs used sparingly and musically"] },
  instructorCaution: "Do not require lip trills. If a student finds them easy and enjoyable they are optional, not a standard. Never push speed at the cost of pitch or tension.",
  keywords: ["runs", "riffs", "agility", "melisma", "fast", "ornament"]
},
{
  key: "harmony", number: 7, title: "Harmonization and blending", skillSlug: "harmony",
  studentSummary: "Learn to sing with others, hold your own part, and blend your voice.",
  instructorSummary: "Harmony needs a stable sense of pitch and good listening. Start with matching another voice, then singing a second note against a held note, then simple thirds. Teach blending: matching vowels, volume and timing.",
  assessment: {
    tasks: ["Sing a note with the instructor and notice whether they blend.", "Hold a note while the instructor sings a different one.", "Sing a simple song with a second line."],
    indicators: ["Pulls toward the other voice's note", "Cannot hold a note against another", "Volume or vowel does not match", "Listens before entering", "Can hear when the blend is good"]
  },
  levels: {
    beginner: { focus: "Blend on the same note.", goals: ["Match and blend with another voice on unison", "Match vowel and volume", "Hold a note while another note is sung"] },
    intermediate: { focus: "Simple harmony.", goals: ["Sing a third above or below a melody", "Hold a part in a simple two-part song", "Adjust to the group"] },
    advanced: { focus: "Independent parts and ensemble.", goals: ["Learn a harmony by ear", "Lead or support a small vocal group", "Adjust blend by listening"] }
  },
  outline: ["Sing in unison and talk about what 'blend' sounds like.", "Match vowels and volume.", "Sing a note while the instructor sings a different one; hold your own.", "Move to thirds on a simple melody.", "Layer in a recorded part.", "Assign a harmony line to learn and record."],
  exercises: [
    { key: "unison-blend", title: "Unison blend", level: "beginner", minutes: 5,
      student: "Play a track or sing along with a recording. Match the singer's note, vowel shape and volume as closely as you can. Try to make your voice disappear inside theirs. Record and listen: can you hear two voices or one?",
      demonstrate: "Sing a unison note with the student and slowly drift off to show the difference.",
      coach: "Listen. Let them hear the difference between 'beating' and a smooth blend.",
      difficulties: [{ issue: "Student is louder than the lead", adjust: "Ask them to sing at 80% of the volume of the recording." }, { issue: "Vowels differ", adjust: "Agree on the vowel and copy the mouth shape." }] },
    { key: "hold-your-note", title: "Hold your note", level: "beginner", minutes: 5,
      student: "Play two notes together (or ask a helper to sing one). Sing the lower one steadily while the other note sounds. Don't move toward the other note. Hold for eight counts. Switch to the other note.",
      demonstrate: "Sing a held note while you play a different note and stay steady.",
      coach: "Praise staying steady. If they drift, play the note louder and let them re-find it.",
      difficulties: [{ issue: "Pulled toward the other note", adjust: "Sing the held note, then add the other note softly." }, { issue: "Distracted by the other sound", adjust: "Plug one ear to hear their own voice, then uncover." }] },
    { key: "thirds", title: "Simple thirds", level: "intermediate", minutes: 8,
      student: "Choose a simple melody (like 'Happy Birthday'). Sing the melody while a helper (or a keyboard) plays a note a third higher or lower. Then try to sing the third while the melody plays. Go slowly and listen for the sweet sound of the interval.",
      demonstrate: "Play melody and third on a keyboard so they hear the sound first.",
      coach: "Learn the harmony part separately before combining. Use the keyboard.",
      difficulties: [{ issue: "Slides back to the melody", adjust: "Practice the harmony alone, then add the melody quietly." }, { issue: "Doesn't know where the third is", adjust: "Count up three notes on the keyboard." }] },
    { key: "part-over-track", title: "Sing a part over a recorded track", level: "intermediate", minutes: 8,
      student: "Use a recording of a simple song. Learn a harmony part (from your instructor or by ear). Sing it with the track at a softer volume than the lead. Record and listen: do the parts blend?",
      demonstrate: "Sing the harmony part against the recording.",
      coach: "Support, don't compete. The harmony should lift the lead.",
      difficulties: [{ issue: "Can't hear their part", adjust: "Have them listen with one ear covered." }, { issue: "Rhythmic mismatch", adjust: "Speak the harmony words in rhythm first." }] },
    { key: "group-blend", title: "Blend in a small group", level: "advanced", minutes: 10,
      student: "Sing a simple chorus with two or three others (or layer your own recorded parts). Listen to the whole sound. Adjust your volume, vowel, and timing to blend. Record and ask: who stands out? Adjust until no one does.",
      demonstrate: "Model listening to the whole and adjusting.",
      coach: "Ask the group how it sounds. Reward listening.",
      difficulties: [{ issue: "One voice dominates", adjust: "Ask that voice to lighten and others to match." }, { issue: "Shy singer is lost", adjust: "Encourage steady, quiet confidence." }] }
  ],
  assignments: [
    { key: "harm-unison", title: "Blend with a recording", level: "beginner", minutes: 6, steps: ["Sing in unison with a recording", "Match vowel and volume", "Record and note if you hear one voice or two"] },
    { key: "harm-thirds", title: "A third above", level: "intermediate", minutes: 10, steps: ["Learn the third on a keyboard", "Sing it with the melody", "Record and listen"] },
    { key: "harm-part", title: "Learn a harmony part", level: "advanced", minutes: 12, steps: ["Learn the part", "Sing over the track", "Record and note any pull toward the lead"] }
  ],
  progress: [
    { indicator: "Holds own note against another", measure: "Seconds before drifting" },
    { indicator: "Blend with lead", measure: "Instructor rating 1-5" },
    { indicator: "Third sung accurately", measure: "Notes correct out of total" }
  ],
  followUp: { when: "Every 4 weeks.", tasks: ["Repeat the hold-your-note task.", "Record a harmony against the same track.", "Compare blend."], looksLike: ["Holds a part for longer", "Better matched vowels", "Student can find a third by ear"] },
  keywords: ["harmony", "blend", "choir", "background", "group", "alto", "tenor", "parts"]
},
{
  key: "stamina-dynamics", number: 8, title: "Stamina, dynamics, and control", skillSlug: "stamina-dynamics",
  studentSummary: "Build the strength to sing for longer and learn to move between soft and strong with control.",
  instructorSummary: "Stamina comes from efficient, relaxed singing and gradual building of duration. Dynamics are controlled changes in volume. Build slowly, keep rest in the plan, and always put comfort before volume.",
  assessment: {
    tasks: ["Have the student sing a familiar song start to finish and note any decline in tone or pitch.", "Ask them to sing a line softly, then medium, then louder, then back.", "Ask how their voice feels after singing."],
    indicators: ["Tone worsens near the end of a song", "Volume jumps instead of changing smoothly", "Pitch drops when tired", "Throat feels dry or sore after singing", "Cannot sing quietly with control"]
  },
  levels: {
    beginner: { focus: "Sing for a few minutes with ease and control soft sounds.", goals: ["Sing a full song at a comfortable volume", "Sing a line softly and steadily", "Rest and hydrate between efforts"] },
    intermediate: { focus: "Control gradual changes.", goals: ["Make a gradual louder and softer phrase", "Sing two songs back to back with consistent tone", "Choose dynamics to match the words"] },
    advanced: { focus: "Sustain a performance set with dynamics.", goals: ["Sing a set of 3-4 songs with planned dynamics", "Recover quickly between songs", "Use dynamics to tell the story"] }
  },
  outline: ["Check hydration, rest and warm-up habits.", "Sing a song and notice where the voice tires.", "Teach soft singing with support: steady air at low volume.", "Practise a crescendo and decrescendo on one note.", "Apply to a phrase of a song with planned dynamics.", "Set a short, gradual stamina plan with rest days."],
  exercises: [
    { key: "soft-steady", title: "Soft and steady", level: "beginner", minutes: 5,
      student: "Sing 'ah' on one comfortable note very softly for eight counts. Keep it steady and clear, not whispery. Try it again slightly louder. Notice how much air you use. Record and listen for steadiness.",
      demonstrate: "Show a soft, connected note and a breathy one.",
      coach: "Soft does not mean airy. Look for clear and steady.",
      difficulties: [{ issue: "Breathy sound", adjust: "A touch more firmness with the same quiet volume." }, { issue: "Voice disappears", adjust: "Raise the volume slightly and keep the same steady air." }] },
    { key: "swell", title: "Swell and fade", level: "intermediate", minutes: 6,
      student: "On one comfortable note, begin softly, grow gradually louder over four counts, and then fade back over four counts. Keep the tone clear and the throat relaxed. Don't let the pitch change. Record and listen for smoothness.",
      demonstrate: "Show a smooth swell and a jerky one.",
      coach: "Smooth change in volume with no jumps. Keep the peak comfortable, not loud.",
      difficulties: [{ issue: "Pitch rises as it gets louder", adjust: "Think 'wider' not 'harder'." }, { issue: "Jerky changes", adjust: "Make the change smaller and slower." }] },
    { key: "song-set", title: "Build a short set", level: "intermediate", minutes: 15,
      student: "Choose two songs you know. Warm up for three minutes. Sing both back to back at a comfortable volume, then rest for two minutes. Notice where your voice tires. Write it down. Next week, add 30 seconds more.",
      demonstrate: "Model pacing and recovery.",
      coach: "Grow duration by small amounts. Watch for strain.",
      difficulties: [{ issue: "Voice fatigues quickly", adjust: "Shorten the session and add rest; check hydration." }, { issue: "Student pushes to keep up", adjust: "Reduce volume and choose easier songs." }] },
    { key: "plan-dynamics", title: "Plan the dynamics of a song", level: "advanced", minutes: 10,
      student: "Print or write the lyrics of a song. Mark the soft, medium and strong parts based on the meaning of the words. Practise with these in mind and record. Listen: do the dynamics help tell the story?",
      demonstrate: "Show a flat version and a planned one.",
      coach: "Dynamics are about meaning. Ask what each line is saying.",
      difficulties: [{ issue: "Everything is loud", adjust: "Pick two lines to be the softest and build from there." }, { issue: "Changes feel forced", adjust: "Link them to the meaning of the words." }] }
  ],
  assignments: [
    { key: "stam-soft", title: "Soft steady note", level: "beginner", minutes: 5, steps: ["Sing a soft steady note x 4", "Try a slightly louder one", "Rate steadiness 1-5"] },
    { key: "stam-set", title: "Two-song set", level: "intermediate", minutes: 15, steps: ["Warm up", "Sing two songs", "Rest and record how the voice felt"] },
    { key: "stam-plan", title: "Dynamics map", level: "advanced", minutes: 12, steps: ["Mark dynamics in lyrics", "Sing with the plan", "Record and review"] }
  ],
  progress: [
    { indicator: "Length of comfortable singing", measure: "Minutes before tone declines" },
    { indicator: "Steady soft note", measure: "Student and instructor rating 1-5" },
    { indicator: "Smooth swell", measure: "Observed: smooth / uneven" }
  ],
  followUp: { when: "Every 4 weeks.", tasks: ["Repeat the two-song set.", "Re-record a swell.", "Ask how the voice feels at the end."], looksLike: ["Longer comfortable singing", "Smoother dynamics", "Less end-of-song strain"] },
  instructorCaution: "Remind students to rest, hydrate, and avoid singing through pain. Persistent hoarseness is a reason to see a doctor.",
  keywords: ["stamina", "tired", "dynamics", "soft", "loud", "control", "volume", "endurance"]
}
];
