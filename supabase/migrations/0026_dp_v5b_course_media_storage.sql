-- v5b: Storage buckets for course/lesson media uploads.
--
-- ADDITIVE + NON-DESTRUCTIVE. Prior to this migration the platform had NO file
-- upload path at all — lessons could only reference external URLs (YouTube,
-- Vimeo, direct links). This adds file uploads, split across TWO buckets so that
-- protected teaching content never becomes anonymously, permanently downloadable.
--
-- No existing tables, rows, or objects are modified. Re-runnable: bucket inserts
-- are ON CONFLICT DO NOTHING and every policy is dropped-if-exists first.
--
-- ---------------------------------------------------------------------------
-- Why two buckets
-- ---------------------------------------------------------------------------
-- Supabase serves any object in a *public* bucket at a permanent, unauthenticated
-- URL that ignores RLS. That is fine for course cover images (they show on browse
-- surfaces to signed-out visitors) but WRONG for lesson videos, audio, workbooks,
-- worksheets, and resources — those must not leak past the lesson-access rules.
--
--   course-media          (PUBLIC)  — cover images / thumbnails only.
--   course-media-private  (PRIVATE) — lesson video, audio, workbooks, resources.
--
-- Private objects are never given a public URL. The app stores a storage:// path
-- reference and mints a short-lived SIGNED URL server-side at render time. Signing
-- goes through the caller's own session, so it is subject to the private-bucket
-- SELECT policy below.
--
-- ---------------------------------------------------------------------------
-- How the private read rule preserves existing lesson access
-- ---------------------------------------------------------------------------
-- Private objects are uploaded under a path that starts with the owning lesson:
--     lessons/<lessonId>/video|audio|workbooks|resources/<file>
-- The SELECT policy extracts <lessonId> from the path and checks that the caller
-- can read that lesson ROW — i.e. `exists (select 1 from dp_lessons where id = ...)`.
-- Because that inner select is itself subject to dp_lessons' RLS
-- (dp_lessons_read_published: status='published' OR super_admin OR faculty OR
-- teacher-of-course), media access inherits the EXACT current lesson-access rule,
-- and will automatically inherit any future tightening (e.g. an enrollment gate
-- added to dp_lessons) with no change here. Draft / coming_soon lessons are
-- readable only by staff, so their media is signable only by staff.

-- ---------------------------------------------------------------------------
-- Helper: parse a uuid without throwing on malformed path segments.
-- ---------------------------------------------------------------------------
create or replace function dp_safe_uuid(t text)
returns uuid
language plpgsql
immutable
as $$
begin
  return t::uuid;
exception
  when others then
    return null;
end;
$$;

-- ===========================================================================
-- PUBLIC bucket: cover images / thumbnails only.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('course-media', 'course-media', true)
on conflict (id) do nothing;

drop policy if exists "course_media_public_read" on storage.objects;
create policy "course_media_public_read"
  on storage.objects for select
  using (bucket_id = 'course-media');

drop policy if exists "course_media_staff_insert" on storage.objects;
create policy "course_media_staff_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-media'
    and (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher'))
  );

drop policy if exists "course_media_staff_update" on storage.objects;
create policy "course_media_staff_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'course-media'
    and (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher'))
  )
  with check (
    bucket_id = 'course-media'
    and (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher'))
  );

drop policy if exists "course_media_staff_delete" on storage.objects;
create policy "course_media_staff_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'course-media'
    and (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher'))
  );

-- ===========================================================================
-- PRIVATE bucket: protected lesson media. No public URL is ever issued.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('course-media-private', 'course-media-private', false)
on conflict (id) do nothing;

-- READ: caller must be able to read the owning lesson row (path = lessons/<id>/...).
-- Staff can also always read (covers non-'lessons/...' paths and unpublished work).
drop policy if exists "course_media_private_read" on storage.objects;
create policy "course_media_private_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'course-media-private'
    and (
      dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher')
      or (
        (storage.foldername(name))[1] = 'lessons'
        and exists (
          select 1 from dp_lessons l
          where l.id = dp_safe_uuid((storage.foldername(name))[2])
        )
      )
    )
  );

-- WRITE (insert/update/delete): staff only.
drop policy if exists "course_media_private_staff_insert" on storage.objects;
create policy "course_media_private_staff_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-media-private'
    and (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher'))
  );

drop policy if exists "course_media_private_staff_update" on storage.objects;
create policy "course_media_private_staff_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'course-media-private'
    and (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher'))
  )
  with check (
    bucket_id = 'course-media-private'
    and (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher'))
  );

drop policy if exists "course_media_private_staff_delete" on storage.objects;
create policy "course_media_private_staff_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'course-media-private'
    and (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher'))
  );
