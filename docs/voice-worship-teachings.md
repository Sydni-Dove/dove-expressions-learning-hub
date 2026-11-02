# Worship Development teachings

Three instructor-led, Scripture-based teachings for vocal students who serve, or want to serve, in praise and worship ministry. They are **teaching resources**, not assessments and not intake forms, and they are kept separate from technical vocal instruction. Nothing here is applied to the hosted database, merged or deployed.

## The modules
| # | Title | Length | Scriptures |
|---|---|---|---|
| 1 | Praise Is What I Do: Developing a Lifestyle of True Worship | 40 min | John 4:23–24; Romans 12:1; Psalm 34:1; Colossians 3:16; Philippians 2:3–5 |
| 2 | The Importance of Being in the Word: Growing in God as a Worshiper | 40 min | Psalm 119:11, 105; Joshua 1:8; 2 Timothy 3:16–17; Colossians 3:16; John 15:4–5; Hebrews 5:13–14 |
| 3 | The Psyche of a Praiser: Understanding the Mental and Spiritual Battles of Worship Ministry | 45 min | 2 Corinthians 10:3–5; Ephesians 6:10–18; 1 Peter 5:8; Romans 8:1; Philippians 4:6–8; 2 Timothy 1:7; 1 Kings 19; Luke 22:31–32 |

Every module has: title and summary, learning objectives, key Scriptures with context, a detailed teaching (8 to 12 points with examples), discussion questions, an interactive activity with debrief, personal reflection, a take-home assignment, praise-team applications, and **private instructor notes** (timing, teaching notes, facilitation tips, cautions).

Module 3 also contains the featured subsection **"Gifted but Still Growing: When the Platform Comes Before Spiritual Maturity"** (the core statement appears verbatim) and the leaders' section **"How to Protect and Develop Spiritually Young Worshipers"**, each with matching instructor notes. Care is taken in the text that:
- 1 Peter 5:8 is not presented as teaching that Satan always targets the youngest believers first; the wider point is labelled a principle.
- 1 Timothy 3:6 is identified as being about overseers, so its use for praise teams is a principle, not a direct command.
- Leaders are told to avoid fear-based instruction and the idea that every difficulty is demonic. Mental-health referral guidance (including 911 and 988 in the US) is in the instructor cautions.

Scripture is paraphrased with background, so students read the text in their own Bibles. The song "Praise Is What I Do" is a thematic reference only; no lyrics appear anywhere.

## How it works
- **Source of truth:** `lib/voice-teaching/` (TypeScript). `scripts/generate-teaching-seed.ts` generates `20261102100000_dp_voice_worship_teachings_seed.sql`; `tests/unit/voice-teaching.test.ts` fails if they drift.
- **Database (migration `20261102090000`):** `dp_voice_teaching_modules` (student content), `dp_voice_teaching_module_private` (instructor notes, staff-only), `dp_assignments.teaching_module_id`, and `dp_assign_teaching_module(student, module_key, due, note)`. No table has a write policy, so the text changes only through migrations.
- **Assigning reuses the existing workflow.** An assignment is created for that one student (no course), so the take-home work uses the same submission, reflection, feedback and review screens as everything else. The existing payment gate applies: new practice requires verified payment and an enrolled Voice student. Assigning twice is refused.
- **Privacy:** a student can read a module only after it is assigned to them, and never the instructor notes. Other students and non-Voice teachers see nothing. After a refund or expiry the student keeps access to what was already assigned; new ones cannot be assigned.
- **No automatic enrollment.** Nothing assigns, enrolls or changes a personalized vocal plan. Stephanie's enrollment is untouched.

## Where things are
- Instructor: **Voice command center → Worship Development** (`/staff/voice/worship`), then a module for the private notes, the student's-eye preview, the assign form and who has it.
- Student: `/voice/worship` and `/voice/worship/[key]`; a **Worship Development** button appears on Voice Home only after something is assigned. Their take-home assignment is in **My Assignments**.

## To assign a teaching
Open the module, choose an eligible student (enrolled and verified-paid, not already assigned), optionally set a due date and a note, and choose **Assign this teaching**.

## Not done / needs approval
- Migrations `20261102090000` and `20261102100000` are unapplied; applying, merging and deploying need your explicit approval.
- The content is a complete draft for your theological and pastoral review. Edit the TypeScript source and regenerate the seed rather than editing SQL.
- Editing a teaching after release needs a new migration (it is not editable in the app). An in-app editor is a possible follow-up.
