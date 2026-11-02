-- Voice intake, skill assessments, track choices, personalized development plans and progress checks.
--
-- ADDITIVE ONLY and NOT YET APPLIED. Apply after 20261030090000. Reuses dp_private.voice_member / manage_voice and dp_assign_weekly_plan
-- (20261029110000) for assigning practice, and dp_practice_recordings (20261030090000) for recorded demonstrations. Creates no duplicate
-- assignment, recording or feedback tables. Student spiritual information is private: student plus authorised Voice staff only.

-- ---------------------------------------------------------------------------
-- 0. Library exercises seeded from the curriculum must not be browsable by students until assigned.
-- ---------------------------------------------------------------------------
alter table dp_voice_exercises add column if not exists curriculum_key text unique;
alter table dp_voice_exercises add column if not exists visibility text not null default 'library' check(visibility in ('library','assigned_only'));
create policy dp_voice_exercises_visibility on dp_voice_exercises as restrictive for select to authenticated
 using(dp_private.manage_voice() or visibility='library');

-- ---------------------------------------------------------------------------
-- 1. Student profile: chosen optional tracks (student) and approved tracks (instructor). A track is used only when BOTH agree.
-- ---------------------------------------------------------------------------
create table dp_voice_profiles(
 student_id uuid primary key references auth.users(id) on delete cascade,
 selected_tracks text[] not null default '{}' check(selected_tracks <@ array['worship_leadership','spontaneous_expression','prophetic_worship']),
 approved_tracks text[] not null default '{}' check(approved_tracks <@ array['worship_leadership','spontaneous_expression','prophetic_worship']),
 tongues_requested boolean not null default false,
 updated_at timestamptz not null default now(), approved_by uuid references auth.users(id),
 check(approved_tracks <@ selected_tracks),
 check(not tongues_requested or 'prophetic_worship' = any(selected_tracks)));
alter table dp_voice_profiles enable row level security;
revoke all on dp_voice_profiles from anon,authenticated; grant select on dp_voice_profiles to authenticated;
create policy dp_voice_profiles_read on dp_voice_profiles for select to authenticated
 using((student_id=auth.uid() and dp_private.voice_member(auth.uid())) or dp_private.manage_voice());

