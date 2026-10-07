-- Rollback for migrations 0027 + 0028 (practical courses). NOT run automatically.
-- Restores the pre-0027 policies exactly as they were in the live project, then
-- removes what 0027/0028 added. My Build data (dp_builds) is DESTROYED by this —
-- export it first if students have started using it.
begin;

-- 0028: draft course (cascades to its modules)
delete from dp_courses where slug = 'how-to-build-an-app-with-ai';

-- Restore original policies (captured from live pg_policies before 0027).
drop policy if exists dp_lessons_read_published on dp_lessons;
create policy dp_lessons_read_published on dp_lessons for select using (
  status = 'published'
  or dp_is_super_admin() or dp_has_role('faculty')
  or dp_is_teacher_of_course((select course_id from dp_modules where dp_modules.id = dp_lessons.module_id))
);
drop policy if exists dp_lesson_blocks_read on dp_lesson_blocks;
create policy dp_lesson_blocks_read on dp_lesson_blocks for select using (auth.role() = 'authenticated');
drop policy if exists dp_modules_read on dp_modules;
create policy dp_modules_read on dp_modules for select using (auth.role() = 'authenticated');

-- Original (insecure) self-enrollment policy. Re-adding it re-opens the hole; only
-- do this if something depended on it.
drop policy if exists dp_enrollments_staff_insert on dp_enrollments;
create policy dp_enrollments_self_insert on dp_enrollments for insert
  with check (user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));

drop table if exists dp_builds cascade;
drop function if exists dp_builds_touch_updated_at();
drop function if exists dp_can_access_course(uuid);
alter table dp_courses drop constraint if exists dp_courses_access_mode_check;
alter table dp_courses drop constraint if exists dp_courses_lesson_style_check;
alter table dp_courses drop column if exists access_mode;
alter table dp_courses drop column if exists lesson_style;
commit;
