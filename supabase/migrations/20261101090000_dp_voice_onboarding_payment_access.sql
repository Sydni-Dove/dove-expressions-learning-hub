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
-- 0. Offline / cash / Square / complimentary access: a verified, audited, instructor-only record. It NEVER enrolls anyone by itself.
-- ---------------------------------------------------------------------------
-- Only a super admin or a faculty member may verify a payment or grant complimentary access (scoped teachers cannot).
create or replace function dp_private.can_verify_payments() returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (dp_is_super_admin() or dp_has_role('faculty')) $$;

create table dp_voice_access_grants(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('offline_payment','complimentary')),
 method text not null check(method in ('cash','check','square','bank_transfer','other_offline','complimentary')),
 reference text check(reference is null or length(reference)<=200),
 reason text check(reason is null or length(reason)<=500),
 amount_cents int check(amount_cents is null or amount_cents>=0),
 received_on date not null,
 package_id uuid references dp_coaching_packages(id) on delete set null,
 recorded_by uuid not null references auth.users(id), recorded_at timestamptz not null default now(),
 revoked_at timestamptz, revoked_by uuid references auth.users(id), revoke_reason text check(revoke_reason is null or length(revoke_reason)<=500),
 -- A paid offline transaction needs a payment reference; complimentary access needs a reason and is never labelled as a payment.
 check((kind='offline_payment' and method<>'complimentary' and length(btrim(coalesce(reference,'')))>0)
    or (kind='complimentary' and method='complimentary' and length(btrim(coalesce(reason,'')))>0)));
create index dp_voice_access_grants_student_idx on dp_voice_access_grants(student_id,recorded_at desc);
alter table dp_coaching_packages add column access_grant_id uuid references dp_voice_access_grants(id) on delete set null;
-- Append-only audit trail of access decisions (granted, revoked, enrolled). Nobody can edit or delete it, including staff.
create table dp_voice_access_events(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 grant_id uuid references dp_voice_access_grants(id) on delete set null,
 event text not null check(event in ('payment_recorded','complimentary_granted','access_revoked','enrolled')),
 actor uuid not null references auth.users(id), at timestamptz not null default now(), details jsonb not null default '{}');
create index dp_voice_access_events_student_idx on dp_voice_access_events(student_id,at desc);
alter table dp_voice_access_grants enable row level security; alter table dp_voice_access_events enable row level security;
revoke all on dp_voice_access_grants,dp_voice_access_events from anon,authenticated; grant select on dp_voice_access_grants,dp_voice_access_events to authenticated;
create policy dp_voice_access_grants_read on dp_voice_access_grants for select to authenticated using(dp_private.can_verify_payments());
create policy dp_voice_access_events_read on dp_voice_access_events for select to authenticated using(dp_private.can_verify_payments());
create or replace function dp_private.audit_immutable() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_table_name='dp_voice_access_events' then raise exception 'The access audit trail cannot be changed'; end if;
 if tg_op='DELETE' then raise exception 'Access records cannot be deleted'; end if;
 if (new.student_id,new.kind,new.method,new.reference,new.reason,new.amount_cents,new.received_on,new.recorded_by,new.recorded_at)
  is distinct from (old.student_id,old.kind,old.method,old.reference,old.reason,old.amount_cents,old.received_on,old.recorded_by,old.recorded_at) then
  raise exception 'Only the revocation fields of an access record can change'; end if;
 return new;
end $$;
create trigger dp_voice_access_grants_immutable before update or delete on dp_voice_access_grants for each row execute function dp_private.audit_immutable();
create trigger dp_voice_access_events_immutable before update or delete on dp_voice_access_events for each row execute function dp_private.audit_immutable();

-- Package entitlements are configurable. For assessments: a number is a cap, 0 means none, and BLANK (null) means "the instructor decides";
-- a blank never blocks personalized coaching. Each assessment is still assigned one at a time, with a reason.
alter table dp_coaching_tiers alter column assessments_included drop not null, alter column assessments_included set default null;
alter table dp_coaching_packages alter column assessments_included drop not null, alter column assessments_included set default null;

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

