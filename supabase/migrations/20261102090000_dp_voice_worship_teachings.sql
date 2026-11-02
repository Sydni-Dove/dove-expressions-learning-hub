-- Worship Development Teaching Editor (database side). ADDITIVE ONLY and NOT YET APPLIED to hosted.
-- The database is the single source of truth for teachings:
--   dp_voice_teachings            one row per teaching: status (draft / ready_for_review / published / archived), the draft revision counter and the currently published version
--   dp_voice_teaching_drafts      the working copy the instructor edits (student lesson AND instructor-only notes), staff-only
--   dp_voice_teaching_revisions   revision history of the working copy (restorable), staff-only
--   dp_voice_teaching_versions    IMMUTABLE published snapshots of the STUDENT lesson only. Instructor notes are never copied here.
--   dp_voice_teaching_categories / _category_links   topics; a teaching can sit in several without being duplicated
--   dp_assignments.teaching_id / teaching_version_id / teaching_custom   an assignment is pinned to the exact published version the student received
-- Content is structured rich-text JSON (never HTML), validated here against a node/mark whitelist. No table has write policies; every change goes through the
-- functions below, which check the caller. Nothing is published or assigned automatically; the seed (next migration) imports the three manuscripts as drafts.

create table dp_voice_teaching_categories(
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z0-9-]+$'), name text not null check(length(btrim(name))>0),
 sort_order int not null default 0, is_active boolean not null default true);
insert into dp_voice_teaching_categories(slug,name,sort_order) values
 ('vocal-technique','Vocal Technique',1),('worship-leadership','Worship Leadership',2),('creative-worship-expression','Creative Worship Expression',3),
 ('prophetic-worship-development','Prophetic Worship Development',4),('spiritual-foundations','Spiritual Foundations',5),('personal-ministry-development','Personal and Ministry Development',6);

