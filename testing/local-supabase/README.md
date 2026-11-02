# Authenticated testing without a cloud project

A disposable Supabase-compatible stack on your own machine (Docker): the same Postgres image Supabase uses (with the
real `auth` and `storage` schemas), GoTrue (login), PostgREST (the API) and Storage. It replays the repository's migrations,
so the application, its row-level security and its private file storage are exercised for real. It costs nothing, touches no
cloud project, and `down` deletes everything. Nothing here can reach production: the keys are throwaway values in `env.mjs`.

## What it is not
It is not your hosted project. Hosted-only behaviour (email delivery, rate limits, dashboard settings, the exact Storage and
GoTrue versions Supabase runs today, network latency) is not reproduced. Re-run the smoke checklist below against the real project
after the migrations are approved and applied.

## Run it
```
docker compose version                      # Docker with Compose is required
node testing/local-supabase/proxy.mjs &     # single-origin gateway on :54321
node testing/local-supabase/run.mjs up      # containers + migrations + six fixture users
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$(cat testing/local-supabase/anon.txt)
npm run build && testing/local-supabase/start-app.sh &      # app on :3111
PW_CHROMIUM=/path/to/chrome npx playwright test -c playwright.auth.config.ts   # PW_CHROMIUM optional
node testing/local-supabase/run.mjs seed    # reset fixtures between runs
node testing/local-supabase/run.mjs down    # delete the stack
```
`ids.json` and `anon.txt` are generated locally and are git-ignored.

## Fixture accounts (all `@fixture.test`, password in `ids.json`)
| Role | Account | Setup |
|---|---|---|
| Voice-only student | voice-only | enrolled in the Voice program |
| Student in another program | creative-only | enrolled in Creative Studio only |
| Student in multiple programs | multi-program | Voice and Creative |
| Authorized vocal instructor | instructor | global `faculty` role |
| Administrator | admin | `super_admin` |
| Extra: scoped teacher | scoped-teacher | teacher of a non-voice course only (negative test) |

## What the suite covers (`tests/e2e-auth`)
1. Login, wrong password, signed-out redirects, and landing page per role.
2. Program access for every role, including blocked staff, creative and discipleship routes and the unpublished roadmap.
3. Instructor builds the exercise library, a template, a package, a schedule (double-booking refused), a weekly plan and goals.
3b. The existing lesson-builder assignment personalization.
4. Student resource area, dashboard values from real records, and isolation between students.
5. Homework: save and restore, file validation, private upload, submit, instructor playback, private note, return, revise, approve,
   automatic progress, goal progress.
6. Unauthorized access: other students and a scoped teacher cannot read recordings, work, goals; no signed URLs; no self-approval.
7. Testimonials: consent captured, approval required, publish gate enforced by the database.
8. Public testimonial page as a signed-out visitor (consented, approved, published only; first name only; video plays), consent
   withdrawal in the app (page and video stop being served; staff cannot republish), deletion.
9. Store payments through the real webhook route (installments matched by parent order or plan reference; a payment with no reference waits
   in a queue and the instructor matches it; refunds; replays): bad signatures, unknown products and unmatched emails rejected; a 12-lesson,
   3-payment package unlocks 4, 8, then 12 lessons; replays and refunds behave; quantity 2 refused; the dashboard says what is unlocked.
10. Scheduling versus payment: a 12-week schedule can be created; recording a lesson beyond paid lessons is refused (function and direct update)
    until the instructor waives payment with a reason; the command center shows lessons scheduled beyond paid lessons.
    (Content gating, refund record preservation and attribution edge cases are covered by the database tests.)
8b. Website embed and JSON feed: same live list, never cached, framing and CORS limited to the website, empty after withdrawal.
Responsive: phone 390, tablet 820, desktop 1440 for student, instructor, admin and the public testimonial page (no horizontal overflow, controls at
least 24 px, screenshots saved to `screenshots/`).

## Smoke checklist for the real project after approval (30 minutes, one test student you create and delete)
Sign in as that student; open Practice Resources; save and reload a plan; upload a 1 MB recording; confirm the instructor can play
it and a second account cannot; approve; submit a testimonial without consent and confirm it cannot be published; delete the test
student and their storage objects.
