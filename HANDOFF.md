# Voice coaching handoff

Updated October 28, 2026. Work in progress; see validation and deployment below.

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

The migration filenames use the actual server-generated versions. No real enrollment
rows were changed. Confirmed four Voice courses unpublished, all 12 lessons draft,
zero Voice lessons published. No unfinished curriculum content was published.

## Validation

Passed against the actual project, using transaction-only fixture users/content and
ROLLBACK: Voice-only versus Creative-only versus multiple-program memberships,
other-program and draft lesson denial, personalized assignment privacy, saved draft
readback, submission, student self-approval denial, authorized teacher draft preview,
private instructor review, shared feedback visibility, returned work revision,
unassigned teacher denial, approval and updated student-visible review status.
The reusable script is `tests/sql/voice-coaching.rollback.sql`; fixtures do not remain.

Local dependency installation is blocked: configured shell proxy is unreachable and
`npm ci --offline` reports missing cached packages. Unit, SQL replay, typecheck, lint,
production build and browser verification are pending CI. Do not describe those as passed.

## Deployment and remaining blockers

Application changes are not merged or deployed to production. Database changes are live.
Draft PR / CI status will be recorded after verification. Instructor must author and
publish ready lessons/courses through existing builders and manage enrollment through
authorized existing systems. No student access was granted for testing.

Recording submissions currently reuse HTTPS links; external hosting privacy is controlled
by that host. Private lesson uploads continue to use the existing signed storage system.
Browser-based authenticated save/reload, full student/instructor navigation, and responsive
visual checks remain required before release. Existing Supabase security advisories include
legacy exposed definer functions and disabled leaked-password protection; unrelated app
configuration was not changed.
