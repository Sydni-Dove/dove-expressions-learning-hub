# Migrations

These files mirror, in order, every migration applied live to the
"Dove Expressions App 2" Supabase project (`jnlvvlkwskidloripvtp`) via the
Supabase MCP during this build (search-path hardening on helper functions
and the audit-log policy fix are folded into `0001` rather than a separate
file). Re-running them against a fresh project reproduces the same schema.

**24 migrations applied to date.** This file is the living source of truth
for the count — if a doc elsewhere states a number, this list is what to
trust.

**v1 — initial platform (Phase 1A/1B foundation):**
1. `0001_dp_core_enums_and_identity.sql`
2. `0002_dp_learning_hierarchy.sql`
3. `0003_dp_assignments_and_creative_projects.sql`
4. `0004_dp_assessment_session_plan_chain.sql`
5. `0005_dp_journaling_notes_announcements_calendar_live.sql`
6. `0006_dp_fk_cleanup_and_seed.sql`
7. `0007_dp_demo_seed_content.sql`

**v2 — Three Pillars framework, area/program-scoped roles, safeguarding:**
8. `0009_dp_v2_pillars_tagging_and_wiring_boundaries.sql` — `dp_pillars`, multi-tag `pillars text[]` columns, Spiritual Wiring result-status/disagreement/public-visibility fields, versioning columns, Creative Studio project visibility states
9. `0010_dp_v2_scoped_roles_consent_safeguarding_certificates.sql` — `dp_role_assignments` (area/program/cohort/course-scoped role grants), policy documents + acceptances, session recording consent, reports, mentor-transfer log, student lifecycle/withdrawal, guardian consent, certificates

**v2b/v2c/v2d/v2e — second-review corrections:**
10. `0011_dp_v2b_pillar_order_correction.sql` — changes `dp_pillars.order_index` to Hear God, Draw Near to God, Fulfill Your Kingdom Mandate. Data-only, no schema change. **Reverted by migration 14 (see below) — this order was later confirmed incorrect.**
11. `0012_dp_v2c_extend_scoped_role_rls.sql` — extends the `dp_has_scoped_role` pattern (previously only on `dp_programs`/`dp_courses`) to `dp_tracks`, `dp_cohorts`, `dp_modules`, `dp_lessons`, so a scoped-only Faculty grant (no global Faculty role) can actually manage everything under the program/course it's scoped to. Additive — every prior access path is preserved with `OR`.
12. `0013_dp_v2d_safeguarding_ui_enablement.sql` — adds a narrow self-insert policy on `dp_guardian_consents` (a new minor account can create its own initial consent record; select/update/delete stay faculty/admin-only) and seeds real, versioned `dp_policy_documents` rows (privacy_policy, recording_consent, guardian_consent) so the new signup/session-log UI has real content to present.
13. `0014_dp_v2e_pillar_order_revert.sql` — **reverts migration 11.** The "Hear God first" pillar order applied in migration 11 was incorrect per explicit correction; this restores the original, correct order: Draw Near to God, Hear God, Fulfill Your Kingdom Mandate. Data-only, no schema change. Migration 11's entry above is left as an accurate historical record of what it did — it is not the current live state; migration 14 is.

