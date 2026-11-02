-- Worship Development teachings: a reusable library of instructor-led teaching modules inside the Voice program.
-- ADDITIVE ONLY and NOT YET APPLIED. Nothing is assigned or enrolled automatically.
--  * dp_voice_teaching_modules         student-facing content. Visible to staff, and to a student ONLY once the instructor assigned that module to them.
--  * dp_voice_teaching_module_private  instructor-only teaching notes (staff only, never visible to students).
--  * dp_assignments.teaching_module_id links an assignment to a module, so progress, submissions, feedback and review reuse the existing workflow.
-- Assigning is an instructor action (dp_assign_teaching_module) and follows the existing payment gate: new practice requires verified payment.

create table dp_voice_teaching_modules(
 id uuid primary key default gen_random_uuid(),
 key text not null unique check(key ~ '^[a-z0-9-]+$'),
 area text not null default 'worship_development' check(area in ('worship_development')),
 module_number int not null check(module_number between 1 and 99),
 title text not null check(length(btrim(title))>0),
 summary text,
 main_message text,
 estimated_minutes int check(estimated_minutes is null or estimated_minutes between 5 and 180),
 student_content jsonb not null default '{}' check(jsonb_typeof(student_content)='object'),
 is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table dp_voice_teaching_module_private(
 module_id uuid primary key references dp_voice_teaching_modules(id) on delete cascade,
 instructor_notes jsonb not null default '{}' check(jsonb_typeof(instructor_notes)='object'));

alter table dp_assignments add column teaching_module_id uuid references dp_voice_teaching_modules(id) on delete restrict;
create unique index dp_assignments_teaching_once on dp_assignments(assigned_to_user_id, teaching_module_id) where teaching_module_id is not null;

create or replace function dp_private.teaching_assigned(mid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from dp_assignments a where a.teaching_module_id=mid and a.assigned_to_user_id=auth.uid())
$$;

alter table dp_voice_teaching_modules enable row level security;
alter table dp_voice_teaching_module_private enable row level security;
create policy dp_voice_teaching_modules_read on dp_voice_teaching_modules for select to authenticated
 using (dp_private.manage_voice() or (dp_private.voice_member(auth.uid()) and dp_private.teaching_assigned(id)));
create policy dp_voice_teaching_private_read on dp_voice_teaching_module_private for select to authenticated using (dp_private.manage_voice());
-- No write policies: content changes ship through migrations, so students and teachers cannot alter the teaching text.
revoke all on dp_voice_teaching_modules, dp_voice_teaching_module_private from anon;
grant select on dp_voice_teaching_modules, dp_voice_teaching_module_private to authenticated;

-- Assign ONE module to ONE student. Instructor only; the student must be a Voice member; payment gate applies through the existing trigger.
create or replace function public.dp_assign_teaching_module(student uuid, module_key text, due date default null, note text default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare m dp_voice_teaching_modules%rowtype; aid uuid; a jsonb;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Teaching assignment not authorized'; end if;
 if not dp_private.voice_member(student) then raise exception 'Student is not enrolled in Voice'; end if;
 select * into m from dp_voice_teaching_modules where key=module_key and is_active;
 if not found then raise exception 'That teaching module is not available'; end if;
 if exists(select 1 from dp_assignments where assigned_to_user_id=student and teaching_module_id=m.id) then raise exception 'This teaching is already assigned to this student'; end if;
 a:=m.student_content->'assignment';
 aid:=gen_random_uuid();
 insert into dp_assignments(id,course_id,lesson_id,assigned_to_user_id,title,description,assignment_type,due_at,goal,practice_steps,practice_items,teaching_module_id,created_by)
 values(aid,null,null,student,m.title,
  nullif(btrim(coalesce(note,'')||E'\n\nOpen the teaching under Worship Development in your Voice area, then complete the take-home assignment below.'),''),
  'written',case when due is null then null else (due::timestamp+time '23:59:59') at time zone 'UTC' end,
  m.main_message,
  array(select jsonb_array_elements_text(a->'steps')),
  jsonb_build_array(jsonb_build_object('title',a->>'title','instructions',a->>'summary','minutes',(a->>'minutes')::int,'module_key',m.key)),
  m.id,auth.uid());
 return aid;
end $$;
revoke all on function public.dp_assign_teaching_module(uuid,text,date,text) from public,anon;
grant execute on function public.dp_assign_teaching_module(uuid,text,date,text) to authenticated;
-- Only the new helper is granted (the policy above calls it as the signed-in user); no other function's permissions are touched.
revoke all on function dp_private.teaching_assigned(uuid) from public,anon;
grant execute on function dp_private.teaching_assigned(uuid) to authenticated;
