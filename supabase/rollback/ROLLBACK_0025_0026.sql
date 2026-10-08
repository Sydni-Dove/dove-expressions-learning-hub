-- Rollback for migrations 0025 (Dreams & Visions seed) and 0026 (course media storage).
-- NOT run automatically. Run 0027/0028 rollback FIRST if they were applied.
begin;

-- 0025: remove the seeded course. Modules, lessons and blocks go with it (ON DELETE CASCADE).
-- Only deletes the seeded course (slug + track_key), never a hand-made one.
-- Student progress/bookmarks/reflections on those lessons would cascade too — there should be none
-- because every seeded lesson is draft/coming_soon.
delete from dp_courses where slug = 'dreams-and-visions' and track_key = 'dreams_visions';

-- 0026: drop the storage policies and helper.
drop policy if exists "course_media_public_read" on storage.objects;
drop policy if exists "course_media_staff_insert" on storage.objects;
drop policy if exists "course_media_staff_update" on storage.objects;
drop policy if exists "course_media_staff_delete" on storage.objects;
drop policy if exists "course_media_private_read" on storage.objects;
drop policy if exists "course_media_private_staff_insert" on storage.objects;
drop policy if exists "course_media_private_staff_update" on storage.objects;
drop policy if exists "course_media_private_staff_delete" on storage.objects;
drop function if exists dp_safe_uuid(text);

-- The two buckets are intentionally NOT deleted here: Supabase refuses to delete a bucket that
-- still contains files, and deleting uploaded course media is irreversible. If both buckets are
-- empty you can remove them from Dashboard -> Storage, or:
--   delete from storage.buckets where id in ('course-media','course-media-private');
commit;