-- Packages that currently count as paid access: a WooCommerce order attributed to the student with at least one installment paid, OR a verified
-- offline-payment / complimentary grant recorded by authorized staff (and not revoked). Manual packages without a grant never count.
create or replace function dp_private.paid_packages(uid uuid) returns setof dp_coaching_packages language sql stable security definer set search_path=public as $$
 select p.* from dp_coaching_packages p
 where p.student_id=uid and p.program_id=dp_private.voice_program() and (p.expires_at is null or p.expires_at>now())
  and ((p.source='woocommerce' and p.payment_status in ('partial','paid') and p.installments_paid>=1)
    or (p.access_grant_id is not null and p.payment_status in ('paid','complimentary')
        and exists(select 1 from dp_voice_access_grants g where g.id=p.access_grant_id and g.revoked_at is null))) $$;
create or replace function dp_private.voice_paid(uid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select uid is not null and exists(select 1 from dp_private.paid_packages(uid)) $$;
-- How the access was established: 'woocommerce', 'offline_payment', 'complimentary' or null.
create or replace function dp_private.access_via(uid uuid) returns text language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from dp_private.paid_packages(uid) p where p.source='woocommerce') then 'woocommerce'
  else (select g.kind from dp_private.paid_packages(uid) p join dp_voice_access_grants g on g.id=p.access_grant_id order by g.recorded_at desc limit 1) end $$;

-- How many more assessments this student's current packages allow. A package with a blank allowance leaves it to the instructor (unlimited);
-- a number is a cap; declined assessments do not use up the allowance.
create or replace function dp_private.assessments_allowance(uid uuid) returns int language sql stable security definer set search_path=public as $$
 select (case when exists(select 1 from dp_private.paid_packages(uid) p where p.assessments_included is null) then 1000
   else coalesce((select sum(p.assessments_included) from dp_private.paid_packages(uid) p),0)::int end)
  - (select count(*) from dp_voice_assessments a where a.student_id=uid and a.status<>'declined')::int $$;

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

-- Staff roster for onboarding: enrolled students, invited prospects and people with verified paid access who are not yet enrolled, with their payment state. Never exposes other programs' people.
create or replace function public.dp_voice_people() returns table(id uuid, full_name text, email text, enrolled boolean, prospect boolean, paid boolean, paid_status text, paid_via text)
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Not authorized'; end if;
 return query
  select p.id,p.full_name,p.email,dp_private.voice_member(p.id),exists(select 1 from dp_voice_prospects x where x.student_id=p.id),dp_private.voice_paid(p.id),
   coalesce((select k.payment_status from dp_coaching_packages k where k.student_id=p.id and k.program_id=dp_private.voice_program() order by k.purchased_at desc limit 1),'none'),dp_private.access_via(p.id)
  from profiles p where dp_private.voice_member(p.id) or exists(select 1 from dp_voice_prospects x where x.student_id=p.id) or dp_private.voice_paid(p.id) order by p.full_name nulls last,p.email;
end $$;

