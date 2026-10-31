-- Controlled editing of approved plans (with version history), structured progress ratings, safe/mapped intake imports,
-- recording-feedback follow-up assignments, and sample-to-draft safeguards.
--
-- ADDITIVE ONLY and NOT YET APPLIED. Apply after 20261030110000. It replaces (create or replace / drop+create) only functions that were
-- introduced by the still-unapplied 20261030100000, so nothing already on the live project is redefined.

-- ---------------------------------------------------------------------------
-- 1. Plan versions and controlled revision of an approved plan
-- ---------------------------------------------------------------------------
alter table dp_voice_plans add column if not exists version_no int not null default 1 check(version_no>=1);
alter table dp_voice_plans add column if not exists source_sample_id uuid references dp_voice_plans(id) on delete set null;
alter table dp_voice_plans add column if not exists sample_reviewed_at timestamptz;
-- Lesson numbers can be re-ordered inside one revision; uniqueness is checked at the end of the statement/transaction.
alter table dp_voice_plan_units drop constraint if exists dp_voice_plan_units_plan_id_seq_key;
alter table dp_voice_plan_units add constraint dp_voice_plan_units_plan_id_seq_key unique(plan_id,seq) deferrable initially deferred;

create table dp_voice_plan_versions(
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references dp_voice_plans(id) on delete cascade,
 version_no int not null, snapshot jsonb not null, reason text not null check(length(btrim(reason)) between 1 and 1000),
 changed_by uuid references auth.users(id), created_at timestamptz not null default now(),
 unique(plan_id,version_no));
alter table dp_voice_plan_versions enable row level security;
revoke all on dp_voice_plan_versions from anon,authenticated; grant select on dp_voice_plan_versions to authenticated;
create policy dp_voice_plan_versions_staff on dp_voice_plan_versions for select to authenticated using(dp_private.manage_voice());