create table dp_voice_teachings(
 id uuid primary key default gen_random_uuid(),
 key text not null unique check(key ~ '^[a-z0-9-]{3,80}$'),
 status text not null default 'draft' check(status in ('draft','ready_for_review','published','archived')),
 template text, sort_order int not null default 100,
 draft_rev int not null default 1,
 published_version_id uuid, published_rev int, published_at timestamptz, published_by uuid references auth.users(id),
 archived_at timestamptz,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table dp_voice_teaching_drafts(
 teaching_id uuid primary key references dp_voice_teachings(id) on delete cascade,
 title text not null check(length(btrim(title))>0 and length(title)<=200), description text check(length(description)<=2000),
 estimated_minutes int check(estimated_minutes is null or estimated_minutes between 5 and 240),
 objectives jsonb not null default '[]', student jsonb not null, instructor jsonb not null,
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now());

create table dp_voice_teaching_revisions(
 id uuid primary key default gen_random_uuid(), teaching_id uuid not null references dp_voice_teachings(id) on delete cascade, rev_no int not null,
 reason text not null check(reason in ('imported','created','autosave','saved_version','ready_for_review','returned_to_draft','published','archived','unarchived','before_restore','restored')),
 label text, title text not null, description text, estimated_minutes int, objectives jsonb not null, student jsonb not null, instructor jsonb not null,
 created_by uuid references auth.users(id), created_at timestamptz not null default now());
create index dp_voice_teaching_revisions_idx on dp_voice_teaching_revisions(teaching_id, created_at desc);

create table dp_voice_teaching_versions(
 id uuid primary key default gen_random_uuid(), teaching_id uuid not null references dp_voice_teachings(id) on delete cascade, version_no int not null,
 title text not null, description text, estimated_minutes int, objectives jsonb not null, student jsonb not null,
 published_at timestamptz not null default now(), published_by uuid references auth.users(id), unique(teaching_id, version_no));
alter table dp_voice_teachings add constraint dp_voice_teachings_published_fk foreign key (published_version_id) references dp_voice_teaching_versions(id);

create table dp_voice_teaching_category_links(
 teaching_id uuid not null references dp_voice_teachings(id) on delete cascade, category_id uuid not null references dp_voice_teaching_categories(id),
 primary key(teaching_id, category_id));

alter table dp_assignments add column teaching_id uuid references dp_voice_teachings(id) on delete restrict;
alter table dp_assignments add column teaching_version_id uuid references dp_voice_teaching_versions(id) on delete restrict;
alter table dp_assignments add column teaching_custom jsonb;
create unique index dp_assignments_teaching_once on dp_assignments(assigned_to_user_id, teaching_id) where teaching_id is not null;

-- Published snapshots can never change or be removed, so what a student received stays exactly as it was.
create or replace function dp_private.teaching_version_immutable() returns trigger language plpgsql set search_path=public as $$
begin
 -- Only the removal of the whole teaching (a rollback of the import, never done from the app) may take its snapshots with it.
 if tg_op='DELETE' and not exists(select 1 from dp_voice_teachings where id=old.teaching_id) then return old; end if;
 raise exception 'A published teaching version cannot be changed or removed';
end $$;
create trigger dp_teaching_version_immutable before update or delete on dp_voice_teaching_versions for each row execute function dp_private.teaching_version_immutable();
create trigger dp_teaching_revision_immutable before update or delete on dp_voice_teaching_revisions for each row execute function dp_private.teaching_version_immutable();

-- ---------- content validation (the safety net behind the editor) ----------
create or replace function dp_private.teaching_doc_ok(d jsonb, depth int default 0) returns boolean
language plpgsql immutable set search_path=public as $$
declare n jsonb; m jsonb; t text;
begin
 if depth>12 or d is null or jsonb_typeof(d)<>'object' then return false; end if;
 t:=d->>'type';
 if t is null or t not in ('doc','paragraph','heading','bulletList','orderedList','listItem','blockquote','hardBreak','text') then return false; end if;
 if t='text' then
  if jsonb_typeof(d->'text') is distinct from 'string' then return false; end if;
  if d ? 'marks' then
   if jsonb_typeof(d->'marks')<>'array' then return false; end if;
   for m in select * from jsonb_array_elements(d->'marks') loop
    if jsonb_typeof(m)<>'object' or coalesce(m->>'type','') not in ('bold','italic','underline','strike','link') then return false; end if;
    if m->>'type'='link' and (coalesce(m#>>'{attrs,href}','') !~* '^(https?://|mailto:)[^[:space:]]+$' or length(m#>>'{attrs,href}')>1000) then return false; end if;
   end loop;
  end if;
 end if;
 if t='heading' and coalesce(d#>>'{attrs,level}','') !~ '^[2-4]$' then return false; end if;
 if d ? 'content' then
  if jsonb_typeof(d->'content')<>'array' then return false; end if;
  for n in select * from jsonb_array_elements(d->'content') loop
   if not dp_private.teaching_doc_ok(n, depth+1) then return false; end if;
  end loop;
 end if;
 return true;
end $$;

create or replace function dp_private.teaching_content_ok(c jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare s jsonb; m jsonb;
begin
 if c is null or jsonb_typeof(c)<>'object' or jsonb_typeof(c->'sections') is distinct from 'array' then return false; end if;
 if jsonb_array_length(c->'sections')>300 or octet_length(c::text)>1500000 then return false; end if;
 for s in select * from jsonb_array_elements(c->'sections') loop
  if jsonb_typeof(s)<>'object' then return false; end if;
  if coalesce(s->>'id','')='' or length(s->>'id')>64 then return false; end if;
  if coalesce(s->>'type','') not in ('text','scripture','activity','discussion','reflection','homework','media','part','script','timing','example','facilitation','reminder') then return false; end if;
  if jsonb_typeof(s->'title') is distinct from 'string' or length(s->>'title')>300 then return false; end if;
  if not dp_private.teaching_doc_ok(s->'doc') or s#>>'{doc,type}'<>'doc' then return false; end if;
  if s ? 'media' then
   if jsonb_typeof(s->'media')<>'array' or jsonb_array_length(s->'media')>20 then return false; end if;
   for m in select * from jsonb_array_elements(s->'media') loop
    if jsonb_typeof(m)<>'object' or coalesce(m->>'kind','') not in ('video','audio','file','link') then return false; end if;
    if coalesce(m->>'url','') !~* '^https://[^[:space:]]+$' or length(m->>'url')>1000 then return false; end if;
    if length(coalesce(m->>'title',''))>200 then return false; end if;
   end loop;
  end if;
 end loop;
 return true;
end $$;

create or replace function dp_private.teaching_payload_ok(p jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare o jsonb;
begin
 if p is null or jsonb_typeof(p)<>'object' then return false; end if;
 if length(btrim(coalesce(p->>'title','')))=0 or length(p->>'title')>200 then return false; end if;
 if length(coalesce(p->>'description',''))>2000 then return false; end if;
 if jsonb_typeof(coalesce(p->'objectives','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p->'objectives','[]'::jsonb))>30 then return false; end if;
 for o in select * from jsonb_array_elements(coalesce(p->'objectives','[]'::jsonb)) loop
  if jsonb_typeof(o)<>'string' or length(o#>>'{}')>500 then return false; end if;
 end loop;
 return dp_private.teaching_content_ok(p->'student') and dp_private.teaching_content_ok(p->'instructor');
end $$;

create or replace function dp_private.can_publish_teaching() returns boolean
language sql stable security definer set search_path=public as $$ select auth.uid() is not null and dp_private.manage_voice() and (dp_is_super_admin() or dp_has_role('faculty')) $$;
create or replace function dp_private.teaching_version_assigned(vid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from dp_assignments a where a.teaching_version_id=vid and a.assigned_to_user_id=auth.uid()) $$;

-- ---------- row-level security: staff see everything; a student sees only the published version assigned to them ----------
alter table dp_voice_teaching_categories enable row level security;
alter table dp_voice_teachings enable row level security;
alter table dp_voice_teaching_drafts enable row level security;
alter table dp_voice_teaching_revisions enable row level security;
alter table dp_voice_teaching_versions enable row level security;
alter table dp_voice_teaching_category_links enable row level security;
create policy dp_vt_categories_read on dp_voice_teaching_categories for select to authenticated using (dp_private.manage_voice());
create policy dp_vt_read on dp_voice_teachings for select to authenticated using (dp_private.manage_voice());
create policy dp_vt_drafts_read on dp_voice_teaching_drafts for select to authenticated using (dp_private.manage_voice());
create policy dp_vt_revisions_read on dp_voice_teaching_revisions for select to authenticated using (dp_private.manage_voice());
create policy dp_vt_links_read on dp_voice_teaching_category_links for select to authenticated using (dp_private.manage_voice());
create policy dp_vt_versions_read on dp_voice_teaching_versions for select to authenticated
 using (dp_private.manage_voice() or (dp_private.voice_member(auth.uid()) and dp_private.teaching_version_assigned(id)));
revoke all on dp_voice_teaching_categories, dp_voice_teachings, dp_voice_teaching_drafts, dp_voice_teaching_revisions, dp_voice_teaching_versions, dp_voice_teaching_category_links from anon, authenticated;
grant select on dp_voice_teaching_categories, dp_voice_teachings, dp_voice_teaching_drafts, dp_voice_teaching_revisions, dp_voice_teaching_versions, dp_voice_teaching_category_links to authenticated;
revoke all on function dp_private.teaching_version_assigned(uuid), dp_private.can_publish_teaching() from public, anon;
grant execute on function dp_private.teaching_version_assigned(uuid), dp_private.can_publish_teaching() to authenticated;

-- ---------- functions (security definer: the tables have no write policies; each checks the caller) ----------
create or replace function dp_private.teaching_snapshot(tid uuid, why text, lbl text default null) returns void language plpgsql security definer set search_path=public as $$
declare t dp_voice_teachings%rowtype;
begin
 select * into t from dp_voice_teachings where id=tid;
 insert into dp_voice_teaching_revisions(teaching_id,rev_no,reason,label,title,description,estimated_minutes,objectives,student,instructor,created_by)
  select tid,t.draft_rev,why,lbl,d.title,d.description,d.estimated_minutes,d.objectives,d.student,d.instructor,auth.uid() from dp_voice_teaching_drafts d where d.teaching_id=tid;
end $$;

create or replace function public.dp_teaching_create(p_title text, p_template text, p_categories text[], p_payload jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare tid uuid:=gen_random_uuid(); k text; pl jsonb:=p_payload;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Teaching editing not authorized'; end if;
 pl:=jsonb_set(pl,'{title}',to_jsonb(btrim(coalesce(p_title,''))));
 if not dp_private.teaching_payload_ok(pl) then raise exception 'That teaching has content that cannot be saved. Check the title and the content.'; end if;
 k:=left(coalesce(nullif(trim(both '-' from regexp_replace(lower(btrim(p_title)),'[^a-z0-9]+','-','g')),''),'teaching'),60)||'-'||substr(md5(random()::text||clock_timestamp()::text),1,6);
 insert into dp_voice_teachings(id,key,status,template,created_by) values(tid,k,'draft',nullif(p_template,''),auth.uid());
 insert into dp_voice_teaching_drafts(teaching_id,title,description,estimated_minutes,objectives,student,instructor,updated_by)
  values(tid,pl->>'title',nullif(pl->>'description',''),nullif(pl->>'estimated_minutes','')::int,coalesce(pl->'objectives','[]'::jsonb),pl->'student',pl->'instructor',auth.uid());
 insert into dp_voice_teaching_category_links(teaching_id,category_id) select tid,c.id from dp_voice_teaching_categories c where c.slug=any(coalesce(p_categories,'{}')) and c.is_active;
 perform dp_private.teaching_snapshot(tid,'created');
 return k;
end $$;

create or replace function public.dp_teaching_save(p_id uuid, p_base_rev int, p_payload jsonb, p_categories text[] default null)
returns int language plpgsql security definer set search_path=public as $$
declare t dp_voice_teachings%rowtype; newrev int;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Teaching editing not authorized'; end if;
 select * into t from dp_voice_teachings where id=p_id for update;
 if not found then raise exception 'Teaching not found'; end if;
 if t.status='archived' then raise exception 'This teaching is archived. Unarchive it before editing.'; end if;
 if t.draft_rev<>p_base_rev then raise exception 'This teaching was changed in another window. Reload to see the latest version before editing.'; end if;
 if not dp_private.teaching_payload_ok(p_payload) then raise exception 'That content cannot be saved. Check the title and any links or media addresses.'; end if;
 newrev:=t.draft_rev+1;
 update dp_voice_teaching_drafts set title=btrim(p_payload->>'title'), description=nullif(p_payload->>'description',''), estimated_minutes=nullif(p_payload->>'estimated_minutes','')::int,
  objectives=coalesce(p_payload->'objectives','[]'::jsonb), student=p_payload->'student', instructor=p_payload->'instructor', updated_by=auth.uid(), updated_at=now() where teaching_id=p_id;
 update dp_voice_teachings set draft_rev=newrev, updated_at=now(), status=case when status='ready_for_review' then 'draft' else status end where id=p_id;
 if p_categories is not null then
  delete from dp_voice_teaching_category_links where teaching_id=p_id;
  insert into dp_voice_teaching_category_links(teaching_id,category_id) select p_id,c.id from dp_voice_teaching_categories c where c.slug=any(p_categories) and c.is_active;
 end if;
 -- Keep history useful without a row per keystroke: an automatic snapshot at most every 10 minutes.
 if not exists(select 1 from dp_voice_teaching_revisions where teaching_id=p_id and created_at>now()-interval '10 minutes') then perform dp_private.teaching_snapshot(p_id,'autosave'); end if;
 return newrev;
end $$;

create or replace function public.dp_teaching_checkpoint(p_id uuid, p_label text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Teaching editing not authorized'; end if;
 if not exists(select 1 from dp_voice_teachings where id=p_id) then raise exception 'Teaching not found'; end if;
 perform dp_private.teaching_snapshot(p_id,'saved_version',nullif(left(btrim(coalesce(p_label,'')),120),''));
end $$;

create or replace function public.dp_teaching_status(p_id uuid, p_action text) returns text language plpgsql security definer set search_path=public as $$
declare t dp_voice_teachings%rowtype; d dp_voice_teaching_drafts%rowtype; vid uuid; vno int; newstatus text;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Teaching editing not authorized'; end if;
 select * into t from dp_voice_teachings where id=p_id for update;
 if not found then raise exception 'Teaching not found'; end if;
 if p_action='ready' then
  if t.status<>'draft' then raise exception 'Only a draft can be marked ready for review'; end if;
  update dp_voice_teachings set status='ready_for_review', updated_at=now() where id=p_id; perform dp_private.teaching_snapshot(p_id,'ready_for_review'); return 'ready_for_review';
 elsif p_action='draft' then
  if t.status<>'ready_for_review' then raise exception 'Only a teaching that is ready for review can be returned to draft'; end if;
  update dp_voice_teachings set status='draft', updated_at=now() where id=p_id; perform dp_private.teaching_snapshot(p_id,'returned_to_draft'); return 'draft';
 elsif p_action='publish' then
  if not dp_private.can_publish_teaching() then raise exception 'Only the instructor (faculty or administrator) can approve and publish a teaching'; end if;
  if not (t.status='ready_for_review' or (t.status='published' and t.published_rev is distinct from t.draft_rev)) then raise exception 'Mark the teaching ready for review before publishing it (or make a change to publish an update)'; end if;
  select * into d from dp_voice_teaching_drafts where teaching_id=p_id;
  if jsonb_array_length(d.student->'sections')=0 then raise exception 'Add at least one section to the student lesson before publishing'; end if;
  select coalesce(max(version_no),0)+1 into vno from dp_voice_teaching_versions where teaching_id=p_id;
  vid:=gen_random_uuid();
  insert into dp_voice_teaching_versions(id,teaching_id,version_no,title,description,estimated_minutes,objectives,student,published_by)
   values(vid,p_id,vno,d.title,d.description,d.estimated_minutes,d.objectives,d.student,auth.uid());
  update dp_voice_teachings set status='published', published_version_id=vid, published_rev=draft_rev, published_at=now(), published_by=auth.uid(), updated_at=now() where id=p_id;
  perform dp_private.teaching_snapshot(p_id,'published','Version '||vno); return 'published';
 elsif p_action='archive' then
  if not dp_private.can_publish_teaching() then raise exception 'Only the instructor (faculty or administrator) can archive a teaching'; end if;
  if t.status='archived' then raise exception 'Already archived'; end if;
  update dp_voice_teachings set status='archived', archived_at=now(), updated_at=now() where id=p_id; perform dp_private.teaching_snapshot(p_id,'archived'); return 'archived';
 elsif p_action='unarchive' then
  if not dp_private.can_publish_teaching() then raise exception 'Only the instructor (faculty or administrator) can unarchive a teaching'; end if;
  if t.status<>'archived' then raise exception 'Not archived'; end if;
  newstatus:=case when t.published_version_id is not null then 'published' else 'draft' end;
  update dp_voice_teachings set status=newstatus, archived_at=null, updated_at=now() where id=p_id; perform dp_private.teaching_snapshot(p_id,'unarchived'); return newstatus;
 end if;
 raise exception 'Unknown action';
end $$;

create or replace function public.dp_teaching_restore(p_id uuid, p_revision_id uuid) returns int language plpgsql security definer set search_path=public as $$
declare t dp_voice_teachings%rowtype; r dp_voice_teaching_revisions%rowtype; newrev int;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Teaching editing not authorized'; end if;
 select * into t from dp_voice_teachings where id=p_id for update;
 if not found then raise exception 'Teaching not found'; end if;
 if t.status='archived' then raise exception 'Unarchive this teaching before restoring an earlier version'; end if;
 select * into r from dp_voice_teaching_revisions where id=p_revision_id and teaching_id=p_id;
 if not found then raise exception 'That earlier version was not found'; end if;
 perform dp_private.teaching_snapshot(p_id,'before_restore','Saved automatically before restoring');
 newrev:=t.draft_rev+1;
 update dp_voice_teaching_drafts set title=r.title, description=r.description, estimated_minutes=r.estimated_minutes, objectives=r.objectives, student=r.student, instructor=r.instructor, updated_by=auth.uid(), updated_at=now() where teaching_id=p_id;
 update dp_voice_teachings set draft_rev=newrev, updated_at=now(), status=case when status='ready_for_review' then 'draft' else status end where id=p_id;
 perform dp_private.teaching_snapshot(p_id,'restored','Restored from '||to_char(r.created_at,'YYYY-MM-DD HH24:MI'));
 return newrev;
end $$;

-- Assign ONE published teaching to ONE enrolled, verified-paid student. Pinned to the published version, so later edits never change what they received.
create or replace function public.dp_assign_teaching(student uuid, teaching_key text, due date default null, instructions text default null,
  reflection text[] default '{}', homework text[] default '{}', resources jsonb default '[]')
returns uuid language plpgsql security definer set search_path=public as $$
declare t dp_voice_teachings%rowtype; v dp_voice_teaching_versions%rowtype; aid uuid:=gen_random_uuid(); steps text[]; custom jsonb; r jsonb; refl text[]; hw text[];
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Teaching assignment not authorized'; end if;
 if not dp_private.voice_member(student) then raise exception 'Student is not enrolled in Voice'; end if;
 select * into t from dp_voice_teachings where key=teaching_key;
 if not found or t.status<>'published' or t.published_version_id is null then raise exception 'That teaching is not published, so it cannot be assigned'; end if;
 select * into v from dp_voice_teaching_versions where id=t.published_version_id;
 if exists(select 1 from dp_assignments where assigned_to_user_id=student and teaching_id=t.id) then raise exception 'This teaching is already assigned to this student'; end if;
 if jsonb_typeof(coalesce(resources,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(resources,'[]'::jsonb))>10 then raise exception 'Too many supporting resources'; end if;
 for r in select * from jsonb_array_elements(coalesce(resources,'[]'::jsonb)) loop
  if jsonb_typeof(r)<>'object' or coalesce(r->>'url','') !~* '^https://[^[:space:]]+$' or length(r->>'url')>1000 or length(btrim(coalesce(r->>'title','')))=0 or length(r->>'title')>200 then raise exception 'Each supporting resource needs a title and an https address'; end if;
 end loop;
 refl:=array(select btrim(x) from unnest(coalesce(reflection,'{}')) x where length(btrim(x))>0);
 hw:=array(select btrim(x) from unnest(coalesce(homework,'{}')) x where length(btrim(x))>0);
 if coalesce(array_length(refl,1),0)>30 or coalesce(array_length(hw,1),0)>30 or exists(select 1 from unnest(refl||hw) x where length(x)>1000) then raise exception 'Too many or too long reflection/homework items'; end if;
 if length(coalesce(instructions,''))>2000 then raise exception 'Personal instructions are too long'; end if;
 steps:=case when coalesce(array_length(hw,1),0)>0 then hw else array['Complete the take-home work in the teaching and submit your response.'] end;
 custom:=jsonb_build_object('instructions',nullif(btrim(coalesce(instructions,'')),''),'reflection',to_jsonb(refl),'homework',to_jsonb(hw),'resources',coalesce(resources,'[]'::jsonb),'version_no',v.version_no);
 insert into dp_assignments(id,course_id,lesson_id,assigned_to_user_id,title,description,assignment_type,due_at,goal,practice_steps,practice_items,teaching_id,teaching_version_id,teaching_custom,created_by)
 values(aid,null,null,student,v.title,'Open the teaching under Worship Development in your Voice area, then complete the work below.','written',
  case when due is null then null else (due::timestamp+time '23:59:59') at time zone 'UTC' end, v.description, steps,
  jsonb_build_array(jsonb_build_object('title','Worship Development: '||v.title,'instructions',coalesce(nullif(btrim(coalesce(instructions,'')),''),'Read the teaching, then complete the take-home work.'),'teaching_key',t.key)),
  t.id,v.id,custom,auth.uid());
 return aid;
end $$;

revoke all on function dp_private.teaching_snapshot(uuid,text,text) from public, anon, authenticated;
revoke all on function public.dp_teaching_create(text,text,text[],jsonb), public.dp_teaching_save(uuid,int,jsonb,text[]), public.dp_teaching_checkpoint(uuid,text),
 public.dp_teaching_status(uuid,text), public.dp_teaching_restore(uuid,uuid), public.dp_assign_teaching(uuid,text,date,text,text[],text[],jsonb) from public, anon;
grant execute on function public.dp_teaching_create(text,text,text[],jsonb), public.dp_teaching_save(uuid,int,jsonb,text[]), public.dp_teaching_checkpoint(uuid,text),
 public.dp_teaching_status(uuid,text), public.dp_teaching_restore(uuid,uuid), public.dp_assign_teaching(uuid,text,date,text,text[],text[],jsonb) to authenticated;
