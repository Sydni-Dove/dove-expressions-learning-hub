-- Voice production readiness: private recordings, attempt history, coaching schedule and
-- lesson credits, consultation inquiries, and consent-gated testimonial video.
--
-- LESSON LENGTHS: the current offering is 45 or 65 minutes. 60 stays a valid stored value only so that any purchase, schedule or lesson
-- recorded as 60 minutes before the October 30 pricing change keeps working exactly as agreed; the app no longer offers 60 for new
-- packages or schedules. Lessons and credits always match on exact length, so 60- and 65-minute entitlements never mix.
--
-- ADDITIVE ONLY. Reuses dp_sessions (as the scheduled lesson record), dp_submissions,
-- dp_enrollments and the dp_private helper functions from the persistent coaching migration.
-- NOT YET APPLIED to the live project: review, then apply to the verified project only.

-- ---------------------------------------------------------------------------
-- 1. Private student recordings (audio/video), separate from course media.
--    Object path: <student_id>/<assignment_id>/<file>. Never public; no overwrite.
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('voice-recordings','voice-recordings',false,52428800,
  array['audio/mpeg','audio/mp4','audio/x-m4a','audio/m4a','audio/aac','audio/wav','audio/x-wav','audio/webm','audio/ogg','video/mp4','video/quicktime','video/webm']),
 ('voice-testimonials','voice-testimonials',false,52428800,
  array['video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table dp_voice_testimonials add column if not exists video_path text;

create or replace function dp_private.manage_program(pid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (dp_is_super_admin() or dp_has_role('faculty')
 or exists(select 1 from dp_courses c where c.program_id=pid and dp_private.manage_course(c.id)))
$$;
create or replace function dp_private.voice_member(uid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from dp_enrollments e where e.user_id=uid and e.status in ('active','completed')
 and ((e.scope_type='program' and e.scope_id in (select id from dp_programs where slug='vocal-coaching'))
 or (e.scope_type='course' and e.scope_id in (select c.id from dp_courses c join dp_programs p on p.id=c.program_id where p.slug='vocal-coaching'))))
$$;
-- A recording can be removed only while no reviewed-or-pending submission references it.
create or replace function dp_private.recording_deletable(obj text) returns boolean
language sql stable security definer set search_path=public as $$
 select not exists(select 1 from dp_submissions s where s.status<>'returned'
 and ('storage://voice-recordings/'||obj)=any(s.file_urls))
$$;

create policy voice_recordings_student_insert on storage.objects for insert to authenticated
with check(bucket_id='voice-recordings' and (storage.foldername(name))[1]=auth.uid()::text
 and dp_private.student_assignment(dp_safe_uuid((storage.foldername(name))[2])));
create policy voice_recordings_read on storage.objects for select to authenticated
using(bucket_id='voice-recordings' and (
 ((storage.foldername(name))[1]=auth.uid()::text and dp_private.student_assignment(dp_safe_uuid((storage.foldername(name))[2])))
 or dp_private.manage_assignment(dp_safe_uuid((storage.foldername(name))[2]))));
create policy voice_recordings_student_delete on storage.objects for delete to authenticated
using(bucket_id='voice-recordings' and (storage.foldername(name))[1]=auth.uid()::text
 and dp_private.recording_deletable(name));

create policy voice_testimonials_student_insert on storage.objects for insert to authenticated
with check(bucket_id='voice-testimonials' and (storage.foldername(name))[1]=auth.uid()::text
 and dp_private.voice_member(auth.uid()));
create policy voice_testimonials_read on storage.objects for select to authenticated
using(bucket_id='voice-testimonials' and ((storage.foldername(name))[1]=auth.uid()::text
 or dp_is_super_admin() or dp_has_role('faculty')));
create policy voice_testimonials_student_delete on storage.objects for delete to authenticated
using(bucket_id='voice-testimonials' and (storage.foldername(name))[1]=auth.uid()::text
 and not exists(select 1 from dp_voice_testimonials t where t.video_path=name));

-- Submitted file references must be an HTTPS link or the student's own recording path.
create or replace function dp_private.check_recording_refs() returns trigger
language plpgsql set search_path=public as $$
declare ref text; refs text[]; prefix text;
begin
 if tg_table_name='dp_submissions' then refs:=new.file_urls; else refs:=case when new.recording_url='' then '{}' else array[new.recording_url] end; end if;
 if coalesce(array_length(refs,1),0)>5 then raise exception 'At most five recordings per submission'; end if;
 prefix:='storage://voice-recordings/'||new.student_id||'/'||new.assignment_id||'/';
 foreach ref in array refs loop
  if ref !~ '^https://[^[:space:]]+$' and not (left(ref,length(prefix))=prefix and position('/' in substr(ref,length(prefix)+1))=0 and length(ref)>length(prefix)) then
   raise exception 'Recording must be an HTTPS link or an upload to your own assignment';
  end if;
 end loop;
 return new;
end $$;
create trigger dp_submission_recording_refs before insert or update of file_urls on dp_submissions
 for each row execute function dp_private.check_recording_refs();
create trigger dp_practice_recording_refs before insert or update of recording_url on dp_assignment_progress
 for each row execute function dp_private.check_recording_refs();

-- ---------------------------------------------------------------------------
-- 2. Attempt history: each submit/resubmit is preserved so improvement can be reviewed.
-- ---------------------------------------------------------------------------
create table dp_submission_attempts(
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references dp_submissions(id) on delete cascade,
 assignment_id uuid not null references dp_assignments(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 attempt_no int not null,
 content jsonb not null default '{}', file_urls text[] not null default '{}',
 submitted_at timestamptz not null default now(),
 unique(submission_id,attempt_no));
create index dp_submission_attempts_student_idx on dp_submission_attempts(student_id,assignment_id,attempt_no);
alter table dp_submission_attempts enable row level security;
grant select on dp_submission_attempts to authenticated;
create policy dp_attempts_read on dp_submission_attempts for select to authenticated using(
 (student_id=auth.uid() and dp_private.student_assignment(assignment_id)) or dp_private.manage_assignment(assignment_id));
create or replace function dp_private.record_attempt() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' or (new.status in ('submitted','revised') and old.status is distinct from new.status) then
  insert into dp_submission_attempts(submission_id,assignment_id,student_id,attempt_no,content,file_urls,submitted_at)
  values(new.id,new.assignment_id,new.student_id,
   coalesce((select max(attempt_no) from dp_submission_attempts where submission_id=new.id),0)+1,
   new.content,new.file_urls,coalesce(new.submitted_at,now()));
 end if;
 return null;
end $$;
create trigger dp_submission_attempt_log after insert or update on dp_submissions
 for each row execute function dp_private.record_attempt();
-- Backfill one attempt for submissions that predate this table.
insert into dp_submission_attempts(submission_id,assignment_id,student_id,attempt_no,content,file_urls,submitted_at)
select id,assignment_id,student_id,1,content,file_urls,submitted_at from dp_submissions;

-- ---------------------------------------------------------------------------
-- 3. Coaching schedule, packages and credits. dp_sessions remains THE lesson record.
-- ---------------------------------------------------------------------------
create table dp_coaching_plans(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 program_id uuid not null references dp_programs(id),
 instructor_id uuid not null references auth.users(id),
 cadence text not null check(cadence in ('weekly','biweekly')),
 lesson_minutes int not null check(lesson_minutes in (45,60,65)),
 first_lesson_on date not null check(first_lesson_on>=date '2000-01-03'),
 lesson_time time not null,
 timezone text not null,
 weekday smallint generated always as (extract(dow from first_lesson_on)::smallint) stored,
 -- Alternating-week group: biweekly students with different parity share one slot.
 week_parity smallint generated always as (((first_lesson_on-date '2000-01-03')/7)%2) stored,
 status text not null default 'active' check(status in ('active','paused','ended')),
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now());
create unique index dp_coaching_plans_one_active on dp_coaching_plans(student_id,program_id) where status='active';
create index dp_coaching_plans_slot_idx on dp_coaching_plans(instructor_id,weekday,lesson_time) where status='active';

-- Package tiers are data, not code: the owner defines lesson count, length, expiry and what each level includes.
-- Prices stay in WooCommerce. No tiers are seeded; the structure is not final.
create table dp_coaching_tiers(
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references dp_programs(id),
 slug text not null, name text not null, description text,
 lesson_minutes int not null check(lesson_minutes in (45,60,65)),
 lesson_count int not null check(lesson_count between 1 and 200),
 valid_days int check(valid_days is null or valid_days between 1 and 1095),
 -- Lessons tagged with a level (dp_lesson_access) open for packages at or above that level.
 resource_level smallint not null default 0 check(resource_level between 0 and 3),
 personal_plan boolean not null default false,
 assessments_included int not null default 0 check(assessments_included>=0),
 recording_feedback_included int not null default 0 check(recording_feedback_included>=0),
 -- Number of payments the store collects for this package. With more than one, lessons unlock in proportion to payments received.
 installments int not null default 1 check(installments between 1 and 12),
 -- Installment payments are matched to their purchase by reference (the store's parent order or plan reference). If the store cannot send
 -- one, this lets a student's single open plan receive the next payment; otherwise an unclear payment waits for a person to match it.
 allow_unreferenced_match boolean not null default false,
 woo_product_ids text[] not null default '{}',
 is_active boolean not null default true, sort_order int not null default 0,
 created_at timestamptz not null default now(), unique(program_id,slug));
alter table dp_coaching_tiers enable row level security;
grant select,insert,update on dp_coaching_tiers to authenticated;
create policy dp_tiers_staff on dp_coaching_tiers for all to authenticated
 using(dp_private.manage_program(program_id)) with check(dp_private.manage_program(program_id));
-- A WooCommerce product may map to only one active tier.
create or replace function dp_private.check_tier_products() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.is_active and exists(select 1 from dp_coaching_tiers o where o.id<>new.id and o.is_active and o.woo_product_ids && new.woo_product_ids) then
  raise exception 'A store product can belong to only one active package'; end if;
 return new;
end $$;
create trigger dp_tier_products_guard before insert or update on dp_coaching_tiers
 for each row execute function dp_private.check_tier_products();

create table dp_coaching_packages(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 program_id uuid not null references dp_programs(id),
 lesson_minutes int not null check(lesson_minutes in (45,60,65)),
 credits_total int not null check(credits_total>0),
 payment_status text not null default 'pending' check(payment_status in ('pending','partial','paid','complimentary','refunded','failed')),
 installments_total int not null default 1 check(installments_total between 1 and 12),
 installments_paid int not null default 0 check(installments_paid>=0),
 purchased_at timestamptz not null default now(),
 expires_at timestamptz,
 renewal_of uuid references dp_coaching_packages(id),
 source text not null default 'manual' check(source in ('manual','woocommerce')),
 -- Entitlements are copied from the tier at purchase, so editing a tier never changes what a student already bought.
 tier_id uuid references dp_coaching_tiers(id) on delete set null, tier_name text,
 resource_level smallint not null default 0, personal_plan boolean not null default false,
 assessments_included int not null default 0, recording_feedback_included int not null default 0,
 external_order_id text, external_line_item_id text, product_sku text, notes text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now());
create unique index dp_coaching_packages_external on dp_coaching_packages(source,external_order_id,coalesce(external_line_item_id,''))
 where external_order_id is not null;
create index dp_coaching_packages_student_idx on dp_coaching_packages(student_id,program_id);

-- One row per payment the store reports for a package (one for ordinary packages, several for installment plans).
create table dp_package_payments(
 id uuid primary key default gen_random_uuid(),
 package_id uuid not null references dp_coaching_packages(id) on delete cascade,
 external_order_id text not null, external_line_item_id text,
 status text not null check(status in ('pending','paid','refunded','failed')),
 attribution text not null default 'new' check(attribution in ('new','reference','sequential','manual')),
 recorded_at timestamptz not null default now());
create unique index dp_package_payments_external on dp_package_payments(external_order_id,coalesce(external_line_item_id,''));
create index dp_package_payments_package_idx on dp_package_payments(package_id);
alter table dp_package_payments enable row level security;
grant select on dp_package_payments to authenticated;
create policy dp_package_payments_read on dp_package_payments for select to authenticated
 using(exists(select 1 from dp_coaching_packages p where p.id=package_id and (p.student_id=auth.uid() or dp_private.manage_program(p.program_id))));

-- Payments the system refused to guess about (several open plans, or no reference). Nothing is lost; staff match them in the app.
create table dp_unmatched_payments(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 tier_id uuid not null references dp_coaching_tiers(id),
 external_order_id text not null, external_line_item_id text,
 status text not null check(status in ('pending','paid','refunded','failed')),
 plan_ref text, reason text not null,
 received_at timestamptz not null default now(),
 resolved_at timestamptz, resolved_package_id uuid references dp_coaching_packages(id), resolved_by uuid references auth.users(id));
create unique index dp_unmatched_payments_open on dp_unmatched_payments(external_order_id,coalesce(external_line_item_id,'')) where resolved_at is null;
alter table dp_unmatched_payments enable row level security;
grant select on dp_unmatched_payments to authenticated;
create policy dp_unmatched_payments_staff on dp_unmatched_payments for select to authenticated
 using(exists(select 1 from dp_coaching_tiers t where t.id=tier_id and dp_private.manage_program(t.program_id)));

-- Lessons a student may use now. Installment plans unlock in proportion to payments received (12 lessons over 3 payments:
-- 4, then 8, then 12), so a first installment can never grant the whole package.
create or replace function dp_private.unlocked_credits(total int,itotal int,ipaid int,status text) returns int
language sql immutable as $$
 select case when status in ('paid','complimentary') then total
  when status='partial' then least(total,floor(total::numeric*greatest(ipaid,0)/greatest(itotal,1))::int) else 0 end
$$;

-- Recompute a store-managed package's status from its payment rows.
create or replace function dp_private.refresh_package(pid uuid) returns void
language plpgsql security definer set search_path=public as $$
declare src text; itotal int; paid int; pend int; refunded int; st text;
begin
 select source,installments_total into src,itotal from dp_coaching_packages where id=pid;
 if src is distinct from 'woocommerce' then return; end if;
 select count(*) filter(where status='paid'),count(*) filter(where status='pending'),count(*) filter(where status='refunded')
  into paid,pend,refunded from dp_package_payments where package_id=pid;
 st:=case when paid>=itotal then 'paid' when paid>0 then 'partial' when refunded>0 then 'refunded' when pend>0 then 'pending' else 'failed' end;
 update dp_coaching_packages set installments_paid=paid,payment_status=st where id=pid;
end $$;


alter table dp_sessions add column if not exists lesson_minutes int check(lesson_minutes in (45,60,65));
alter table dp_sessions add column if not exists appointment_status text
 check(appointment_status in ('scheduled','completed','cancelled','late_cancelled','no_show'));
alter table dp_sessions add column if not exists plan_id uuid references dp_coaching_plans(id) on delete set null;
alter table dp_sessions add column if not exists package_id uuid references dp_coaching_packages(id) on delete set null;
-- A taught lesson normally draws on a paid, unlocked lesson. An instructor may waive that, but only with a recorded reason.
alter table dp_sessions add column if not exists credit_waived boolean not null default false;
alter table dp_sessions add column if not exists waive_reason text;
create unique index if not exists dp_sessions_plan_slot on dp_sessions(plan_id,scheduled_at) where plan_id is not null;
create index if not exists dp_sessions_package_idx on dp_sessions(package_id) where package_id is not null;
create index if not exists dp_sessions_upcoming_idx on dp_sessions(scheduled_at) where appointment_status='scheduled';

alter table dp_coaching_plans enable row level security;
alter table dp_coaching_packages enable row level security;
grant select,insert,update on dp_coaching_plans,dp_coaching_packages to authenticated;
create policy dp_plans_read on dp_coaching_plans for select to authenticated
 using(student_id=auth.uid() or dp_private.manage_program(program_id));
create policy dp_plans_staff_write on dp_coaching_plans for all to authenticated
 using(dp_private.manage_program(program_id)) with check(dp_private.manage_program(program_id));
create policy dp_packages_read on dp_coaching_packages for select to authenticated
 using(student_id=auth.uid() or dp_private.manage_program(program_id));
create policy dp_packages_staff_write on dp_coaching_packages for all to authenticated
 using(dp_private.manage_program(program_id)) with check(dp_private.manage_program(program_id));

-- Prevent double-booking of an instructor's slot. Two biweekly students may share a slot
-- only when they alternate weeks; a weekly student owns the whole slot.
create or replace function dp_private.check_plan_slot() returns trigger
language plpgsql set search_path=public as $$
declare s int := extract(hour from new.lesson_time)*60+extract(minute from new.lesson_time);
 -- Generated columns are not populated yet in a BEFORE trigger, so derive them here.
 wd int := extract(dow from new.first_lesson_on); par int := ((new.first_lesson_on-date '2000-01-03')/7)%2;
begin
 if new.status='active' and exists(select 1 from dp_coaching_plans o
  where o.id<>new.id and o.status='active' and o.instructor_id=new.instructor_id and o.timezone=new.timezone
  and o.weekday=wd
  and (extract(hour from o.lesson_time)*60+extract(minute from o.lesson_time)) < s+new.lesson_minutes
  and s < (extract(hour from o.lesson_time)*60+extract(minute from o.lesson_time))+o.lesson_minutes
  and (o.cadence='weekly' or new.cadence='weekly' or o.week_parity=par)) then
  raise exception 'That time slot is already taken for the chosen weeks';
 end if;
 if not exists(select 1 from dp_enrollments e where e.user_id=new.student_id and e.status='active'
  and ((e.scope_type='program' and e.scope_id=new.program_id) or (e.scope_type='course' and e.scope_id in
   (select c.id from dp_courses c where c.program_id=new.program_id)))) then
  raise exception 'Student is not actively enrolled in this program';
 end if;
 return new;
end $$;
create trigger dp_plan_slot_guard before insert or update on dp_coaching_plans
 for each row execute function dp_private.check_plan_slot();

-- Credits are consumed by completed lessons, late cancellations and no-shows only.
create or replace function dp_private.assign_package() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.appointment_status in ('completed','late_cancelled','no_show') then
  if new.package_id is null then
   perform pg_advisory_xact_lock(hashtext(new.student_id::text));
   select p.id into new.package_id from dp_coaching_packages p
   where p.student_id=new.student_id and p.program_id is not distinct from new.program_id
    and p.lesson_minutes=new.lesson_minutes and p.payment_status in ('paid','partial','complimentary')
    and (p.expires_at is null or p.expires_at>coalesce(new.scheduled_at,now()))
    and dp_private.unlocked_credits(p.credits_total,p.installments_total,p.installments_paid,p.payment_status)>(select count(*) from dp_sessions s where s.package_id=p.id
      and s.appointment_status in ('completed','late_cancelled','no_show') and s.id<>new.id)
   order by p.expires_at nulls last,p.purchased_at limit 1;
   -- Appointments can be scheduled for the whole program, but a lesson cannot be recorded as taught (or charged as a late
   -- cancellation or missed lesson) unless a paid, unlocked lesson covers it or the instructor waives payment with a reason.
   if new.package_id is null and not (new.credit_waived and length(btrim(coalesce(new.waive_reason,'')))>0) then
    raise exception 'No paid lesson is available for this student. Record the payment, or waive payment with a reason.';
   end if;
  end if;
 else
  new.package_id:=null; new.credit_waived:=false; new.waive_reason:=null;
 end if;
 return new;
end $$;
create trigger dp_session_credit_assign before insert or update of appointment_status,lesson_minutes on dp_sessions
 for each row execute function dp_private.assign_package();

-- Lesson balances: remaining credits per package. Honors the caller's RLS.
create view dp_package_balances with(security_invoker=true) as
select p.id package_id,p.student_id,p.program_id,p.lesson_minutes,p.credits_total,p.payment_status,p.purchased_at,p.expires_at,p.renewal_of,
 p.installments_total,p.installments_paid,p.tier_id,
 dp_private.unlocked_credits(p.credits_total,p.installments_total,p.installments_paid,p.payment_status) as credits_unlocked,
 greatest(dp_private.unlocked_credits(p.credits_total,p.installments_total,p.installments_paid,p.payment_status)-count(s.id)::int,0) as credits_remaining,
 p.payment_status in ('paid','partial','complimentary') and (p.expires_at is null or p.expires_at>now()) as usable,
 exists(select 1 from dp_coaching_packages r where r.renewal_of=p.id) as renewed,
 p.tier_name,p.resource_level,p.personal_plan,p.assessments_included,p.recording_feedback_included,
 -- Approximate: shared feedback given on recorded submissions during the package period.
 (select count(*)::int from dp_feedback f join dp_submissions sb on sb.id=f.submission_id
   where sb.student_id=p.student_id and not f.is_private and cardinality(sb.file_urls)>0
   and f.created_at>=p.purchased_at and (p.expires_at is null or f.created_at<=p.expires_at)) as recording_feedback_used
from dp_coaching_packages p
left join dp_sessions s on s.package_id=p.id and s.appointment_status in ('completed','late_cancelled','no_show')
group by p.id;
grant select on dp_package_balances to authenticated;

-- Create upcoming scheduled lessons for a plan (idempotent; at most 120 days ahead).
create or replace function public.dp_generate_appointments(target_plan_id uuid,through date)
returns int language plpgsql security invoker set search_path=public as $$
declare p dp_coaching_plans; d date; step int; n int:=0; ts timestamptz; c int;
begin
 select * into p from dp_coaching_plans where id=target_plan_id;
 if p.id is null or not dp_private.manage_program(p.program_id) then raise exception 'Plan unavailable'; end if;
 if p.status<>'active' then raise exception 'Plan is not active'; end if;
 if through>current_date+120 then raise exception 'Generate at most 120 days ahead'; end if;
 step:=case p.cadence when 'weekly' then 7 else 14 end;
 d:=p.first_lesson_on;
 if d<current_date then d:=d+(((current_date-d)+step-1)/step)*step; end if;
 while d<=through loop
  ts:=(d+p.lesson_time) at time zone p.timezone;
  insert into dp_sessions(student_id,mentor_id,program_id,session_type,scheduled_at,lesson_minutes,appointment_status,plan_id,created_by)
  values(p.student_id,p.instructor_id,p.program_id,'follow_up',ts,p.lesson_minutes,'scheduled',p.id,auth.uid())
  on conflict(plan_id,scheduled_at) where plan_id is not null do nothing;
  get diagnostics c=row_count; n:=n+c; d:=d+step;
 end loop;
 return n;
end $$;
revoke all on function public.dp_generate_appointments(uuid,date) from public,anon;
grant execute on function public.dp_generate_appointments(uuid,date) to authenticated;

-- Staff-recorded outcome for a scheduled lesson (credit use follows the status).
create or replace function public.dp_set_lesson_status(target_id uuid,next_status text,waive_reason text default null)
returns void language plpgsql security invoker set search_path=public as $$
declare w text:=nullif(btrim(coalesce(waive_reason,'')),'');
begin
 if next_status not in ('scheduled','completed','cancelled','late_cancelled','no_show') then raise exception 'Unknown lesson status'; end if;
 update dp_sessions set appointment_status=next_status,credit_waived=(w is not null),waive_reason=w
  where id=target_id and appointment_status is not null;
 if not found then raise exception 'Lesson unavailable'; end if;
end $$;
revoke all on function public.dp_set_lesson_status(uuid,text,text) from public,anon;
grant execute on function public.dp_set_lesson_status(uuid,text,text) to authenticated;

-- Roster for instructors who manage a program (profiles are otherwise readable only by owner/admin).
create or replace function public.dp_program_students(target_program_slug text)
returns table(id uuid,full_name text,email text,enrolled_at timestamptz) language sql stable security definer set search_path=public as $$
 select p.id,p.full_name,p.email,min(e.enrolled_at) from profiles p
 join dp_enrollments e on e.user_id=p.id and e.status='active'
 join dp_programs g on g.slug=target_program_slug and dp_private.manage_program(g.id)
 and ((e.scope_type='program' and e.scope_id=g.id) or (e.scope_type='course' and e.scope_id in (select c.id from dp_courses c where c.program_id=g.id)))
 group by p.id,p.full_name,p.email
$$;
revoke all on function public.dp_program_students(text) from public,anon;
grant execute on function public.dp_program_students(text) to authenticated;

-- Student-safe overview: own plan, upcoming/recent lessons, credits. No private notes.
create or replace function public.dp_my_coaching_overview(target_program_slug text)
returns jsonb language sql stable security definer set search_path=public as $$
 with prog as (select id from dp_programs where slug=target_program_slug),
 ok as (select 1 from prog where auth.uid() is not null and exists(select 1 from dp_enrollments e
   where e.user_id=auth.uid() and e.status in ('active','completed') and ((e.scope_type='program' and e.scope_id=prog.id)
   or (e.scope_type='course' and e.scope_id in (select c.id from dp_courses c where c.program_id=prog.id))))),
 sess as (select s.* from dp_sessions s,prog,ok where s.student_id=auth.uid() and s.program_id=prog.id and s.appointment_status is not null),
 bal as (select p.*,dp_private.unlocked_credits(p.credits_total,p.installments_total,p.installments_paid,p.payment_status) as unlocked,
   greatest(dp_private.unlocked_credits(p.credits_total,p.installments_total,p.installments_paid,p.payment_status)-(select count(*) from sess s where s.package_id=p.id
   and s.appointment_status in ('completed','late_cancelled','no_show'))::int,0) as remaining
   from dp_coaching_packages p,prog,ok where p.student_id=auth.uid() and p.program_id=prog.id)
 select case when not exists(select 1 from ok) then null else jsonb_build_object(
  'plan',(select to_jsonb(x) from (select cadence,lesson_minutes,lesson_time,weekday,timezone,status from dp_coaching_plans pl,prog
     where pl.student_id=auth.uid() and pl.program_id=prog.id and pl.status='active') x),
  'upcoming',coalesce((select jsonb_agg(to_jsonb(x) order by x.scheduled_at) from (select id,scheduled_at,lesson_minutes from sess
     where appointment_status='scheduled' and scheduled_at>=now() order by scheduled_at limit 4) x),'[]'),
  'history',coalesce((select jsonb_agg(to_jsonb(x) order by x.scheduled_at desc) from (select id,scheduled_at,lesson_minutes,appointment_status from sess
     where appointment_status<>'scheduled' or scheduled_at<now() order by scheduled_at desc limit 12) x),'[]'),
  'credits_by_minutes',coalesce((select jsonb_object_agg(m,n) from (select lesson_minutes::text m,sum(remaining)::int n from bal
     where payment_status in ('paid','partial','complimentary') and (expires_at is null or expires_at>now()) group by lesson_minutes) c),'{}'),
  'packages',coalesce((select jsonb_agg(to_jsonb(x) order by x.purchased_at desc) from (select credits_total,remaining,unlocked as credits_unlocked,installments_total,installments_paid,lesson_minutes,
     payment_status,expires_at,purchased_at,tier_name,resource_level,personal_plan,assessments_included,recording_feedback_included,
     (select count(*)::int from dp_feedback f join dp_submissions sb on sb.id=f.submission_id
       where sb.student_id=auth.uid() and not f.is_private and cardinality(sb.file_urls)>0
       and f.created_at>=bal.purchased_at and (bal.expires_at is null or f.created_at<=bal.expires_at)) recording_feedback_used from bal) x),'[]')) end
$$;
revoke all on function public.dp_my_coaching_overview(text) from public,anon;
grant execute on function public.dp_my_coaching_overview(text) to authenticated;

-- Shared package writer. Runs with the caller's rights; copies the tier's entitlements onto the package.
create or replace function dp_private.create_package(student uuid,tier uuid,quantity int,pay_status text,expiry_override timestamptz,
 src text,order_id text,line_item_id text,sku text,creator uuid) returns uuid
language plpgsql set search_path=public as $$
declare t dp_coaching_tiers; prev uuid; result uuid;
begin
 if pay_status not in ('pending','paid','complimentary','refunded','failed') then raise exception 'Unsupported payment status'; end if;
 if quantity is null or quantity<1 or quantity>20 then raise exception 'Quantity must be between 1 and 20'; end if;
 select * into t from dp_coaching_tiers where id=tier;
 if t.id is null then raise exception 'Package type not found'; end if;
 select id into prev from dp_coaching_packages p where p.student_id=student and p.program_id=t.program_id
  and not exists(select 1 from dp_coaching_packages r where r.renewal_of=p.id) order by purchased_at desc limit 1;
 insert into dp_coaching_packages(student_id,program_id,lesson_minutes,credits_total,payment_status,expires_at,renewal_of,source,
  external_order_id,external_line_item_id,product_sku,tier_id,tier_name,resource_level,personal_plan,assessments_included,
  recording_feedback_included,created_by,installments_total,installments_paid)
 values(student,t.program_id,t.lesson_minutes,t.lesson_count*quantity,pay_status,
  coalesce(expiry_override,case when t.valid_days is null then null else now()+make_interval(days=>t.valid_days) end),prev,src,
  order_id,line_item_id,sku,t.id,t.name,t.resource_level,t.personal_plan,t.assessments_included*quantity,
  t.recording_feedback_included*quantity,creator,t.installments,case when pay_status in ('paid','complimentary') then t.installments else 0 end)
 returning id into result;
 return result;
end $$;

-- Instructor action: record a package for a student from a tier (payments made outside the website).
create or replace function public.dp_create_package(student uuid,tier uuid,pay_status text default 'paid',
 quantity int default 1,expiry_override timestamptz default null) returns uuid
language plpgsql security invoker set search_path=public as $$
declare pid uuid;
begin
 select program_id into pid from dp_coaching_tiers where id=tier;
 if pid is null or not dp_private.manage_program(pid) then raise exception 'Package unavailable'; end if;
 if pay_status not in ('pending','paid','complimentary') then raise exception 'Choose pending, paid or complimentary'; end if;
 return dp_private.create_package(student,tier,quantity,pay_status,expiry_override,'manual',null,null,null,auth.uid());
end $$;
revoke all on function public.dp_create_package(uuid,uuid,text,int,timestamptz) from public,anon;
grant execute on function public.dp_create_package(uuid,uuid,text,int,timestamptz) to authenticated;

-- Payment entitlement writer for the WooCommerce webhook (service role only, idempotent per order line).
-- Ordinary packages: one package per paid order line. Installment packages (tier.installments > 1): each paid order line is one
-- payment on ONE specific purchase. Matching, safest first:
--   1. plan_ref (the first order's id, sent by the store as the parent order or a plan reference) -> that exact purchase;
--   2. no reference and no open plan -> this is a new purchase;
--   3. no reference, exactly one open plan and the tier allows it -> that plan (recorded as 'sequential');
--   4. anything else -> the payment waits in dp_unmatched_payments for a person to match; nothing is guessed.
create or replace function public.dp_record_package_purchase(student uuid,tier uuid,quantity int,order_id text,line_item_id text,
 sku text,pay_status text,plan_ref text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare pid uuid; t dp_coaching_tiers; open_ids uuid[]; attr text:='new'; why text;
begin
 if pay_status not in ('pending','paid','refunded','failed') then raise exception 'Unsupported payment status'; end if;
 select package_id into pid from dp_package_payments where external_order_id=order_id and coalesce(external_line_item_id,'')=coalesce(line_item_id,'');
 if pid is not null then
  update dp_package_payments set status=pay_status,recorded_at=now()
   where external_order_id=order_id and coalesce(external_line_item_id,'')=coalesce(line_item_id,'');
  perform dp_private.refresh_package(pid);
  return pid;
 end if;
 if exists(select 1 from dp_unmatched_payments u where u.resolved_at is null and u.external_order_id=order_id and coalesce(u.external_line_item_id,'')=coalesce(line_item_id,'')) then
  update dp_unmatched_payments set status=pay_status where resolved_at is null and external_order_id=order_id and coalesce(external_line_item_id,'')=coalesce(line_item_id,'');
  return null;
 end if;
 select * into t from dp_coaching_tiers where id=tier;
 if t.id is null then raise exception 'Package type not found'; end if;
 if t.installments>1 then
  if quantity<>1 then raise exception 'Installment packages must be bought one payment at a time'; end if;
  if plan_ref is not null then
   select p.id into pid from dp_coaching_packages p join dp_package_payments x on x.package_id=p.id
    where x.external_order_id=plan_ref and p.student_id=student and p.tier_id=tier limit 1 for update of p;
   -- The first payment may simply not have arrived yet; failing makes the store retry the delivery later.
   if pid is null then raise exception 'The referenced purchase has not been recorded yet'; end if;
   if (select count(*) from dp_package_payments x where x.package_id=pid and x.status in ('paid','pending'))>=(select installments_total from dp_coaching_packages where id=pid) then
    pid:=null; why:='The referenced plan already has all of its payments';
   else attr:='reference'; end if;
  else
   select array_agg(p.id order by p.purchased_at) into open_ids from dp_coaching_packages p
    where p.student_id=student and p.tier_id=tier and p.source='woocommerce' and p.installments_total>1
     and (select count(*) from dp_package_payments x where x.package_id=p.id and x.status in ('paid','pending'))<p.installments_total;
   if open_ids is null then
    pid:=dp_private.create_package(student,tier,1,'pending',null,'woocommerce',order_id,line_item_id,sku,null);
   elsif cardinality(open_ids)=1 and t.allow_unreferenced_match then
    pid:=open_ids[1]; attr:='sequential';
   else
    why:=case when cardinality(open_ids)=1 then 'This student has an open plan and the payment carries no reference' else 'This student has several open plans and the payment carries no reference' end;
   end if;
  end if;
  if pid is null then
   insert into dp_unmatched_payments(student_id,tier_id,external_order_id,external_line_item_id,status,plan_ref,reason)
    values(student,tier,order_id,line_item_id,pay_status,plan_ref,why);
   return null;
  end if;
 else
  pid:=dp_private.create_package(student,tier,quantity,'pending',null,'woocommerce',order_id,line_item_id,sku,null);
 end if;
 insert into dp_package_payments(package_id,external_order_id,external_line_item_id,status,attribution) values(pid,order_id,line_item_id,pay_status,attr);
 perform dp_private.refresh_package(pid);
 return pid;
end $$;
revoke all on function public.dp_record_package_purchase(uuid,uuid,int,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.dp_record_package_purchase(uuid,uuid,int,text,text,text,text,text) to service_role;

-- Staff match a waiting payment to a specific purchase, or start a new purchase from it.
create or replace function public.dp_resolve_unmatched_payment(unmatched_id uuid,target_package uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare u dp_unmatched_payments; t dp_coaching_tiers; pid uuid;
begin
 select * into u from dp_unmatched_payments where id=unmatched_id and resolved_at is null for update;
 if u.id is null then raise exception 'Payment not found or already matched'; end if;
 select * into t from dp_coaching_tiers where id=u.tier_id;
 if auth.uid() is null or not dp_private.manage_program(t.program_id) then raise exception 'Not authorized'; end if;
 if target_package is null then
  pid:=dp_private.create_package(u.student_id,u.tier_id,1,'pending',null,'woocommerce',u.external_order_id,u.external_line_item_id,null,null);
 else
  select id into pid from dp_coaching_packages where id=target_package and student_id=u.student_id and tier_id=u.tier_id and source='woocommerce';
  if pid is null then raise exception 'Choose one of this student''s purchases of this package'; end if;
  if (select count(*) from dp_package_payments x where x.package_id=pid and x.status in ('paid','pending'))>=(select installments_total from dp_coaching_packages where id=pid) then
   raise exception 'That purchase already has all of its payments'; end if;
 end if;
 insert into dp_package_payments(package_id,external_order_id,external_line_item_id,status,attribution) values(pid,u.external_order_id,u.external_line_item_id,u.status,'manual');
 update dp_unmatched_payments set resolved_at=now(),resolved_package_id=pid,resolved_by=auth.uid() where id=u.id;
 perform dp_private.refresh_package(pid);
 return pid;
end $$;
revoke all on function public.dp_resolve_unmatched_payment(uuid,uuid) from public,anon;
grant execute on function public.dp_resolve_unmatched_payment(uuid,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reusable library with access levels: one set of lessons, many packages.
-- A lesson with no row here is open to every enrolled student (today's behaviour).
-- ---------------------------------------------------------------------------
create table dp_lesson_access(
 lesson_id uuid primary key references dp_lessons(id) on delete cascade,
 -- A lesson's content opens only for a paid package at this level or higher that has unlocked at least this many lessons.
 min_level smallint not null default 0 check(min_level between 0 and 3),
 min_unlocked_lessons int not null default 0 check(min_unlocked_lessons between 0 and 200),
 updated_at timestamptz not null default now(),
 check(min_level>0 or min_unlocked_lessons>0));
alter table dp_lesson_access enable row level security;
grant select,insert,update,delete on dp_lesson_access to authenticated;
create policy dp_lesson_access_staff on dp_lesson_access for all to authenticated
 using(exists(select 1 from dp_lessons l join dp_modules m on m.id=l.module_id where l.id=lesson_id and dp_private.manage_course(m.course_id)))
 with check(exists(select 1 from dp_lessons l join dp_modules m on m.id=l.module_id where l.id=lesson_id and dp_private.manage_course(m.course_id)));
-- Highest unlocked-lesson count among the student's paid, unexpired packages at the given level or higher (cumulative entitlement, not remaining).
create or replace function dp_private.student_unlocked_lessons(uid uuid,at_level int) returns int
language sql stable security definer set search_path=public as $$
 select coalesce(max(dp_private.unlocked_credits(credits_total,installments_total,installments_paid,payment_status)),0)::int
 from dp_coaching_packages where student_id=uid and resource_level>=at_level
  and payment_status in ('paid','partial','complimentary') and (expires_at is null or expires_at>now())
$$;
create or replace function dp_private.student_resource_level(uid uuid) returns int
language sql stable security definer set search_path=public as $$
 select coalesce(max(resource_level),0)::int from dp_coaching_packages
 where student_id=uid and payment_status in ('paid','partial','complimentary') and (expires_at is null or expires_at>now())
$$;
create or replace function dp_private.lesson_level_ok(lid uuid, mid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (
  not exists(select 1 from dp_lesson_access a where a.lesson_id=lid)
  or exists(select 1 from dp_lesson_access a where a.lesson_id=lid
      and exists(select 1 from dp_coaching_packages p where p.student_id=auth.uid() and p.resource_level>=a.min_level
        and p.payment_status in ('paid','partial','complimentary') and (p.expires_at is null or p.expires_at>now())
        and dp_private.unlocked_credits(p.credits_total,p.installments_total,p.installments_paid,p.payment_status)>=greatest(a.min_unlocked_lessons,1)))
  or exists(select 1 from dp_modules m where m.id=mid and dp_private.manage_course(m.course_id)))
$$;
create or replace function dp_private.lesson_level_ok_id(lid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from dp_lessons l where l.id=lid and dp_private.lesson_level_ok(l.id,l.module_id))
$$;
-- Gate the CONTENT (blocks and private files), not the lesson row: after a refund a student still sees lesson titles, progress,
-- assignments and feedback; only teaching content they have not paid for is closed.
create policy dp_lesson_blocks_level_boundary on dp_lesson_blocks as restrictive for select to authenticated
 using(dp_private.lesson_level_ok_id(lesson_id));
create policy dp_private_file_level_boundary on storage.objects as restrictive for select to authenticated
 using(bucket_id<>'course-media-private' or (storage.foldername(name))[1]<>'lessons'
  or dp_private.lesson_level_ok_id(dp_safe_uuid((storage.foldername(name))[2])));
-- What the lesson page needs to explain a closed lesson, without exposing the access table.
create or replace function public.dp_my_lesson_lock(target_lesson uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare a dp_lesson_access; mid uuid;
begin
 select * into a from dp_lesson_access where lesson_id=target_lesson;
 select module_id into mid from dp_lessons where id=target_lesson;
 if a.lesson_id is null or dp_private.lesson_level_ok(target_lesson,mid) then return jsonb_build_object('locked',false); end if;
 return jsonb_build_object('locked',true,'needed_lessons',greatest(a.min_unlocked_lessons,1),'needed_level',a.min_level,
  'unlocked_now',dp_private.student_unlocked_lessons(auth.uid(),a.min_level));
end $$;
revoke all on function public.dp_my_lesson_lock(uuid) from public,anon;
grant execute on function public.dp_my_lesson_lock(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Consultation inquiries (Google Form follow-up). Staff-only; PII.
-- ---------------------------------------------------------------------------
create table dp_consultation_inquiries(
 id uuid primary key default gen_random_uuid(),
 external_id text unique,
 full_name text not null, email text not null, phone text, interest text, message text,
 source text not null default 'google_form',
 status text not null default 'new' check(status in ('new','acknowledged','booked','consulted','recommended','enrolled','closed')),
 submitted_at timestamptz not null default now(),
 acknowledged_at timestamptz, booking_link_sent_at timestamptz,
 reminder_sent_at timestamptz, booked_at timestamptz, consultation_at timestamptz,
 recommended_plan text, recommendation_sent_at timestamptz,
 student_id uuid references auth.users(id), notes text,
 created_at timestamptz not null default now());
create index dp_consultation_status_idx on dp_consultation_inquiries(status,submitted_at);
alter table dp_consultation_inquiries enable row level security;
grant select,insert,update on dp_consultation_inquiries to authenticated;
create policy dp_consultations_staff on dp_consultation_inquiries for all to authenticated
 using(dp_is_super_admin() or dp_has_role('faculty')) with check(dp_is_super_admin() or dp_has_role('faculty'));

-- ---------------------------------------------------------------------------
-- 5. Testimonials: upload path, recorded consent, and an enforced publication gate.
-- ---------------------------------------------------------------------------
alter table dp_voice_testimonials add column if not exists consented_at timestamptz;
alter table dp_voice_testimonials add column if not exists published_at timestamptz;
alter table dp_voice_testimonials add column if not exists published_by uuid references auth.users(id);
alter table dp_voice_testimonials add column if not exists consent_withdrawn_at timestamptz;
alter table dp_voice_testimonials drop constraint if exists dp_voice_testimonials_content;
alter table dp_voice_testimonials add constraint dp_voice_testimonials_content check(
 nullif(btrim(coalesce(review_text,'')),'') is not null or nullif(btrim(coalesce(video_url,'')),'') is not null or video_path is not null);
alter table dp_voice_testimonials add constraint dp_voice_testimonials_video_path
 check(video_path is null or (video_path like student_id::text||'/%' and video_path !~ '\.\.'));
alter table dp_voice_testimonials add constraint dp_voice_testimonials_publish_gate
 check(published_at is null or (status='approved' and allow_public_use and consented_at is not null));
drop policy if exists dp_voice_testimonials_student_insert on dp_voice_testimonials;
create policy dp_voice_testimonials_student_insert on dp_voice_testimonials for insert to authenticated
 with check(student_id=auth.uid() and status='pending' and reviewed_at is null and published_at is null
  and published_by is null and dp_private.voice_member(auth.uid()));
create or replace function dp_private.guard_testimonial() returns trigger
language plpgsql set search_path=public as $$
begin
 if tg_op='INSERT' then
  new.consented_at:=case when new.allow_public_use then now() else null end;
 else
  -- Reviewers decide status and publication only; submitted content and consent are immutable.
  if new.student_id<>old.student_id or new.review_text is distinct from old.review_text
   or new.video_url is distinct from old.video_url or new.video_path is distinct from old.video_path
   or new.consented_at is distinct from old.consented_at then
   raise exception 'Submitted testimonial content and consent cannot be changed';
  end if;
  -- Only the student's own withdrawal (dp_withdraw_testimonial_consent) may change consent, and only to withdraw it.
  if new.allow_public_use<>old.allow_public_use or new.consent_withdrawn_at is distinct from old.consent_withdrawn_at then
   if coalesce(current_setting('dp.withdraw',true),'')<>'1' or new.allow_public_use or old.consent_withdrawn_at is not null then
    raise exception 'Submitted testimonial content and consent cannot be changed'; end if;
  end if;
  if new.published_at is not null and new.published_at is distinct from old.published_at and new.status<>'approved' then
   raise exception 'Only approved testimonials can be published';
  end if;
  if new.published_at is distinct from old.published_at then
   new.published_by:=case when new.published_at is null then null else auth.uid() end;
  end if;
  if new.status<>'approved' then new.published_at:=null; new.published_by:=null; end if;
 end if;
 return new;
end $$;
create trigger dp_testimonial_guard before insert or update on dp_voice_testimonials
 for each row execute function dp_private.guard_testimonial();

-- Student withdraws public-use permission: unpublishes at once and keeps the private record.
create or replace function public.dp_withdraw_testimonial_consent(target_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform set_config('dp.withdraw','1',true);
 update dp_voice_testimonials set allow_public_use=false,consent_withdrawn_at=now(),published_at=null,published_by=null
  where id=target_id and student_id=auth.uid() and allow_public_use;
 if not found then raise exception 'Nothing to withdraw'; end if;
 perform set_config('dp.withdraw','',true);
end $$;
revoke all on function public.dp_withdraw_testimonial_consent(uuid) from public,anon;
grant execute on function public.dp_withdraw_testimonial_consent(uuid) to authenticated;

-- Student removes a testimonial entirely (the app then deletes the uploaded video, which becomes deletable once unreferenced).
create or replace function public.dp_delete_my_testimonial(target_id uuid) returns text
language plpgsql security definer set search_path=public as $$
declare path text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 delete from dp_voice_testimonials where id=target_id and student_id=auth.uid() returning video_path into path;
 if not found then raise exception 'Testimonial not found'; end if;
 return path;
end $$;
revoke all on function public.dp_delete_my_testimonial(uuid) from public,anon;
grant execute on function public.dp_delete_my_testimonial(uuid) to authenticated;

-- Public display: only approved, published testimonials whose student granted permission and has not withdrawn it.
-- Shows the first name only. Video objects are served only while the testimonial stays published (policy below).
create or replace function public.dp_public_testimonials()
returns table(id uuid,display_name text,review_text text,video_path text,published_at timestamptz)
language sql stable security definer set search_path=public as $$
 select t.id,coalesce(nullif(split_part(btrim(coalesce(p.full_name,'')),' ',1),''),'A student'),t.review_text,t.video_path,t.published_at
 from dp_voice_testimonials t left join profiles p on p.id=t.student_id
 where t.published_at is not null and t.status='approved' and t.allow_public_use and t.consented_at is not null and t.consent_withdrawn_at is null
 order by t.published_at desc limit 50
$$;
revoke all on function public.dp_public_testimonials() from public;
grant execute on function public.dp_public_testimonials() to anon,authenticated;

create or replace function public.dp_is_published_testimonial_video(obj text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from dp_voice_testimonials t where t.video_path=obj and t.published_at is not null and t.status='approved'
  and t.allow_public_use and t.consented_at is not null and t.consent_withdrawn_at is null)
$$;
revoke all on function public.dp_is_published_testimonial_video(text) from public;
grant execute on function public.dp_is_published_testimonial_video(text) to anon,authenticated;
create policy voice_testimonials_published_read on storage.objects for select to anon,authenticated
 using(bucket_id='voice-testimonials' and public.dp_is_published_testimonial_video(name));

revoke all on all functions in schema dp_private from public,anon;
grant execute on all functions in schema dp_private to authenticated;
