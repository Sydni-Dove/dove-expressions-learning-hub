# Voice curriculum, intake, assessments and personalized plans

Status: built and tested locally. **Not deployed. Migrations `20261030100000` and `20261030110000` are NOT applied to the hosted project.** Draft content for instructor review; nothing is published or advertised.

## What exists (implemented)
| Piece | Where |
|---|---|
| 12 skill areas + 3 separate optional Creative Worship tracks (assessment tasks and indicators, beginner/intermediate/advanced goals, teaching outline, 72 exercises with demonstrate / coach / difficulties / safety, practice assignments, progress indicators, follow-up assessment) | `lib/voice-curriculum/` (single source) |
| Exercise library seed (generated, drift-tested) | `supabase/migrations/20261030110000_dp_voice_curriculum_seed.sql` |
| Interactive instructor curriculum browser | `/staff/voice/curriculum` |
| Post-consultation **intake**, separate from skill assessments; Hub form or Google Forms CSV import | `/voice/intake`, `/staff/voice/development` (import), `lib/voice-assessments/intake.ts` |
| Student **track choice** (optional) + instructor **approval** | `/voice/plan`, student page in `/staff/voice/development/[id]` |
| **Assessment B** Personal Time With God (the 13 questions, wording unchanged, all optional, not scored) | `lib/voice-assessments/personal-time.ts` |
| **Assessment C** Creative Vocal Expression (self-report + 5 recorded demonstrations linked to My Practice Recordings + staff-only observation rubric) | `creative-expression.ts` |
| **Assessment A** How Does God Speak to You? — import + category-by-category engine, **awaiting the source document; cannot be assigned** | `hearing-god.ts` |
| Student: assigned assessments, save draft, resume, submit, locked afterwards, shared summary | `/voice/assessments` |
| Instructor: assign, review privately, share a summary, observations | student page |
| **Personalized plan** (single lesson, monthly 4, 12-week with checks at weeks 4, 8 and final evaluation); drafted from intake + assessments + observations + approved tracks, fully editable, approved before the student sees it | `lib/voice-assessments/plan.ts`, student page |
| Assign a lesson's practice through the existing weekly-plan assignment (snapshot of library exercises) | `dp_plan_assign_unit` → `dp_assign_weekly_plan` |
| Progress checks (private notes; shared only when the instructor chooses; never overwritten) | student page, `/voice/plan` |
| Stephanie **sample pathway** (hypothetical scenarios; kept apart from real records) | `/staff/voice/development/sample` |

## Privacy and gating rules (all enforced in the database, not just the UI)
- Faith-related answers are visible to the student and authorised Voice staff only. Observations, private notes and plan rationale are in separate staff-only tables.
- Nothing is scored, ranked or used to label spiritual maturity. Personal Time With God is a plain restatement grouped by purpose.
- Personal Time With God (and Assessment A, once supplied) can be assigned only if the student chose Prophetic Worship Development.
- An optional track enters a plan only when the student chose it **and** the instructor approved it. A sample plan is exempt; copying a sample to a student re-checks this.
- Singing in tongues: never auto-selected (`onlyOnRequest`), and `dp_plan_save` / `dp_plan_assign_unit` refuse it unless the student ticked the request.
- Seeded curriculum exercises are staff-only until assigned (`visibility='assigned_only'`; track skills hidden). Students see only the practice assigned to them.
- A student who leaves Voice loses access to profile, intake, assessments, plans and checks.

## Reconciliation with what already existed
Reused, not duplicated: `dp_assignments`/`dp_assign_weekly_plan` (practice), `dp_practice_recordings` (demonstrations), `dp_voice_skills`/`dp_voice_exercises` (library), `dp_private.voice_member/manage_voice`. Existing skill slugs (`pitch-ear`, `range`, `registers`, `tone-resonance`, `agility`, `breath-posture`) are reused by the seed. New tables only where nothing existed: profiles, intakes, assessments (+private), plans/units/private, progress checks (+private). The older static roadmap and draft lesson shells (`20261029100000`) are unchanged.

## Migration order (all unapplied)
`20261029090000` → `20261029100000` → `20261029110000` → `20261030090000` (recordings) → `20261030100000` (this system) → `20261030110000` (curriculum seed). Apply one at a time with the Supabase MCP, not `supabase db push`.

## Not built / planned
- **Assessment A content** — needs the "From Vision to Reality" Day 1 text (not in Drive or reachable). Import path and engine are ready and tested with synthetic fixtures only.
- Importing a **real** intake and mapping unusual Google Form wording: the CSV import matches columns by the question text in `INTAKE_QUESTIONS`. If your form words things differently, columns are ignored (and listed) until the form or the mapping is aligned.
- "Save as sample" / "create a draft from the sample" buttons: the database functions exist (`dp_plan_copy_sample`) and are tested; the screen shows the sample but has no button yet.
- Instructor-provided custom practice tracks (upload backing tracks / call-and-response audio) and their private storage: not built.
- Editing a plan after it is approved (only drafts can be re-saved; add progress checks or a new plan).
- Moving lessons around by drag-and-drop; reordering is by editing the lesson list.
- Rating sliders in progress checks (the `ratings` field exists, the form saves free text only).
- Recordings are not auto-attached to assignments from the assessment screen beyond choosing from the student's own list.

## Tests
Unit `tests/unit/voice-curriculum.test.ts`, `voice-assessments.test.ts` (wording preserved, gating, CSV import, plan logic, Stephanie). SQL `tests/sql/voice-development.test.ts` (17). Browser `tests/e2e-auth/development.spec.ts` (8). Tests found and fixed two real defects: the plan draft could auto-assign the tongues exercise, and a variable named `id` shadowed a column in `dp_plan_save`.
