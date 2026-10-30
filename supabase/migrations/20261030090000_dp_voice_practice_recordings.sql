-- Private Practice Recording Library (Cloudflare R2 object storage + Supabase metadata and access rules).
--
-- ADDITIVE ONLY and NOT YET APPLIED. Apply after 20261029110000. Audio/video bytes live in a PRIVATE R2 bucket and are
-- reached only through short-lived presigned URLs minted by the app server AFTER these functions confirm ownership.
-- Students and instructors never receive R2 credentials. This table does not touch dp_submissions or its attempt history,
-- which stay as the official homework record; a "submitted" practice recording is simply attached to an assignment.

create table dp_practice_recordings(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 assignment_id uuid references dp_assignments(id) on delete set null,
 lesson_id uuid references dp_lessons(id) on delete set null,
 label text not null default 'Personal practice'
  check(label in ('Verse','Chorus','Bridge','Warmup','Pitch exercise','Breath exercise','Song','Personal practice','Other')),
 title text not null default '' check(length(title)<=120),
 part_no int not null default 1 check(part_no between 1 and 50),
 revision_no int not null default 1 check(revision_no between 1 and 50),
 revision_of uuid references dp_practice_recordings(id),
 storage_provider text not null default 'r2' check(storage_provider in ('r2')),
 storage_key text not null unique,
 content_type text not null check(content_type in ('audio/mpeg','audio/mp4','audio/x-m4a','audio/m4a','audio/aac','audio/wav','audio/x-wav','audio/webm','audio/ogg','video/mp4','video/quicktime','video/webm')),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=104857600),
 duration_seconds int check(duration_seconds is null or duration_seconds between 1 and 7200),
 -- pending: upload URL issued, bytes not confirmed. saved: private draft. submitted: sent to the instructor.
 -- reviewed / returned: instructor outcome. discarded: student removed a draft (object purged by cleanup).
 status text not null default 'pending' check(status in ('pending','saved','submitted','reviewed','returned','discarded')),
 created_at timestamptz not null default now(),
 uploaded_at timestamptz, submitted_at timestamptz, reviewed_at timestamptz, discarded_at timestamptz,
 purged_at timestamptz);
create index dp_practice_recordings_student_idx on dp_practice_recordings(student_id,created_at desc);
create index dp_practice_recordings_assignment_idx on dp_practice_recordings(assignment_id,part_no,revision_no);
-- Duplicate protection: one live recording per numbered part and revision; a recording can be revised exactly once.
create unique index dp_practice_recordings_part_uq on dp_practice_recordings(student_id,assignment_id,part_no,revision_no)
 where assignment_id is not null and status<>'discarded';
create unique index dp_practice_recordings_revision_uq on dp_practice_recordings(revision_of) where revision_of is not null and status<>'discarded';

-- Feedback is append-only: there is no update or delete path, so earlier feedback is never overwritten.
create table dp_practice_recording_feedback(
 id uuid primary key default gen_random_uuid(),
 recording_id uuid not null references dp_practice_recordings(id) on delete cascade,
 author_id uuid not null references auth.users(id),
 kind text not null check(kind in ('feedback','return_for_revision')),
 body text not null check(length(btrim(body)) between 1 and 4000),
 follow_up text check(follow_up is null or length(follow_up)<=1000),
 created_at timestamptz not null default now());
create index dp_practice_feedback_idx on dp_practice_recording_feedback(recording_id,created_at);

alter table dp_practice_recordings enable row level security;
alter table dp_practice_recording_feedback enable row level security;
-- Reads only. Every write goes through the security-definer functions below.
revoke all on dp_practice_recordings,dp_practice_recording_feedback from anon,authenticated;
grant select on dp_practice_recordings,dp_practice_recording_feedback to authenticated;
create policy dp_practice_rec_read on dp_practice_recordings for select to authenticated using(
 status<>'discarded' and ((student_id=auth.uid() and dp_private.voice_member(auth.uid())) or dp_private.manage_voice()));
