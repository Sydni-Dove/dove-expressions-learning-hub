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
- Voice lessons link directly to guided practice rather than spiritual reflection or an app-building workspace; students cannot self-mark Voice completion.
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
- `20261028193254_dp_voice_completion_requires_instructor_review`

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
The reusable script is `tests/sql/voice-coaching.rollback.sql`; fixtures do not remain. Final database checks confirmed zero fixture users and zero published Voice courses or lessons.

Local dependency installation is blocked: configured shell proxy is unreachable and
`npm ci --offline` reports missing cached packages. GitHub Actions compensates for this:
TypeScript, 36 unit tests (including saved draft restoration, revision, save failure,
preview and atomic feedback), 23 SQL replay tests, lint, and production build passed. Final code commit `9913ce5` passed all checks, including expanded SQL fixtures, the lesson-to-practice link, and the instructor completion guard. CI evidence: https://github.com/Sydni-Dove/dove-expressions-learning-hub/actions/runs/40767994300
CI provisions pinned ESLint tooling because the original lockfile omits it. Existing
cosmetic JSX quotation findings now report as warnings; other lint checks remain active.
Authenticated browser verification remains pending; do not describe it as passed.

## Deployment and remaining blockers

Application changes are not merged or deployed to production. Database changes are live.
Draft PR #2 is open on `codex/voice-persistent-coaching`; Final code CI passed on `9913ce5`. Instructor must author and
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


## October 29 update: production readiness work (branch `claude/voice-coaching-production-lwtpjk`)

Built on top of PR #2 (this branch contains its commits). New work is additive and **not applied to the live database**
and **not deployed**.

### Added
- Migration `20261029090000_dp_voice_recordings_scheduling_consultations.sql` (NOT applied): private `voice-recordings`
  and `voice-testimonials` buckets (50 MB, audio/video types only, owner + managing instructor read, no overwrite), recording
  reference validation (HTTPS link or own upload), `dp_submission_attempts` history, `dp_coaching_plans` (weekly / alternating
  weeks, 45/60 min, overlap-proof), `dp_coaching_packages` (payment status, expiry, renewal link), lesson fields on `dp_sessions`
  (credit use by status), `dp_package_balances`, `dp_generate_appointments`, `dp_set_lesson_status`, `dp_my_coaching_overview`,
  `dp_program_students` (needed because live `profiles` is owner/admin-only), service-role `dp_record_package_purchase`,
  `dp_consultation_inquiries`, and the testimonial consent/publish gate.
- Migration `20261029100000_dp_voice_draft_lesson_content.sql` (NOT applied): draft teaching sections for the 12 lessons;
  lessons stay `draft`; only lessons with no blocks are touched.
- App: private recording upload + signed playback + attempt history (student and instructor), rebuilt Voice dashboard on live
  data, `/staff/voice` command center, testimonial video upload with explicit consent and approval-gated publishing,
  `/api/webhooks/woocommerce` (inert until env is set), consultation Apps Script and docs (`docs/voice-integrations.md`).
- The migrations must be applied before the matching app code is deployed; the dashboard and command center degrade to
  "not available" messages if they are missing, but uploads and testimonials will fail.

### Validation actually run (local, October 29)
TypeScript, lint (eslint 8.57.1 as in CI), unit tests, SQL replay tests (PGlite with real RLS), and production build.
See the final report for counts. Unauthenticated route protection verified by curl (all Voice/staff routes redirect to /login);
login and signup pages checked at 390, 820 and 1440 px with no horizontal overflow.

### NOT done / not verified (superseded by the October 29 evening update below)
- **Authenticated browser QA** (five roles, responsive screenshots of the dashboard and command center): not performed.
  It needs test accounts or a Supabase branch; creating users in the live project was not authorized.
- Migration not dry-run on the live server (tool connection dropped); only PGlite-verified.
- Real WooCommerce webhook, Google Apps Script, and email sending: unexecuted.


## October 29 evening update: finalized pricing, student resource area, configurable packages, authenticated testing

### Direction from the owner
Final prices (store is the source of truth; nothing in WooCommerce was changed): single lesson $45/45 min and $65/60 min;
monthly four weekly lessons $172/45 and $248/60 (one-time, no auto-renewal); 12-week coaching $504 (3 x $168)/45 and $720
(3 x $240)/60; annual is future only; no 3- or 6-lesson bundles. Keep the Vocal Development Program and curriculum unpublished and
do not advertise anything not yet built. Priority for current paying students: a simple resource area.

### Added (migrations `20261029090000`, `20261029100000`, `20261029110000`; all NOT applied to production)
- **Configurable packages** (`dp_coaching_tiers`, staff > Voice > Packages): lesson count and length, expiry, library access level,
  development plan flag, assessments and recording-feedback allowances, store product IDs. Entitlements are copied onto each
  purchase. No tiers are seeded. The WooCommerce webhook now maps products through these records (no environment map).
- **Reusable library with access levels:** `dp_lesson_access` tags a lesson with a minimum level; untagged lessons behave exactly as
  before. Levels are dormant until used and are not shown to students.
- **Student resource area** (`/voice/resources`): editable welcome and practice guide, this week's plan, exercise library of curated
  external video links by vocal skill, goals with self-rated progress, and homework (existing assignments, recording upload,
  instructor feedback). Instructor tools: `/staff/voice/library` (exercises, templates, guide text), `/staff/voice/plans` (assign a
  weekly plan from a template or hand-picked exercises with per-student notes; set goals). A weekly plan is a personalized
  assignment with no course, so submission, review and feedback reuse the existing workflow. Library edits never change work already
  assigned (snapshot).
- The unpublished 12-session roadmap (`/voice/training`) is staff-only; students are redirected to the resource area. The roadmap link
  was removed from the student dashboard.

### Defect found and fixed by real authenticated testing (affects PR #2 code)
The lesson-builder "Assign practice" form inserted with `.select("id")`; against a real database the assignment access policy
rejected that for every instructor and admin ("new row violates row-level security policy dp_assignments_boundary"), although the
earlier SQL tests passed because they inserted without RETURNING. Fixed in `components/AssignmentQuickForm.tsx` and covered by the
browser suite. Note this defect would have been live in production had PR #2 been deployed as it stood.

### Authenticated testing (no cloud branch needed): `testing/local-supabase`
Docker stack with the real Supabase Postgres image, GoTrue, PostgREST and Storage; replays all migrations (including the three new
ones) and runs the real app. Results from October 29 (local, not production): see the final report in the PR. Run instructions,
fixture accounts and the post-approval smoke checklist are in `testing/local-supabase/README.md`.

### Still open before any production release
Owner approval of the implementation and test results; decision on when 12-week lessons unlock given three payments; applying the
migrations to the live project (with a rollback plan); store price corrections and product linking; payment-first enforcement on
the booking pages; Google Apps Script installation; a smoke pass against the real project; scoped teachers can open the staff Voice
pages (they see no data) but cannot review course-less weekly-plan homework (only faculty and administrators can).
