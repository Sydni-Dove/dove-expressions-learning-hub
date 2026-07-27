-- dp_v3_course_wide_assignment_visibility
-- Fixes a real gap: an assignment created with only course_id set (no
-- assigned_to_user_id, no assigned_to_cohort_id — i.e. "everyone enrolled in
-- this course") was invisible to students under the original
-- dp_assignments_select policy, which only checked direct-user and cohort
-- assignment. This adds a course-wide branch via dp_enrollments
-- (scope_type = 'course'). Additive: every existing branch is preserved
-- with OR, nothing is removed or narrowed.

drop policy if exists dp_assignments_select on dp_assignments;

create policy dp_assignments_select
on dp_assignments
for select
using (
  assigned_to_user_id = auth.uid()
  or dp_is_super_admin()
  or dp_has_role('faculty')
  or dp_is_teacher_of_course(course_id)
  or dp_is_mentor_of(assigned_to_user_id)
  or assigned_to_cohort_id in (
      select scope_id from dp_enrollments
      where user_id = auth.uid() and scope_type = 'cohort'
    )
  or (
      assigned_to_user_id is null
      and assigned_to_cohort_id is null
      and course_id in (
        select scope_id from dp_enrollments
        where user_id = auth.uid() and scope_type = 'course'
      )
    )
);
