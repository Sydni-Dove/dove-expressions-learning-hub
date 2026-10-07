-- v6: Practical-course support — per-course enrollment gate, enrollment lock-down,
-- and the student-owned "My Build" record.
--
-- Supersedes supabase/proposed/0027_enrollment_gated_lesson_access.PROPOSED.sql
-- (removed). That draft gated EVERY course on enrollment; with zero rows in
-- dp_enrollments that would have hidden all existing lessons from all students.
-- This version gates only courses explicitly marked access_mode = 'enrolled'.
-- Every existing course is backfilled to 'open' by the column default, so for
-- existing courses/lessons the effective access rule is unchanged.
--
-- WHAT THIS CHANGES
--   ADDITIVE
--     * dp_courses.access_mode  ('open' default | 'enrolled')
--     * dp_courses.lesson_style ('reflective' default | 'practical')
--     * function dp_can_access_course(course_id)   — the single access choke point
--     * table dp_builds (+ RLS, trigger)            — "My Build"
--   POLICY CHANGES (existing policies are replaced, not left alongside)
--     * dp_lessons_read_published   — published AND can-access-course (staff unchanged)
--     * dp_lesson_blocks_read       — now follows the owning lesson's visibility
--                                     (was: any signed-in user, even for DRAFT lessons)
--     * dp_modules_read             — can-access-course (open courses: unchanged)
--     * dp_enrollments_self_insert  — DROPPED; replaced by dp_enrollments_staff_insert.
--                                     Students can no longer enroll themselves.
--   NOT TOUCHED: dp_courses_read (catalog stays browsable), dp_lesson_progress,
--   assignments/submissions, reflections, notes, storage policies from 0026.
--
-- FUTURE PURCHASES: a trusted server-side flow (service role / SECURITY DEFINER
-- RPC after a verified payment) inserts a dp_enrollments row. Nothing here needs
-- to change — dp_can_access_course() already honours course/program/track/cohort
-- enrollments.
--
-- Re-runnable: columns use IF NOT EXISTS, policies/functions are drop/create-or-replace.

-- ---------------------------------------------------------------------------
-- 1. Per-course settings
-- ---------------------------------------------------------------------------
alter table dp_courses add column if not exists access_mode text not null default 'open';
alter table dp_courses add column if not exists lesson_style text not null default 'reflective';

alter table dp_courses drop constraint if exists dp_courses_access_mode_check;
alter table dp_courses add constraint dp_courses_access_mode_check check (access_mode in ('open', 'enrolled'));
alter table dp_courses drop constraint if exists dp_courses_lesson_style_check;
alter table dp_courses add constraint dp_courses_lesson_style_check check (lesson_style in ('reflective', 'practical'));

-- ---------------------------------------------------------------------------
-- 2. Access function (single choke point; used by RLS and by the app route guard)
-- ---------------------------------------------------------------------------
create or replace function dp_can_access_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- staff
    dp_is_super_admin()
    or dp_has_role('faculty')
    or dp_is_teacher_of_course(target_course_id)
    -- open courses behave exactly as before this migration
    or exists (
      select 1 from dp_courses c
      where c.id = target_course_id and c.access_mode = 'open'
    )
    -- enrolled courses: an active/completed enrollment that reaches the course
    or exists (
      select 1
      from dp_enrollments e
      join dp_courses c on c.id = target_course_id
      where e.user_id = auth.uid()
        and e.status in ('active', 'completed')
        and (
              (e.scope_type = 'course'  and e.scope_id = c.id)
          or  (e.scope_type = 'program' and c.program_id is not null and e.scope_id = c.program_id)
          or  (e.scope_type = 'track'   and c.track_id   is not null and e.scope_id = c.track_id)
          or  (e.scope_type = 'cohort'  and e.scope_id in (
                select ch.id from dp_cohorts ch
                where (c.program_id is not null and ch.program_id = c.program_id)
                   or (c.track_id   is not null and ch.track_id   = c.track_id)
              ))
        )
    );
$$;

