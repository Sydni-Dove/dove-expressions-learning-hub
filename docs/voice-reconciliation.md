# PR #3 reconciliation against `main` (October 30, 2026)

## 1. Where `main` stands
- `main` is at `e0fad58` ("Link full Voice training roadmap from Voice Home"). **It has not moved since PR #2 and PR #3 branched.** There are no commits on `main`
  that this branch lacks, so there are **no textual merge conflicts**.
- PR #2's branch (`codex/voice-persistent-coaching`, head `4b59ac0`) is **fully contained** in this branch (verified with `git merge-base --is-ancestor`). Merging this
  branch makes PR #2 redundant; if PR #2 is merged first, this PR's diff only shrinks.
- 30 files that already exist on `main` are modified here (listed by `git diff --name-status origin/main HEAD | grep '^M'`). If anyone changes those files on `main`
  before this branch merges, re-run this reconciliation: `app/(app)/assignments/page.tsx`, `vocal-coaching/page.tsx`, `voice/training/page.tsx`, the lesson page,
  `AppShell.tsx`, `nav-config.ts`, `SubmissionForm.tsx`, `AssignmentQuickForm.tsx`, `VoiceReviewForm.tsx`, `VoiceReviewModeration.tsx`, `lib/roles.ts`,
  `lib/course-access.ts`, `lib/storage.ts`, `next.config.js`, `tests/sql/*`, among others.
- Other remote branches (`add-command-center-dashboard`, `feature/app-course-lesson-1-1`, `feature/practical-course-support`) are unrelated to Voice.

