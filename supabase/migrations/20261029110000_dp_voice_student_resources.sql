-- Voice student resource area: reusable exercise library (curated external video links by skill),
-- reusable practice-plan templates, individually assigned weekly plans, per-student goals with progress,
-- and editable welcome / practice-guide text.
--
-- ADDITIVE ONLY and NOT YET APPLIED. Weekly plans are personalized dp_assignments (no course), so submissions,
-- recordings, feedback and review reuse the existing workflow. No curriculum is published or advertised.

create or replace function dp_private.voice_program() returns uuid
language sql stable security definer set search_path=public as $$ select id from dp_programs where slug='vocal-coaching' $$;
create or replace function dp_private.manage_voice() returns boolean
language sql stable security definer set search_path=public as $$ select dp_private.manage_program(dp_private.voice_program()) $$;

-- Skill categories (names only; no content is implied).
create table dp_voice_skills(
 id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
 sort_order int not null default 0, is_active boolean not null default true);
insert into dp_voice_skills(slug,name,sort_order) values
 ('breath-posture','Breath and posture',1),('pitch-ear','Pitch and ear training',2),('range','Range',3),
 ('registers','Chest, head and mixed voice',4),('tone-resonance','Tone and resonance',5),('agility','Agility and control',6),
 ('stamina-care','Stamina and vocal care',7),('song-style','Song and style (gospel, worship, R&B)',8),('performance','Performance and confidence',9)
on conflict (slug) do nothing;

-- The exercise library: written once by the instructor, reused in any number of plans.
create table dp_voice_exercises(
 id uuid primary key default gen_random_uuid(),
 skill_id uuid not null references dp_voice_skills(id),
 title text not null check(length(btrim(title))>0),
 instructions text,
 video_url text check(video_url is null or video_url ~* '^https://[^[:space:]]+$'),
 source_name text, minutes int check(minutes is null or minutes between 1 and 120),
 is_active boolean not null default true,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index dp_voice_exercises_skill_idx on dp_voice_exercises(skill_id) where is_active;

create table dp_voice_plan_templates(
 id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title))>0), description text,
 items jsonb not null default '[]' check(jsonb_typeof(items)='array'),
 is_active boolean not null default true, created_by uuid references auth.users(id), created_at timestamptz not null default now());

-- A weekly plan is a personalized assignment; library exercises are copied in (snapshot) when it is assigned.
alter table dp_assignments add column if not exists practice_items jsonb check(practice_items is null or jsonb_typeof(practice_items)='array');
create index if not exists dp_assignments_plan_idx on dp_assignments(assigned_to_user_id) where practice_items is not null;

create table dp_voice_goals(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 skill_id uuid references dp_voice_skills(id),
 title text not null check(length(btrim(title))>0), detail text, target_date date,
 status text not null default 'active' check(status in ('active','achieved','paused')),
 created_by uuid references auth.users(id), created_at timestamptz not null default now(), achieved_at timestamptz);
create index dp_voice_goals_student_idx on dp_voice_goals(student_id,status);
create table dp_voice_goal_updates(
 id uuid primary key default gen_random_uuid(),
 goal_id uuid not null references dp_voice_goals(id) on delete cascade,
 author_id uuid not null references auth.users(id),
 note text check(note is null or length(note)<=2000), rating smallint check(rating is null or rating between 1 and 5),
 created_at timestamptz not null default now(),
 check(note is not null and length(btrim(note))>0 or rating is not null));
create index dp_voice_goal_updates_goal_idx on dp_voice_goal_updates(goal_id,created_at desc);

create table dp_voice_resource_content(
 key text primary key check(key in ('welcome','practice_guide')), title text not null, body text not null,
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now());
insert into dp_voice_resource_content(key,title,body) values
 ('welcome','Welcome to your vocal coaching space',
  E'This is your private space for vocal coaching with Dove Expressions.\n\nHere you will find your weekly practice plan, the exercise videos your instructor has chosen for you, your personal vocal goals, and a place to submit recordings and receive feedback.\n\nYour coaching is personal. Your plan and goals are set for you, and they will change as your voice develops. If anything is unclear, message your instructor.'),
 ('practice_guide','How to practice',
  E'1. Open your weekly plan and read it through before you begin.\n2. Warm up gently. Start in a comfortable range and never push for volume.\n3. Work through the exercises in order and check each one off as you finish it.\n4. Short and consistent beats long and strained. Ten to twenty minutes is a good session unless your instructor says otherwise.\n5. Stop and rest if you feel pain, tightness or light-headedness. Drink water and rest your voice.\n6. Record yourself on your phone (a voice memo or video is fine). Upload it from your assignment; files up to 50 MB are accepted and only you and your instructor can play them.\n7. Submit when you are done. Your instructor reviews privately and then shares feedback with you.\n8. Update your goals after practice and note how it felt.')
on conflict (key) do nothing;

-- ----- Row level security -----
alter table dp_voice_skills enable row level security;
alter table dp_voice_exercises enable row level security;
alter table dp_voice_plan_templates enable row level security;
alter table dp_voice_goals enable row level security;
alter table dp_voice_goal_updates enable row level security;
alter table dp_voice_resource_content enable row level security;
grant select,insert,update,delete on dp_voice_skills,dp_voice_exercises,dp_voice_plan_templates,dp_voice_goals,dp_voice_resource_content to authenticated;
grant select,insert on dp_voice_goal_updates to authenticated;