create policy dp_practice_fb_read on dp_practice_recording_feedback for select to authenticated using(
 exists(select 1 from dp_practice_recordings r where r.id=recording_id
  and ((r.student_id=auth.uid() and dp_private.voice_member(auth.uid())) or dp_private.manage_voice())));
-- Restrictive guard: a student with no Voice enrollment (or an ex-student) sees nothing even if another policy is added later.
create policy dp_practice_rec_program on dp_practice_recordings as restrictive for select to authenticated using(
 dp_private.manage_voice() or dp_private.voice_member(auth.uid()));

-- ----- 1. Begin an upload: validates, reserves the row and the object key. The app then signs the R2 URL. -----
create or replace function public.dp_recording_begin(
 asg uuid, lesson uuid, rec_label text, rec_title text, part int, ctype text, bytes bigint, seconds int, revise uuid default null,
 max_parts int default 10, max_bytes bigint default 52428800)
returns table(id uuid, storage_key text) language plpgsql security definer set search_path=public as $$
declare rid uuid:=gen_random_uuid(); uid uuid:=auth.uid(); ext text; orig dp_practice_recordings; rev int:=1; k text;
begin
 if uid is null or not dp_private.voice_member(uid) then raise exception 'Voice enrollment required'; end if;
 if asg is not null and not dp_private.student_assignment(asg) then raise exception 'That assignment is not yours'; end if;
 if lesson is not null and asg is null then
  if not exists(select 1 from dp_lessons l where l.id=lesson and l.status='published' and dp_private.lesson_level_ok_id(l.id)) then raise exception 'That lesson is not available to you'; end if;
 end if;
 if bytes>max_bytes then raise exception 'File is larger than the allowed size'; end if;
 if asg is not null and (select count(*) from dp_practice_recordings r where r.student_id=uid and r.assignment_id=asg and r.status<>'discarded')>=max_parts then
  raise exception 'This assignment already has the maximum number of recordings'; end if;
 if revise is not null then
  select * into orig from dp_practice_recordings r where r.id=revise and r.student_id=uid;
  if not found then raise exception 'Original recording not found'; end if;
  if orig.status<>'returned' then raise exception 'Only a recording returned for revision can be revised'; end if;
  asg:=orig.assignment_id; lesson:=orig.lesson_id; part:=orig.part_no; rev:=orig.revision_no+1;
  rec_label:=coalesce(nullif(rec_label,''),orig.label);
 end if;
 ext:=case ctype when 'audio/mpeg' then 'mp3' when 'audio/aac' then 'aac' when 'audio/wav' then 'wav' when 'audio/x-wav' then 'wav' when 'audio/webm' then 'webm'
  when 'audio/ogg' then 'ogg' when 'video/mp4' then 'mp4' when 'video/quicktime' then 'mov' when 'video/webm' then 'webm' else 'm4a' end;
 k:='voice/'||uid||'/'||coalesce(asg::text,'general')||'/'||rid||'.'||ext;
 insert into dp_practice_recordings(id,student_id,assignment_id,lesson_id,label,title,part_no,revision_no,revision_of,storage_key,content_type,size_bytes,duration_seconds)
 values(rid,uid,asg,lesson,coalesce(nullif(rec_label,''),'Personal practice'),coalesce(rec_title,''),coalesce(part,1),rev,revise,k,ctype,bytes,seconds);
 return query select rid,k;
end $$;

