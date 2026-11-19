-- Voice coaching: extends existing assignments, submissions and feedback.
-- No enrollment changes or content publication. Apply only to verified project.
create schema if not exists dp_private;
revoke all on schema dp_private from public;
grant usage on schema dp_private to authenticated;

create or replace function dp_private.manage_course(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select auth.uid() is not null and exists(select 1 from dp_courses c where c.id=cid and (
 dp_is_super_admin() or dp_has_role('faculty') or dp_is_teacher_of_course(c.id)
 or dp_has_scoped_role('faculty',c.area_id,c.program_id,null,c.id)
 or dp_has_scoped_role('teacher',c.area_id,c.program_id,null,c.id)))
$$;
create or replace function dp_private.enrolled_course(cid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select auth.uid() is not null and exists(select 1 from dp_courses c join dp_enrollments e on e.user_id=uid
 where c.id=cid and e.status in ('active','completed') and (
 (e.scope_type='course' and e.scope_id=c.id) or (e.scope_type='program' and e.scope_id=c.program_id)
 or (e.scope_type='track' and e.scope_id=c.track_id)
 or (e.scope_type='cohort' and exists(select 1 from dp_cohorts h where h.id=e.scope_id
 and (h.program_id=c.program_id or h.track_id=c.track_id)))))
$$;
create or replace function public.dp_can_access_course(target_course_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select auth.uid() is not null and (dp_private.manage_course(target_course_id) or exists(
 select 1 from dp_courses c where c.id=target_course_id and c.is_published and (
 dp_private.enrolled_course(c.id,auth.uid()) or (c.program_id is null and c.access_mode='open'))))
$$;
revoke all on function public.dp_can_access_course(uuid) from public,anon;
grant execute on function public.dp_can_access_course(uuid) to authenticated;

-- Restrictive policies also constrain older permissive policies left by prior releases.
create policy dp_courses_program_boundary on dp_courses as restrictive for select to authenticated
 using (dp_can_access_course(id));
drop policy if exists dp_lessons_read_published on dp_lessons;
create policy dp_lessons_read_published on dp_lessons for select to authenticated using (
 exists(select 1 from dp_modules m where m.id=module_id and
 (dp_private.manage_course(m.course_id) or (status='published' and dp_can_access_course(m.course_id)))));

alter table dp_assignments add column if not exists song text;
alter table dp_assignments add column if not exists goal text;
alter table dp_assignments add column if not exists pacing text;
alter table dp_assignments add column if not exists practice_steps text[] not null default '{}';

create or replace function dp_private.manage_assignment(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select auth.uid() is not null and exists(select 1 from dp_assignments a where a.id=aid and (
 dp_private.manage_course(a.course_id) or (a.course_id is null and
 (dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(a.assigned_to_user_id)))))
$$;
create or replace function dp_private.student_assignment(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select auth.uid() is not null and exists(select 1 from dp_assignments a where a.id=aid
 and (a.assigned_to_user_id is null or a.assigned_to_user_id=auth.uid())
 and (a.assigned_to_cohort_id is null or exists(select 1 from dp_enrollments e where e.user_id=auth.uid()
 and e.scope_type='cohort' and e.scope_id=a.assigned_to_cohort_id and e.status='active'))
 and ((a.course_id is null and a.assigned_to_user_id=auth.uid()) or
 (dp_private.enrolled_course(a.course_id,auth.uid()) and dp_can_access_course(a.course_id)))
 and (a.lesson_id is null or exists(select 1 from dp_lessons l where l.id=a.lesson_id and l.status='published')))
$$;
drop policy if exists dp_assignments_select on dp_assignments;
create policy dp_assignments_select on dp_assignments for select to authenticated using (
 dp_private.manage_assignment(id) or dp_private.student_assignment(id));
create policy dp_assignments_boundary on dp_assignments as restrictive for all to authenticated
 using (dp_private.manage_assignment(id) or dp_private.student_assignment(id))
 with check (dp_private.manage_course(course_id) or (course_id is null and
 (dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(assigned_to_user_id))));
-- Scoped course staff can manage assignments without global staff permissions.
create policy dp_assignments_scoped_write on dp_assignments for all to authenticated
 using (dp_private.manage_course(course_id)) with check (dp_private.manage_course(course_id));

create or replace function dp_private.check_assignment() returns trigger
language plpgsql set search_path = public as $$
begin
 if new.lesson_id is not null and not exists(select 1 from dp_lessons l join dp_modules m on m.id=l.module_id
 where l.id=new.lesson_id and m.course_id=new.course_id) then raise exception 'Lesson and course must match'; end if;
 if new.course_id is not null and new.assigned_to_user_id is not null
 and not dp_private.enrolled_course(new.course_id,new.assigned_to_user_id) then
 raise exception 'Student must already be enrolled in this course or program'; end if;
 return new;
end $$;
create trigger dp_assignment_scope_check before insert or update on dp_assignments
 for each row execute function dp_private.check_assignment();

-- A draft practice record is distinct from a submitted attempt, and reuses its assignment.
create table dp_assignment_progress (
 assignment_id uuid not null references dp_assignments(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 checked_steps integer[] not null default '{}',
 minutes integer not null default 0 check(minutes between 0 and 1440),
 response text not null default '', recording_url text not null default '',
 updated_at timestamptz not null default now(),
 primary key(assignment_id,student_id)
);
alter table dp_assignment_progress enable row level security;
grant select,insert,update on dp_assignment_progress to authenticated;
create policy dp_practice_read on dp_assignment_progress for select to authenticated using (
 (student_id=auth.uid() and dp_private.student_assignment(assignment_id)) or dp_private.manage_assignment(assignment_id));
create policy dp_practice_insert on dp_assignment_progress for insert to authenticated with check (
 student_id=auth.uid() and dp_private.student_assignment(assignment_id));
create policy dp_practice_update on dp_assignment_progress for update to authenticated using (
 student_id=auth.uid() and dp_private.student_assignment(assignment_id)) with check (
 student_id=auth.uid() and dp_private.student_assignment(assignment_id));

create policy dp_submission_boundary on dp_submissions as restrictive for all to authenticated using (
 (student_id=auth.uid() and dp_private.student_assignment(assignment_id)) or dp_private.manage_assignment(assignment_id))
 with check ((student_id=auth.uid() and dp_private.student_assignment(assignment_id)) or dp_private.manage_assignment(assignment_id));
create policy dp_submission_scoped_staff on dp_submissions for all to authenticated using (
 dp_private.manage_assignment(assignment_id)) with check (dp_private.manage_assignment(assignment_id));
create or replace function dp_private.check_submission() returns trigger
language plpgsql set search_path = public as $$
begin
 if tg_op='UPDATE' and (new.student_id<>old.student_id or new.assignment_id<>old.assignment_id) then
 raise exception 'Submission ownership cannot be changed'; end if;
 if not dp_private.manage_assignment(new.assignment_id) then
   if new.student_id<>auth.uid() or not dp_private.student_assignment(new.assignment_id) then raise exception 'Assignment unavailable'; end if;
   if tg_op='UPDATE' and old.status not in ('returned','revised') then raise exception 'Only returned work can be revised'; end if;
   if new.status not in ('submitted','revised') then raise exception 'Only instructors can review submissions'; end if;
 end if;
 new.updated_at=now();
 return new;
end $$;
create trigger dp_submission_review_guard before insert or update on dp_submissions
 for each row execute function dp_private.check_submission();

create policy dp_feedback_boundary on dp_feedback as restrictive for all to authenticated using (
 exists(select 1 from dp_submissions s where s.id=submission_id and (
 dp_private.manage_assignment(s.assignment_id) or (s.student_id=auth.uid() and not is_private))))
 with check (author_id=auth.uid() and exists(select 1 from dp_submissions s where s.id=submission_id
 and dp_private.manage_assignment(s.assignment_id)));
create policy dp_feedback_scoped_staff on dp_feedback for all to authenticated using (
 exists(select 1 from dp_submissions s where s.id=submission_id and dp_private.manage_assignment(s.assignment_id)))
 with check (author_id=auth.uid() and exists(select 1 from dp_submissions s where s.id=submission_id
 and dp_private.manage_assignment(s.assignment_id)));

create or replace function public.dp_review_submission(target_id uuid, feedback_text text, next_status dp_submission_status)
returns void language plpgsql security invoker set search_path = public as $$
declare aid uuid;
begin
 select assignment_id into aid from dp_submissions where id=target_id for update;
 if auth.uid() is null or aid is null or not dp_private.manage_assignment(aid) then raise exception 'Review not authorized'; end if;
 if next_status not in ('approved','returned','exempt') or length(trim(feedback_text))=0 then raise exception 'Choose an outcome and write feedback'; end if;
 insert into dp_feedback(submission_id,author_id,content,is_private) values(target_id,auth.uid(),trim(feedback_text),false);
 update dp_submissions set status=next_status where id=target_id;
end $$;
revoke all on function public.dp_review_submission(uuid,text,dp_submission_status) from public,anon;
grant execute on function public.dp_review_submission(uuid,text,dp_submission_status) to authenticated;

create policy dp_progress_lesson_boundary on dp_lesson_progress as restrictive for all to authenticated using (
 exists(select 1 from dp_lessons l where l.id=lesson_id)) with check (
 exists(select 1 from dp_lessons l where l.id=lesson_id));

-- Never return a row containing private faculty notes to a student, even via REST.
create policy dp_sessions_private_boundary on dp_sessions as restrictive for select to authenticated using (
 dp_is_super_admin() or dp_has_role('faculty') or mentor_id=auth.uid());
alter table dp_sessions add column if not exists program_id uuid references dp_programs(id);
create or replace function public.dp_my_session_summaries(target_program_slug text)
returns table(id uuid,scheduled_at timestamptz,session_type dp_session_type,student_visible_notes text,follow_up_date date)
language sql stable security definer set search_path = public as $$
 select s.id,s.scheduled_at,s.session_type,s.student_visible_notes,s.follow_up_date
 from dp_sessions s join dp_programs p on p.id=s.program_id
 where auth.uid() is not null and s.student_id=auth.uid() and p.slug=target_program_slug
 and exists(select 1 from dp_enrollments e where e.user_id=auth.uid() and e.status in ('active','completed')
 and ((e.scope_type='program' and e.scope_id=p.id) or (e.scope_type='course' and e.scope_id in
 (select c.id from dp_courses c where c.program_id=p.id))))
$$;
revoke all on function public.dp_my_session_summaries(text) from public,anon;
grant execute on function public.dp_my_session_summaries(text) to authenticated;

create or replace function public.dp_course_students(target_course_id uuid)
returns table(id uuid,full_name text) language sql stable security definer set search_path=public as $$
 select p.id,p.full_name from profiles p where auth.uid() is not null and dp_private.manage_course(target_course_id)
 and dp_private.enrolled_course(target_course_id,p.id)
$$;
revoke all on function public.dp_course_students(uuid) from public,anon;
grant execute on function public.dp_course_students(uuid) to authenticated;

revoke all on all functions in schema dp_private from public,anon;
grant execute on all functions in schema dp_private to authenticated;
-- Existing private lesson files inherit the tightened lesson policies.
-- Existing public course-media is reserved for covers; never store practice there.

-- Program-linked notes must pass the same content boundary as lessons.
create policy dp_notes_program_boundary on dp_notes as restrictive for all to authenticated using (
 linked_type is null or linked_type not in ('lesson','course','program')
 or (linked_type='lesson' and exists(select 1 from dp_lessons l where l.id=linked_id))
 or (linked_type='course' and dp_can_access_course(linked_id))
 or (linked_type='program' and exists(select 1 from dp_courses c where c.program_id=linked_id and dp_can_access_course(c.id)))
) with check (
 linked_type is null or linked_type not in ('lesson','course','program')
 or (linked_type='lesson' and exists(select 1 from dp_lessons l where l.id=linked_id))
 or (linked_type='course' and dp_can_access_course(linked_id))
 or (linked_type='program' and exists(select 1 from dp_courses c where c.program_id=linked_id and dp_can_access_course(c.id)))
);
create or replace function dp_private.manage_session(sid uuid, pid uuid, mid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (
 dp_is_super_admin() or dp_has_role('faculty')
 or (mid=auth.uid() and dp_is_mentor_of(sid))
 or exists(select 1 from dp_courses c where c.program_id=pid
 and dp_private.enrolled_course(c.id,sid) and dp_private.manage_course(c.id)))
$$;
create policy dp_sessions_write_boundary on dp_sessions as restrictive for all to authenticated
 using (dp_private.manage_session(student_id,program_id,mentor_id))
 with check (dp_private.manage_session(student_id,program_id,mentor_id));
-- Scoped instructors need the permissive grant as well as the restrictive boundary.
create policy dp_sessions_scoped_staff on dp_sessions for all to authenticated
 using (dp_private.manage_session(student_id,program_id,mentor_id))
 with check (dp_private.manage_session(student_id,program_id,mentor_id));
-- Replace the earlier SELECT restriction to include scoped course instructors.
drop policy dp_sessions_private_boundary on dp_sessions;
create policy dp_sessions_private_boundary on dp_sessions as restrictive for select to authenticated
 using (dp_private.manage_session(student_id,program_id,mentor_id));
create or replace function public.dp_student_session_programs(target_student_id uuid)
returns table(id uuid,name text) language sql stable security definer set search_path=public as $$
 select p.id,p.name from dp_programs p where auth.uid() is not null
 and dp_private.manage_session(target_student_id,p.id,auth.uid())
 and (exists(select 1 from dp_enrollments e where e.user_id=target_student_id and e.status='active'
 and e.scope_type='program' and e.scope_id=p.id)
 or exists(select 1 from dp_courses c where c.program_id=p.id and dp_private.enrolled_course(c.id,target_student_id)))
$$;
revoke all on function public.dp_student_session_programs(uuid) from public,anon;
grant execute on function public.dp_student_session_programs(uuid) to authenticated;
revoke all on function dp_private.manage_session(uuid,uuid,uuid) from public,anon;
grant execute on function dp_private.manage_session(uuid,uuid,uuid) to authenticated;
create index if not exists dp_assignment_progress_student_idx on dp_assignment_progress(student_id);
create index if not exists dp_submissions_assignment_student_idx on dp_submissions(assignment_id,student_id);
create index if not exists dp_feedback_submission_idx on dp_feedback(submission_id);