create policy dp_voice_skills_read on dp_voice_skills for select to authenticated using(dp_private.manage_voice() or (is_active and dp_private.voice_member(auth.uid())));
create policy dp_voice_skills_write on dp_voice_skills for all to authenticated using(dp_private.manage_voice()) with check(dp_private.manage_voice());
create policy dp_voice_exercises_read on dp_voice_exercises for select to authenticated using(dp_private.manage_voice() or (is_active and dp_private.voice_member(auth.uid())));
create policy dp_voice_exercises_write on dp_voice_exercises for all to authenticated using(dp_private.manage_voice()) with check(dp_private.manage_voice());
create policy dp_voice_templates_staff on dp_voice_plan_templates for all to authenticated using(dp_private.manage_voice()) with check(dp_private.manage_voice());
create policy dp_voice_content_read on dp_voice_resource_content for select to authenticated using(dp_private.manage_voice() or dp_private.voice_member(auth.uid()));
create policy dp_voice_content_write on dp_voice_resource_content for all to authenticated using(dp_private.manage_voice()) with check(dp_private.manage_voice());
create policy dp_voice_goals_read on dp_voice_goals for select to authenticated
 using(dp_private.manage_voice() or (student_id=auth.uid() and dp_private.voice_member(auth.uid())));
create policy dp_voice_goals_staff_write on dp_voice_goals for all to authenticated using(dp_private.manage_voice()) with check(dp_private.manage_voice());
-- Students record their own progress on goals their instructor set; they cannot edit the goals.
create policy dp_voice_goal_updates_read on dp_voice_goal_updates for select to authenticated
 using(exists(select 1 from dp_voice_goals g where g.id=goal_id));
create policy dp_voice_goal_updates_insert on dp_voice_goal_updates for insert to authenticated
 with check(author_id=auth.uid() and exists(select 1 from dp_voice_goals g where g.id=goal_id and (dp_private.manage_voice() or g.student_id=auth.uid())));

-- Keep the content tables tidy: touch updated_at; only HTTPS demonstration links are ever stored (CHECK above).
create or replace function dp_private.touch_voice_row() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at:=now(); if tg_table_name='dp_voice_resource_content' then new.updated_by:=auth.uid(); end if; return new; end $$;
create trigger dp_voice_exercises_touch before update on dp_voice_exercises for each row execute function dp_private.touch_voice_row();
create trigger dp_voice_content_touch before update on dp_voice_resource_content for each row execute function dp_private.touch_voice_row();
create or replace function dp_private.goal_status() returns trigger language plpgsql set search_path=public as $$
begin new.achieved_at:=case when new.status='achieved' then coalesce(old.achieved_at,now()) else null end; return new; end $$;
create trigger dp_voice_goal_status before update on dp_voice_goals for each row execute function dp_private.goal_status();

-- ----- Assign a weekly plan -----
-- items: [{"exercise_id": uuid, "note": text, "minutes": int}] chosen from the library (optionally from a template).
-- The exercises are copied into the assignment, so later library edits never change work already assigned.
create or replace function public.dp_assign_weekly_plan(student uuid,plan_title text,notes text,goal_text text,due date,items jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare snap jsonb; steps text[]; aid uuid;
begin
 if auth.uid() is null or not dp_private.manage_voice() then raise exception 'Plan assignment not authorized'; end if;
 if not dp_private.voice_member(student) then raise exception 'Student is not enrolled in Voice'; end if;
 if length(btrim(coalesce(plan_title,'')))=0 then raise exception 'Give the plan a title'; end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 20 then raise exception 'Choose between 1 and 20 exercises'; end if;
 select jsonb_agg(jsonb_build_object('exercise_id',e.id,'title',e.title,'skill',s.name,'instructions',e.instructions,
   'video_url',e.video_url,'source_name',e.source_name,'minutes',coalesce((i.value->>'minutes')::int,e.minutes),'note',nullif(btrim(i.value->>'note'),''))
   order by i.ord),
  array_agg(e.title||case when coalesce((i.value->>'minutes')::int,e.minutes) is not null then ' ('||coalesce((i.value->>'minutes')::int,e.minutes)||' min)' else '' end order by i.ord)
 into snap,steps
 from jsonb_array_elements(items) with ordinality i(value,ord)
 join dp_voice_exercises e on e.id=(i.value->>'exercise_id')::uuid and e.is_active
 join dp_voice_skills s on s.id=e.skill_id;
 if snap is null or jsonb_array_length(snap)<>jsonb_array_length(items) then raise exception 'An exercise in this plan is no longer available'; end if;

 -- Generate the id first: RETURNING would re-check SELECT policies against a row the policy helpers cannot yet see.
 aid:=gen_random_uuid();
 insert into dp_assignments(id,course_id,lesson_id,assigned_to_user_id,title,description,assignment_type,due_at,goal,practice_steps,practice_items,created_by)
 values(aid,null,null,student,btrim(plan_title),nullif(btrim(notes),''),'voice_memo',case when due is null then null else (due::timestamp+time '23:59:59') at time zone 'UTC' end,
  nullif(btrim(goal_text),''),steps,snap,auth.uid());
 return aid;
end $$;
revoke all on function public.dp_assign_weekly_plan(uuid,text,text,text,date,jsonb) from public,anon;
grant execute on function public.dp_assign_weekly_plan(uuid,text,text,text,date,jsonb) to authenticated;

revoke all on all functions in schema dp_private from public,anon;
grant execute on all functions in schema dp_private to authenticated;