-- ----- 2. The server confirmed the object exists in R2 (HEAD) -> the recording is a private saved draft. -----
create or replace function public.dp_recording_mark_saved(rid uuid, actual_bytes bigint, seconds int default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 update dp_practice_recordings set status='saved',uploaded_at=now(),size_bytes=actual_bytes,duration_seconds=coalesce(seconds,duration_seconds)
 where id=rid and student_id=auth.uid() and status='pending';
 if not found then raise exception 'Recording not found or already saved'; end if;
end $$;

-- ----- 3. Submit saved recordings to the instructor. Idempotent per recording: resubmitting a submitted one is a no-op. -----
create or replace function public.dp_recording_submit(ids uuid[]) returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
 if auth.uid() is null or not dp_private.voice_member(auth.uid()) then raise exception 'Voice enrollment required'; end if;
 update dp_practice_recordings set status='submitted',submitted_at=now()
 where id=any(ids) and student_id=auth.uid() and status='saved';
 get diagnostics n=row_count;
 return n;
end $$;

-- ----- 4. Discard: only drafts that were never submitted. Submitted/reviewed/returned recordings are preserved. -----
create or replace function public.dp_recording_discard(rid uuid) returns text language plpgsql security definer set search_path=public as $$
declare k text;
begin
 update dp_practice_recordings set status='discarded',discarded_at=now() where id=rid and student_id=auth.uid() and status in ('pending','saved') returning storage_key into k;
 if k is null then raise exception 'Only an unsubmitted recording can be removed'; end if;
 return k;
end $$;

-- ----- 5. Instructor review: appends feedback; never edits the recording or earlier feedback. -----
create or replace function public.dp_recording_review(rid uuid, outcome text, feedback_text text, follow_up_text text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare fid uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Review not authorized'; end if;
 if outcome not in ('reviewed','returned') then raise exception 'Outcome must be reviewed or returned'; end if;
 update dp_practice_recordings set status=outcome,reviewed_at=now() where id=rid and status='submitted';
 if not found then raise exception 'Only a submitted recording can be reviewed'; end if;
 insert into dp_practice_recording_feedback(id,recording_id,author_id,kind,body,follow_up)
 values(fid,rid,auth.uid(),case outcome when 'returned' then 'return_for_revision' else 'feedback' end,feedback_text,nullif(btrim(follow_up_text),''));
 return fid;
end $$;

-- ----- 6. Cleanup (service role only): abandoned uploads and discarded drafts -> keys to delete from R2, then rows are purged. -----
create or replace function public.dp_recording_cleanup_candidates(pending_hours int default 24)
returns table(id uuid, storage_key text) language sql security definer set search_path=public as $$
 select r.id,r.storage_key from dp_practice_recordings r where r.purged_at is null
  and ((r.status='pending' and r.created_at<now()-make_interval(hours=>pending_hours)) or r.status='discarded')
$$;
create or replace function public.dp_recording_mark_purged(ids uuid[]) returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
 update dp_practice_recordings set purged_at=now(),status='discarded',discarded_at=coalesce(discarded_at,now()) where id=any(ids) and status in ('pending','discarded');
 get diagnostics n=row_count; return n;
end $$;

revoke all on function public.dp_recording_begin(uuid,uuid,text,text,int,text,bigint,int,uuid,int,bigint),public.dp_recording_mark_saved(uuid,bigint,int),
 public.dp_recording_submit(uuid[]),public.dp_recording_discard(uuid),public.dp_recording_review(uuid,text,text,text),
 public.dp_recording_cleanup_candidates(int),public.dp_recording_mark_purged(uuid[]) from public,anon;
-- Cleanup runs with the service role from a protected server route only; students and instructors cannot call it.
revoke all on function public.dp_recording_cleanup_candidates(int),public.dp_recording_mark_purged(uuid[]) from authenticated;
grant execute on function public.dp_recording_begin(uuid,uuid,text,text,int,text,bigint,int,uuid,int,bigint),public.dp_recording_mark_saved(uuid,bigint,int),
 public.dp_recording_submit(uuid[]),public.dp_recording_discard(uuid),public.dp_recording_review(uuid,text,text,text) to authenticated;
grant execute on function public.dp_recording_cleanup_candidates(int),public.dp_recording_mark_purged(uuid[]) to service_role;
