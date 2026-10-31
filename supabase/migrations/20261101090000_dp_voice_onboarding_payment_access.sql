-- Onboarding and payment-access rules (confirmed business decision):
--   INTAKE happens BEFORE payment.  ASSESSMENTS, recorded demonstrations, coaching resources and new practice happen AFTER verified payment.
--
-- ADDITIVE ONLY and NOT YET APPLIED. Apply after 20261031090000. Everything here is enforced in the database (policies, triggers, functions),
-- not by what the screens show. Completed work is never deleted: losing paid status (refund, expiry) restricts NEW work and resources only.
--
-- "Verified paid coaching access" (dp_private.voice_paid) means: the student has a Voice coaching package that came from a WooCommerce order
-- attributed to them (source = 'woocommerce'), with at least one installment actually paid, not refunded or failed, and not expired.
-- Manual and complimentary packages are NOT counted (fail closed; see docs/voice-access-rules.md for the open decision).

-- ---------------------------------------------------------------------------
-- 1. Who may do intake without paying: enrolled students, plus people an instructor has invited after a consultation.
-- ---------------------------------------------------------------------------
create table dp_voice_prospects(
 student_id uuid primary key references auth.users(id) on delete cascade,
 invited_by uuid references auth.users(id), invited_at timestamptz not null default now(), note text check(note is null or length(note)<=500));
alter table dp_voice_prospects enable row level security;
revoke all on dp_voice_prospects from anon,authenticated; grant select on dp_voice_prospects to authenticated;
create policy dp_voice_prospects_read on dp_voice_prospects for select to authenticated using(student_id=auth.uid() or dp_private.manage_voice());

