-- Voice production readiness: private recordings, attempt history, coaching schedule and
-- lesson credits, consultation inquiries, and consent-gated testimonial video.
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
 lesson_minutes int not null check(lesson_minutes in (45,60)),
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

create table dp_coaching_packages(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 program_id uuid not null references dp_programs(id),
 lesson_minutes int not null check(lesson_minutes in (45,60)),
 credits_total int not null check(credits_total>0),
 payment_status text not null default 'pending' check(payment_status in ('pending','paid','complimentary','refunded','failed')),
 purchased_at timestamptz not null default now(),
 expires_at timestamptz,
 renewal_of uuid references dp_coaching_packages(id),
 source text not null default 'manual' check(source in ('manual','woocommerce')),
 external_order_id text, external_line_item_id text, product_sku text, notes text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now());
create unique index dp_coaching_packages_external on dp_coaching_packages(source,external_order_id,coalesce(external_line_item_id,''))
 where external_order_id is not null;
create index dp_coaching_packages_student_idx on dp_coaching_packages(student_id,program_id);

alter table dp_sessions add column if not exists lesson_minutes int check(lesson_minutes in (45,60));
alter table dp_sessions add column if not exists appointment_status text
 check(appointment_status in ('scheduled','completed','cancelled','late_cancelled','no_show'));
alter table dp_sessions add column if not exists plan_id uuid references dp_coaching_plans(id) on delete set null;
alter table dp_sessions add column if not exists package_id uuid references dp_coaching_packages(id) on delete set null;
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
    and p.lesson_minutes=new.lesson_minutes and p.payment_status in ('paid','complimentary')
    and (p.expires_at is null or p.expires_at>coalesce(new.scheduled_at,now()))
    and p.credits_total>(select count(*) from dp_sessions s where s.package_id=p.id
      and s.appointment_status in ('completed','late_cancelled','no_show') and s.id<>new.id)
   order by p.expires_at nulls last,p.purchased_at limit 1;
  end if;
 else
  new.package_id:=null;
 end if;
 return new;
end $$;
create trigger dp_session_credit_assign before insert or update of appointment_status,lesson_minutes on dp_sessions
 for each row execute function dp_private.assign_package();

-- Lesson balances: remaining credits per package. Honors the caller's RLS.
create view dp_package_balances with(security_invoker=true) as
select p.id package_id,p.student_id,p.program_id,p.lesson_minutes,p.credits_total,p.payment_status,p.purchased_at,p.expires_at,
 p.renewal_of,p.credits_total-count(s.id)::int as credits_remaining,
 p.payment_status in ('paid','complimentary') and (p.expires_at is null or p.expires_at>now()) as usable,
 exists(select 1 from dp_coaching_packages r where r.renewal_of=p.id) as renewed
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
create or replace function public.dp_set_lesson_status(target_id uuid,next_status text)
returns void language plpgsql security invoker set search_path=public as $$
begin
 if next_status not in ('scheduled','completed','cancelled','late_cancelled','no_show') then raise exception 'Unknown lesson status'; end if;
 update dp_sessions set appointment_status=next_status where id=target_id and appointment_status is not null;
 if not found then raise exception 'Lesson unavailable'; end if;
end $$;
revoke all on function public.dp_set_lesson_status(uuid,text) from public,anon;
grant execute on function public.dp_set_lesson_status(uuid,text) to authenticated;

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
 bal as (select p.*,p.credits_total-(select count(*) from sess s where s.package_id=p.id
   and s.appointment_status in ('completed','late_cancelled','no_show'))::int as remaining
   from dp_coaching_packages p,prog,ok where p.student_id=auth.uid() and p.program_id=prog.id)
 select case when not exists(select 1 from ok) then null else jsonb_build_object(
  'plan',(select to_jsonb(x) from (select cadence,lesson_minutes,lesson_time,weekday,timezone,status from dp_coaching_plans pl,prog
     where pl.student_id=auth.uid() and pl.program_id=prog.id and pl.status='active') x),
  'upcoming',coalesce((select jsonb_agg(to_jsonb(x) order by x.scheduled_at) from (select id,scheduled_at,lesson_minutes from sess
     where appointment_status='scheduled' and scheduled_at>=now() order by scheduled_at limit 4) x),'[]'),
  'history',coalesce((select jsonb_agg(to_jsonb(x) order by x.scheduled_at desc) from (select id,scheduled_at,lesson_minutes,appointment_status from sess
     where appointment_status<>'scheduled' or scheduled_at<now() order by scheduled_at desc limit 12) x),'[]'),
  'credits_by_minutes',coalesce((select jsonb_object_agg(m,n) from (select lesson_minutes::text m,sum(remaining)::int n from bal
     where payment_status in ('paid','complimentary') and (expires_at is null or expires_at>now()) group by lesson_minutes) c),'{}'),
  'packages',coalesce((select jsonb_agg(to_jsonb(x) order by x.purchased_at desc) from (select credits_total,remaining,lesson_minutes,
     payment_status,expires_at,purchased_at from bal) x),'[]')) end
$$;
revoke all on function public.dp_my_coaching_overview(text) from public,anon;
grant execute on function public.dp_my_coaching_overview(text) to authenticated;

-- Payment entitlement writer for the WooCommerce webhook (service role only, idempotent).
create or replace function public.dp_record_package_purchase(student uuid,program_slug text,minutes int,credits int,
 valid_days int,order_id text,line_item_id text,sku text,pay_status text)
returns uuid language plpgsql security definer set search_path=public as $$
declare pid uuid; prog uuid; prev uuid; result uuid;
begin
 if pay_status not in ('pending','paid','refunded','failed') then raise exception 'Unsupported payment status'; end if;
 select id into prog from dp_programs where slug=program_slug;
 if prog is null then raise exception 'Unknown program'; end if;
 select id into pid from dp_coaching_packages where source='woocommerce' and external_order_id=order_id
  and coalesce(external_line_item_id,'')=coalesce(line_item_id,'');
 if pid is not null then
  update dp_coaching_packages set payment_status=pay_status where id=pid;
  return pid;
 end if;
 select id into prev from dp_coaching_packages p where p.student_id=student and p.program_id=prog
  and not exists(select 1 from dp_coaching_packages r where r.renewal_of=p.id) order by purchased_at desc limit 1;
 insert into dp_coaching_packages(student_id,program_id,lesson_minutes,credits_total,payment_status,expires_at,renewal_of,
  source,external_order_id,external_line_item_id,product_sku)
 values(student,prog,minutes,credits,pay_status,case when valid_days is null then null else now()+make_interval(days=>valid_days) end,
  prev,'woocommerce',order_id,line_item_id,sku) returning id into result;
 return result;
end $$;
revoke all on function public.dp_record_package_purchase(uuid,text,int,int,int,text,text,text,text) from public,anon,authenticated;
grant execute on function public.dp_record_package_purchase(uuid,text,int,int,int,text,text,text,text) to service_role;

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
   or new.allow_public_use<>old.allow_public_use or new.consented_at is distinct from old.consented_at then
   raise exception 'Submitted testimonial content and consent cannot be changed';
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

revoke all on all functions in schema dp_private from public,anon;
grant execute on all functions in schema dp_private to authenticated;