**v3/v3b/v3c/v3d/v3e — real backends for launch-prep features:**
14. `0015_dp_v3_course_wide_assignment_visibility.sql` — replaces `dp_assignments_select` to add a course-wide visibility branch (via `dp_enrollments` where `scope_type='course'`) for assignments created with only `course_id` set and no direct user/cohort target. Additive — every prior branch preserved with `OR`. Closes a real gap: these assignments were previously invisible to enrolled students.
15. `0016_dp_v3b_profiles_authenticated_read.sql` — adds one new permissive SELECT policy on the pre-existing (non-`dp_`) `profiles` table, allowing any authenticated user to read basic profile fields (id/email/full_name/avatar_url/role/timestamps — no sensitive columns exist on this table). Does not touch the 3 pre-existing self-only policies. Fixes a latent bug: staff pages showing another user's name were silently broken by RLS in real sessions, undetectable via the Supabase MCP's elevated-privilege queries.
16. `0017_dp_v3c_messaging.sql` — real backend for direct/group messaging: `dp_conversations`, `dp_conversation_participants`, `dp_messages`, gated by the new `dp_is_conversation_participant()` SECURITY DEFINER helper. MVP scope (no peer-to-peer student messaging) is enforced in the app's candidate-recipient list, not the schema.
17. `0018_dp_v3d_community.sql` — real backend for community spaces/posts/comments: `dp_community_spaces`, `dp_community_posts`, `dp_community_comments`, with per-space `requires_approval` moderation. Seeds 3 starter spaces (General, Testimonies, Dreams & Visions — the last requiring approval).
18. `0019_dp_v3e_prayer_requests.sql` — real backend for prayer requests: `dp_prayer_requests`, `dp_prayer_responses`, gated by the new `dp_can_view_prayer_request()` SECURITY DEFINER helper covering all four visibility levels (private/mentor/cohort/community). `is_anonymous` is UI-only — `author_id` is always stored and always visible to staff/admin.
19. `0020_dp_v3f_grant_owner_super_admin.sql` — data-only insert granting `super_admin` in `dp_user_roles` to the existing owner account (`sydnimb@gmail.com`), which predates this build and already had `role='owner'` on the pre-existing `profiles` table. No schema change.

**v4 — Pathways (supersedes Three Pillars as the primary framework):**
20. `0021_dp_v4_four_pathways.sql` — originally adds `dp_pathways` (Draw Near, Hear God, Rooted, Kingdom Mandate) and new `pathways text[]` tagging columns on `dp_courses`/`dp_lessons`/`dp_assignments`/`dp_assignment_templates`/`dp_goals`/`dp_notes`, entirely additive alongside the now-deprecated `dp_pillars`/`pillars text[]` from migration 9. Adds richer course/series metadata (`subtitle`, `content_format`, `instructor_id`, `difficulty_level`, `estimated_duration`, `scripture_refs`, `prerequisite_course_id`, `content_status`) and a matching `content_status` on `dp_lessons`. Adds `dp_lesson_reflections` (the 8-part Reflection & Activation framework, one row per lesson per student, with an explicit `shared_with_mentor` boundary). Seeds the "Rooted: The Mind of Christ" placeholder series (course + one module + one placeholder lesson, `content_status = 'coming_soon'`, `is_published = false` — no lesson curriculum content invented). See migration 24 for the corrective three-top-level-pathway architecture. **`dp_lesson_reflections_owner`'s privacy policy was corrected by migration 22 — see below; do not treat this migration's original policy as the current live state.**
21. `0022_dp_v4b_fix_lesson_reflection_privacy.sql` — **fixes a real privacy defect found in a follow-up QA review of migration 21.** The original `dp_lesson_reflections_owner` policy granted any user with the `faculty` role unconditional read/write access to every student's private lesson reflections, regardless of the `shared_with_mentor` flag — inconsistent with this app's own established private-content pattern (`dp_notes_owner_select`, which grants only the author, `dp_is_super_admin()`, and explicit shares) and a direct violation of "private reflections stay private unless the student shares them." Replaces the one combined policy with three: student full-control, `dp_is_super_admin()` select-only (oversight, matching the `dp_notes` precedent), and mentor select-only gated on `shared_with_mentor = true`. Verified live via `pg_policy` that no policy on this table references `dp_has_role('faculty')` anymore.
22. `0023_dp_v4c_lesson_experience_integration.sql` — supports integrating the standalone lesson-viewer prototype (`docs/drawing-near-episode-2-lesson.html`) into the real lesson-detail route. Adds `dp_lessons.subtitle` (nullable text, mirrors `dp_courses.subtitle` from migration 21) and a new `dp_lesson_bookmarks` table (`user_id`, `lesson_id`, unique per pair) with the same owner/`super_admin`/`faculty` RLS pattern as `dp_lesson_progress` — bookmarking had no persistence anywhere before this. Purely additive; no existing table, column, or policy changed.
23. `0024_dp_v4d_three_pathways_rooted_track.sql` — corrects the top-level architecture to three primary pathways: Draw Near, Hear God, and Kingdom Mandate. Keeps the existing `rooted` pathway row for backward compatibility, marks it `is_primary = false` / `pathway_level = 'track'` with `parent_pathway_code = 'draw_near'`, adds lightweight course grouping fields (`track_key`, `series_key`), and tags Rooted courses/lessons with Draw Near so progress rolls up without data loss.

