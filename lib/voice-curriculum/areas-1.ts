import type { AreaSpec } from "./types";

export const AREAS_1: AreaSpec[] = [
{
  key: "posture-breath", number: 1, title: "Posture and breath management", skillSlug: "breath-posture",
  studentSummary: "A relaxed, balanced stance and calm, steady breathing are the base of everything else you sing.",
  instructorSummary: "Teach a relaxed, aligned stance and a low, quiet breath that is released steadily. The goal is ease and consistency, not a big breath. Most beginners over-breathe, lift the shoulders or grip the stomach; most improvement comes from releasing tension.",
  assessment: {
    tasks: ["Have the student stand naturally and sing one familiar line, then speak the same line. Watch posture and breathing without commenting yet.", "Ask them to breathe in for a count of four and release on a soft 'ssss' for as long as is comfortable. Time it.", "Sing a short phrase twice and note where they take breath."],
    indicators: ["Shoulders rise on the inhale", "Chin pushes forward or the neck looks tight", "Phrases end with the voice fading or being pushed", "Breath is audible and noisy on inhale", "Release on 'ssss' is uneven or shorter than about 10 seconds", "Knees locked or weight shifting from foot to foot"]
  },
  levels: {
    beginner: { focus: "Notice posture and breathing, and release obvious tension.", goals: ["Stand balanced with soft knees and relaxed shoulders", "Take a quiet low breath without lifting the shoulders", "Release air steadily on 'ssss' or 'vvvv' for 10-15 seconds"] },
    intermediate: { focus: "Connect steady air to sung phrases.", goals: ["Sing one four-bar phrase on one breath without pushing at the end", "Plan breath points in a song and keep them consistent", "Recover quickly after a poorly placed breath"] },
    advanced: { focus: "Keep ease while phrases, tempo and volume get demanding.", goals: ["Sustain longer phrases and dynamic changes without tension", "Breathe in rhythm in fast or syncopated songs", "Keep posture relaxed during performance and while holding a microphone"] }
  },
  outline: ["Warm welcome and a one-minute body check: feet, knees, spine, shoulders, jaw.", "Explain the aim in one sentence: easy, steady, quiet breath.", "Demonstrate the stance, then the low quiet inhale, then a steady release.", "Student tries; you coach one thing at a time (shoulders first, then jaw, then air).", "Move from air to a hummed note, then a spoken line, then a sung line.", "Record one phrase; listen back together and choose one thing to practice this week."],
  exercises: [
    { key: "stance-check", title: "Balanced stance check", level: "beginner", minutes: 3,
      student: "Stand with your feet about hip-width apart and your knees slightly soft. Let your arms hang. Imagine a string lifting the top of your head gently. Roll your shoulders back and down once, then let them rest. Check your jaw is loose. Say your name out loud, then sing one line of a song you know. Notice what stays relaxed.",
      demonstrate: "Stand in front of the student, show a stiff version (locked knees, high shoulders) then the relaxed version. Let them copy and compare in a mirror or on phone video.",
      coach: "Look from the side and front. Fix one thing at a time. Ask 'where do you feel tension?' before telling them. Praise any release.",
      difficulties: [{ issue: "Student stands rigid like a soldier", adjust: "Ask them to sway gently side to side and settle in the middle." }, { issue: "Cannot stand for long (health, fatigue)", adjust: "Teach seated with feet flat and back long; the principles are the same." }] },
    { key: "low-breath-release", title: "Quiet low breath and steady 'ssss'", level: "beginner", minutes: 5,
      student: "Place one hand lightly on your lower ribs and one on your stomach. Breathe in quietly through your nose or mouth for a count of four, letting the lower ribs and stomach widen a little. Do not lift your shoulders. Release the air on a soft, steady 'ssss' for as long as is comfortable. Rest and repeat four times. Write down your longest comfortable release in seconds.",
      demonstrate: "Show the quiet inhale (no gasp), then a steady 'ssss'. Time yourself for the student so they have a target they can reach.",
      coach: "Listen for a quiet inhale and an even 'ssss' with no wobble. The aim is evenness, not length. If the sound shakes or dies, the air is being pushed or dumped.",
      difficulties: [{ issue: "Shoulders lift on the inhale", adjust: "Have them lie on their back for two minutes first, then repeat standing." }, { issue: "Dizziness", adjust: "Shorter releases, more rest, and slower breathing; stop if it continues." }],
      safety: "Stop if you feel light-headed." },
    { key: "count-and-hum", title: "Counted breath into a hum", level: "beginner", minutes: 5,
      student: "Breathe in for four counts, then hum one comfortable note on 'mm' for eight counts with a gentle, steady sound. Feel a soft buzz in your lips and nose. Rest. Repeat on a slightly higher and then a slightly lower note. If humming feels tight, open your mouth a little as if saying 'ng' in 'sing'.",
      demonstrate: "Hum a note with a steady sound, then a wobbly version, so they can hear the difference. Play the note on a keyboard or app.",
      coach: "Check the sound stays steady and the jaw and tongue stay loose. If the hum is airy or fades, reduce the length.",
      difficulties: [{ issue: "Hum feels buzzy or ticklish", adjust: "Hum more softly or on 'ng'." }, { issue: "Cannot match the note", adjust: "Use a comfortable speaking pitch first; pitch work comes in the next area." }] },
    { key: "phrase-on-one-breath", title: "Sing a phrase on one breath", level: "intermediate", minutes: 8,
      student: "Choose a four-bar phrase from a song you love. Mark where you will breathe with a small tick in the lyrics. Breathe in quietly, sing the phrase at a comfortable volume, and stop before you push. Record yourself. Listen: does the end of the phrase sound as relaxed as the beginning? Adjust your tick marks and try again.",
      demonstrate: "Sing the phrase once with a gasp and a pushed end, then once with a planned quiet breath and a relaxed end.",
      coach: "Agree breath points that match the meaning of the words (end of a thought). Shorten the phrase rather than let the voice fade.",
      difficulties: [{ issue: "Student runs out of air before the end", adjust: "Add a breath earlier or slow the tempo; breathe in more slowly rather than more deeply." }, { issue: "Voice gets louder at the end of the phrase", adjust: "Practice the phrase on a hum, then on words, with the same volume." }] },
    { key: "consonant-air", title: "Spend the air wisely: consonants and vowels", level: "intermediate", minutes: 6,
      student: "Speak a line of a song with a flat, steady energy. Then sing it, keeping the same easy energy. Notice which words use up a lot of air ('h', 'f', 's', 'th'). Soften those consonants a little and let the vowels carry the sound. Mark the words where you tend to lose breath.",
      demonstrate: "Over-blow 'h' and 'f' words, then sing the same words with lighter consonants.",
      coach: "Listen for airy onsets. A gentle, clear start on vowels usually saves air.",
      difficulties: [{ issue: "Airy tone on soft songs", adjust: "Practice the line at a slightly higher volume with a clear onset, then bring it back down." }, { issue: "Mumbled words", adjust: "Say the words clearly first, then sing them with the same clarity." }] },
    { key: "breath-in-rhythm", title: "Breathing in rhythm", level: "advanced", minutes: 8,
      student: "Pick a faster song. Mark small, quick breaths in the gaps between lines. Practice breathing in time with the music: tap the beat, breathe in on the 'and' of the beat before your entrance, and sing. Record a verse and listen for any rushed or noisy breaths.",
      demonstrate: "Tap a beat and show a quick, silent breath on the off-beat.",
      coach: "Quick breaths are low and quiet. Keep shoulders down. Rehearse the breath as part of the music.",
      difficulties: [{ issue: "Gasping breaths", adjust: "Practice the breath alone to a metronome, then add the words." }, { issue: "Student sings behind the beat after breathing", adjust: "Start the breath earlier and count the entrance." }] }
  ],
  assignments: [
    { key: "breath-daily", title: "Five-minute breath and posture routine", level: "beginner", minutes: 5, steps: ["Balanced stance check (30 seconds)", "Quiet low breath and steady 'ssss' x 4", "Counted breath into a hum x 3", "Write down your longest comfortable 'ssss' in seconds"] },
    { key: "breath-phrase", title: "One song phrase, one breath", level: "intermediate", minutes: 10, steps: ["Choose a four-bar phrase and mark breath points", "Sing it on one breath at a comfortable volume, three times", "Record your best take and write one sentence about how the end of the phrase felt"] },
    { key: "breath-fast-song", title: "Plan the breaths in a faster song", level: "advanced", minutes: 12, steps: ["Mark quiet quick breaths in a verse", "Sing the verse to a metronome or backing track", "Record it and note any breath you can hear"] }
  ],
  progress: [
    { indicator: "Comfortable 'ssss' release", measure: "Seconds (record each week; look for steadiness, not just length)" },
    { indicator: "Shoulders stay down on the inhale", measure: "Instructor observation: yes / sometimes / not yet" },
    { indicator: "Phrase length on one breath", measure: "Number of bars sung with a relaxed end" },
    { indicator: "Audible gasp", measure: "Heard on recording: often / sometimes / rarely" }
  ],
  followUp: { when: "Every 3-4 weeks, or after the first breath unit.", tasks: ["Repeat the 'ssss' release and note the time and evenness.", "Sing the same four-bar phrase recorded at the start.", "Ask the student what they notice now."], looksLike: ["Quiet inhale with relaxed shoulders", "Steady release with no wobble", "Phrase ends as relaxed as it begins"] },
  instructorCaution: "Avoid telling students to 'push from the diaphragm' or to take huge breaths. Keep instructions about feeling and ease. If a student has asthma or a breathing condition, let them set the pace and suggest they check with their doctor.",
  keywords: ["breath", "breathing", "posture", "stamina", "run out of air", "tension"]
},
{
  key: "pitch-ear", number: 2, title: "Pitch accuracy and ear training", skillSlug: "pitch-ear",
  studentSummary: "Learn to hear a note, imagine it, and sing it so that it matches.",
  instructorSummary: "Ear training comes before voice training: if a student cannot hear the difference between their note and the target, instructions about the voice will not help. Work from single notes, to two notes, to short patterns, to a phrase in a real song. Always compare to a reference.",
  assessment: {
    tasks: ["Play five single notes in the student's comfortable range on a keyboard or app; ask them to match each one.", "Play two notes and ask whether the second is higher, lower or the same.", "Sing a familiar song's first line a cappella and then with a track; note drift.", "Echo a short three-note pattern."],
    indicators: ["Matches single notes within a semitone", "Hears 'higher' versus 'lower' correctly", "Stays in the same key from start to end of a phrase", "Notices and fixes their own mistakes", "Sings flat or sharp consistently on certain notes"]
  },
  levels: {
    beginner: { focus: "Hear and match single notes and simple patterns.", goals: ["Match five comfortable notes", "Say whether a second note is higher or lower", "Echo a three-note pattern"] },
    intermediate: { focus: "Keep pitch through a phrase and with accompaniment.", goals: ["Sing a phrase in tune a cappella", "Hear when they drift and correct", "Sing intervals up to a fifth"] },
    advanced: { focus: "Hold pitch in harder keys, with other parts and with embellishments.", goals: ["Stay in tune when other voices or instruments move", "Sing a new line by ear", "Hear and name the key and the first note"] }
  },
  outline: ["Check the student can hear the reference: play a note, ask them to hum it, ask 'higher, lower, same?'.", "Start with a note in their comfort zone; match it together on 'mm', then 'ah'.", "Add two-note patterns, then three, then 1-3-5-3-1.", "Teach the self-check: sing, listen back (record), compare to the reference.", "Apply to the first line of a song.", "Give a daily five-minute listening-and-matching routine."],
  exercises: [
    { key: "match-one-note", title: "Match one note", level: "beginner", minutes: 5,
      student: "Play one note on a keyboard or tuning app that sits comfortably in your voice. Listen to it for two seconds. Imagine it in your head. Hum it softly. Hold your hum and listen to whether it blends with the note. If it sounds like a wobble or a clash, slide very slowly until it fits. Repeat with five different notes. Rest your voice if it feels tired.",
      demonstrate: "Play a note, hum it slightly off, then slide into the match so they can hear the 'blend' versus the 'beating'.",
      coach: "Ask 'what do you hear?' before you correct. A student who can feel the blend is learning the skill.",
      difficulties: [{ issue: "Student cannot tell if they are matching", adjust: "Use headphones or a quiet room, sing at a lower volume, and play the note longer." }, { issue: "Voice jumps to an octave away", adjust: "That is a match in a different octave; praise it and then move into their range." }] },
    { key: "higher-lower-same", title: "Higher, lower or the same?", level: "beginner", minutes: 5,
      student: "Ask a helper (or use a free ear-training app) to play two notes. Say whether the second is higher, lower or the same. Then sing both notes. Start with notes far apart and bring them closer together over the week. Keep a simple score each day.",
      demonstrate: "Play wide intervals first, then narrower. Celebrate right answers.",
      coach: "If the student answers wrongly, replay and let them slide their voice between the notes to feel the direction.",
      difficulties: [{ issue: "Cannot hear direction", adjust: "Use their hand: move it up or down with the pitch." }, { issue: "Gets frustrated", adjust: "Keep sessions under five minutes and finish on a success." }] },
    { key: "echo-patterns", title: "Echo patterns: 1-3-5-3-1", level: "beginner", minutes: 6,
      student: "Listen to a short pattern played slowly (for example five notes up and down). Sing it back on 'ah' or 'noo' at a comfortable volume. Then try it a half-step higher and a half-step lower. Record one round and listen to whether each note was in tune.",
      demonstrate: "Play and sing a pattern together, then play only and have them sing alone.",
      coach: "Slow tempo, clear start note. If the pattern drifts, return to single notes for a day.",
      difficulties: [{ issue: "Pattern collapses halfway", adjust: "Break it into two shorter pieces and join them." }, { issue: "Student sings too loud and strains", adjust: "Model a soft, relaxed sound; pitch is easier with less force." }] },
    { key: "a-cappella-line", title: "A cappella first line", level: "intermediate", minutes: 8,
      student: "Choose the first line of a familiar song. Sing it without any accompaniment and record it. Then play the starting note and sing again with the track. Listen to both. Mark any word where your pitch moved. Practice those words slowly with a keyboard until they match.",
      demonstrate: "Sing a line, then show how you check the first and last note against the instrument.",
      coach: "Pick a song in a comfortable key. Help the student find the first note before they start.",
      difficulties: [{ issue: "Starts in a different key every time", adjust: "Always play the starting note first and sing it silently before beginning." }, { issue: "Drifts flat on long notes", adjust: "Practice the long note on 'mm' with a drone note, listening for the blend." }] },
    { key: "interval-slides", title: "Interval slides and landing", level: "intermediate", minutes: 6,
      student: "Play two notes a third apart (for example do and mi). Sing the first, then slide slowly to the second and stop exactly on it. Check the landing against the instrument. Repeat with fourths and fifths. Slow slides help your ear catch the exact note.",
      demonstrate: "Slide too far and too short so they hear 'over' and 'under', then land exactly.",
      coach: "Praise accurate landings. If they overshoot, shorten the slide; if they undershoot, give the target note louder.",
      difficulties: [{ issue: "Always overshoots high notes", adjust: "Ask them to think 'narrow' and 'light' and aim slightly under." }, { issue: "Strain on higher notes", adjust: "Use a lower start note or smaller intervals." }] },
    { key: "drone-harmony-pitch", title: "Sing against a drone", level: "advanced", minutes: 8,
      student: "Play one low note (a drone). Sing a slow scale above it and listen for how each note sounds against the drone, from easy and smooth to tense. Practice landing on the notes that feel smooth. Then sing a short melody you know over the drone.",
      demonstrate: "Show how a note 'locks in' with the drone and how a slightly off note sounds rough.",
      coach: "This builds an inner sense of key. Keep it quiet and unhurried.",
      difficulties: [{ issue: "Gets lost against the drone", adjust: "Return to singing the drone note together, then add one step at a time." }, { issue: "Fatigue", adjust: "Keep sessions to five minutes." }] }
  ],
  assignments: [
    { key: "pitch-daily", title: "Daily match-five-notes", level: "beginner", minutes: 5, steps: ["Match five single notes", "Do 'higher, lower, same?' for ten pairs", "Echo one pattern and write down which note was hardest"] },
    { key: "pitch-song-line", title: "Two recordings of one line", level: "intermediate", minutes: 10, steps: ["Record a cappella", "Record with the track", "Listen to both and mark where your pitch moved"] },
    { key: "pitch-drone", title: "Melody over a drone", level: "advanced", minutes: 10, steps: ["Sing a slow scale against a drone", "Sing a short melody over the drone", "Record your best take"] }
  ],
  progress: [
    { indicator: "Single-note matches within a semitone", measure: "Out of five" },
    { indicator: "Higher/lower/same accuracy", measure: "Out of ten" },
    { indicator: "Pattern echo accuracy", measure: "Notes in tune out of the pattern" },
    { indicator: "A cappella line ends in the same key", measure: "Yes / sometimes / not yet" }
  ],
  followUp: { when: "Every 3-4 weeks.", tasks: ["Repeat five single notes and ten higher/lower pairs.", "Re-record the first line used at the start.", "Ask the student to find and sing the starting note."], looksLike: ["Most single notes match", "Starts and ends a phrase in the same key", "Student notices and corrects their own slips"] },
  instructorCaution: "Some students struggle to hear pitch differences. This is trainable, but progress can be slow; keep tasks short and celebrate small wins. A student who cannot match any pitch at all after several weeks might benefit from a hearing check.",
  keywords: ["pitch", "in tune", "off key", "ear", "flat", "sharp", "key"]
},
{
  key: "tone-resonance", number: 3, title: "Vocal tone, resonance, and openness", skillSlug: "tone-resonance",
  studentSummary: "Find a clear, warm, free sound that does not feel squeezed.",
  instructorSummary: "Tone is the result of relaxed jaw, tongue and throat, steady air, and clear vowels. Teach by sensation and by listening to recordings, not by anatomy. Use gentle hums, 'ng' and open vowels to find forward, easy sound.",
  assessment: {
    tasks: ["Sing a sustained 'ah' and a familiar line; note breathiness, harshness, nasality or a squeezed quality.", "Ask the student to describe how their voice feels (tight, free, buzzy, heavy).", "Record the same line at two volumes."],
    indicators: ["Jaw tightens or juts forward", "Tongue pulls back or the throat feels squeezed", "Tone is airy, thin, or pressed", "Vowels change shape when pitch rises", "Voice sounds different on recordings than it feels"]
  },
  levels: {
    beginner: { focus: "Release the jaw and tongue and find an easy hum and open 'ah'.", goals: ["Hum on 'mm' or 'ng' with a gentle buzz", "Sing 'ah' without squeezing", "Describe the difference between tight and free"] },
    intermediate: { focus: "Keep tone consistent across vowels and through a phrase.", goals: ["Match tone between 'oo', 'oh', 'ah', 'ee'", "Keep a warm tone at soft and medium volume", "Notice and fix a squeezed word"] },
    advanced: { focus: "Choose tone colours on purpose for a song.", goals: ["Brighten or warm the sound for the style", "Keep tone steady in a performance setting", "Use recordings to refine tone"] }
  },
  outline: ["Play the student a recording of themselves; ask what they like and what they would change.", "Teach the jaw and tongue release: yawn-sigh, gentle chewing, tongue relaxed on the lower lip.", "Introduce 'ng' glides and hums to feel forward vibration.", "Apply to 'ah', then other vowels, then a word, then a phrase.", "Compare two recordings (tight and free) and let them hear it.", "Assign the five-minute tone routine."],
  exercises: [
    { key: "yawn-sigh", title: "Yawn-sigh release", level: "beginner", minutes: 3,
      student: "Take an easy, quiet yawn (or imagine one). On the exhale let out a soft sigh on 'hah' from a comfortable middle note down to a lower note. Keep your jaw loose and your tongue resting. Repeat four times and notice if your throat feels more open.",
      demonstrate: "Do a big visible yawn then a gentle sigh down. Let the student see the jaw dropping naturally.",
      coach: "Look for a jaw that drops easily. Do not force the mouth wide; ease is the point.",
      difficulties: [{ issue: "Student cannot yawn on command", adjust: "Use a gentle sigh on 'hoo' instead." }, { issue: "Sigh turns breathy", adjust: "Keep the sound soft but connected, not whispered." }] },
    { key: "ng-glide", title: "'ng' glide", level: "beginner", minutes: 4,
      student: "Say 'sing' and hold the 'ng' sound at the end (the back of the tongue touches the soft palate). Hum on 'ng' on one comfortable note, then glide slowly up a few notes and back down. Feel the soft buzz behind your nose and mouth. Keep the sound gentle. Rest if it tickles.",
      demonstrate: "Show where the tongue sits. Slide gently and quietly.",
      coach: "The sound should be easy and buzzing, not pinched. If it is nasal and tight, soften the volume.",
      difficulties: [{ issue: "Sound is stuck in the nose", adjust: "Open the mouth slightly and think 'ah' while keeping the tongue relaxed." }, { issue: "Throat feels tight", adjust: "Try a soft hum on 'mm' first." }] },
    { key: "hoo-sigh-glide", title: "'Hoo' sighs", level: "beginner", minutes: 4,
      student: "Sing a soft 'hoo' (like a gentle owl) from a comfortable note, gliding down slowly. Keep the sound round and quiet. Do five sighs on different starting notes. Focus on an easy release rather than power.",
      demonstrate: "Model a gentle, round 'hoo' with an easy slide.",
      coach: "Round, easy and quiet. If it cracks, stay in a lower range and keep it relaxed.",
      difficulties: [{ issue: "Voice cracks", adjust: "Start lower and make the slide smaller." }, { issue: "Breathy", adjust: "Use a slightly firmer, steady sound but stay soft." }] },
    { key: "vowel-ladder", title: "Vowel ladder", level: "intermediate", minutes: 6,
      student: "Sing one comfortable note on 'oo', then 'oh', 'ah', 'eh', 'ee' without changing the sound too much. Keep the jaw relaxed and the tongue easy. Notice which vowel feels tighter. Record the five vowels and listen for differences in tone.",
      demonstrate: "Sing the five vowels showing small, relaxed mouth changes and a steady tone.",
      coach: "Aim for consistent warmth. 'ee' often squeezes: let the jaw drop a little and keep the corners relaxed.",
      difficulties: [{ issue: "'ee' sounds thin and tight", adjust: "Think 'ih' with a slightly open mouth." }, { issue: "Vowels all sound the same", adjust: "Exaggerate the mouth shapes at first, then relax them." }] },
    { key: "soft-to-medium", title: "Soft, medium, steady", level: "intermediate", minutes: 6,
      student: "Sing a comfortable note on 'ah' at a soft volume, then medium, then soft again, keeping the tone free and the same colour. Do not push. Record and listen: is the tone steady or does it get harsher at the medium level?",
      demonstrate: "Show a smooth swell and return without the tone changing.",
      coach: "Aim for clean consistent tone. Increase volume with more steady air rather than more squeeze.",
      difficulties: [{ issue: "Tone gets harsh as volume rises", adjust: "Return to a lower volume and build gradually." }, { issue: "Cannot sing softly", adjust: "Practice a soft hum and then add the vowel." }] },
    { key: "colour-choices", title: "Choosing tone colours for a song", level: "advanced", minutes: 8,
      student: "Pick one phrase of a song. Sing it three ways: bright and forward, warm and rounded, and simple and natural. Record all three. Choose the one that best fits the words and style and say why.",
      demonstrate: "Model the three colours in small, safe ways. Avoid exaggeration.",
      coach: "This is musical choice, not a trick. Let the student decide and defend their choice.",
      difficulties: [{ issue: "All three sound identical", adjust: "Change the vowel shape slightly or the smile-width of the mouth." }, { issue: "Strain while trying a colour", adjust: "Return to a natural tone; the colour should never cost comfort." }] }
  ],
  assignments: [
    { key: "tone-daily", title: "Five-minute open-tone routine", level: "beginner", minutes: 5, steps: ["Yawn-sigh x 4", "'ng' glide x 3", "'Hoo' sighs x 5", "Write down which felt freest"] },
    { key: "tone-vowels", title: "Vowel comparison recording", level: "intermediate", minutes: 8, steps: ["Sing the vowel ladder on one note", "Record it", "Mark the vowel that sounded tightest and practice it slowly"] },
    { key: "tone-song", title: "Three colours, one phrase", level: "advanced", minutes: 10, steps: ["Record three versions of one phrase", "Choose your favourite", "Write one sentence about why it fits the song"] }
  ],
  progress: [
    { indicator: "Free versus tight tone", measure: "Student rating 1-5 and instructor rating 1-5" },
    { indicator: "Vowel consistency", measure: "Number of vowels with similar tone out of five" },
    { indicator: "Jaw and tongue release", measure: "Observed: yes / sometimes / not yet" }
  ],
  followUp: { when: "Every 3-4 weeks.", tasks: ["Re-record the sustained 'ah' and a familiar line.", "Listen to old and new takes together.", "Ask the student to describe the difference."], looksLike: ["Easier, less pressed sound", "More even vowels", "Student can hear and name tight versus free"] },
  instructorCaution: "Avoid forcing a 'placement' or telling students to 'sing from the mask' as a rule. Use sensations as gentle guides and let recordings be the judge. Persistent hoarseness, pain or breathiness that does not improve should be checked by a doctor.",
  keywords: ["tone", "sound", "resonance", "nasal", "breathy", "squeezed", "warm", "bright"]
},
{
  key: "range", number: 4, title: "Vocal range development", skillSlug: "range",
  studentSummary: "Find your comfortable range and extend it safely over time.",
  instructorSummary: "Range grows slowly and safely from the comfortable middle outward. Map the student's range first, choose keys that fit it, and expand a note or two at a time. Never push for extremes; stamina and tone come first.",
  assessment: {
    tasks: ["Slide gently down from a comfortable note to the lowest easy note and up to the highest easy note; record the notes.", "Sing a familiar song in two keys and note which fits better.", "Ask where the voice feels easy, effortful or breaks."],
    indicators: ["Easy lowest and highest notes", "Notes where the sound thins, cracks or strains", "Preferred key for common songs", "Effort level near the top and bottom of the range"]
  },
  levels: {
    beginner: { focus: "Map the comfortable range and choose suitable keys.", goals: ["Know their lowest and highest comfortable notes", "Use gentle sirens to explore without strain", "Pick a key that fits for a chosen song"] },
    intermediate: { focus: "Extend by small steps and keep tone.", goals: ["Add one or two notes at either end with ease", "Sing phrases that move across the range", "Reduce cracks and strain"] },
    advanced: { focus: "Make a wider range usable in songs.", goals: ["Sing a full song across the range with consistent tone", "Choose keys and arrangements that show the best of their voice", "Manage warm-ups before higher-demand songs"] }
  },
  outline: ["Warm up gently with sighs and hums.", "Map the range with a slow slide and a keyboard; write the notes down.", "Explain that range is a result of ease, not effort.", "Practice small stepwise extensions at the edges.", "Test two keys for a favourite song.", "Plan a weekly range practice that is short and gentle."],
  exercises: [
    { key: "range-map", title: "Map your comfortable range", level: "beginner", minutes: 6,
      student: "With a keyboard or app, start on a note in the middle of your speaking range. Sing it on 'ah'. Move one note down at a time until the sound gets uncomfortable, then one note back. Do the same going up. Write down your lowest and highest easy notes. Do not push beyond ease.",
      demonstrate: "Show how to step gently and stop at the first sign of effort.",
      coach: "The edges are where the sound thins or tightens. Mark them gently and praise honesty.",
      difficulties: [{ issue: "Student pushes to look impressive", adjust: "Explain that range gained through strain disappears; ask for the easy edges only." }, { issue: "Cracks at the top", adjust: "Stop two notes lower and record that as the easy top for now." }] },
    { key: "gentle-sirens", title: "Gentle sirens on 'ng' or 'oo'", level: "beginner", minutes: 5,
      student: "Sing a soft 'ng' or 'oo' and glide slowly up as far as is comfortable, then glide back down. Keep the sound soft and connected. Do four sirens. If it feels strained, make the glide smaller.",
      demonstrate: "Show a smooth, quiet siren and a pushed one so they hear the difference.",
      coach: "Look for a smooth line with no jumps or sudden loudness. If there is a break, make it smaller and slower.",
      difficulties: [{ issue: "Voice breaks in the middle", adjust: "Do smaller slides across the break and keep volume soft." }, { issue: "Throat feels tight", adjust: "Use a lower starting note and a softer sound." }] },
    { key: "five-note-steps", title: "Five-note steps, one half-step at a time", level: "intermediate", minutes: 8,
      student: "Sing a five-note scale (do re mi fa sol and back) on 'noo' or 'ah' starting on a comfortable note. Move the whole pattern up by one note each time until it feels like effort, then back down. Stop one step before it feels hard. Notice how many steps you gained since last week.",
      demonstrate: "Play the pattern on a keyboard and sing with the student.",
      coach: "Keep tempo slow and sound light. If the top notes squeeze, lower the starting note and try again.",
      difficulties: [{ issue: "Pitch drifts flat at the top", adjust: "Slow down and keep the volume gentle." }, { issue: "Student holds breath at the top", adjust: "Breathe before each pattern and keep the shoulders down." }] },
    { key: "key-test", title: "Find the best key for a song", level: "intermediate", minutes: 8,
      student: "Choose a song. Sing the chorus in three different keys (the original, one step lower, one step higher). Record each. Pick the key where you sound the clearest and most comfortable and write down the key.",
      demonstrate: "Sing a chorus in two keys and discuss which one suits you.",
      coach: "Choose the key that shows the voice's best, not the original key. Teach students that transposing is normal.",
      difficulties: [{ issue: "Student insists on the original key", adjust: "Record both and listen together." }, { issue: "No key feels right", adjust: "Look at the song's melody range; the song may simply be too wide for now." }] },
    { key: "range-in-song", title: "Use the new edge notes in a song", level: "advanced", minutes: 10,
      student: "Pick a song that touches the edges of your range. Practice the phrases that reach the highest and lowest notes slowly on 'noo', then on words. Make sure the tone stays steady. Record a verse and chorus and mark any place that sounds strained.",
      demonstrate: "Show how to practice the hardest phrase small, then in context.",
      coach: "Support the edge notes by keeping volume modest and the jaw loose. Shorten practice time if tired.",
      difficulties: [{ issue: "Voice tires quickly", adjust: "Divide practice into two short sessions with rest between." }, { issue: "Edge notes sound weak", adjust: "Check the vowel and the start of the note; a clear gentle start often helps." }] }
  ],
  assignments: [
    { key: "range-map-hw", title: "My range map", level: "beginner", minutes: 8, steps: ["Map your comfortable range", "Write down lowest and highest easy notes", "Do four gentle sirens"] },
    { key: "range-key", title: "Choose my key", level: "intermediate", minutes: 10, steps: ["Sing a chorus in three keys", "Record all three", "Choose the key that feels best and write it down"] },
    { key: "range-song", title: "Edge notes in context", level: "advanced", minutes: 12, steps: ["Practice the highest phrase slowly", "Record a verse and chorus", "Note any strain and where"] }
  ],
  progress: [
    { indicator: "Easy lowest note", measure: "Note name; check monthly" },
    { indicator: "Easy highest note", measure: "Note name; check monthly" },
    { indicator: "Notes gained without strain", measure: "Count since the first map" },
    { indicator: "Cracks or strain in a chosen song", measure: "Count in a recorded verse" }
  ],
  followUp: { when: "Monthly.", tasks: ["Repeat the range map.", "Re-record a song from the first month.", "Compare edge notes and effort."], looksLike: ["One or two notes gained with ease", "Fewer cracks", "Student can choose a fitting key unaided"] },
  instructorCaution: "This curriculum does not assume advanced vocal-science expertise. Expand range slowly and conservatively. If a student reports pain, persistent hoarseness, or a loss of range that does not recover, stop range work and suggest they see a doctor or a qualified voice specialist.",
  keywords: ["range", "high notes", "low notes", "higher", "lower", "extend", "key"]
}
];
