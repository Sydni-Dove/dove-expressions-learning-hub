-- ============================================================================
-- v2c correction: extend the area/program-scoped Faculty grant pattern
-- (dp_has_scoped_role, introduced in migration 10 for dp_programs and
-- dp_courses only) to the remaining core learning-hierarchy write policies:
-- dp_tracks, dp_cohorts, dp_modules, dp_lessons. This closes the gap where a
-- person holding ONLY a scoped Faculty grant (dp_role_assignments, no global
-- dp_user_roles 'faculty' row) could manage a program/course but not the
-- tracks, cohorts, modules, or lessons underneath it. Purely additive: every
-- existing access path (super admin, global faculty, dp_is_teacher_of_course)
-- is preserved with OR, nothing is narrowed or removed.
-- ============================================================================

-- dp_tracks: scoped via the track's program (and that program's area)
drop policy if exists dp_tracks_write on dp_tracks;
create policy dp_tracks_write on dp_tracks for all using (
  dp_is_super_admin() or dp_has_role('faculty')
  or dp_has_scoped_role('faculty', (select area_id from dp_programs p where p.id = dp_tracks.program_id), program_id, null, null)
) with check (
  dp_is_super_admin() or dp_has_role('faculty')
  or dp_has_scoped_role('faculty', (select area_id from dp_programs p where p.id = dp_tracks.program_id), program_id, null, null)
);

-- dp_cohorts: scoped via the cohort's own id, its program, and that program's area
drop policy if exists dp_cohorts_write on dp_cohorts;
create policy dp_cohorts_write on dp_cohorts for all using (
  dp_is_super_admin() or dp_has_role('faculty')
  or dp_has_scoped_role('faculty', (select area_id from dp_programs p where p.id = dp_cohorts.program_id), program_id, id, null)
) with check (
  dp_is_super_admin() or dp_has_role('faculty')
  or dp_has_scoped_role('faculty', (select area_id from dp_programs p where p.id = dp_cohorts.program_id), program_id, id, null)
);

-- dp_modules: scoped via the module's course, and that course's program/area
drop policy if exists dp_modules_write on dp_modules;
create policy dp_modules_write on dp_modules for all using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_is_teacher_of_course(course_id)
  or dp_has_scoped_role(
       'faculty',
       (select area_id from dp_courses c where c.id = dp_modules.course_id),
       (select program_id from dp_courses c where c.id = dp_modules.course_id),
       null, course_id
     )
) with check (
  dp_is_super_admin() or dp_has_role('faculty') or dp_is_teacher_of_course(course_id)
  or dp_has_scoped_role(
       'faculty',
       (select area_id from dp_courses c where c.id = dp_modules.course_id),
       (select program_id from dp_courses c where c.id = dp_modules.course_id),
       null, course_id
     )
);

-- dp_lessons: scoped via the lesson's module -> course -> program/area
drop policy if exists dp_lessons_write on dp_lessons;
create policy dp_lessons_write on dp_lessons for all using (
  dp_is_super_admin() or dp_has_role('faculty')
  or dp_is_teacher_of_course((select m.course_id from dp_modules m where m.id = dp_lessons.module_id))
  or dp_has_scoped_role(
       'faculty',
       (select c.area_id from dp_modules m join dp_courses c on c.id = m.course_id where m.id = dp_lessons.module_id),
       (select c.program_id from dp_modules m join dp_courses c on c.id = m.course_id where m.id = dp_lessons.module_id),
       null,
       (select m.course_id from dp_modules m where m.id = dp_lessons.module_id)
     )
) with check (
  dp_is_super_admin() or dp_has_role('faculty')
  or dp_is_teacher_of_course((select m.course_id from dp_modules m where m.id = dp_lessons.module_id))
  or dp_has_scoped_role(
       'faculty',
       (select c.area_id from dp_modules m join dp_courses c on c.id = m.course_id where m.id = dp_lessons.module_id),
       (select c.program_id from dp_modules m join dp_courses c on c.id = m.course_id where m.id = dp_lessons.module_id),
       null,
       (select m.course_id from dp_modules m where m.id = dp_lessons.module_id)
     )
);
