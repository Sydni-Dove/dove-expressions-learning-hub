# Voice release plan: migrations, backups, rollback and recovery

Status: **plan only. Nothing has been applied, deployed or configured.** PR #3 stays in draft. Every statement below about the hosted project comes from read-only queries run on 2026-10-31.

## 1. What the audit found

**main vs. this branch.** `main` (`e0fad58`) has not moved since this branch started: 0 commits behind, no conflicts. `main` contains **none** of the Voice migrations (`20261028…` from PR #2 and the seven below are all branch-only), which is expected: the owner applied the PR #2 migrations to the hosted project from the branch.

**Hosted project** (`jnlvvlkwskidloripvtp`, shared with Hearing God): last applied migration is `20261028193254`. Repo numbering (`0001…0031`) differs from hosted timestamps, so **`supabase db push` must not be used**; apply one file at a time with the Supabase tool (`apply_migration`), then confirm with `list_migrations`.

**Conflicts: none.** None of the 31 tables/views the release creates exist on hosted; none of the `dp_private`/`public` functions it creates or replaces exist; the voice storage buckets are absent. Hosted-only items the repo does not hold (left untouched): migration `dp_security_hardening`, the combined `20261028164738 dp_voice_draft_curriculum_and_testimonials`, and the Hearing God edge functions (see `docs/voice-recordings-r2.md`).

**Live data the release can touch (counts today):** `dp_sessions` 0 · `dp_submissions` 0 · `dp_assignment_progress` 0 · `dp_voice_testimonials` 0 · Voice lesson blocks 0 · Voice program enrollments 0 · `dp_assignments` 4 · voice storage objects 0. So today almost nothing can be lost; the backup rules below are written for the moment real students exist.

**Existing objects the release changes** (everything else is new):
| Existing object | Changed by | Change |
|---|---|---|
| `dp_sessions` | 20261029090000 | +6 columns, +2 check constraints, +2 foreign keys, +trigger `dp_session_credit_assign` (pay-first rule) |
| `dp_submissions`, `dp_assignment_progress` | 20261029090000 | +triggers (recording-reference check, attempt log); backfills `dp_submission_attempts` |
| `dp_voice_testimonials` | 20261029090000 | +columns, replaced content check and student-insert policy, +publish-gate constraint and guard trigger |
| `dp_lesson_blocks`, `storage.objects` | 20261029090000 | +restrictive read policy (level gate); +named storage policies |
| `storage.buckets` | 20261029090000 | +`voice-recordings`, `voice-testimonials` (private) |
| `dp_lesson_blocks` | 20261029100000 | **inserts** 24 draft teaching blocks into lessons that have none (lessons stay draft) |
| `dp_assignments` | 20261029110000 | +column `practice_items` |
| every function in schema `dp_private` | 20261029110000 | `revoke all … from public, anon` then `grant execute … to authenticated` (blanket) |

## 2. Migration dependency chain (cannot be reordered)
```
PR #2 migrations (20261028*, already on hosted)
  └─ 20261029090000  recordings, scheduling, packages, consultations, testimonials   (defines dp_private.manage_program / voice_member / lesson_level_ok_id)
       ├─ 20261029100000  draft lesson content                                       (needs the 12 draft lesson shells from 0031)
       └─ 20261029110000  student resources: skills, exercise library, goals, weekly plans  (defines manage_voice, dp_assign_weekly_plan)
            └─ 20261030090000  practice recordings (R2 metadata + feedback)           (needs voice_member, student_assignment, lesson_level_ok_id)
                 └─ 20261030100000  profiles, intake, assessments, plans, progress checks   (needs dp_practice_recordings, dp_voice_exercises, dp_assign_weekly_plan)
                      ├─ 20261030110000  curriculum seed (74 exercises, skills)       (needs curriculum_key/visibility columns)
                      └─ 20261031090000  plan revisions, ratings, import mappings, follow-ups   (needs everything above)
                           └─ 20261101090000  onboarding + payment access, Vocal Demo         (replaces policies/functions from #3, #5, #7)
```
Verified by replaying all migrations in order from an empty database (and again after a full rollback). The seed file is generated from `lib/voice-curriculum` and a unit test fails if it drifts.

## 3. Migration-by-migration release plan

For every migration: run the **pre-check**, apply it by itself (one transaction), run the **post-check**, run the listed smoke test, record the version. Stop at the first failure and use that migration's rollback (Section 5). Rollback files are in `supabase/rollback/` and are named `<migration>.rollback.sql`.

| # | Migration | What it does | Backup required? | Rollback loses data? | Post-check (expect) | Smoke test after applying |
|---|---|---|---|---|---|---|
| 1 | `20261029090000_dp_voice_recordings_scheduling_consultations` | recordings bucket + policies, attempt history, packages/tiers/payments, scheduling, credits, level gating, consultations, testimonial video | **YES — full database backup + dump of `dp_voice_testimonials`, `dp_sessions`, `dp_submissions`, `storage.buckets` and `storage.objects` policies.** Alters live tables and adds triggers to `dp_submissions`/`dp_assignment_progress` | Yes: packages, payments, schedules, attempts, consultations, testimonials added after go-live | `dp_coaching_tiers` … exist with RLS on; both `voice-*` buckets private; trigger `dp_session_credit_assign` present | Student A cannot complete an unpaid lesson; testimonial cannot publish without consent; level-gated lesson content hidden from an unpaid student |
| 2 | `20261029100000_dp_voice_draft_lesson_content` | 24 draft blocks into the 12 lesson shells that have no blocks | **YES (small): `pg_dump -t dp_lesson_blocks`.** Inserts rows into an existing table | No: rollback deletes only blocks still identical to what the migration inserted; instructor edits are kept | 24 new blocks, all in `draft` lessons | Lessons still `draft`; students see none |
| 3 | `20261029110000_dp_voice_student_resources` | skills, exercise library, plan templates, goals, welcome text, `dp_assign_weekly_plan` | **YES: save the ACL snapshot in `testing/hosted-preflight.sql` part (2) and dump `dp_assignments`.** Blanket permission change on `dp_private`; new column on `dp_assignments` (4 rows) | Library/goals/templates added after go-live | `dp_assignments.practice_items` exists; 9 skills | Instructor assigns a weekly plan; student sees it; a non-member cannot |
| 4 | `20261030090000_dp_voice_practice_recordings` | `dp_practice_recordings`, append-only feedback, definer functions | No (new objects only). **Before any rollback after use:** export `dp_practice_recordings` and the R2 object keys | Yes after use (recording index and feedback) — and R2 objects would be orphaned | 2 tables, RLS on, no write policies | Needs R2 configured: save → submit → review → revise → student A cannot play B's recording |
| 5 | `20261030100000_dp_voice_intake_assessments_plans` | profiles, intake, assessments (+private), plans, progress checks | No (new objects; alters only tables created in #3) | Yes after use: intakes, answers, plans, checks | 9 tables, RLS on | Student completes intake and an assessment; instructor reviews privately; plan approved |
| 6 | `20261030110000_dp_voice_curriculum_seed` | 74 library exercises, 9 more skills | No (seed rows into library tables) | Seeded rows only; exercises already assigned are copied into assignments and keep working | 74 exercises with `curriculum_key`; 3 track skills inactive | Student cannot list unassigned curriculum or `track-%` skills |
| 7 | `20261031090000_dp_voice_plan_revisions_ratings_imports` | plan versions, ratings validation, mapped imports, follow-ups, sample safeguards | No (changes only objects created in #4–#5; one function dropped and recreated) | Yes after use: plan history, saved mappings | `dp_plan_revise`, `dp_recording_assign_followup` exist | Revise an approved plan (assigned lessons locked); import the same CSV twice → second adds 0 |
| 8 | `20261101090000_dp_voice_onboarding_payment_access` | prospects (intake before payment), `voice_paid` rules, Vocal Demo tables, payment triggers on assessments/recordings/new practice/plan approval, paid-only resource policies | **Recommended (small): `pg_dump -t dp_assignments` and the policy list.** It adds one trigger to the existing `dp_assignments` table and replaces policies on tables created by #3, #5 | Yes after use: invited prospects, Vocal Demo entries | `dp_voice_prospects`, `dp_voice_demos` exist; trigger `dp_voice_practice_assignment_gate` on `dp_assignments` | An unpaid enrolled student: intake works, assessments/recordings/resources locked; after a verified payment the instructor can assign one assessment with a reason; refund closes new work, keeps records |

**Backups, plainly:** a backup is *required* before migrations 1, 2 and 3 (they change existing tables or permissions), and before **any** rollback once students have used the system (rollbacks drop tables). Migrations 4–7 only add objects, so no backup is needed to *apply* them. Recommended anyway: one dated backup before step 1, because the project also holds production Hearing God data that these migrations do not touch but a project-level restore would.

How to back up (pick one, record where it is stored): Supabase **Point-in-Time Recovery** marker (note the timestamp) or a dashboard backup; plus a targeted `pg_dump --data-only -t <table>` of the tables named above. Never restore a *whole-project* backup to undo a Voice problem: it would also rewind Hearing God journal entries written since. Restore only the affected tables into a scratch project and copy rows back.

## 4. Order of operations on release day
1. Owner approval in writing; PR #3 marked ready by the owner (not by me).
2. Run `testing/hosted-preflight.sql`; confirm every "already present" count is 0 and the last migration is `20261028193254`. Save the ACL snapshot.
3. Take the backups in Section 3.
4. Apply migrations 1 → 8, one at a time, post-check and smoke test each. Do not batch.
5. Cloudflare: create the private bucket, token and CORS rule; set the Vercel environment variables (`docs/voice-recordings-r2.md`). Until then the recording routes answer "not configured" and nothing else is affected.
6. **Then** deploy the app. The new pages call the new functions; deploying first would show errors on those routes. Deploy to preview, smoke-test, then production.
7. Run the full smoke checklist below with a real test student and a real instructor account.
8. Only then enable payments/webhook (`/api/webhooks/woocommerce`) and publish anything to students.

**Smoke checklist (hosted):** sign in as student/instructor/stranger; student sees only their own plan, intake and assessments; instructor private notes invisible to the student; unpaid student blocked from completed-lesson credit and level-gated content; refunded package keeps records; recording upload/playback/cross-student denial against real R2; same Google Forms CSV imported twice adds nothing; plan revision keeps assigned lessons locked; optional track appears only after student choice + instructor approval; singing-in-tongues exercise cannot be assigned without the student's request.

## 5. Rollback and recovery procedures

**Principles.** Each rollback script runs in one transaction (all or nothing), is generated from a before/after schema diff, and is proven by `tests/sql/rollback.test.ts`: applying all eight migrations and then each rollback in reverse restores the exact schema, policies, triggers, function bodies and permissions, and every pre-existing row (including an instructor's edited draft block); re-applying afterwards reproduces the same result. They have **never been run on the hosted project**.

**Roll back in reverse order only** (8 → 1). To undo just the newest work, run only the newest scripts (tested: rolling back 8, 7, 6 and 5 leaves 1–4 working).

| If this happens | Do this |
|---|---|
| A migration errors while applying | Nothing to undo: each apply is one transaction. Read the error, fix the SQL on the branch, retry. |
| A migration applied but a post-check or smoke test fails | Run that migration's `.rollback.sql` (and any later ones already applied), then investigate. Before running, if students have used the feature, export the affected tables. |
| Recordings must be backed out after use (#4) | Export `dp_practice_recordings` + feedback and the R2 keys; run the rollback; delete the R2 objects with the cleanup route or the Cloudflare dashboard; storage buckets must be emptied through the Storage API (a bucket cannot be removed with objects in it). |
| Permissions look wrong after #3 | The rollback restores the `dp_private` ACLs known to the repo baseline. For functions that exist only on hosted, re-apply the ACL snapshot saved in pre-flight. |
| Data was damaged | Restore the specific tables from the targeted dumps into a scratch database and copy rows back. Whole-project PITR is the last resort (it also rewinds Hearing God). |
| R2 objects exist with no database row | Run `POST /api/recordings/cleanup` (it removes abandoned and discarded uploads and never touches submitted work). |

**What a rollback cannot do:** bring back rows in dropped tables (hence the exports), undo files already in R2, or restore a hand-edited object that is not in the repo. Hosted-only edge functions are untouched by every script.

## 6. Decisions needed from you (details in the PR report)
1. Whether students with no paid or a refunded package should keep using recordings, intake, assessments and plans (today they can, because those only require Voice enrollment; payment gates lesson credits and level-gated content).
2. Whether Voice homework shares the existing `dove-media` R2 bucket (works, shared blast radius) or gets its own (recommended).
3. Whether to review the public `entry-attachments` bucket that holds personal journal media (outside this PR).
4. A retention period for submitted recordings (nothing deletes them automatically).
5. Approval of the recommended 60-minute prices ($248 monthly, $720 as 3 × $240).
