-- =============================================================================
-- PROPOSED — DO NOT APPLY YET. Kept OUTSIDE supabase/migrations/ on purpose so
-- `supabase db push` does NOT run it. This is the smallest additive correction
-- that makes lesson (and lesson-media) access match the intended rule:
--
--   Students may access lesson content/media only when authorized for that
--   specific lesson via enrollment; being authenticated alone must NOT grant
--   access to every published lesson. Staff keep full access.
--
-- ⚠️  BEHAVIOR CHANGE + ROLLOUT RISK. Today there is NO enrollment gate on
--     lessons — every authenticated user can read every *published* lesson.
--     Applying this immediately hides published lesson content/media from any
--     student who does NOT have an active dp_enrollments row covering the
--     course. If enrollment data is not yet backfilled, real students will lose
--     access. Backfill/verify dp_enrollments FIRST, then apply this in a
--     maintenance window, then re-verify. This file is additive and
--     non-destructive to DATA (it only redefines two SELECT policies and adds
--     one function), but it DOES change who can read.
--
-- Scope of the fix (deliberately minimal):
--   * dp_lessons        — gate published-lesson reads on enrollment.
--   * dp_lesson_blocks  — same gate (block text is the lesson's content and is
--                         currently readable by ANY authenticated user).
--   * Course/module CATALOG rows stay browsable (dp_courses/dp_modules
--     unchanged) so students can still discover courses they aren't enrolled in
--     — they just can't open the lessons or media.
--
-- Why nothing changes in migration 0026: the course-media-private read policy
-- already binds to `exists (select 1 from dp_lessons where id = <lessonId>)`.
-- Once dp_lessons is enrollment-gated here, that EXISTS starts returning false
-- for non-enrolled users, so protected media inherits enrollment automatically.
-- The storage policy needs no edit.
--
-- NOT covered here (call out explicitly — these are separate, currently-
-- unenforced concerns, not silently included):
--   * Scheduled release by publish_at timestamp — today only the `status` enum
--     gates release ('scheduled'/'draft' are hidden; a timed auto-flip to
--     'published' is not implemented).
--   * prerequisite_lesson_id / drip_rule sequencing — columns exist but nothing
--     enforces them in RLS or app logic.
--   Add those separately if/when you want them; they are independent of this fix.
-- =============================================================================

-- Enrollment reach: can the current user access this course through any active
-- enrollment scope (course / program / track / cohort)? SECURITY DEFINER so the
-- check is consistent regardless of the caller's own RLS on dp_enrollments.
create or replace function dp_can_access_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from dp_enrollments e
    join dp_courses c on c.id = target_course_id
    where e.user_id = auth.uid()
      and e.status = 'active'
      and (
            (e.scope_type = 'course'  and e.scope_id = c.id)
        or  (e.scope_type = 'program' and e.scope_id = c.program_id)
        or  (e.scope_type = 'track'   and e.scope_id = c.track_id)
        or  (e.scope_type = 'cohort'  and e.scope_id in (
              select ch.id from dp_cohorts ch
              where (c.program_id is not null and ch.program_id = c.program_id)
                 or (c.track_id  is not null and ch.track_id  = c.track_id)
            ))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- dp_lessons: replace the published-to-everyone branch with published-AND-enrolled.
-- Staff branches (super_admin / faculty / teacher-of-course) are preserved so
-- they can still see draft, scheduled, coming_soon, and published media.
-- ---------------------------------------------------------------------------
drop policy if exists dp_lessons_read_published on dp_lessons;
create policy dp_lessons_read_published on dp_lessons for select using (
  dp_is_super_admin()
  or dp_has_role('faculty')
  or dp_is_teacher_of_course((select course_id from dp_modules where dp_modules.id = module_id))
  or (
    status = 'published'
    and dp_can_access_course((select course_id from dp_modules where dp_modules.id = module_id))
  )
);

-- ---------------------------------------------------------------------------
-- dp_lesson_blocks: currently readable by ANY authenticated user. Gate it to the
-- same rule as the owning lesson so block text can't be read past enrollment.
-- ---------------------------------------------------------------------------
drop policy if exists dp_lesson_blocks_read on dp_lesson_blocks;
create policy dp_lesson_blocks_read on dp_lesson_blocks for select using (
  exists (select 1 from dp_lessons l where l.id = lesson_id)
);

-- Verification queries to run AFTER applying (in staging or a transaction):
--   -- a non-enrolled student should get 0 rows for a published lesson:
--   set local role authenticated; -- (plus a test JWT) then select from dp_lessons ...
--   -- an enrolled student should get their lesson rows; staff should see all.
-- Rollback: re-create the original permissive policies from migration 0002
--   (dp_lessons_read_published = status='published' or staff...; dp_lesson_blocks_read
--   = auth.role()='authenticated') and drop function dp_can_access_course.