create or replace function dp_private.intake_ok(uid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select uid is not null and (dp_private.voice_member(uid) or exists(select 1 from dp_voice_prospects p where p.student_id=uid)) $$;

create or replace function dp_private.voice_paid(uid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select uid is not null and exists(select 1 from dp_coaching_packages p
  where p.student_id=uid and p.program_id=dp_private.voice_program() and p.source='woocommerce'
   and p.payment_status in ('partial','paid') and p.installments_paid>=1 and (p.expires_at is null or p.expires_at>now())) $$;

-- How many more assessments this student's current packages allow (sum of the packages' assessments_included, minus those already assigned).
create or replace function dp_private.assessments_allowance(uid uuid) returns int language sql stable security definer set search_path=public as $$
 select coalesce((select sum(p.assessments_included) from dp_coaching_packages p
   where p.student_id=uid and p.program_id=dp_private.voice_program() and p.source='woocommerce' and p.payment_status in ('partial','paid')
    and p.installments_paid>=1 and (p.expires_at is null or p.expires_at>now())),0)::int
  - (select count(*) from dp_voice_assessments a where a.student_id=uid)::int $$;

create or replace function public.dp_voice_invite_intake(person_email text, invite_note text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 select id into sid from profiles where lower(email)=lower(btrim(person_email));
 if sid is null then raise exception 'No account uses that email yet. Ask them to create an account, then invite them again.'; end if;
 insert into dp_voice_prospects(student_id,invited_by,note) values(sid,auth.uid(),nullif(btrim(invite_note),'')) on conflict(student_id) do nothing;
 return sid;
end $$;

-- Staff roster for onboarding: enrolled students and invited prospects, with their payment state. Never exposes other programs' people.
create or replace function public.dp_voice_people() returns table(id uuid, full_name text, email text, enrolled boolean, prospect boolean, paid boolean, paid_status text)
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 return query
  select p.id,p.full_name,p.email,dp_private.voice_member(p.id),exists(select 1 from dp_voice_prospects x where x.student_id=p.id),dp_private.voice_paid(p.id),
   coalesce((select k.payment_status from dp_coaching_packages k where k.student_id=p.id and k.program_id=dp_private.voice_program() order by k.purchased_at desc limit 1),'none')
  from profiles p where dp_private.voice_member(p.id) or exists(select 1 from dp_voice_prospects x where x.student_id=p.id) order by p.full_name nulls last,p.email;
end $$;

-- What the signed-in person may do right now (drives the screens; the database enforces the same rules on its own).
create or replace function public.dp_voice_my_access() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('signed_in',auth.uid() is not null,'enrolled',dp_private.voice_member(auth.uid()),'intake',dp_private.intake_ok(auth.uid()),
  'paid',dp_private.voice_paid(auth.uid()),
  'status',coalesce((select k.payment_status from dp_coaching_packages k where k.student_id=auth.uid() and k.program_id=dp_private.voice_program() order by k.purchased_at desc limit 1),'none')) $$;

-- ---------------------------------------------------------------------------
-- 2. Intake needs no payment: the intake functions and reads use intake_ok instead of voice_member.
-- ---------------------------------------------------------------------------
drop policy dp_voice_profiles_read on dp_voice_profiles;
create policy dp_voice_profiles_read on dp_voice_profiles for select to authenticated using((student_id=auth.uid() and dp_private.intake_ok(auth.uid())) or dp_private.manage_voice());
drop policy dp_voice_intakes_read on dp_voice_intakes;
create policy dp_voice_intakes_read on dp_voice_intakes for select to authenticated using((student_id=auth.uid() and dp_private.intake_ok(auth.uid())) or dp_private.manage_voice());

create or replace function public.dp_voice_set_my_tracks(tracks text[], tongues boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare t text[]:=coalesce(tracks,'{}');
begin
 if auth.uid() is null or not dp_private.intake_ok(auth.uid()) then raise exception 'Voice enrollment or an intake invitation is required'; end if;
 if not (t <@ array['worship_leadership','spontaneous_expression','prophetic_worship']) then raise exception 'Unknown track'; end if;
 insert into dp_voice_profiles(student_id,selected_tracks,tongues_requested) values(auth.uid(),t,coalesce(tongues,false) and 'prophetic_worship'=any(t))
 on conflict(student_id) do update set selected_tracks=excluded.selected_tracks,
  approved_tracks=array(select x from unnest(dp_voice_profiles.approved_tracks) x where x=any(excluded.selected_tracks)),
  tongues_requested=excluded.tongues_requested,updated_at=now();
end $$;
create or replace function public.dp_voice_submit_intake(a jsonb, requested_tracks text[] default '{}') returns uuid
language plpgsql security definer set search_path=public as $$
declare iid uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not dp_private.intake_ok(auth.uid()) then raise exception 'Voice enrollment or an intake invitation is required'; end if;
 insert into dp_voice_intakes(id,student_id,source,answers) values(iid,auth.uid(),'hub',a);
 perform public.dp_voice_set_my_tracks(requested_tracks, false);
 return iid;
end $$;
create or replace function public.dp_voice_import_intake(student uuid, a jsonb, requested_tracks text[], submitted timestamptz, import_key text)
returns table(id uuid, duplicate boolean) language plpgsql security definer set search_path=public as $$
declare iid uuid:=gen_random_uuid(); t text[]:=coalesce(requested_tracks,'{}'); existing uuid; newest timestamptz; sub timestamptz:=coalesce(submitted,now());
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 if not dp_private.intake_ok(student) then raise exception 'That person is not enrolled in Voice and has not been invited to complete an intake'; end if;
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
-- 3. Assessments: after verified payment, only as the instructor decides, within what the package includes.
-- ---------------------------------------------------------------------------
-- Specialized assessments only: Personal Time With God, Creative Vocal Expression (and How Does God Speak to You? when its source is supplied).
-- The technical baseline is the Vocal Demo recorded at the consultation, so there is deliberately NO technical-assessment kind here.
-- Each assignment records WHY it fits this student's goals, so nobody is ever given "everything" by default.
alter table dp_voice_assessments add column if not exists assign_reason text check(assign_reason is null or length(assign_reason)<=500);
drop function if exists public.dp_assessment_assign(uuid,text);
create or replace function public.dp_assessment_assign(student uuid, assessment_kind text, reason text) returns uuid
language plpgsql security definer set search_path=public as $$
declare aid uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 if not dp_private.voice_member(student) then raise exception 'That person is not enrolled in Voice'; end if;
 if assessment_kind='hearing_god' then raise exception 'How Does God Speak to You? cannot be assigned until its source wording is supplied'; end if;
 if assessment_kind not in ('personal_time','creative_expression') then raise exception 'Unknown assessment'; end if;
 if length(btrim(coalesce(reason,'')))=0 then raise exception 'Say why this assessment fits the student''s interests and goals'; end if;
 insert into dp_voice_assessments(id,student_id,kind,assigned_by,assign_reason) values(aid,student,assessment_kind,auth.uid(),btrim(reason));
 return aid;
end $$;

-- The same rules sit on the table itself, so no path (function, future screen, direct insert by a role that has insert) can skip them.
create or replace function dp_private.assessment_gate() returns trigger language plpgsql security definer set search_path=public as $$
declare prof dp_voice_profiles;
begin
 if tg_op='INSERT' then
  if not dp_private.voice_paid(new.student_id) then
   raise exception 'Assessments open after verified payment. This student has no paid, current coaching package.'; end if;
  if dp_private.assessments_allowance(new.student_id)<=0 then
   raise exception 'This student''s package does not include another assessment.'; end if;
  if new.kind in ('personal_time','hearing_god') then
   select * into prof from dp_voice_profiles where student_id=new.student_id;
   if prof.student_id is null or not ('prophetic_worship'=any(prof.selected_tracks) and 'prophetic_worship'=any(prof.approved_tracks)) then
    raise exception 'Prophetic worship assessments need the student''s choice of Prophetic Worship Development and your authorization.'; end if;
  end if;
 elsif old.status in ('assigned','in_progress') and new.status in ('in_progress','submitted') then
  if not dp_private.voice_paid(new.student_id) then
   raise exception 'Assessments can be completed while your coaching package is paid and current.'; end if;
 end if;
 return new;
end $$;
create trigger dp_voice_assessment_gate before insert or update on dp_voice_assessments for each row execute function dp_private.assessment_gate();

-- ---------------------------------------------------------------------------
-- 4. Recorded demonstrations and new submissions: verified payment required (existing recordings stay readable and playable).
-- ---------------------------------------------------------------------------
create or replace function dp_private.recording_gate() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' or (new.status='submitted' and old.status is distinct from 'submitted') then
  if not dp_private.voice_paid(new.student_id) then
   raise exception 'Recording is available with a paid, current coaching package.'; end if;
 end if;
 return new;
end $$;
create trigger dp_practice_recording_gate before insert or update on dp_practice_recordings for each row execute function dp_private.recording_gate();

-- ---------------------------------------------------------------------------
-- 5. New practice assignments (weekly plans, plan lessons, recording follow-ups) follow payment. Existing assignments are untouched.
-- ---------------------------------------------------------------------------
create or replace function dp_private.practice_assignment_gate() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.practice_items is not null and new.assigned_to_user_id is not null and not dp_private.voice_paid(new.assigned_to_user_id) then
  raise exception 'New practice can be assigned after verified payment. This student has no paid, current coaching package.'; end if;
 return new;
end $$;
create trigger dp_voice_practice_assignment_gate before insert on dp_assignments for each row execute function dp_private.practice_assignment_gate();

-- ---------------------------------------------------------------------------
-- 6. The development plan: approved by the instructor before the student sees it, and approved/revised only for a paid student.
-- ---------------------------------------------------------------------------
create or replace function dp_private.plan_payment_gate() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if (new.status='active' and old.status is distinct from 'active') or (new.status='active' and new.version_no is distinct from old.version_no) then
  if not dp_private.voice_paid(new.student_id) then
   raise exception 'A plan can be approved or revised while the student has a paid, current coaching package.'; end if;
 end if;
 return new;
end $$;
create trigger dp_voice_plan_payment_gate before update on dp_voice_plans for each row execute function dp_private.plan_payment_gate();

-- ---------------------------------------------------------------------------
-- 7. Coaching resources (skills, exercise library, welcome/practice guide, goals) are for paying students; staff are unaffected.
-- ---------------------------------------------------------------------------
drop policy dp_voice_skills_read on dp_voice_skills;
create policy dp_voice_skills_read on dp_voice_skills for select to authenticated using(dp_private.manage_voice() or (is_active and dp_private.voice_member(auth.uid()) and dp_private.voice_paid(auth.uid())));
drop policy dp_voice_exercises_read on dp_voice_exercises;
create policy dp_voice_exercises_read on dp_voice_exercises for select to authenticated using(dp_private.manage_voice() or (is_active and dp_private.voice_member(auth.uid()) and dp_private.voice_paid(auth.uid())));
drop policy dp_voice_content_read on dp_voice_resource_content;
create policy dp_voice_content_read on dp_voice_resource_content for select to authenticated using(dp_private.manage_voice() or (dp_private.voice_member(auth.uid()) and dp_private.voice_paid(auth.uid())));
drop policy dp_voice_goals_read on dp_voice_goals;
create policy dp_voice_goals_read on dp_voice_goals for select to authenticated using(dp_private.manage_voice() or (student_id=auth.uid() and dp_private.voice_member(auth.uid()) and dp_private.voice_paid(auth.uid())));
drop policy dp_voice_goal_updates_insert on dp_voice_goal_updates;
create policy dp_voice_goal_updates_insert on dp_voice_goal_updates for insert to authenticated
 with check(author_id=auth.uid() and exists(select 1 from dp_voice_goals g where g.id=goal_id and (dp_private.manage_voice() or (g.student_id=auth.uid() and dp_private.voice_paid(auth.uid())))));

-- ---------------------------------------------------------------------------
-- 8. The Vocal Demo: recorded by the instructor at the consultation, BEFORE payment. It is the student's initial technical baseline
--    (pitch, range, breath, tone, agility and other relevant skills). It needs no payment and unlocks nothing; later progress checks are
--    measured against it, so the baseline is never collected twice.
-- ---------------------------------------------------------------------------
create table dp_voice_demos(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 ratings jsonb not null check(jsonb_typeof(ratings)='object' and ratings<>'{}'::jsonb),
 strengths text check(strengths is null or length(strengths)<=4000), next_focus text check(next_focus is null or length(next_focus)<=4000),
 observed_at timestamptz not null default now(), recorded_by uuid references auth.users(id), shared_at timestamptz, created_at timestamptz not null default now());
create index dp_voice_demos_student_idx on dp_voice_demos(student_id,observed_at desc);
create table dp_voice_demo_private(demo_id uuid primary key references dp_voice_demos(id) on delete cascade, notes text check(notes is null or length(notes)<=8000));
alter table dp_voice_demos enable row level security; alter table dp_voice_demo_private enable row level security;
revoke all on dp_voice_demos,dp_voice_demo_private from anon,authenticated; grant select on dp_voice_demos,dp_voice_demo_private to authenticated;
create policy dp_voice_demos_read on dp_voice_demos for select to authenticated
 using(dp_private.manage_voice() or (shared_at is not null and student_id=auth.uid() and dp_private.intake_ok(auth.uid())));
create policy dp_voice_demo_private_staff on dp_voice_demo_private for select to authenticated using(dp_private.manage_voice());
-- Append-only: a correction is a new entry; the latest entry is the current baseline and earlier ones stay as history.
create or replace function public.dp_voice_record_demo(student uuid, rate jsonb, good text, focus text, private_notes text, share boolean default false, observed timestamptz default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare did uuid:=gen_random_uuid(); k text; v text;
 core text[]:=array['posture-breath','pitch-ear','tone-resonance','range','registers','agility','harmony','stamina-dynamics','interpretation','confidence-mic','improvisation','worship-leading'];
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 if not dp_private.intake_ok(student) then raise exception 'That person is not enrolled in Voice and has not been invited to complete an intake'; end if;
 if jsonb_typeof(coalesce(rate,'{}'))<>'object' or coalesce(rate,'{}')='{}'::jsonb then raise exception 'Rate at least one skill from the demo'; end if;
 for k,v in select key,value #>> '{}' from jsonb_each(rate) loop
  if not k=any(core) then raise exception '% is not one of the 12 skill areas',k; end if;
  if v !~ '^[1-5]$' then raise exception 'Ratings are whole numbers from 1 to 5'; end if;
 end loop;
 insert into dp_voice_demos(id,student_id,ratings,strengths,next_focus,observed_at,recorded_by,shared_at)
 values(did,student,rate,nullif(btrim(good),''),nullif(btrim(focus),''),coalesce(observed,now()),auth.uid(),case when share then now() end);
 insert into dp_voice_demo_private(demo_id,notes) values(did,nullif(btrim(private_notes),''));
 return did;
end $$;
revoke all on function public.dp_voice_record_demo(uuid,jsonb,text,text,text,boolean,timestamptz) from public,anon;
grant execute on function public.dp_voice_record_demo(uuid,jsonb,text,text,text,boolean,timestamptz) to authenticated;

revoke all on function public.dp_voice_invite_intake(text,text),public.dp_voice_people(),public.dp_voice_my_access(),public.dp_assessment_assign(uuid,text,text) from public,anon;
grant execute on function public.dp_voice_invite_intake(text,text),public.dp_voice_people(),public.dp_voice_my_access(),public.dp_assessment_assign(uuid,text,text) to authenticated;
revoke all on function dp_private.intake_ok(uuid),dp_private.voice_paid(uuid),dp_private.assessments_allowance(uuid) from public,anon;
grant execute on function dp_private.intake_ok(uuid),dp_private.voice_paid(uuid),dp_private.assessments_allowance(uuid) to authenticated;
