/** FROZEN ONE-TIME IMPORT SOURCE. These manuscripts are converted by convert.ts into the seed migration. After the seed is applied the DATABASE is the only source of truth; the app never reads this file. Edit teachings in the Teaching Editor, not here. */
import type { TeachingModule } from "./types";

export const CORE_STATEMENT = "The youngest in the Kingdom may face some of the hardest challenges in praise and worship ministry because they’re still developing the spiritual maturity and discernment needed to withstand the pressures they encounter.";

export const MODULE_3: TeachingModule = {
  key: "psyche-of-a-praiser",
  number: 3,
  title: "The Psyche of a Praiser: Understanding the Mental and Spiritual Battles of Worship Ministry",
  mainMessage: "Worshipers can experience significant internal battles before, during and after ministry. Spiritual preparation, biblical understanding, maturity and supportive discipleship matter alongside musical preparation.",
  summary: "Standing in front of people to lead them toward God stirs up real battles in the mind and heart: fear, shame, comparison, criticism, perfectionism, weariness, distraction and pride. This teaching names those battles honestly, shows how Scripture speaks into each one, and gives practical, biblical and relational tools for responding. It includes a featured teaching on being gifted but still growing, and a section for praise team leaders on protecting and developing spiritually young worshipers.",
  estimatedMinutes: 45,
  objectives: [
    "Name common internal battles of worship ministry (fear, shame, comparison, rejection, perfectionism, discouragement, distraction, pride) and recognize them in your own experience.",
    "Distinguish, with humility, between ordinary human struggles and spiritual opposition, without assuming every difficulty is a demonic attack.",
    "Respond to difficult thoughts with Scripture, prayer, practical coping strategies and support (2 Corinthians 10:3–5; Philippians 4:6–8).",
    "Explain why musical gifting is not the same as spiritual readiness, and why spiritually young worshipers benefit from discipleship and mentoring.",
    "Use 1 Peter 5:8, Ephesians 4:14, Hebrews 5:13–14, 1 Timothy 3:6 and Luke 22:31–32 accurately and without overreaching.",
    "Make a personal plan for before, during and after serving, including who you will talk to."
  ],
  scriptures: [
    { ref: "2 Corinthians 10:3–5", paraphrase: "Paul says that although we live in the world, we do not wage war with worldly methods. The weapons we use are powerful through God for demolishing strongholds: arguments and every proud obstacle raised against the knowledge of God, taking every thought captive to obey Christ.",
      context: "Paul is answering criticism of his ministry in Corinth. The 'battle' described here is largely about thoughts and arguments, and the weapons are spiritual and truth-based. Taking thoughts captive is an active practice of comparing a thought with what is true in Christ." },
    { ref: "Ephesians 6:10–18", paraphrase: "Be strong in the Lord and in his mighty power. Put on the full armor of God so that you can stand against the devil's schemes. Our struggle is not against flesh and blood but against rulers, authorities and spiritual forces of evil. Stand firm with truth, righteousness, readiness from the gospel of peace, faith, salvation and the Spirit's sword, the word of God, and pray at all times.",
      context: "Paul closes his letter by describing a spiritual struggle that believers face together. The emphasis is on standing, on truth, and on prayer. The armor is given by God, and the picture is of a community, not a lone hero." },
    { ref: "1 Peter 5:8", paraphrase: "Be sober-minded and alert. Your adversary the devil prowls around like a roaring lion, looking for someone to devour.",
      context: "Peter writes to believers who are suffering. The call is to watchfulness, humility and resistance, with the support of others who are enduring the same sufferings (5:9). The text says the adversary looks for 'someone'; it does not say he targets the youngest believers first. We will use it as a picture of vulnerability and the need for watchfulness, not as a claim about who he targets." },
    { ref: "Romans 8:1", paraphrase: "There is now no condemnation for those who are in Christ Jesus.",
      context: "Paul has just described the struggle with sin in chapter 7 and answers it with this declaration. Conviction from God leads toward repentance and restoration; condemnation says you are finished. In Christ, the verdict is settled." },
    { ref: "Philippians 4:6–8", paraphrase: "Do not be anxious about anything. In every situation, by prayer and petition with thanksgiving, present your requests to God, and the peace of God that surpasses understanding will guard your hearts and minds in Christ. Whatever is true, honorable, right, pure, lovely, admirable, excellent or praiseworthy, think about such things.",
      context: "Paul writes from prison, to a church he loves. He gives a pattern: bring worries to God in prayer with thanks, and then direct the mind deliberately to what is true and good. It joins prayer and the discipline of thought." },
    { ref: "2 Timothy 1:7", paraphrase: "God has not given us a spirit of fear, but of power, love and self-control (sound judgment).",
      context: "Paul writes to a gifted, younger leader who was timid. In verse 6 he tells Timothy to fan into flame the gift of God. Timothy's gift was real and his fear was real. Paul does not shame him; he reminds him of what God has given." },
    { ref: "1 Kings 19", paraphrase: "After a great victory, Elijah is threatened by Jezebel and flees in fear. Exhausted, he asks to die. God does not rebuke him first; an angel gives him food and rest. At Horeb God comes not in wind, earthquake or fire but in a gentle whisper, corrects his belief that he is alone (there are seven thousand who have not bowed to Baal), and gives him a next step, including a successor, Elisha.",
      context: "Elijah is a gifted, faithful prophet who still hits a wall of weariness, fear and isolation right after a high point. God's response is practical (rest and food), relational (presence and a companion) and directional. It is a model of care for weary worshipers and for leaders who care for them." },
    { ref: "Luke 22:31–32", paraphrase: "Jesus tells Simon that Satan has demanded to sift all of them like wheat, but that Jesus has prayed for Simon, that his faith will not fail, and that when he has turned back he should strengthen his brothers.",
      context: "The 'you' Satan asked to sift is plural, so the whole group of disciples is in view. Jesus prays specifically for Simon Peter. Peter will still fail by denying Jesus three times, and he is restored (John 21). Jesus does not remove the testing; he prays, restores, and gives Peter a calling to strengthen others from his own experience." }
  ],
  student: {
    intro: [
      "Serving in worship ministry looks calm from the pews. Inside, it can be loud. Before you serve, you may feel nervous, unworthy or tired. While you serve, your mind may race with comparison, criticism and 'what if I mess up?' After you serve, you might replay every flaw, feel flat, or feel proud and then ashamed of feeling proud.",
      "These experiences are common. They do not mean you are not called or not spiritual. They do mean that preparation for ministry includes more than rehearsing the songs: it includes the heart, the mind, Scripture, prayer, rest and people who care about you.",
      "This is a teaching about being honest and equipped. It is not meant to scare you or to suggest that every hard feeling is an attack from the enemy. Some struggles are ordinary human limits (sleep, stress, health), some are patterns of thought we have learned, some are sin we need to bring to God, and some may involve spiritual opposition. We will learn to tell the difference with humility, and to respond with truth and support."
    ],
    points: [
      { heading: "1. A balanced starting point", body: [
        "When a difficult thought or feeling arrives, ask three questions. Is my body asking for something (rest, food, a break)? Is my mind caught in an unhelpful pattern (fear, perfectionism, comparison)? Is there something here that is sin or spiritual opposition and that Scripture speaks to? Often it is a mix of all three.",
        "Ephesians 6 reminds us that there is a real spiritual struggle, and it also tells us what to do: stand, use truth, pray, and do it with other believers. It does not tell us to be afraid, or to blame every hard moment on a spiritual enemy."
      ] },
      { heading: "2. Fear and intimidation", body: [
        "Fear of people, of the room, of making a mistake, or of being exposed is among the most common battles. You may fear the platform, the leader, the other singers, or the congregation. Fear often intensifies right before you walk on.",
        "Second Timothy 1:7 reminds a gifted but timid young leader that God's gift to us is power, love and self-control, not a spirit of fear. Paul also tells him to stir up the gift. You do not wait for the fear to be gone before you serve; you bring it to God and take the next faithful step."
      ], example: "Before: 'I have a knot in my stomach and I want to leave.' During: 'I forget the second verse and freeze.' After: 'I should not have been on the team.' A response: pray before ('God, I give you this fear'), breathe and refocus on the people during, and talk with your leader afterward." },
      { heading: "3. Shame and condemnation", body: [
        "Shame says 'something is wrong with me.' Condemnation says 'you will never be good enough.' Conviction is different: it says 'this thing was wrong' and it leads toward repentance and restoration.",
        "Romans 8:1 says there is no condemnation for those in Christ. If a thought attacks your identity and offers no way forward, it is not the voice of the Father. Bring the specific failure to God, receive forgiveness, make things right if needed, and keep going."
      ] },
      { heading: "4. Comparison and insecurity", body: [
        "Praise teams are full of gifts that are easy to compare: tone, range, stage presence, the ability to ad-lib. Comparison turns teammates into competitors and turns your gift into a source of anxiety.",
        "Philippians 2 (Module 1) calls us to count others as more significant. That does not mean pretending you have no gift; it means refusing to rank yourself. Thank God for someone else's gift, and ask what he has uniquely given you."
      ] },
      { heading: "5. Rejection and criticism", body: [
        "You may receive feedback you do not like, be passed over for a solo, or hear criticism that is unkind. Some feedback is valuable and needs to be received. Some is ill-timed or wrong.",
        "A helpful practice: wait before responding; ask 'what is true in this?' and 'what is not?'; talk with someone you trust; and pray before reacting. A mature worshiper learns to be teachable without being crushed."
      ] },
      { heading: "6. Performance anxiety and perfectionism", body: [
        "Performance anxiety can make your heart race, your voice shake, and your mind go blank. Perfectionism says 'it must be flawless or it is worthless.' Both can make worship about the self.",
        "Philippians 4:6–8 gives a pattern: bring the worry to God with thanks, receive his peace, and direct your thoughts to what is true. Practical help includes preparation, breath and body techniques your instructor can teach you, and the reminder that your aim is to help people meet God, not to be flawless. If anxiety is severe or constant, talk with a trusted leader and a qualified counselor or doctor; that is wisdom, not weakness."
      ] },
      { heading: "7. Discouragement and weariness", body: [
        "Elijah's story (1 Kings 19) is a gift. Right after a great victory he was exhausted, afraid, and alone. God responded first with food and rest, then with presence, then with perspective and a companion.",
        "If you are weary, do not assume you are failing spiritually. Ask whether you need rest, whether you are carrying too much, and who you can tell. Serving without rest is not a spiritual virtue. Even leaders must be cared for."
      ] },
      { heading: "8. Distractions and competing thoughts", body: [
        "During a service you may think about the sound, what people think, an unfinished argument, or your to-do list. Not every distracting thought is spiritual warfare; most are just a busy mind.",
        "Second Corinthians 10:5 speaks of taking thoughts captive. A simple practice: notice the thought, name it, and gently return your attention to God and the people in front of you. Short prayers help: 'Lord, I give you this thought. Help me to be here.'"
      ] },
      { heading: "9. Pride and the desire for recognition", body: [
        "Pride is not only arrogance; it can also be fear of not being noticed. It shows up as needing to be the featured voice, being hurt when not thanked, or comparing applause. Praise teams are uniquely exposed because the work is public.",
        "The cure is not self-hatred. It is truth and gratitude: your gift is a gift, you are loved apart from the platform, and the point is God's glory and others' good. Confess pride when you see it. It is common, and it loses power when named."
      ] },
      { heading: "10. Spiritual opposition and discernment", body: [
        "Scripture teaches that there is an adversary who opposes God's people (Ephesians 6:11–12; 1 Peter 5:8). It also teaches that we are to resist him by being alert, firm in faith, and surrounded by other believers (1 Peter 5:8–9).",
        "Not everything is spiritual opposition. A good test is to ask: Does this thought agree with what God has said? Does it lead me toward truth, repentance and love, or toward fear, isolation and shame? Bring it to God and to trusted, mature believers. Resisting is mostly ordinary: truth, prayer, obedience, rest and community."
      ] },
      { heading: "11. Before, during and after: what you might experience", body: [
        "BEFORE: nerves in the days before; feeling unqualified; arguments or distractions that seem to peak on the day you serve; tiredness; a sense of dread. A response: prepare practically, rest, pray for the congregation and yourself, tell your leader if you are struggling, and arrive early to settle.",
        "DURING: a racing mind; fear of mistakes; comparison with other singers; awareness of the audience; getting caught in how you sound. A response: breathe, return attention to God and the congregation with a short prayer, and keep singing. Mistakes are survivable.",
        "AFTER: replaying errors; feeling empty or flat; elation then a drop; praise that tempts pride or criticism that stings; weariness. A response: thank God, do not replay the service for hours, eat and rest, debrief briefly with a trusted person, and write down one thing that went well."
      ] },
      { heading: "12. Your toolkit: Scripture, prayer, practical help, and people", body: [
        "SCRIPTURE: keep a short list of verses for fear (2 Timothy 1:7), condemnation (Romans 8:1), anxiety (Philippians 4:6–8) and weariness (1 Kings 19). Say them aloud and compare your thoughts to them (2 Corinthians 10:5).",
        "PRAYER: short, honest prayers; thanksgiving; praying for others; praying before, during and after serving.",
        "PRACTICAL HELP: sleep, food, breathing, warm-ups, realistic preparation, boundaries with your schedule, and, when needed, a doctor or counselor.",
        "PEOPLE: a mentor, a trusted friend, your leader. Isolation makes every battle harder. Telling someone is not weakness; it is obedience to the way God designed the body of Christ."
      ] }
    ],
    featured: {
      title: "Gifted but Still Growing: When the Platform Comes Before Spiritual Maturity",
      coreStatement: CORE_STATEMENT,
      sections: [
        { heading: "A person can be gifted and still spiritually young", body: [
          "A person may be musically gifted and fully qualified to sing on a praise team while still being spiritually young. Their vocal gift may have developed more quickly than their spiritual maturity. That is not a character flaw. It is a very common situation, and it deserves care, not criticism.",
          "It matters because the platform brings responsibilities, expectations, visibility and pressure. A person can be experiencing all of that without yet having the spiritual foundations to carry it with confidence."
        ] },
        { heading: "Visibility is not maturity", body: [
          "People often assume that someone who leads songs or stands in front of a congregation is spiritually strong. Visibility is not maturity. Maturity is formed by time with God, time in the word, obedience, correction, and perseverance, most of which is unseen.",
          "Musical gifting and spiritual readiness are different things. A person can have an extraordinary voice and still need to learn to pray, to read the Bible for themselves, to forgive, to receive correction, and to discern."
        ] },
        { heading: "What spiritually young worshipers may experience", body: [
          "Intimidation: feeling out of their depth among more experienced believers or leaders. Discouragement: believing they are failing because they feel so inconsistent. Confusion: hearing many opinions about what worship 'should' be and not knowing how to weigh them. Temptation: facing pride, relationships on the team, or old habits, with the added pressure of being 'an example.' Comparison: measuring their inside against others' outsides.",
          "None of these means they are not called. It means they need support while their roots grow deep."
        ] },
        { heading: "Immaturity and vulnerability (Ephesians 4:14)", body: [
          "Paul describes believers who are still like children, tossed by waves and blown about by every wind of teaching, in danger of deceit and craftiness. The cure he gives is growing up together in truth and love (4:15–16).",
          "A spiritually young believer is more likely to be swayed by a confident voice, a dramatic claim or a persuasive teaching because they do not yet have the trained senses of Hebrews 5:13–14 to test what they hear. This is an argument for teaching and mentoring, not for fear."
        ] },
        { heading: "A careful use of 1 Peter 5:8", body: [
          "First Peter 5:8 gives us the image of an adversary prowling and looking for someone to devour. It is a sober call to be alert. The verse does not say that the devil always targets the youngest believers first, and we should not claim that Scripture teaches that.",
          "What we can say is that a lion looks for the vulnerable: those who are isolated, unprepared or unguarded. Spiritually young believers who serve in visible roles without teaching, prayer, accountability and community are more exposed to pressure and deception. That is a principle drawn from the picture, and from experience, not a direct statement in the verse."
        ] },
        { heading: "A careful use of 1 Timothy 3:6", body: [
          "First Timothy 3:6 says an overseer must not be a recent convert, lest he become puffed up with conceit and fall into the condemnation of the devil. This verse is about overseers (church elders), not about praise team members. We should not treat it as a command for worship teams.",
          "As a principle it still teaches something wise: placing someone in a prominent role before they have had time to grow can expose them to pride and to a fall. That is a reason for patience, discipleship and appropriate, graduated responsibility, not a reason to exclude or shame new believers."
        ] },
        { heading: "Peter's testing and the call to strengthen others (Luke 22:31–32)", body: [
          "Jesus told Simon that Satan had asked to sift the disciples, and that he had prayed for Simon that his faith would not fail. Peter was gifted, bold and sincere, and he still failed under pressure. Jesus did not abandon him. He prayed, restored him, and then told him to strengthen his brothers.",
          "This is a comfort for anyone who has struggled or failed in ministry, and a charge: those who have come through testing are to strengthen others. Growth is not a straight line; failure can be the doorway to a deeper maturity when it is met with grace and restoration."
        ] },
        { heading: "How believers grow stronger", body: [
          "Prayer: a real conversation with God that does not depend on a role. Scripture: reading for yourself, so that you know what is true. Discernment: practicing, with others, the testing of what you hear. Accountability: someone who can ask you honest questions. Community: a church family where you are known beyond the platform. Rest and ordinary obedience: small, repeated, faithful steps.",
          "Believers grow stronger through spiritual practice and maturity. No one is stuck as a spiritual infant. If you are young in the Lord, that is where everyone begins, and what you do next matters."
        ] }
      ]
    },
    leaders: {
      title: "How to Protect and Develop Spiritually Young Worshipers",
      sections: [
        { heading: "Start with mentoring, not just expectations", body: [
          "A spiritually young team member needs a person, not just a schedule. Pair each new member with a mature mentor who prays with them, answers questions, and checks in on their life, not only their part.",
          "Ask 'How is your walk with God?' as often as you ask 'Do you know the song?'"
        ] },
        { heading: "Encourage and affirm, and teach", body: [
          "Name what is good about their gift and their character. Teach the basics of the faith, of prayer, of Scripture and of worship. Offer short, practical teaching (like the three lessons in this series) instead of assuming they already know.",
          "Correction should be given privately, kindly and clearly, with a path forward."
        ] },
        { heading: "Give appropriate, graduated responsibility", body: [
          "Match visibility to readiness and give increasing responsibility as the person grows. Consider starting new members in supporting roles, or with shorter sets, before featured parts, and review regularly. This protects them from pressures they are not ready for, and it protects the team.",
          "Do not use a person's gift to fill a gap in a way that overwhelms them. Do not hold them to the standard of the most mature person on the team."
        ] },
        { heading: "Build healthy accountability and community", body: [
          "Create regular, low-pressure ways for team members to be known: a short prayer and check-in at rehearsal, a small group, occasional meals. Make it normal to say, 'I am struggling.' Teach the team to confess, forgive and encourage one another.",
          "Accountability is not surveillance. It is a relationship in which someone has permission to ask honest questions and to care."
        ] },
        { heading: "Avoid fear-based instruction and false conclusions", body: [
          "Do not teach new members that the enemy is waiting to destroy them if they slip, or that every hard day is a demonic attack. Fear-based instruction produces anxiety and secrecy. Teach the real battle with confidence in Christ, and with practical, biblical, relational responses.",
          "When a team member struggles, consider sleep, health, stress, relationships and sin as well as spiritual opposition. Pray, but also ask questions and offer practical help. When appropriate, encourage them to see a doctor or counselor."
        ] },
        { heading: "Care for them before, during and after", body: [
          "Before: pray with the team, and check on members who seem anxious. During: be a steady presence; plan for mistakes with grace. After: debrief kindly, thank people by name, and watch for signs of discouragement or pride. Build in rest and rotation so that no one is on every week.",
          "If a member steps back for a season, treat it as wisdom, not failure."
        ] }
      ]
    },
    discussion: [
      "Which of the battles in this lesson (fear, shame, comparison, criticism, perfectionism, weariness, distraction, pride) do you recognize in yourself? When do they show up: before, during or after serving?",
      "What is the difference between condemnation and conviction? How does Romans 8:1 help?",
      "Elijah got food and rest before he got a sermon. What does that teach us about caring for weary worshipers, including ourselves?",
      "Why is it unwise to assume every difficult feeling is spiritual warfare? Why is it also unwise to ignore the spiritual side?",
      "What does 'gifted but still growing' mean to you? How can a gift outrun maturity?",
      "What does 1 Peter 5:8 say, and what does it not say? Why does that distinction matter?",
      "What would help a new member of your team feel supported? Who is a person you could ask to mentor you?"
    ],
    activity: {
      title: "Name it, answer it, tell someone",
      setup: "You need paper or your phone, your Bible, and 15 minutes. This works best with your instructor or a trusted person, but you can start alone.",
      steps: [
        "Draw three columns: Before, During, After. In each, write one real thought or feeling you have had around serving (for example, 'I will mess up', 'she sounds better than me', 'I felt flat').",
        "Next to each, label it with the best word you can (fear, shame, comparison, criticism, perfectionism, weariness, distraction, pride).",
        "For each, write a short answer from Scripture. Use the verses from this lesson (for example 2 Timothy 1:7, Romans 8:1, Philippians 4:6–8, 1 Kings 19). Write it in your own words.",
        "Add one practical step you could take for each (for example, rest, a breathing exercise, a prayer, a conversation).",
        "Choose one item to tell someone you trust this week. Write down who, and when."
      ],
      debrief: [
        "Which column was hardest to fill in? Why?",
        "Which Scripture spoke most directly to something you named?",
        "What makes it hard to tell someone? What would make it easier?"
      ]
    },
    reflection: [
      "What do I most often feel before, during and after I serve? What is that telling me?",
      "Where have I treated an ordinary struggle as only spiritual, or a spiritual one as only emotional? What would a balanced response look like?",
      "How do I see my own spiritual growth compared with the growth of my gift? What do I need to do to let my roots grow?",
      "Who is walking with me spiritually? If no one is, who could I ask?",
      "What encouragement from this lesson do I most need to hear today?"
    ],
    assignment: {
      title: "Truth for the thought: one week of naming and answering",
      summary: "You will notice difficult thoughts, answer them with Scripture and prayer, practice one practical step, and talk with a mentor or trusted person. You will bring your notes to your next lesson.",
      steps: [
        "Each day this week, write down one difficult thought or feeling related to serving, singing or ministry. Name it (fear, shame, comparison, etc.).",
        "Write a short answer from Scripture. Use 2 Timothy 1:7, Romans 8:1, Philippians 4:6–8, 2 Corinthians 10:5 or 1 Kings 19. Say your answer aloud as a prayer.",
        "Choose one practical step each day (rest, food, breathing, a short walk, a conversation) and do it.",
        "Read Ephesians 4:11–16 and Hebrews 5:11–14 once this week. Write two sentences on what they say about growing up in Christ.",
        "Talk with one mature, trusted believer about what you are learning. If you do not have such a person, tell your instructor and make a plan to find one.",
        "Write a short response: What battle did you notice most? What helped? What do you need next? Submit it with this assignment."
      ],
      minutes: 90
    },
    application: [
      "Create a short before-during-after routine you can use every time you serve (a prayer, a breathing exercise, a debrief).",
      "Ask your leader about mentoring, check-ins or a team prayer time, especially for newer members.",
      "If you lead or mentor others, use the leaders' section to plan one concrete way to support a spiritually young team member this month.",
      "Keep a short list of verses on your phone for fear, shame, anxiety and weariness.",
      "Notice and celebrate other people's gifts in front of them this week."
    ]
  },
  instructor: {
    overview: [
      "Purpose: to help students understand that internal battles in worship ministry are common, to give them biblical and practical responses, and to show that spiritual maturity, discernment and community matter alongside musical skill. The featured teaching, 'Gifted but Still Growing,' addresses students who are skilled but spiritually young.",
      "Tone: pastoral, calm and encouraging. This lesson can stir up fear if taught carelessly. Your job is to give students language, hope and tools, and to model that these struggles can be named and carried with others.",
      "This module is a teaching resource. It is not an assessment of a student's spiritual condition, and it is not counseling. Keep it separate from technical vocal instruction and from any intake or assessment."
    ],
    timing: [
      { minutes: 5, segment: "Welcome, prayer, opening question: 'What goes through your mind before you sing for people?'" },
      { minutes: 10, segment: "Points 1–6 (balanced starting point; fear; shame; comparison; rejection; performance anxiety) with Scripture" },
      { minutes: 8, segment: "Points 7–10 (weariness with 1 Kings 19; distraction; pride; spiritual opposition) and point 11 (before, during, after)" },
      { minutes: 12, segment: "Featured teaching: Gifted but Still Growing" },
      { minutes: 5, segment: "Point 12 (toolkit) and the leaders' section, briefly" },
      { minutes: 5, segment: "Name it / Answer it / Tell someone activity and debrief" }
    ],
    notes: [
      { heading: "Opening", body: [
        "Begin with prayer and with permission: 'This is a safe place to be honest, and nothing you say here is a grade.' Ask the opening question. Students often admit nerves or comparison immediately.",
        "Listen for the language they use. If they say 'I'm just not spiritual enough' or 'I feel fake,' note it for the featured teaching and for follow-up."
      ] },
      { heading: "A balanced starting point", body: [
        "State clearly that some struggles are physical, some are emotional or habitual, some are sin, and some may involve spiritual opposition, and that you do not assume which it is. This protects students from a fear-based worldview and models careful thinking.",
        "Explain the three questions (body, mind, spirit). Practice with an example the student offers."
      ] },
      { heading: "Fear, shame, comparison, criticism and anxiety", body: [
        "For each battle, read the Scripture, normalize the experience, and ask for a specific example. Avoid giving advice too quickly; reflect what you hear.",
        "Distinguish carefully between conviction and condemnation (Romans 8:1). Many students have heard shaming messages and need to hear that God's correction is aimed at restoration. If a student's shame seems heavy or constant, treat it as a pastoral concern and consider a referral.",
        "On performance anxiety, affirm practical help: preparation, breath and body strategies (which you can reinforce in vocal lessons), and professional support when it is severe. Do not imply that medication, counseling or medical care signal weak faith.",
        "On criticism, teach a simple response: pause, ask what is true, seek counsel, respond kindly. If a student reports being criticized in an abusive or humiliating way, take it seriously and follow your safeguarding practice."
      ] },
      { heading: "Elijah (1 Kings 19)", body: [
        "Tell the story briefly and highlight God's sequence: sleep, food, presence, gentle whisper, perspective (seven thousand), companion (Elisha). Invite the student to notice that Elijah was gifted and faithful, and still needed care.",
        "Ask: 'Who has cared for you like that? Who could?' This leads naturally to mentoring."
      ] },
      { heading: "Distraction, pride and spiritual opposition", body: [
        "On distraction, normalize the busy mind and teach the 'notice, name, return' practice with a short prayer.",
        "On pride, speak first about your own temptation if appropriate. Teach that pride and insecurity are two sides of the same preoccupation with self. The remedy is truth and gratitude.",
        "On spiritual opposition, teach with calm confidence. Use Ephesians 6 and 1 Peter 5:8–9: be alert, resist, stand, pray, and do it in community. State plainly that not every hard moment is demonic. Avoid sensational language, deliverance rituals or speculation about demons targeting individuals. If a student asks, explain that your approach is prayer, Scripture, wisdom and care, and refer to their pastoral leadership for deeper concerns."
      ] },
      { heading: "Before, during, after", body: [
        "Use the examples to help the student see patterns. Ask them to describe their last service in those three phases. Encourage them to design a simple routine for each phase.",
        "Include practical items: sleep the night before, eating, arriving early, breathing, a short prayer, and a kind debrief with a person, not alone."
      ] }
    ],
    featuredNotes: [
      { heading: "How to introduce 'Gifted but Still Growing'", body: [
        "Introduce it warmly: 'Some of the most gifted people on a team are also some of the newest in their faith. That is a good thing, and it also creates real challenges. I want us to talk about that honestly.'",
        "Read the core statement aloud and ask what the student notices: \"" + CORE_STATEMENT + "\" Explain that it is a pastoral observation about vulnerability and maturity, not a doctrinal claim that a specific group is targeted. Emphasize that the lesson is meant to encourage investment in growth.",
        "If the student is spiritually young, make sure they hear that being young in the Lord is not a deficiency of worth; it is a stage. If the student is more mature, invite them to consider how they can help others."
      ] },
      { heading: "Why visibility does not equal maturity", body: [
        "Ask: 'When you see someone on a platform, what do you assume about them?' Draw out that we often assume strength, and that the assumption puts pressure on the person and on the congregation. Gently point out that the person on the platform may be the one who needs the most support.",
        "Stress that musical gifting and spiritual readiness are different, and that confusing them can hurt people. A leader who recruits purely on skill may unintentionally place someone in a position that overwhelms them."
      ] },
      { heading: "The experiences of a spiritually young team member", body: [
        "Walk through intimidation, discouragement, confusion, temptation and comparison with a concrete example for each. Ask the student which resonates. If the student is not young in faith, ask what they remember from that time.",
        "Be careful not to label the student. Use 'a person may experience' language."
      ] },
      { heading: "Ephesians 4:14 and Hebrews 5:13–14", body: [
        "Show how Ephesians 4:14 describes immaturity as instability and exposure to deception, and how 4:15–16 names the remedy: speaking the truth in love and growing up together. Link to Hebrews 5:13–14: discernment comes from practice.",
        "Make the point that deception is not only about dramatic false teaching; it is also about subtle pressures, flattery, shame and half-truths. Mature practice and mature people protect against them."
      ] },
      { heading: "Handling 1 Peter 5:8 and 1 Timothy 3:6 responsibly", body: [
        "On 1 Peter 5:8, state three things: (1) the text calls every believer to sober alertness; (2) it says the adversary seeks 'someone' to devour and does not say he goes after the youngest first; (3) our application, that isolated, unprepared believers are more exposed, is a reasonable principle from the picture, and from observation. Make sure the student can say the difference between what the text says and what we are applying.",
        "On 1 Timothy 3:6, explain that it is addressed to the qualifications of overseers (elders), says a recent convert may become conceited and fall, and is not a rule for praise teams. Offer it as a principle: do not rush people into prominent roles before they have grown, and support them when they are placed there. Avoid using it to shame new believers or to argue that they should not serve at all.",
        "Reinforce that these distinctions are part of discernment: we handle Scripture carefully."
      ] },
      { heading: "Luke 22:31–32: Peter", body: [
        "Draw out the details: 'you' is plural for the sifting; Jesus prays for Simon specifically; Jesus expects Peter to turn back; the instruction is to strengthen his brothers. Mention John 21 as the restoration.",
        "Apply: gifted, sincere believers can fail under pressure. The right response is restoration and growth, not exile. Ask the student: 'Who strengthened you after you struggled? Who could you strengthen now?'"
      ] },
      { heading: "Closing the featured teaching with hope", body: [
        "End on growth. Review the practices: prayer, Scripture, discernment, accountability, community, rest and obedience. Ask the student to choose one to strengthen this month and to name a person who will walk with them.",
        "Pray for the student, and for the team they serve with."
      ] }
    ],
    leaderNotes: [
      { heading: "Using the leaders' section", body: [
        "Teach it to students who lead or mentor others now or who are likely to. For others, present it briefly so that they know what healthy support looks like and can ask for it.",
        "Invite students to evaluate their own team culture: Where is mentoring happening? Where is responsibility given too quickly? Where is rest built in? Frame it as constructive and avoid gossip about specific leaders."
      ] },
      { heading: "Coaching a leader (if the student is one)", body: [
        "Help the leader think through an onboarding path for new members: a mentor, a short teaching series, a gradual increase in responsibility, regular check-ins, and clear ways to step back.",
        "Challenge fear-based approaches kindly. Ask: 'How would a new person feel hearing that?' Offer language that is truthful and hopeful.",
        "Remind leaders that they are shepherds. When a team member struggles, the first questions are about care: rest, health, relationships, spiritual life, and whether they need a referral."
      ] }
    ],
    facilitation: [
      "Pace yourself. This is the heaviest of the three lessons. If a student is moved or distressed, slow down, and let the activity be shorter rather than skipping care.",
      "Offer to continue a topic in a later lesson rather than packing everything into one session.",
      "Use 'many people experience' language to reduce shame. Invite the student to share their own words and do not push for detail they are not ready to give.",
      "Keep a prayerful, non-sensational tone. Avoid dramatic stories about spiritual attacks. Use measured, biblical language.",
      "Always bring the student back to hope: God's care (Elijah), forgiveness (Romans 8:1), equipping (Ephesians 6), restoration (Peter), and community."
    ],
    cautions: [
      "Do not teach or imply that every difficulty is a demonic attack, or that students are in danger of spiritual harm if they miss a rehearsal or a devotion. Fear-based teaching damages people.",
      "Do not claim that Scripture says the enemy targets the youngest believers first. Use 1 Peter 5:8 as the text states it, and label any wider application as a principle.",
      "1 Timothy 3:6 concerns overseers. Do not present it as a command about praise team membership.",
      "This is a teaching and discipleship resource, not therapy. Do not diagnose or treat. If a student shows signs of depression, anxiety that interferes with daily life, trauma, abuse or self-harm, listen, take it seriously, and refer them to qualified professionals and appropriate pastoral support. If someone may be in immediate danger, contact local emergency services (911 in the United States) or, in the United States, the 988 Suicide & Crisis Lifeline by call or text.",
      "Follow your safeguarding policy. Do not promise secrecy when safety is at stake. Keep any disclosures confidential otherwise, and share them with leaders only with the student's consent unless a safety obligation requires otherwise.",
      "Do not publish or share a student's reflections, testimony or notes without explicit consent. Their written responses are private to them and the Voice instructor.",
      "Do not use this module to judge a student's spiritual maturity, readiness for a platform role, or standing with God. Those decisions belong to the student's church leadership.",
      "Do not reproduce copyrighted lyrics or long copyrighted Bible translation passages in handouts."
    ]
  }
};
