-- PROPOSED, NOT APPLIED. Lives outside supabase/migrations on purpose so no tool picks it up.
-- Two independent changes. Review the PREVIEW queries first; run them read-only against the live project.

-- ===== PREVIEW (read-only) =====
-- select 'lessons to change' k, count(*) from dp_lessons where status='draft' and content_status='published';            -- live today: 13
-- select 'courses to change' k, count(*) from dp_courses where is_published=false and content_status='published';        -- live today: 4

-- ===== 1. Correct content_status labels =====
-- Draft lessons that carry the column default 'published'. Only touches rows that are BOTH not published and labelled published.
-- No application code reads or writes lesson content_status; lesson visibility is governed by dp_lessons.status.
update dp_lessons set content_status='draft'
 where status='draft' and content_status='published';

-- Unpublished courses labelled 'published' (the four Voice courses). Affects only the staff course-list pill and pathway pages.
-- 'coming_soon' and 'archived' courses are NOT touched.
update dp_courses set content_status='draft'
 where is_published=false and content_status='published';

-- ===== 2. Stop anonymous visitors reading unpublished course rows =====
-- Today dp_courses_read is PERMISSIVE for {public}, qual true: signed-out visitors can read the title/description of every course,
-- including unpublished ones. Signed-in users are already narrowed by the RESTRICTIVE policy dp_courses_program_boundary
-- (dp_can_access_course), which this change does not touch.
drop policy if exists dp_courses_read on dp_courses;
create policy dp_courses_read on dp_courses for select to public
  using (auth.role() = 'authenticated' or is_published);
-- Effect: anon sees only is_published=true courses (9 today). authenticated behaviour is unchanged (true AND the restrictive boundary).

-- ===== ROLLBACK =====
-- drop policy if exists dp_courses_read on dp_courses;
-- create policy dp_courses_read on dp_courses for select to public using (auth.role() = 'authenticated' or auth.role() = 'anon');
-- Labels cannot be restored automatically; the prior value was the column default 'published' for exactly the rows counted in PREVIEW.
