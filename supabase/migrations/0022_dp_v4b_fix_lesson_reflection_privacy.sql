-- ============================================================================
-- v4b correction: dp_lesson_reflections_owner (migration 0021) incorrectly
-- granted ANY faculty member unconditional read/write access to a student's
-- private lesson reflections via `dp_has_role('faculty')`, regardless of the
-- shared_with_mentor flag. This deviates from this codebase's own established
-- pattern for private personal content (see dp_notes_owner_select, which
-- grants only the author, dp_is_super_admin(), and explicit/mentor-visibility
-- shares -- never a blanket faculty role check) and directly contradicts the
-- "private reflections stay private unless the student explicitly shares
-- them" requirement. Splits the single combined policy into three narrower
-- ones so a faculty member who is not the student's assigned mentor, and not
-- super_admin, can never see or touch a reflection the student hasn't shared.
-- ============================================================================

drop policy if exists dp_lesson_reflections_owner on dp_lesson_reflections;

-- Student: full control of their own reflections.
create policy dp_lesson_reflections_owner_all on dp_lesson_reflections for all using (
  student_id = auth.uid()
) with check (
  student_id = auth.uid()
);

-- Oversight: super_admin only (matches dp_notes_owner_select precedent) --
-- plain 'faculty' role does not get blanket access here, unlike the
-- migration-0021 policy this replaces.
create policy dp_lesson_reflections_super_admin_select on dp_lesson_reflections for select using (
  dp_is_super_admin()
);

-- Mentor: read-only, and only once the student has explicitly shared this
-- specific reflection (shared_with_mentor = true), and only their own mentor.
create policy dp_lesson_reflections_mentor_select on dp_lesson_reflections for select using (
  shared_with_mentor = true and dp_is_mentor_of(student_id)
);
