# Dove Expressions Discipleship Platform — Prototype

A working Next.js + Supabase prototype of the Dove Expressions Discipleship Hub &
Creative Studio: two learning areas on one platform, organized around the
**Three Pillars** — Draw Near to God, Hear God, Fulfill Your Kingdom Mandate —
with real authentication, real role-based access enforced at the database
level, and the assessment → session → profile → plan discipleship loop wired
end to end. Minimum safeguarding UI — privacy-policy acceptance, session
recording consent, report submission/review, and initial guardian-consent
capture — is also live; see `07-trust-safety-and-consent.md` for the one
documented gap (guardian consent is self-reported at signup, not yet
independently confirmed by the guardian).

This ships alongside nine planning documents (in the parent deliverable):
`01-information-architecture.md`, `02-role-permission-matrix.md`,
`03-route-structure.md`, `04-database-schema.md`,
`05-phased-implementation-plan.md`, `06-safety-and-recovery.md`,
`07-trust-safety-and-consent.md`, `08-feature-status.md`,
`09-consistency-report.md`.
**Start with `08-feature-status.md`** if you want the honest, current answer
to "does X actually work?" — it's the one document kept as the source of
truth on real status. Read the others for the *why*; this README is the
*how to run it*.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. `.env.local` is already populated with the live
Supabase project's URL and publishable key — no setup required to try it.

To deploy: push this folder to a Git repo and import it into Vercel (or any
Next.js host). Add the same two environment variables from `.env.local` in
your host's dashboard.

## What's real vs. preview

See `08-feature-status.md` for the complete, current, feature-by-feature
breakdown (Live and connected / Partially connected / Prototype only /
Requires external integration / Not started). Short version: authentication,
role-based routing + RLS, the learning hierarchy, lesson progress, the
Spiritual Wiring Assessment and results/reflection flow, the discipleship
plan, notes with honest autosave, live session listings, Creative Studio's
roadmap + project workspaces, and the safeguarding basics (privacy
acceptance, recording consent, report submission/review, initial guardian
consent) are live against your real Supabase data. Messages, Community,
Prayer, and the unified Library page render realistic sample data behind a
visible amber "Prototype preview" badge.
Several 1B-phase screens (Session Prep, Session Workspace creation, the
Wiring Profile builder, the Kingdom Mandate tool, Meetings With God,
Two-Way Journaling) have live schema but no UI yet — see the feature-status
doc for the exact line between what's built and what's next.

## Database safety

Every migration touches only `dp_`-prefixed objects — nothing belonging to
your existing Mentee Dashboard / Dream Journal / Prophetic Words tools was
ever altered. `06-safety-and-recovery.md` has the full migration inventory,
confirms this with actual row-count checks, and `supabase/rollback/` has a
tested rollback script if you ever want to remove the Discipleship Platform
schema entirely.

## Creating test accounts

Sign up normally at `/signup` — every new account gets the `guest` role.
To try faculty/mentor/teacher/admin views, sign up, then in the Supabase
dashboard's Table Editor add a row to `dp_user_roles` for that user with the
role you want to test (`faculty`, `teacher`, `mentor`, or `super_admin`). To
see mentor-scoped student data, also add a row to `dp_mentor_assignments`
linking that mentor to a student account. To test a Faculty grant scoped to
just one program (rather than the whole platform), add a row to
`dp_role_assignments` instead of the global `dp_user_roles` — see
`02-role-permission-matrix.md` → "Every permission is evaluated through role
and scope."

## Navigation

Student navigation is grouped — **Learn / Grow / Connect / Library / Account**
— rather than 15+ flat items (see `components/nav-config.ts`). The mobile
menu opens as a genuine full-width panel and never overflows the screen.

## Brand system

Tailwind is configured with the exact Dove Expressions palette: burgundy
`#630000`, charcoal `#1B1717`, soft white `#FDFDFD`, sunrise `#D97904`, coral
`#D96248`, pale pink `#F2DFD8`, gold `#E6A742`. Typography is Playfair
Display for headings, Lora for body copy, Lato for UI/labels/buttons — loaded
from Google Fonts at runtime (see `app/layout.tsx`) rather than bundled at
build time, so the build never depends on network access. Discipleship Hub
surfaces lean on burgundy; Creative Studio surfaces lean on sunrise, per
`dp_learning_areas.accent_color`.

## Accessibility notes already implemented

Semantic form labels that stay visible (never placeholder-only), visible
focus states (gold outline), `role="progressbar"` with proper aria attributes
on every progress bar, `aria-live`/`role="status"` on save-state indicators,
a `prefers-reduced-motion` rule in `globals.css`, 44px-minimum touch targets
on primary buttons and nav items, and a mobile nav that opens as a genuine
full-width panel (never an overflowing dropdown).

## Project structure

```
app/                      Next.js App Router pages
  (app)/                  Authenticated route group (student + staff)
  login/ signup/          Public auth pages
  page.tsx                Public landing page
components/               Shared UI + feature components
  nav-config.ts            Grouped nav (Learn/Grow/Connect/Library/Account)
lib/supabase/             Browser + server Supabase clients
lib/roles.ts              Server-side role lookup (UX convenience — NOT the security boundary)
lib/mock-data.ts          Sample content for not-yet-live features, clearly labeled in the UI
lib/types.ts              Shared TypeScript types matching the dp_ schema
supabase/migrations/      Every migration SQL file, in order, applied to your live project
supabase/rollback/        Tested rollback script for the entire dp_ schema
```

## The one thing to remember about security

Every `dp_` table has Row-Level Security enabled with real policies — `lib/roles.ts`
and route-level checks are there for UX (deciding what to render), but they are
not the actual security boundary. Even a compromised or buggy client cannot
read or write data it isn't authorized for, because Postgres itself refuses
it. See `04-database-schema.md` → "Row-Level Security approach," and
`02-role-permission-matrix.md` for how role checks are also scoped by area,
program, cohort, or course rather than assumed to apply everywhere.
