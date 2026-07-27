-- ============================================================================
-- v4c: supports integrating the standalone lesson-viewer prototype into the
-- real LMS. Purely additive: one new small table for bookmarks (genuinely
-- missing — no bookmark persistence existed anywhere), and one nullable
-- column so a lesson can carry a short subtitle the way courses already can
-- (dp_courses.subtitle was added in migration 21; dp_lessons never got the
-- equivalent). No existing table, column, policy, or enum is altered.
-- ============================================================================

alter table dp_lessons add column if not exists subtitle text;

create table if not exists dp_lesson_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references dp_lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

alter table dp_lesson_bookmarks enable row level security;

-- Same ownership pattern as dp_lesson_progress: the student themselves, plus
-- super_admin and faculty for support/oversight purposes.
create policy dp_lesson_bookmarks_owner on dp_lesson_bookmarks for all using (
  user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
) with check (
  user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
);