create or replace function public.dp_voice_set_my_tracks(tracks text[], tongues boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare t text[]:=coalesce(tracks,'{}');
begin
 if auth.uid() is null or not dp_private.voice_member(auth.uid()) then raise exception 'Voice enrollment required'; end if;
 if not (t <@ array['worship_leadership','spontaneous_expression','prophetic_worship']) then raise exception 'Unknown track'; end if;
 insert into dp_voice_profiles(student_id,selected_tracks,tongues_requested) values(auth.uid(),t,coalesce(tongues,false) and 'prophetic_worship'=any(t))
 on conflict(student_id) do update set selected_tracks=excluded.selected_tracks,
  approved_tracks=array(select x from unnest(dp_voice_profiles.approved_tracks) x where x=any(excluded.selected_tracks)),
  tongues_requested=excluded.tongues_requested,updated_at=now();
end $$;
create or replace function public.dp_voice_approve_tracks(student uuid, tracks text[]) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 update dp_voice_profiles set approved_tracks=array(select x from unnest(coalesce(tracks,'{}')) x where x=any(selected_tracks)),approved_by=auth.uid(),updated_at=now() where student_id=student;
 if not found then raise exception 'The student has not chosen any tracks'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Post-consultation intake (goals and choices). SEPARATE from assessments. Hub form or Google Forms import.
-- ---------------------------------------------------------------------------
create table dp_voice_intakes(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 source text not null check(source in ('hub','google_forms_import')),
 answers jsonb not null default '{}' check(jsonb_typeof(answers)='object' and pg_column_size(answers)<65536),
 submitted_at timestamptz not null default now(), imported_by uuid references auth.users(id), created_at timestamptz not null default now());
create index dp_voice_intakes_student_idx on dp_voice_intakes(student_id,submitted_at desc);
alter table dp_voice_intakes enable row level security;
revoke all on dp_voice_intakes from anon,authenticated; grant select on dp_voice_intakes to authenticated;
create policy dp_voice_intakes_read on dp_voice_intakes for select to authenticated
 using((student_id=auth.uid() and dp_private.voice_member(auth.uid())) or dp_private.manage_voice());

create or replace function public.dp_voice_submit_intake(a jsonb, requested_tracks text[] default '{}') returns uuid
language plpgsql security definer set search_path=public as $$
declare iid uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not dp_private.voice_member(auth.uid()) then raise exception 'Voice enrollment required'; end if;
 insert into dp_voice_intakes(id,student_id,source,answers) values(iid,auth.uid(),'hub',a);
 perform public.dp_voice_set_my_tracks(requested_tracks, false);
 return iid;
end $$;
-- Staff import of a Google Forms row. The student's own form answer is recorded as their choice; it is NOT approval.
create or replace function public.dp_voice_import_intake(student uuid, a jsonb, requested_tracks text[] default '{}', submitted timestamptz default now()) returns uuid
language plpgsql security definer set search_path=public as $$
declare iid uuid:=gen_random_uuid(); t text[]:=coalesce(requested_tracks,'{}');
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 if not dp_private.voice_member(student) then raise exception 'That person is not enrolled in Voice'; end if;
 if not (t <@ array['worship_leadership','spontaneous_expression','prophetic_worship']) then raise exception 'Unknown track'; end if;
 insert into dp_voice_intakes(id,student_id,source,answers,submitted_at,imported_by) values(iid,student,'google_forms_import',a,coalesce(submitted,now()),auth.uid());
 insert into dp_voice_profiles(student_id,selected_tracks) values(student,t)
 on conflict(student_id) do update set selected_tracks=excluded.selected_tracks,
  approved_tracks=array(select x from unnest(dp_voice_profiles.approved_tracks) x where x=any(excluded.selected_tracks)),
  tongues_requested=dp_voice_profiles.tongues_requested and 'prophetic_worship'=any(excluded.selected_tracks),updated_at=now();
 return iid;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Assessments. Answers are the student's; observations and private notes are staff-only in a separate table.
-- ---------------------------------------------------------------------------
create table dp_voice_assessments(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('personal_time','creative_expression','hearing_god')),
 status text not null default 'assigned' check(status in ('assigned','in_progress','submitted','reviewed')),
 answers jsonb not null default '{}' check(jsonb_typeof(answers)='object' and pg_column_size(answers)<65536),
 shared_summary text check(shared_summary is null or length(shared_summary)<=4000), shared_at timestamptz,
 assigned_by uuid references auth.users(id), assigned_at timestamptz not null default now(),
 submitted_at timestamptz, reviewed_at timestamptz, updated_at timestamptz not null default now());
create unique index dp_voice_assessments_open_uq on dp_voice_assessments(student_id,kind) where status in ('assigned','in_progress');
create index dp_voice_assessments_student_idx on dp_voice_assessments(student_id,assigned_at desc);
create table dp_voice_assessment_private(
 assessment_id uuid primary key references dp_voice_assessments(id) on delete cascade,
 observations jsonb not null default '{}' check(jsonb_typeof(observations)='object'),
 notes text check(notes is null or length(notes)<=8000), reviewed_by uuid references auth.users(id), updated_at timestamptz not null default now());
alter table dp_voice_assessments enable row level security;
alter table dp_voice_assessment_private enable row level security;
revoke all on dp_voice_assessments,dp_voice_assessment_private from anon,authenticated;
grant select on dp_voice_assessments,dp_voice_assessment_private to authenticated;
create policy dp_voice_assessments_read on dp_voice_assessments for select to authenticated
 using((student_id=auth.uid() and dp_private.voice_member(auth.uid())) or dp_private.manage_voice());
create policy dp_voice_assessment_private_staff on dp_voice_assessment_private for select to authenticated using(dp_private.manage_voice());