## 2. Voice pieces already on `main`, and what this PR does with each (no duplicate systems)
| On `main` | PR #3 |
|---|---|
| `/voice` and `/vocal-coaching` (alias), `/voice/training` static 12-session roadmap | Home rebuilt on live data. The static roadmap is now **staff-only** (it advertised unpublished curriculum). **Remaining duplicate:** the roadmap's hard-coded sessions, the 12 draft lesson shells (migration 0031) with draft blocks (migration `20261029100000`), and the new skill library are three representations of "the curriculum". They should be consolidated after the owner approves the skill library. |
| Program/course/lesson shells and 12 draft lessons (0030, 0031) | Reused. Draft blocks added only where a lesson has none; nothing published. |
| Testimonial table, form and moderation (0029) | Extended in place (video, consent timestamp, publish gate, withdrawal). One table. |
| Enrollment-driven program membership (`getStudentPrograms`, enrollments) | Reused unchanged. `dp_private.voice_member()` applies the same rule in the database. |
| `dp_sessions` (lesson notes) | Reused as the lesson/appointment record (new columns); no parallel appointments table. |
| Assignments, submissions, feedback, progress (PR #2) | Reused. Weekly plans are personalized assignments with no course. |
| Private lesson file storage (`course-media-private`) | Reused; new buckets only for student recordings, testimonial video. |

## 3. Migration ordering and conflicts
- Hosted history ends at `20261028193254 dp_voice_completion_requires_instructor_review`. Repo files `0001`-`0031` use a different numbering from hosted
  versions (hosted applied them with server timestamps; `0029`-`0031` were applied together as `20261028164738`). Therefore **do not use `supabase db push`**:
  it would try to re-apply the numbered files. Apply by the same method as PR #2 (the Supabase MCP `apply_migration`, one file per call).
- **Required order** (each depends on the previous): `20261029090000_dp_voice_recordings_scheduling_consultations.sql`, then `20261029100000_dp_voice_draft_lesson_content.sql`
  (needs only the existing lesson shells), then `20261029110000_dp_voice_student_resources.sql` (needs `dp_private.manage_program`/`voice_member` from the first),
  then the assessment and curriculum migration(s) added after this report (they need `dp_voice_skills`/`dp_voice_exercises` from the third).
- **No name collisions** with anything on the hosted project (read-only check, below): no new table, view, function, column or policy name already exists.
- Replaying every migration (38 before the curriculum work) from scratch on the real Supabase Postgres image succeeds locally; hosted runs PG 17.6 and the local image is PG 15,
  which matters only for expression printing (see section 4).

## 4. Access enforcement: hosted versus what the tests exercised
Read-only comparison of the hosted policies with the local replay (66 policies on the Voice-relevant tables plus the private-file policies on `storage.objects`):
**43 identical byte-for-byte; 22 more identical once a cosmetic printing difference (`auth.uid()` versus `uid()`) is normalized; 1 intentionally different**
(`dp_voice_testimonials_student_insert`, tightened by this PR); 2 new in this PR (`dp_lesson_blocks_level_boundary`, `dp_private_file_level_boundary`); **none present only on hosted**.
So the browser and database tests that prove students cannot read other programs' rows, lesson content or files are exercising the same rules that are live.

| Layer | Main before PR #2 | Now |
|---|---|---|
| Routes | partial; several program pages open to any signed-in student | every Voice route requires Voice enrollment or a staff role; verified by direct URL for six account types |
| Rows | lessons readable by any authenticated user (`dp_lessons_read` authenticated) | restrictive program boundary on courses, modules, lessons; assignments, submissions, progress, notes require enrollment |
| Lesson content (`dp_lesson_blocks`) | read policy `dp_lesson_blocks_read` (unchanged on hosted) which inherits lesson visibility through the lesson row; PR #3 adds the payment gate | verified: another program's blocks return nothing |
| Files | private bucket read boundary from PR #2 | verified: another program's file cannot be downloaded or signed; PR #3 adds the payment gate |

## 5. What the browser suite now proves (local stack; 64 tests passing)
Direct URLs, database rows, lesson content and private files for voice-only, creative-only, multi-program, signed-in-stranger, instructor and administrator accounts;
the full lesson workflow (instructor personalizes practice on a published lesson, student practises, saves, reloads, submits, instructor privately reviews and shares
feedback, approval completes the lesson, and it all persists in a brand-new session); locked lessons (closed page, no content, no file; opens at eight paid lessons;
closes again on refund with every record kept); and the waiver (blocked until a reason is given, then listed in an audit section of the command center).

## 6. Hosted project identification and the read-only check
- The repository's `.env.local.example` points at `https://jnlvvlkwskidloripvtp.supabase.co`. Of the six projects in the organization, that is **"Dove Expressions App 2"**
  (us-west-2, `ACTIVE_HEALTHY`, Postgres 17.6). It is the only active project containing the `dp_` schema; the others are inactive older apps or unrelated ("Book Build").
- `testing/hosted-readonly-check.sql` is a single SELECT that reports missing prerequisites, name collisions, counts and policy presence. It was run on October 30 against
  that project. Result: **nothing missing, nothing colliding.** 1 enrollment, 0 submissions, 0 sessions, 0 testimonials; 12 voice lessons, 0 published; 0 published voice courses.
  `profiles` has the `id`, `email`, `full_name` columns the new functions read (readable only by owner and admin, which is why staff use a definer function).
- Security advisors (pre-existing, unrelated to this PR): 2 tables with RLS but no policy (other apps), 4 functions with mutable search path, many legacy
  `SECURITY DEFINER` functions executable by `anon`/`authenticated`, leaked-password protection off. This PR adds two intentionally anon-callable read-only functions
  (`dp_public_testimonials`, `dp_is_published_testimonial_video`) that will appear in the same advisor list.

## 7. Integration readiness and remaining release blockers
Ready (tested locally): payments webhook, installments, matching queue, waivers, scheduling, refunds, testimonials and embed, recordings, resource area.
Blockers before any production step: hosted smoke test; owner decision on 60-minute monthly and 12-week prices; store changes and the reference for installment orders;
pay-first enforcement; Apps Script installation; final release review; and the assessment source document (Assessment A) described in the curriculum report.


## Addendum (Oct 30): later migrations
Added after the reconciliation above: `20261030090000_dp_voice_practice_recordings.sql` (R2 recording metadata + append-only feedback), `20261030100000_dp_voice_intake_assessments_plans.sql` (profiles, intake, assessments, plans, progress checks) and `20261030110000_dp_voice_curriculum_seed.sql` (generated library seed). They reuse existing helpers and tables and add no duplicate assignment or recording tables. See `docs/voice-development-system.md`.
