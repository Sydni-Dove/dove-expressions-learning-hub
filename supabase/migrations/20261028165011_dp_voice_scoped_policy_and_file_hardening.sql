-- Close legacy permissive-policy paths as well as primary SELECT policies.
create or replace function public.dp_has_scoped_role(check_role dp_role, p_area_id uuid default null, p_program_id uuid default null, p_cohort_id uuid default null, p_course_id uuid default null)
returns boolean language sql security definer stable set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from dp_role_assignments ra
 where ra.user_id=auth.uid() and ra.role=check_role
 and (ra.area_id is null or ra.area_id=p_area_id)
 and (ra.program_id is null or ra.program_id=p_program_id)
 and (ra.cohort_id is null or ra.cohort_id=p_cohort_id)
 and (ra.course_id is null or ra.course_id=p_course_id))
$$;
revoke all on function public.dp_has_scoped_role(dp_role,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.dp_has_scoped_role(dp_role,uuid,uuid,uuid,uuid) to authenticated;
create policy dp_module_scope_boundary on dp_modules as restrictive for all to authenticated
using(dp_can_access_course(course_id)) with check(dp_private.manage_course(course_id));
create policy dp_lesson_scope_boundary on dp_lessons as restrictive for all to authenticated
using(exists(select 1 from dp_modules m where m.id=module_id and
 (dp_private.manage_course(m.course_id) or (status='published' and dp_can_access_course(m.course_id)))))
with check(exists(select 1 from dp_modules m where m.id=module_id and dp_private.manage_course(m.course_id)));
create policy dp_course_scoped_management on dp_courses for update to authenticated
using(dp_private.manage_course(id)) with check(dp_private.manage_course(id));
create policy dp_course_update_boundary on dp_courses as restrictive for update to authenticated
using(dp_private.manage_course(id)) with check(dp_private.manage_course(id));
create policy dp_course_delete_boundary on dp_courses as restrictive for delete to authenticated
using(dp_private.manage_course(id));
create policy dp_private_file_read_boundary on storage.objects as restrictive for select to authenticated
using(bucket_id<>'course-media-private' or ((storage.foldername(name))[1]='lessons'
and exists(select 1 from dp_lessons l where l.id=dp_safe_uuid((storage.foldername(name))[2]))));
create policy dp_private_file_insert_boundary on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'course-media-private' or exists(select 1 from dp_lessons l join dp_modules m on m.id=l.module_id
where l.id=dp_safe_uuid((storage.foldername(name))[2]) and (storage.foldername(name))[1]='lessons' and dp_private.manage_course(m.course_id)));
create policy dp_private_file_update_boundary on storage.objects as restrictive for update to authenticated
using(bucket_id<>'course-media-private' or exists(select 1 from dp_lessons l join dp_modules m on m.id=l.module_id
where l.id=dp_safe_uuid((storage.foldername(name))[2]) and (storage.foldername(name))[1]='lessons' and dp_private.manage_course(m.course_id)))
with check(bucket_id<>'course-media-private' or exists(select 1 from dp_lessons l join dp_modules m on m.id=l.module_id
where l.id=dp_safe_uuid((storage.foldername(name))[2]) and (storage.foldername(name))[1]='lessons' and dp_private.manage_course(m.course_id)));
create policy dp_private_file_delete_boundary on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'course-media-private' or exists(select 1 from dp_lessons l join dp_modules m on m.id=l.module_id
where l.id=dp_safe_uuid((storage.foldername(name))[2]) and (storage.foldername(name))[1]='lessons' and dp_private.manage_course(m.course_id)));
-- Serialize initial submissions so double clicks cannot create multiple open attempts.
create or replace function dp_private.check_submission() returns trigger
language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and (new.student_id<>old.student_id or new.assignment_id<>old.assignment_id) then raise exception 'Submission ownership cannot be changed'; end if;
 if tg_op='INSERT' then
   perform pg_advisory_xact_lock(hashtext(new.assignment_id::text),hashtext(new.student_id::text));
   if exists(select 1 from dp_submissions where assignment_id=new.assignment_id and student_id=new.student_id) then
    raise exception 'An attempt already exists. Revise the returned submission instead.'; end if;
 end if;
 if not dp_private.manage_assignment(new.assignment_id) then
   if new.student_id<>auth.uid() or not dp_private.student_assignment(new.assignment_id) then raise exception 'Assignment unavailable'; end if;
   if tg_op='UPDATE' and old.status not in ('returned','revised') then raise exception 'Only returned work can be revised'; end if;
   if new.status not in ('submitted','revised') then raise exception 'Only instructors can review submissions'; end if;
 end if;
 new.updated_at=now();
 return new;
end $$;
revoke all on function dp_private.check_submission() from public,anon;
grant execute on function dp_private.check_submission() to authenticated;