create or replace function dp_private.plan_snapshot(pid uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('title',p.title,'package_type',p.package_type,'notes',to_jsonb(p.notes),
  'units',coalesce((select jsonb_agg(to_jsonb(u)-'plan_id' order by u.seq) from dp_voice_plan_units u where u.plan_id=p.id),'[]'::jsonb))
 from dp_voice_plans p where p.id=pid $$;

-- An optional-track or request-only exercise is allowed only when the student chose AND the instructor approved it (or the student asked).
create or replace function dp_private.area_allowed(student uuid, area text, keys text[]) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare prof dp_voice_profiles; tr text:=dp_private.area_track(area);
begin
 select * into prof from dp_voice_profiles where student_id=student;
 if tr is not null and not (prof.student_id is not null and tr=any(prof.selected_tracks) and tr=any(prof.approved_tracks)) then return false; end if;
 if 'optional-tongues'=any(coalesce(keys,'{}')) and not coalesce(prof.tongues_requested,false) then return false; end if;
 return true;
end $$;

create or replace function public.dp_plan_revise(pid uuid, units jsonb, reason text, plan_notes text[] default null) returns int
language plpgsql security definer set search_path=public as $$
declare pl dp_voice_plans; locked record; u jsonb; incoming_ids uuid[]; n int; cur dp_voice_plan_units;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 select * into pl from dp_voice_plans where id=pid for update;
 if not found or pl.is_sample or pl.status<>'active' then raise exception 'Only an approved, active student plan can be revised'; end if;
 if length(btrim(coalesce(reason,'')))=0 then raise exception 'Say why the plan is changing'; end if;
 if jsonb_typeof(units)<>'array' or jsonb_array_length(units) not between 1 and 60 then raise exception 'A plan needs between 1 and 60 lessons'; end if;
 select coalesce(array_agg((x->>'id')::uuid) filter (where x ? 'id' and nullif(x->>'id','') is not null),'{}') into incoming_ids from jsonb_array_elements(units) x;
 if exists(select 1 from unnest(incoming_ids) i where not exists(select 1 from dp_voice_plan_units uu where uu.id=i and uu.plan_id=pid)) then raise exception 'A lesson does not belong to this plan'; end if;
 -- Lessons already assigned or done are the student's record: they must come back unchanged and cannot be removed.
 for locked in select * from dp_voice_plan_units where plan_id=pid and (status<>'planned' or assigned_assignment_id is not null) loop
  select x into u from jsonb_array_elements(units) x where (x->>'id')::uuid=locked.id limit 1;
  if u is null then raise exception 'Lesson % has practice assigned or is done, so it cannot be removed',locked.week; end if;
  if u->>'area_key'<>locked.area_key or u->>'level'<>locked.level or u->>'objective'<>locked.objective
   or coalesce(array(select jsonb_array_elements_text(u->'exercise_keys')),'{}')<>locked.exercise_keys or (u->>'week')::int<>locked.week then
   raise exception 'Lesson % has practice assigned or is done, so it cannot be changed',locked.week;
  end if;
 end loop;
 for u in select * from jsonb_array_elements(units) loop
  if not dp_private.area_allowed(pl.student_id,u->>'area_key',coalesce(array(select jsonb_array_elements_text(u->'exercise_keys')),'{}')) then
   raise exception 'A lesson uses an optional track or exercise the student has not chosen and you have not approved';
  end if;
 end loop;
 -- Keep the first approved state as version 1 the first time a plan is revised, then every state that is replaced.
 insert into dp_voice_plan_versions(plan_id,version_no,snapshot,reason,changed_by)
 values(pid,pl.version_no,dp_private.plan_snapshot(pid),case when pl.version_no=1 then 'As approved' else 'Replaced by revision' end||': '||btrim(reason),auth.uid());
 delete from dp_voice_plan_units where plan_id=pid and status='planned' and assigned_assignment_id is null and not (id=any(incoming_ids));
 for u in select * from jsonb_array_elements(units) loop
  if nullif(u->>'id','') is not null then
   select * into cur from dp_voice_plan_units where id=(u->>'id')::uuid;
   if cur.status='planned' and cur.assigned_assignment_id is null then
    update dp_voice_plan_units set seq=(u->>'seq')::int,week=(u->>'week')::int,area_key=u->>'area_key',area_title=u->>'area_title',level=u->>'level',objective=u->>'objective',
     exercise_keys=coalesce(array(select jsonb_array_elements_text(u->'exercise_keys')),'{}'),assignment_key=nullif(u->>'assignment_key',''),checkpoint=nullif(u->>'checkpoint',''),
     follow_up=coalesce(array(select jsonb_array_elements_text(u->'follow_up')),'{}') where id=cur.id;
   else update dp_voice_plan_units set seq=(u->>'seq')::int where id=cur.id; end if;
  else
   insert into dp_voice_plan_units(plan_id,seq,week,area_key,area_title,level,objective,exercise_keys,assignment_key,checkpoint,follow_up,segment_advice)
   values(pid,(u->>'seq')::int,(u->>'week')::int,u->>'area_key',u->>'area_title',u->>'level',u->>'objective',
    coalesce(array(select jsonb_array_elements_text(u->'exercise_keys')),'{}'),nullif(u->>'assignment_key',''),nullif(u->>'checkpoint',''),
    coalesce(array(select jsonb_array_elements_text(u->'follow_up')),'{}'),coalesce(nullif(u->>'segment_advice',''),'Record practice in 3–5 minute segments; save each part separately.'));
  end if;
 end loop;
 update dp_voice_plans set version_no=version_no+1,notes=coalesce(plan_notes,notes) where id=pid returning version_no into n;
 return n;
end $$;

create or replace function public.dp_plan_unit_set_status(uid uuid, new_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 if new_status<>'done' then raise exception 'A lesson can only be marked done'; end if;
 update dp_voice_plan_units u set status='done' from dp_voice_plans p where u.id=uid and p.id=u.plan_id and p.status='active' and not p.is_sample and u.status in ('planned','assigned');
 if not found then raise exception 'That lesson cannot be marked done'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Sample pathways never become a student's plan on their own
-- ---------------------------------------------------------------------------
create or replace function public.dp_plan_copy_sample(sample uuid, student uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare p dp_voice_plans; us jsonb; kept jsonb; dropped int; newid uuid;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 select * into p from dp_voice_plans where id=sample and is_sample;
 if not found then raise exception 'Sample not found'; end if;
 if not dp_private.voice_member(student) then raise exception 'That person is not enrolled in Voice'; end if;
 select jsonb_agg(to_jsonb(u)-'id'-'plan_id'-'status'-'assigned_assignment_id' order by seq) into us from dp_voice_plan_units u where plan_id=sample;
 -- Keep only lessons this student may have: optional-track lessons need their choice AND your approval; request-only exercises need their request.
 select jsonb_agg(x-'seq'-'week' || jsonb_build_object('seq',r,'week',r) order by r), count(*) into kept, dropped from (
  select x, row_number() over (order by (x->>'seq')::int) r from jsonb_array_elements(us) x
  where dp_private.area_allowed(student,x->>'area_key',coalesce(array(select jsonb_array_elements_text(x->'exercise_keys')),'{}'))) k;
 if kept is null then raise exception 'None of the sample lessons fit this student yet'; end if;
 newid:=public.dp_plan_save(null,student,'Development plan (draft for review)',p.package_type,kept,array['Copied from a sample pathway'],
  array['Copied from a sample pathway. Review every lesson against this student''s own findings before approving.'],'{}','Started from a sample, not from this student''s findings.');
 update dp_voice_plans set source_sample_id=sample where id=newid;
 return newid;
end $$;
create or replace function public.dp_plan_mark_sample_reviewed(pid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 update dp_voice_plans set sample_reviewed_at=now() where id=pid and status='draft' and source_sample_id is not null and not is_sample;
 if not found then raise exception 'This plan does not need a sample review'; end if;
end $$;
create or replace function public.dp_plan_activate(pid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 if exists(select 1 from dp_voice_plans where id=pid and source_sample_id is not null and sample_reviewed_at is null) then
  raise exception 'This draft came from a sample. Confirm you have replaced the sample''s assumptions with this student''s findings before approving';
 end if;
 update dp_voice_plans set status='active',approved_at=now() where id=pid and status='draft' and not is_sample;
 if not found then raise exception 'Only a student''s draft plan can be approved'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Structured progress ratings (baseline / progress / midpoint / final) per skill area in the student's plan
-- ---------------------------------------------------------------------------
alter table dp_voice_progress_checks drop constraint if exists dp_voice_progress_checks_kind_check;
alter table dp_voice_progress_checks add constraint dp_voice_progress_checks_kind_check check(kind in ('baseline','progress','midpoint','final','custom'));
create or replace function public.dp_progress_check_save(pid uuid, wk int, check_kind text, rate jsonb, good text, focus text, private_notes text, share boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare cid uuid:=gen_random_uuid(); sid uuid; k text; v text;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 select student_id into sid from dp_voice_plans where id=pid and not is_sample and status in ('active','completed');
 if sid is null then raise exception 'Progress checks belong to an approved student plan'; end if;
 if jsonb_typeof(coalesce(rate,'{}'))<>'object' then raise exception 'Ratings must be an object'; end if;
 for k,v in select key,value #>> '{}' from jsonb_each(coalesce(rate,'{}')) loop
  if not exists(select 1 from dp_voice_plan_units where plan_id=pid and area_key=k) then raise exception 'Rating for % is not a skill area in this plan',k; end if;
  if v !~ '^[1-5]$' then raise exception 'Ratings are whole numbers from 1 to 5'; end if;
 end loop;
 insert into dp_voice_progress_checks(id,plan_id,student_id,week,kind,ratings,strengths,next_focus,shared_at,created_by)
 values(cid,pid,sid,wk,check_kind,coalesce(rate,'{}'),good,focus,case when share then now() end,auth.uid());
 insert into dp_voice_progress_check_private(check_id,notes) values(cid,private_notes);
 return cid;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Intake import: saved field mappings, and safe repeat imports
-- ---------------------------------------------------------------------------
create table dp_voice_import_mappings(
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(btrim(name)) between 1 and 80),
 header_map jsonb not null check(jsonb_typeof(header_map)='object'), updated_by uuid references auth.users(id), updated_at timestamptz not null default now());
alter table dp_voice_import_mappings enable row level security;
revoke all on dp_voice_import_mappings from anon,authenticated; grant select on dp_voice_import_mappings to authenticated;
create policy dp_voice_import_mappings_staff on dp_voice_import_mappings for select to authenticated using(dp_private.manage_voice());
create or replace function public.dp_voice_save_mapping(map_name text, map jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 insert into dp_voice_import_mappings(id,name,header_map,updated_by) values(mid,btrim(map_name),map,auth.uid())
 on conflict(name) do update set header_map=excluded.header_map,updated_by=excluded.updated_by,updated_at=now() returning id into mid;
 return mid;
end $$;

alter table dp_voice_intakes add column if not exists import_key text;
create unique index if not exists dp_voice_intakes_import_key_uq on dp_voice_intakes(student_id,import_key) where import_key is not null;
drop function if exists public.dp_voice_import_intake(uuid,jsonb,text[],timestamptz);
-- Idempotent: the same Google Forms response (same key) is recorded once. An older response never overrides newer track choices.
create or replace function public.dp_voice_import_intake(student uuid, a jsonb, requested_tracks text[], submitted timestamptz, import_key text)
returns table(id uuid, duplicate boolean) language plpgsql security definer set search_path=public as $$
declare iid uuid:=gen_random_uuid(); t text[]:=coalesce(requested_tracks,'{}'); existing uuid; newest timestamptz; sub timestamptz:=coalesce(submitted,now());
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 if not dp_private.voice_member(student) then raise exception 'That person is not enrolled in Voice'; end if;
 if not (t <@ array['worship_leadership','spontaneous_expression','prophetic_worship']) then raise exception 'Unknown track'; end if;
 if length(coalesce(import_key,''))<16 then raise exception 'An import key is required'; end if;
 select i.id into existing from dp_voice_intakes i where i.student_id=student and i.import_key=dp_voice_import_intake.import_key;
 if existing is not null then return query select existing,true; return; end if;
 select max(i.submitted_at) into newest from dp_voice_intakes i where i.student_id=student;
 insert into dp_voice_intakes(id,student_id,source,answers,submitted_at,imported_by,import_key) values(iid,student,'google_forms_import',a,sub,auth.uid(),import_key);
 if newest is null or sub>=newest then
  insert into dp_voice_profiles(student_id,selected_tracks) values(student,t)
  on conflict(student_id) do update set selected_tracks=excluded.selected_tracks,
   approved_tracks=array(select x from unnest(dp_voice_profiles.approved_tracks) x where x=any(excluded.selected_tracks)),
   tongues_requested=dp_voice_profiles.tongues_requested and 'prophetic_worship'=any(excluded.selected_tracks),updated_at=now();
 end if;
 return query select iid,false;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Recording feedback -> follow-up assignment (append-only: each follow-up is a new feedback entry)
-- ---------------------------------------------------------------------------
alter table dp_practice_recording_feedback add column if not exists follow_up_assignment_id uuid references dp_assignments(id) on delete set null;
create or replace function dp_private.exercise_allowed(student uuid, ex uuid) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare e dp_voice_exercises; slug text; tr text;
begin
 select * into e from dp_voice_exercises where id=ex and is_active;
 if not found then return false; end if;
 if e.curriculum_key='optional-tongues' then return dp_private.area_allowed(student,'track-prophetic-worship',array['optional-tongues']); end if;
 select s.slug into slug from dp_voice_skills s where s.id=e.skill_id;
 tr:=dp_private.area_track(slug);
 return tr is null or dp_private.area_allowed(student,slug,'{}');
end $$;
create or replace function public.dp_recording_assign_followup(rid uuid, exercise uuid, due date, note text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare rec dp_practice_recordings; ttl text; aid uuid; fid uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 select * into rec from dp_practice_recordings where id=rid and status in ('submitted','reviewed','returned');
 if not found then raise exception 'Follow-up can be assigned only after the student submits the recording'; end if;
 if not dp_private.exercise_allowed(rec.student_id,exercise) then raise exception 'That exercise is not available for this student (optional track not chosen and approved, or not in the library)'; end if;
 select title into ttl from dp_voice_exercises where id=exercise;
 aid:=public.dp_assign_weekly_plan(rec.student_id,'Follow-up: '||ttl,coalesce(nullif(btrim(note),''),'Follow-up from your recording feedback.'),null,due,jsonb_build_array(jsonb_build_object('exercise_id',exercise)));
 insert into dp_practice_recording_feedback(id,recording_id,author_id,kind,body,follow_up,follow_up_assignment_id)
 values(fid,rid,auth.uid(),'feedback',coalesce(nullif(btrim(note),''),'Follow-up exercise assigned: '||ttl),ttl,aid);
 return aid;
end $$;
create or replace function public.dp_recording_review_assign(rid uuid, outcome text, feedback_text text, follow_up_text text, exercise uuid, due date)
returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid;
begin
 perform public.dp_recording_review(rid,outcome,feedback_text,follow_up_text);
 if exercise is not null then aid:=public.dp_recording_assign_followup(rid,exercise,due,null); end if;
 return aid;
end $$;

revoke all on function public.dp_plan_revise(uuid,jsonb,text,text[]),public.dp_plan_unit_set_status(uuid,text),public.dp_plan_copy_sample(uuid,uuid),
 public.dp_plan_mark_sample_reviewed(uuid),public.dp_plan_activate(uuid),public.dp_progress_check_save(uuid,int,text,jsonb,text,text,text,boolean),
 public.dp_voice_save_mapping(text,jsonb),public.dp_voice_import_intake(uuid,jsonb,text[],timestamptz,text),
 public.dp_recording_assign_followup(uuid,uuid,date,text),public.dp_recording_review_assign(uuid,text,text,text,uuid,date) from public,anon;
grant execute on function public.dp_plan_revise(uuid,jsonb,text,text[]),public.dp_plan_unit_set_status(uuid,text),public.dp_plan_copy_sample(uuid,uuid),
 public.dp_plan_mark_sample_reviewed(uuid),public.dp_plan_activate(uuid),public.dp_progress_check_save(uuid,int,text,jsonb,text,text,text,boolean),
 public.dp_voice_save_mapping(text,jsonb),public.dp_voice_import_intake(uuid,jsonb,text[],timestamptz,text),
 public.dp_recording_assign_followup(uuid,uuid,date,text),public.dp_recording_review_assign(uuid,text,text,text,uuid,date) to authenticated;
