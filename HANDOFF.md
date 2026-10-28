# Voice coaching handoff

Updated October 28, 2026. Draft PR: https://github.com/Sydni-Dove/dove-expressions-learning-hub/pull/2.

## Audit and reuse

Reused `dp_enrollments`, `dp_courses/modules/lessons`, the 12-session Voice scaffold,
`dp_assignments`, `dp_submissions`, `dp_feedback`, `dp_lesson_progress`, `dp_sessions`,
lesson notes, private lesson storage, and the existing assignment/review builders.
Added only `dp_assignment_progress`: an assignment-specific practice draft, not a
second enrollment, submission, lesson, feedback, or curriculum system.

## Implemented

- Instructor lesson builder: individual enrolled student or course/program audience,
  editable song, goal, pacing, instructions, checklist and due date.
- Student assignments: guided checklist, minutes, reflection, recording link,
  explicit save/reload, submit, revision after return, shared feedback and completion.
- Existing instructor queue includes revised work. Private review notes are separate
  feedback rows protected by RLS. Publishing feedback and review outcome is atomic.
- Approval updates existing lesson progress atomically after all assigned work for that lesson is approved or exempted; returning work reopens it.
- Voice journey shows assigned work and reviewed completion; Voice-only progress
  routes to Voice. Existing Voice colors/layout retained; hero has no microphone.
- Program/course/lesson checks fail closed in routes and database. Tightened legacy
  policies, scoped staff matching, private lesson file reads/writes, linked notes,
  submissions, and progress. Students cannot choose instructor review outcomes.
- Sessions are program-tagged. Students cannot query session rows containing private
  faculty notes; a whitelist RPC supplies their own enrolled program's shared summaries.
  Legacy sessions with no program are not guessed or exposed to the Voice portal.

## Verified Supabase project and applied migrations

Repository `.env.local.example` and Supabase project metadata both identify
`jnlvvlkwskidloripvtp`, **Dove Expressions App 2**, us-west-2, active/healthy.
Read actual columns, policies, function definitions, migration inventory, and security
advisors before changes. Existing schema contains unrelated apps; changes stay in
`dp_` objects and policies restricted to the existing private course media bucket.

Applied via Supabase MCP (CLI unavailable in this environment):

- `20261028164718_dp_voice_persistent_coaching_and_program_boundaries`
- `20261028164738_dp_voice_draft_curriculum_and_testimonials` (repository scripts 0029–0031 together)
- `20261028165011_dp_voice_scoped_policy_and_file_hardening`
- `20261028180736_dp_voice_review_updates_lesson_progress`
- `20261028181226_dp_voice_review_progress_status_type`
- `20261028181439_dp_voice_notes_policy_recursion_fix`

The migration filenames use the actual server-generated versions. No real enrollment
rows were changed. Confirmed four Voice courses unpublished, all 12 lessons draft,
zero Voice lessons published. No unfinished curriculum content was published.

## Validation

Passed against the actual project, using transaction-only fixture users/content and
ROLLBACK: Voice-only versus Creative-only versus multiple-program memberships,
other-program and draft lesson denial, personalized assignment privacy, saved draft
readback, submission, student self-approval denial, authorized teacher draft preview,
private instructor review, shared feedback visibility, returned work revision,
unassigned/scoped teacher denial, private-file and program-linked-note isolation, private session-row denial with safe shared summaries, withdrawn enrollment denial, approval and updated student-visible lesson progress. A pre-existing notes/shares policy recursion discovered by these tests was also fixed.
The reusable script is `tests/sql/voice-coaching.rollback.sql`; fixtures do not remain.

Local dependency installation is blocked: configured shell proxy is unreachable and
`npm ci --offline` reports missing cached packages. GitHub Actions compensates for this:
TypeScript, 36 unit tests (including saved draft restoration, revision, save failure,
preview and atomic feedback), 23 SQL replay tests, and production build passed on commit
`46a89a5`. Final expanded SQL fixtures and progress migrations are being checked again.
CI provisions pinned ESLint tooling because the original lockfile omits it. Existing
cosmetic JSX quotation findings now report as warnings; other lint checks remain active.
Authenticated browser verification remains pending; do not describe it as passed.

## Deployment and remaining blockers

Application changes are not merged or deployed to production. Database changes are live.
Draft PR #2 is open on `codex/voice-persistent-coaching`; final CI status will be recorded after verification. Instructor must author and
publish ready lessons/courses through existing builders and manage enrollment through
authorized existing systems. No student access was granted for testing.

Recording submissions currently reuse HTTPS links; external hosting privacy is controlled
by that host. Private lesson uploads continue to use the existing signed storage system.
Browser-based authenticated save/reload, full student/instructor navigation, and responsive
visual checks remain required before release. Existing Supabase security advisories include
legacy exposed definer functions and disabled leaked-password protection; unrelated app
configuration was not changed.

## Advisory review

Post-change Supabase advisors were reviewed. The three intentional authenticated
summary/roster RPCs are SECURITY DEFINER with fixed search paths, explicit caller
checks, no anonymous execution, scoped results, and whitelisted returned columns.
They appear under the generic definer advisory. Internal lookup helpers are in the
unexposed `dp_private` schema. Remaining legacy advisories include unrelated functions
and RLS tables intentionally without policies. References:
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