create or replace function public.dp_assessment_assign(student uuid, assessment_kind text) returns uuid
language plpgsql security definer set search_path=public as $$
declare aid uuid:=gen_random_uuid(); prof dp_voice_profiles;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 if not dp_private.voice_member(student) then raise exception 'That person is not enrolled in Voice'; end if;
 if assessment_kind='hearing_god' then raise exception 'How Does God Speak to You? cannot be assigned until its source wording is supplied'; end if;
 if assessment_kind not in ('personal_time','creative_expression') then raise exception 'Unknown assessment'; end if;
 if assessment_kind='personal_time' then
  select * into prof from dp_voice_profiles where student_id=student;
  if not found or not 'prophetic_worship'=any(prof.selected_tracks) then raise exception 'Only students who chose Prophetic Worship Development can be given this'; end if;
 end if;
 insert into dp_voice_assessments(id,student_id,kind,assigned_by) values(aid,student,assessment_kind,auth.uid());
 return aid;
end $$;
create or replace function public.dp_assessment_save(aid uuid, a jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare k text; v text;
begin
 if jsonb_typeof(a)<>'object' then raise exception 'Answers must be an object'; end if;
 for k,v in select key,value #>> '{}' from jsonb_each(a) where key like 'd\_%' loop
  if coalesce(v,'')<>'' and not exists(select 1 from dp_practice_recordings r where r.id=dp_safe_uuid(v) and r.student_id=auth.uid() and r.status<>'discarded') then
   raise exception 'That recording is not yours';
  end if;
 end loop;
 update dp_voice_assessments set answers=a,status='in_progress',updated_at=now() where id=aid and student_id=auth.uid() and status in ('assigned','in_progress');
 if not found then raise exception 'This assessment is not open for editing'; end if;
end $$;
create or replace function public.dp_assessment_submit(aid uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 update dp_voice_assessments set status='submitted',submitted_at=now(),updated_at=now() where id=aid and student_id=auth.uid() and status in ('assigned','in_progress');
 if not found then raise exception 'This assessment is not open for submitting'; end if;
end $$;
create or replace function public.dp_assessment_review(aid uuid, obs jsonb, private_notes text, summary_for_student text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 update dp_voice_assessments set status='reviewed',reviewed_at=now(),updated_at=now(),
  shared_summary=nullif(btrim(summary_for_student),''),shared_at=case when nullif(btrim(summary_for_student),'') is null then null else now() end
 where id=aid and status in ('submitted','reviewed');
 if not found then raise exception 'Only a submitted assessment can be reviewed'; end if;
 insert into dp_voice_assessment_private(assessment_id,observations,notes,reviewed_by) values(aid,coalesce(obs,'{}'),private_notes,auth.uid())
 on conflict(assessment_id) do update set observations=excluded.observations,notes=excluded.notes,reviewed_by=excluded.reviewed_by,updated_at=now();
end $$;

-- ---------------------------------------------------------------------------
-- 4. Personalized development plans. Sample plans have no student and are never visible to students.
-- ---------------------------------------------------------------------------
create table dp_voice_plans(
 id uuid primary key default gen_random_uuid(),
 student_id uuid references auth.users(id) on delete cascade,
 is_sample boolean not null default false,
 title text not null check(length(btrim(title)) between 1 and 160),
 package_type text not null check(package_type in ('single','monthly','twelve_week')),
 status text not null default 'draft' check(status in ('draft','active','completed')),
 basis text[] not null default '{}', notes text[] not null default '{}',
 created_by uuid references auth.users(id), created_at timestamptz not null default now(), approved_at timestamptz,
 check((is_sample and student_id is null and status='draft') or (not is_sample and student_id is not null)));
create index dp_voice_plans_student_idx on dp_voice_plans(student_id,created_at desc);
create table dp_voice_plan_units(
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references dp_voice_plans(id) on delete cascade,
 seq int not null check(seq between 1 and 60), week int not null check(week between 1 and 60),
 area_key text not null, area_title text not null, level text not null check(level in ('beginner','intermediate','advanced')),
 objective text not null, exercise_keys text[] not null default '{}' check(cardinality(exercise_keys)<=12), assignment_key text,
 checkpoint text check(checkpoint in ('progress','midpoint','final')), follow_up text[] not null default '{}',
 segment_advice text not null default 'Record practice in 3–5 minute segments; save each part separately.',
 status text not null default 'planned' check(status in ('planned','assigned','done')),
 assigned_assignment_id uuid references dp_assignments(id) on delete set null,
 unique(plan_id,seq));
create table dp_voice_plan_private(
 plan_id uuid primary key references dp_voice_plans(id) on delete cascade,
 rationale jsonb not null default '{}', instructor_notes text check(instructor_notes is null or length(instructor_notes)<=8000), updated_at timestamptz not null default now());
alter table dp_voice_plans enable row level security; alter table dp_voice_plan_units enable row level security; alter table dp_voice_plan_private enable row level security;
revoke all on dp_voice_plans,dp_voice_plan_units,dp_voice_plan_private from anon,authenticated;
grant select on dp_voice_plans,dp_voice_plan_units,dp_voice_plan_private to authenticated;
create policy dp_voice_plans_read on dp_voice_plans for select to authenticated
 using(dp_private.manage_voice() or (not is_sample and status in ('active','completed') and student_id=auth.uid() and dp_private.voice_member(auth.uid())));
create policy dp_voice_plan_units_read on dp_voice_plan_units for select to authenticated using(exists(select 1 from dp_voice_plans p where p.id=plan_id));
create policy dp_voice_plan_private_staff on dp_voice_plan_private for select to authenticated using(dp_private.manage_voice());

create or replace function dp_private.area_track(area text) returns text language sql immutable as $$
 select case area when 'track-worship-leadership' then 'worship_leadership' when 'track-spontaneous-expression' then 'spontaneous_expression'
  when 'track-prophetic-worship' then 'prophetic_worship' else null end $$;

-- Creates or replaces a DRAFT plan's units. Units for an optional track need the student's choice AND the instructor's approval (samples are exempt).
create or replace function public.dp_plan_save(pid uuid, student uuid, plan_title text, ptype text, units jsonb, plan_basis text[], plan_notes text[], rationale jsonb, instructor_notes text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=coalesce(pid,gen_random_uuid()); u jsonb; prof dp_voice_profiles; tr text; cur dp_voice_plans;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 if jsonb_typeof(units)<>'array' or jsonb_array_length(units) not between 1 and 60 then raise exception 'A plan needs between 1 and 60 lessons'; end if;
 if student is not null and not dp_private.voice_member(student) then raise exception 'That person is not enrolled in Voice'; end if;
 if pid is not null then
  select * into cur from dp_voice_plans where dp_voice_plans.id=pid;
  if not found then raise exception 'Plan not found'; end if;
  if cur.status<>'draft' then raise exception 'Only a draft plan can be re-saved; add a progress check or a new plan instead'; end if;
 end if;
 if student is not null then select * into prof from dp_voice_profiles where student_id=student; end if;
 for u in select * from jsonb_array_elements(units) loop
  tr:=dp_private.area_track(u->>'area_key');
  if tr is not null and student is not null and not (prof.student_id is not null and tr=any(prof.selected_tracks) and tr=any(prof.approved_tracks)) then
   raise exception 'The % track needs the student''s choice and your approval first',tr;
  end if;
  if (u->'exercise_keys') ? 'optional-tongues' and not coalesce(prof.tongues_requested,false) then
   raise exception 'Singing in tongues can be included only when the student explicitly requested it';
  end if;
 end loop;
 insert into dp_voice_plans(id,student_id,is_sample,title,package_type,basis,notes,created_by)
 values(v_id,student,student is null,btrim(plan_title),ptype,coalesce(plan_basis,'{}'),coalesce(plan_notes,'{}'),auth.uid())
 on conflict(id) do update set title=excluded.title,package_type=excluded.package_type,basis=excluded.basis,notes=excluded.notes;
 delete from dp_voice_plan_units where plan_id=v_id;
 insert into dp_voice_plan_units(plan_id,seq,week,area_key,area_title,level,objective,exercise_keys,assignment_key,checkpoint,follow_up,segment_advice)
 select v_id,(x->>'seq')::int,(x->>'week')::int,x->>'area_key',x->>'area_title',x->>'level',x->>'objective',
  coalesce(array(select jsonb_array_elements_text(x->'exercise_keys')),'{}'),nullif(x->>'assignment_key',''),nullif(x->>'checkpoint',''),
  coalesce(array(select jsonb_array_elements_text(x->'follow_up')),'{}'),coalesce(nullif(x->>'segment_advice',''),'Record practice in 3–5 minute segments; save each part separately.')
 from jsonb_array_elements(units) x;
 insert into dp_voice_plan_private(plan_id,rationale,instructor_notes) values(v_id,coalesce(rationale,'{}'),instructor_notes)
 on conflict(plan_id) do update set rationale=excluded.rationale,instructor_notes=excluded.instructor_notes,updated_at=now();
 return v_id;
end $$;
create or replace function public.dp_plan_activate(pid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 update dp_voice_plans set status='active',approved_at=now() where id=pid and status='draft' and not is_sample;
 if not found then raise exception 'Only a student''s draft plan can be approved'; end if;
end $$;
-- Copies a sample into a draft for a real student; track rules are re-checked by dp_plan_save.
create or replace function public.dp_plan_copy_sample(sample uuid, student uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare p dp_voice_plans; us jsonb;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 select * into p from dp_voice_plans where id=sample and is_sample;
 if not found then raise exception 'Sample not found'; end if;
 select jsonb_agg(to_jsonb(u)-'id'-'plan_id'-'status'-'assigned_assignment_id' order by seq) into us from dp_voice_plan_units u where plan_id=sample;
 return public.dp_plan_save(null,student,p.title||' (draft for review)',p.package_type,us,p.basis,array_append(p.notes,'Copied from a sample pathway. Review every lesson before approving.'),'{}','Started from a sample, not from this student''s findings. Replace with observed findings.');
end $$;
-- Assigns one planned lesson's practice through the existing weekly-plan assignment (snapshot of the library exercises).
create or replace function public.dp_plan_assign_unit(uid uuid, due date) returns uuid language plpgsql security definer set search_path=public as $$
declare un dp_voice_plan_units; pl dp_voice_plans; prof dp_voice_profiles; items jsonb; aid uuid; missing int;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 select * into un from dp_voice_plan_units where id=uid; select * into pl from dp_voice_plans where id=un.plan_id;
 if un.id is null or pl.status<>'active' then raise exception 'Approve the plan before assigning practice'; end if;
 if un.assigned_assignment_id is not null then raise exception 'This lesson already has practice assigned'; end if;
 select * into prof from dp_voice_profiles where student_id=pl.student_id;
 if 'optional-tongues'=any(un.exercise_keys) and not coalesce(prof.tongues_requested,false) then raise exception 'Singing in tongues needs the student''s explicit request'; end if;
 if dp_private.area_track(un.area_key) is not null and not (dp_private.area_track(un.area_key)=any(coalesce(prof.selected_tracks,'{}')) and dp_private.area_track(un.area_key)=any(coalesce(prof.approved_tracks,'{}'))) then
  raise exception 'That track is not chosen and approved for this student'; end if;
 select jsonb_agg(jsonb_build_object('exercise_id',e.id) order by k.ord),count(*) filter (where e.id is null) into items,missing
 from unnest(un.exercise_keys) with ordinality k(key,ord) left join dp_voice_exercises e on e.curriculum_key=k.key and e.is_active;
 if items is null or missing>0 then raise exception 'An exercise in this lesson is not in the library yet'; end if;
 aid:=public.dp_assign_weekly_plan(pl.student_id,'Week '||un.week||': '||un.area_title,un.objective||E'\n'||un.segment_advice,un.objective,due,items);
 update dp_voice_plan_units set assigned_assignment_id=aid,status='assigned' where id=uid;
 return aid;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Progress checks. Private notes stay with staff; the student sees a check only after it is shared.
-- ---------------------------------------------------------------------------
create table dp_voice_progress_checks(
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references dp_voice_plans(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 week int not null check(week between 1 and 60), kind text not null check(kind in ('progress','midpoint','final','custom')),
 ratings jsonb not null default '{}' check(jsonb_typeof(ratings)='object'),
 strengths text check(strengths is null or length(strengths)<=4000), next_focus text check(next_focus is null or length(next_focus)<=4000),
 shared_at timestamptz, created_by uuid references auth.users(id), created_at timestamptz not null default now());
create table dp_voice_progress_check_private(check_id uuid primary key references dp_voice_progress_checks(id) on delete cascade, notes text check(notes is null or length(notes)<=8000));
alter table dp_voice_progress_checks enable row level security; alter table dp_voice_progress_check_private enable row level security;
revoke all on dp_voice_progress_checks,dp_voice_progress_check_private from anon,authenticated;
grant select on dp_voice_progress_checks,dp_voice_progress_check_private to authenticated;
create policy dp_voice_checks_read on dp_voice_progress_checks for select to authenticated
 using(dp_private.manage_voice() or (shared_at is not null and student_id=auth.uid() and dp_private.voice_member(auth.uid())));
create policy dp_voice_check_private_staff on dp_voice_progress_check_private for select to authenticated using(dp_private.manage_voice());
-- A saved check is never overwritten: each save is a new row, so earlier checks stay as the record of progress.
create or replace function public.dp_progress_check_save(pid uuid, wk int, check_kind text, rate jsonb, good text, focus text, private_notes text, share boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare cid uuid:=gen_random_uuid(); sid uuid;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 select student_id into sid from dp_voice_plans where id=pid and not is_sample and status in ('active','completed');
 if sid is null then raise exception 'Progress checks belong to an approved student plan'; end if;
 insert into dp_voice_progress_checks(id,plan_id,student_id,week,kind,ratings,strengths,next_focus,shared_at,created_by)
 values(cid,pid,sid,wk,check_kind,coalesce(rate,'{}'),good,focus,case when share then now() end,auth.uid());
 insert into dp_voice_progress_check_private(check_id,notes) values(cid,private_notes);
 return cid;
end $$;

revoke all on function public.dp_voice_set_my_tracks(text[],boolean),public.dp_voice_approve_tracks(uuid,text[]),public.dp_voice_submit_intake(jsonb,text[]),
 public.dp_voice_import_intake(uuid,jsonb,text[],timestamptz),public.dp_assessment_assign(uuid,text),public.dp_assessment_save(uuid,jsonb),
 public.dp_assessment_submit(uuid),public.dp_assessment_review(uuid,jsonb,text,text),
 public.dp_plan_save(uuid,uuid,text,text,jsonb,text[],text[],jsonb,text),public.dp_plan_activate(uuid),public.dp_plan_copy_sample(uuid,uuid),
 public.dp_plan_assign_unit(uuid,date),public.dp_progress_check_save(uuid,int,text,jsonb,text,text,text,boolean) from public,anon;
grant execute on function public.dp_voice_set_my_tracks(text[],boolean),public.dp_voice_approve_tracks(uuid,text[]),public.dp_voice_submit_intake(jsonb,text[]),
 public.dp_voice_import_intake(uuid,jsonb,text[],timestamptz),public.dp_assessment_assign(uuid,text),public.dp_assessment_save(uuid,jsonb),
 public.dp_assessment_submit(uuid),public.dp_assessment_review(uuid,jsonb,text,text),
 public.dp_plan_save(uuid,uuid,text,text,jsonb,text[],text[],jsonb,text),public.dp_plan_activate(uuid),public.dp_plan_copy_sample(uuid,uuid),
 public.dp_plan_assign_unit(uuid,date),public.dp_progress_check_save(uuid,int,text,jsonb,text,text,text,boolean) to authenticated;