-- What the signed-in person may do right now (drives the screens; the database enforces the same rules on its own).
create or replace function public.dp_voice_my_access() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('signed_in',auth.uid() is not null,'enrolled',dp_private.voice_member(auth.uid()),'intake',dp_private.intake_ok(auth.uid()),
  'paid',dp_private.voice_paid(auth.uid()),'via',dp_private.access_via(auth.uid()),
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

-- The student's consent: an assigned assessment is an invitation. They accept it before starting, or decline it at no cost.
alter table dp_voice_assessments add column if not exists consented_at timestamptz, add column if not exists declined_at timestamptz;
alter table dp_voice_assessments drop constraint dp_voice_assessments_status_check;
alter table dp_voice_assessments add constraint dp_voice_assessments_status_check check(status in ('assigned','in_progress','submitted','reviewed','declined'));
create or replace function public.dp_assessment_consent(aid uuid, accept boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not dp_private.voice_member(auth.uid()) then raise exception 'Voice enrollment required'; end if;
 update dp_voice_assessments set consented_at=case when accept then now() end, declined_at=case when accept then null else now() end,
  status=case when accept then status else 'declined' end, updated_at=now()
 where id=aid and student_id=auth.uid() and status='assigned' and consented_at is null;
 if not found then raise exception 'This assessment is not waiting for your decision'; end if;
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
  if new.status<>'assigned' or new.consented_at is not null then raise exception 'A new assessment starts as an invitation waiting for the student''s consent.'; end if;
  if new.kind in ('personal_time','hearing_god') then
   select * into prof from dp_voice_profiles where student_id=new.student_id;
   if prof.student_id is null or not ('prophetic_worship'=any(prof.selected_tracks) and 'prophetic_worship'=any(prof.approved_tracks)) then
    raise exception 'Prophetic worship assessments need the student''s choice of Prophetic Worship Development and your authorization.'; end if;
  end if;
 elsif old.status in ('assigned','in_progress') and new.status in ('in_progress','submitted') then
  if new.consented_at is null then
   raise exception 'Please accept this assessment first. You can also decline it.'; end if;
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
-- 7. Coaching resources (skills, exercise library, welcome/practice guide) are for paying students; staff are unaffected.
-- ---------------------------------------------------------------------------
drop policy dp_voice_skills_read on dp_voice_skills;
create policy dp_voice_skills_read on dp_voice_skills for select to authenticated using(dp_private.manage_voice() or (is_active and dp_private.voice_member(auth.uid()) and dp_private.voice_paid(auth.uid())));
drop policy dp_voice_exercises_read on dp_voice_exercises;
create policy dp_voice_exercises_read on dp_voice_exercises for select to authenticated using(dp_private.manage_voice() or (is_active and dp_private.voice_member(auth.uid()) and dp_private.voice_paid(auth.uid())));
drop policy dp_voice_content_read on dp_voice_resource_content;
create policy dp_voice_content_read on dp_voice_resource_content for select to authenticated using(dp_private.manage_voice() or (dp_private.voice_member(auth.uid()) and dp_private.voice_paid(auth.uid())));
-- (Goals and their progress notes are the student's own record: they stay readable after a refund or expiry. Adding a progress note needs paid access.)
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

-- ---------------------------------------------------------------------------
-- 9. Recording, revoking and enrolling: authorized staff only, always audited.
-- ---------------------------------------------------------------------------
create or replace function public.dp_voice_record_access_grant(student uuid, tier uuid, grant_kind text, grant_method text, grant_reference text, grant_reason text,
 paid_on date, amount int default null, assessments int default null, expiry timestamptz default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare gid uuid:=gen_random_uuid(); pid uuid; t dp_coaching_tiers; pstat text;
begin
 if not dp_private.can_verify_payments() then raise exception 'Only a super admin or a faculty member can verify an offline payment or grant complimentary access'; end if;
 if not exists(select 1 from profiles where id=student) then raise exception 'That person has no account'; end if;
 select * into t from dp_coaching_tiers where id=tier and is_active;
 if t.id is null or t.program_id is distinct from dp_private.voice_program() then raise exception 'Choose an active Voice package'; end if;
 if grant_kind not in ('offline_payment','complimentary') then raise exception 'Choose offline payment or complimentary'; end if;
 if paid_on is null or paid_on < current_date-730 or paid_on > current_date+1 then raise exception 'Enter the date the payment was received (or the access was granted)'; end if;
 if grant_kind='offline_payment' then
  if grant_method not in ('cash','check','square','bank_transfer','other_offline') then raise exception 'Choose how the payment was made'; end if;
  if length(btrim(coalesce(grant_reference,'')))=0 then raise exception 'Enter the receipt, check or transaction reference'; end if;
  pstat:='paid';
 else
  if length(btrim(coalesce(grant_reason,'')))=0 then raise exception 'Say why this access is complimentary'; end if;
  grant_method:='complimentary'; pstat:='complimentary';
 end if;
 if assessments is not null and assessments<0 then raise exception 'Assessments cannot be negative'; end if;
 insert into dp_voice_access_grants(id,student_id,kind,method,reference,reason,amount_cents,received_on,recorded_by)
 values(gid,student,grant_kind,grant_method,nullif(btrim(grant_reference),''),nullif(btrim(grant_reason),''),amount,paid_on,auth.uid());
 pid:=dp_private.create_package(student,tier,1,pstat,expiry,'manual',null,null,null,auth.uid());
 update dp_coaching_packages set access_grant_id=gid,assessments_included=case when assessments is null then assessments_included else assessments end where id=pid;
 update dp_voice_access_grants set package_id=pid where id=gid;
 insert into dp_voice_access_events(student_id,grant_id,event,actor,details)
 values(student,gid,case when grant_kind='complimentary' then 'complimentary_granted' else 'payment_recorded' end,auth.uid(),
  jsonb_build_object('method',grant_method,'package',t.name,'received_on',paid_on));
 return gid;
end $$;

create or replace function public.dp_voice_revoke_access_grant(grant_id uuid, why text) returns void
language plpgsql security definer set search_path=public as $$
declare g dp_voice_access_grants;
begin
 if not dp_private.can_verify_payments() then raise exception 'Only a super admin or a faculty member can revoke access'; end if;
 if length(btrim(coalesce(why,'')))=0 then raise exception 'Say why this access is being revoked'; end if;
 select * into g from dp_voice_access_grants where id=grant_id for update;
 if g.id is null or g.revoked_at is not null then raise exception 'That access record was not found or is already revoked'; end if;
 update dp_voice_access_grants set revoked_at=now(),revoked_by=auth.uid(),revoke_reason=btrim(why) where id=grant_id;
 update dp_coaching_packages set payment_status='refunded' where id=g.package_id;
 insert into dp_voice_access_events(student_id,grant_id,event,actor,details) values(g.student_id,grant_id,'access_revoked',auth.uid(),jsonb_build_object('reason',btrim(why)));
end $$;

-- Enrollment stays an instructor decision. Verified payment (online or offline) makes a person ELIGIBLE; this is the explicit step that enrolls them.
create or replace function public.dp_voice_enroll_student(student uuid, enroll_note text default null) returns void
language plpgsql security definer set search_path=public as $$
declare vp uuid:=dp_private.voice_program(); area uuid;
begin
 if not (auth.uid() is not null and (dp_is_super_admin() or dp_has_role('faculty'))) then raise exception 'Only a super admin or a faculty member can enroll a student'; end if;
 if not exists(select 1 from profiles where id=student) then raise exception 'That person has no account'; end if;
 if exists(select 1 from dp_enrollments e where e.user_id=student and e.scope_type='program' and e.scope_id=vp and e.status in ('active','completed')) then raise exception 'Already enrolled in Voice'; end if;
 select area_id into area from dp_programs where id=vp;
 insert into dp_enrollments(user_id,area_id,scope_type,scope_id,status) values(student,area,'program',vp,'active');
 insert into dp_voice_access_events(student_id,event,actor,details) values(student,'enrolled',auth.uid(),jsonb_build_object('note',nullif(btrim(enroll_note),''),'eligible',dp_private.voice_paid(student)));
end $$;

-- Completed work stays available: a student keeps the teaching content of lessons they have COMPLETED after a refund or expiry.
-- (Level-gated lessons they have not completed still need a paid, current package.)
create or replace function dp_private.lesson_level_ok(lid uuid, mid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (
  not exists(select 1 from dp_lesson_access a where a.lesson_id=lid)
  or exists(select 1 from dp_lesson_access a where a.lesson_id=lid
      and exists(select 1 from dp_coaching_packages p where p.student_id=auth.uid() and p.resource_level>=a.min_level
        and p.payment_status in ('paid','partial','complimentary') and (p.expires_at is null or p.expires_at>now())
        and dp_private.unlocked_credits(p.credits_total,p.installments_total,p.installments_paid,p.payment_status)>=greatest(a.min_unlocked_lessons,1)))
  or exists(select 1 from dp_lesson_progress lp where lp.lesson_id=lid and lp.user_id=auth.uid() and lp.status='completed')
  or exists(select 1 from dp_modules m where m.id=mid and dp_private.manage_course(m.course_id)))
$$;

revoke all on function public.dp_voice_invite_intake(text,text),public.dp_voice_people(),public.dp_voice_my_access(),public.dp_assessment_assign(uuid,text,text),public.dp_assessment_consent(uuid,boolean),
 public.dp_voice_record_access_grant(uuid,uuid,text,text,text,text,date,int,int,timestamptz),public.dp_voice_revoke_access_grant(uuid,text),public.dp_voice_enroll_student(uuid,text) from public,anon;
grant execute on function public.dp_voice_invite_intake(text,text),public.dp_voice_people(),public.dp_voice_my_access(),public.dp_assessment_assign(uuid,text,text),public.dp_assessment_consent(uuid,boolean),
 public.dp_voice_record_access_grant(uuid,uuid,text,text,text,text,date,int,int,timestamptz),public.dp_voice_revoke_access_grant(uuid,text),public.dp_voice_enroll_student(uuid,text) to authenticated;
revoke all on function dp_private.intake_ok(uuid),dp_private.voice_paid(uuid),dp_private.assessments_allowance(uuid),dp_private.access_via(uuid),dp_private.can_verify_payments(),dp_private.paid_packages(uuid) from public,anon;
grant execute on function dp_private.intake_ok(uuid),dp_private.voice_paid(uuid),dp_private.assessments_allowance(uuid),dp_private.access_via(uuid),dp_private.can_verify_payments(),dp_private.paid_packages(uuid) to authenticated;