**v5 — Dreams & Visions track + uploads (Phase 1):**
24. `0025_dp_v5_dreams_visions_track_seed.sql` — **purely additive data seed; creates no tables and alters no columns.** Seeds the "Dreams & Visions" course under the Hear God pathway (`pathways = ['hear_god']`, `track_key = 'dreams_visions'`, `content_status = 'coming_soon'`, `is_published = false`), with 8 modules (Biblical Foundations, Preparing to Hear God, Principles of Dream Interpretation, The Interpretation Process, Dream Symbols, Responding to Revelation, Advanced Dream Topics, Dream Labs and Practicum) and their placeholder lessons (all `draft`/`coming_soon`). Every lesson gets the same empty reusable scaffold of `dp_lesson_blocks` — learning objectives, key scriptures, lesson media (video), lesson teaching, workbook, reflection, assignment, quiz, prayer/activation, resources — for Sydni to fill through the admin builder. No teaching content is invented. Guarded by a `track_key = 'dreams_visions'` existence check so re-running is a no-op. Reuses the existing `dp_courses → dp_modules → dp_lessons → dp_lesson_blocks` hierarchy exactly, so it renders on the Hear God pathway page and in the staff builder with zero renderer changes.
25. `0026_dp_v5b_course_media_storage.sql` — adds the platform's first file-upload path with a **two-bucket, security-reviewed design** so protected teaching content never gets a permanent public URL. Creates: (a) `course-media` — **public**, cover images/thumbnails only; (b) `course-media-private` — **private** (`public = false`), for lesson video/audio/workbooks/resources. Both are staff-write (`dp_is_super_admin() or dp_has_role('faculty'/'teacher')`). The **public** bucket has public `select`. The **private** bucket's `select` policy binds to lesson access: private objects live under `lessons/<lessonId>/…`, and the policy allows read only when `exists (select 1 from dp_lessons where id = <lessonId from path>)` — because that inner select is itself under `dp_lessons` RLS (`dp_lessons_read_published`), private-media access **inherits the exact current lesson-access rule** (published-or-staff) and any future tightening (e.g. an enrollment gate) automatically; staff also always read. Adds an immutable `dp_safe_uuid(text)` helper so malformed paths don't error the policy. The app stores public URLs for covers (`dp_courses.cover_image_url`) and `storage://course-media-private/…` references (never URLs) for protected media in existing `dp_lesson_blocks` content (`lesson_media`, `workbook_download`, `resources`); the lesson page mints short-lived (1h) signed URLs from those refs at render (`lib/storage.ts` `resolveStorageContent`). No new columns. Additive and re-runnable (buckets `on conflict do nothing`, policies dropped-if-exists). Per-object size limits are enforced in the upload UI; adjust the project's global Storage file-size limit in the Supabase dashboard for large video.

Note: file numbering skips `0008` (reserved during the v1/v2 split and never
used) and jumps from `0007` to `0009`; the live migration history has a
`dp_security_hardening` entry between migrations 6 and 8 that is folded into
`0001` here rather than shipped as its own file. Both are cosmetic
packaging differences, not missing migrations. The numbered files after that
point are additive corrections and feature migrations; use this README, not a
hardcoded historical count, as the local migration inventory.

All tables are namespaced `dp_` to avoid colliding with this project's
existing Mentee Dashboard / Dream Journal / Prophetic Words tables, which
are untouched by every migration above. See `../../04-database-schema.md`
for the v1 entity-relationship writeup and `../../06-safety-and-recovery.md`
for the full migration inventory, rollback path, and the reasoning for
applying additively to production instead of a staging branch.