revoke all on function dp_can_access_course(uuid) from public;
grant execute on function dp_can_access_course(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Read policies
-- ---------------------------------------------------------------------------
drop policy if exists dp_lessons_read_published on dp_lessons;
create policy dp_lessons_read_published on dp_lessons for select using (
  dp_is_super_admin()
  or dp_has_role('faculty')
  or dp_is_teacher_of_course((select m.course_id from dp_modules m where m.id = dp_lessons.module_id))
  or (
    status = 'published'
    and dp_can_access_course((select m.course_id from dp_modules m where m.id = dp_lessons.module_id))
  )
);

-- Blocks inherit the lesson's visibility (the subquery is itself subject to dp_lessons RLS).
drop policy if exists dp_lesson_blocks_read on dp_lesson_blocks;
create policy dp_lesson_blocks_read on dp_lesson_blocks for select using (
  exists (select 1 from dp_lessons l where l.id = dp_lesson_blocks.lesson_id)
);

drop policy if exists dp_modules_read on dp_modules;
create policy dp_modules_read on dp_modules for select using (
  auth.role() = 'authenticated' and dp_can_access_course(dp_modules.course_id)
);

-- ---------------------------------------------------------------------------
-- 4. Enrollments: staff-only creation (students must not grant themselves access)
-- ---------------------------------------------------------------------------
drop policy if exists dp_enrollments_self_insert on dp_enrollments;
drop policy if exists dp_enrollments_staff_insert on dp_enrollments;
create policy dp_enrollments_staff_insert on dp_enrollments for insert
  with check (dp_is_super_admin() or dp_has_role('faculty'));

-- ---------------------------------------------------------------------------
-- 5. My Build
-- ---------------------------------------------------------------------------
create table if not exists dp_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references dp_courses(id) on delete cascade,
  app_name text not null default '',
  building_what text not null default '',
  audience text not null default '',
  central_action text not null default '',
  repo_url text not null default '',
  preview_url text not null default '',
  live_url text not null default '',
  strategist_tool text not null default '',
  developer_tool text not null default '',
  evaluator_tool text not null default '',
  current_focus text not null default '',
  notes text not null default '',
  parked_ideas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id),
  -- Text + links only. Length caps keep this a notes page, not a file dump.
  constraint dp_builds_len check (
    char_length(app_name) <= 120 and char_length(building_what) <= 1000
    and char_length(audience) <= 1000 and char_length(central_action) <= 1000
    and char_length(strategist_tool) <= 120 and char_length(developer_tool) <= 120
    and char_length(evaluator_tool) <= 120 and char_length(current_focus) <= 2000
    and char_length(notes) <= 8000 and char_length(parked_ideas) <= 4000
  ),
  -- http(s) only, no embedded user:password@ credentials.
  constraint dp_builds_urls check (
    repo_url ~* '^(https?://[^/@\s]+(/.*)?)?$' and char_length(repo_url) <= 500
    and preview_url ~* '^(https?://[^/@\s]+(/.*)?)?$' and char_length(preview_url) <= 500
    and live_url ~* '^(https?://[^/@\s]+(/.*)?)?$' and char_length(live_url) <= 500
  )
);

create or replace function dp_builds_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dp_builds_touch on dp_builds;
create trigger dp_builds_touch before update on dp_builds
  for each row execute function dp_builds_touch_updated_at();

alter table dp_builds enable row level security;
revoke all on dp_builds from anon;

-- Owner: read always; write only while they still have access to the course.
drop policy if exists dp_builds_owner_select on dp_builds;
create policy dp_builds_owner_select on dp_builds for select using (user_id = auth.uid());

drop policy if exists dp_builds_owner_insert on dp_builds;
create policy dp_builds_owner_insert on dp_builds for insert
  with check (user_id = auth.uid() and dp_can_access_course(course_id));

drop policy if exists dp_builds_owner_update on dp_builds;
create policy dp_builds_owner_update on dp_builds for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and dp_can_access_course(course_id));

drop policy if exists dp_builds_owner_delete on dp_builds;
create policy dp_builds_owner_delete on dp_builds for delete using (user_id = auth.uid());

-- Staff: read-only oversight (matches the dp_lesson_progress / dp_submissions pattern).
drop policy if exists dp_builds_staff_select on dp_builds;
create policy dp_builds_staff_select on dp_builds for select using (
  dp_is_super_admin()
  or dp_has_role('faculty')
  or dp_is_teacher_of_course(course_id)
  or dp_is_mentor_of(user_id)
);
