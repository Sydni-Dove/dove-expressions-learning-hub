-- Discipleship Platform (dp_) namespace: enums + identity/scoping tables
-- Deliberately independent of the existing app_role enum used by the Mentee Dashboard.

create type dp_role as enum ('super_admin','faculty','teacher','mentor','student','guest');
create type dp_scope_type as enum ('program','track','cohort','course');
create type dp_lesson_status as enum ('draft','scheduled','published');
create type dp_completion_status as enum ('not_started','in_progress','completed');
create type dp_assignment_type as enum ('written','file','image','audio','voice_memo','video','scripture_study','reflection','quiz','checklist','project','testimony','discussion','live_presentation','private_mentor_response');
create type dp_submission_status as enum ('submitted','returned','revised','approved','exempt');
create type dp_question_type as enum ('multiple_choice','rating_scale','scenario','short_response');
create type dp_response_status as enum ('in_progress','submitted');
create type dp_session_type as enum ('initial','follow_up','group');
create type dp_note_kind as enum ('personal','journal','shared','folder');
create type dp_visibility as enum ('private','mentor','teacher','cohort','selected_students','community');
create type dp_save_status as enum ('saving','saved','failed','offline');
create type dp_plan_status as enum ('active','completed','continuing');
create type dp_step_status as enum ('pending','completed');
create type dp_announcement_target as enum ('everyone','students','faculty','teachers','program','cohort','class','individuals');
create type dp_provider as enum ('zoom','meet','youtube','vimeo','other');
create type dp_mwg_status as enum ('received','testing','confirmed','acting','completed','archived');
create type dp_journey_status as enum ('not_started','in_progress','completed');

create table dp_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role dp_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create table dp_cohort_faculty (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_in_cohort text default 'faculty',
  created_at timestamptz not null default now(),
  unique(cohort_id, user_id)
);

create table dp_class_teachers (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(course_id, user_id)
);

create table dp_mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  assigned_at timestamptz not null default now(),
  unique(mentor_id, student_id)
);

create table dp_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function dp_has_role(check_role dp_role)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from dp_user_roles where user_id = auth.uid() and role = check_role);
$$;

create or replace function dp_is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select dp_has_role('super_admin');
$$;

create or replace function dp_is_mentor_of(target_student_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from dp_mentor_assignments where mentor_id = auth.uid() and student_id = target_student_id and status = 'active');
$$;

create or replace function dp_is_teacher_of_course(target_course_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from dp_class_teachers where course_id = target_course_id and user_id = auth.uid());
$$;

create or replace function dp_is_faculty_of_cohort(target_cohort_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from dp_cohort_faculty where cohort_id = target_cohort_id and user_id = auth.uid())
    or dp_has_role('faculty') or dp_is_super_admin();
$$;

alter table dp_user_roles enable row level security;
alter table dp_cohort_faculty enable row level security;
alter table dp_class_teachers enable row level security;
alter table dp_mentor_assignments enable row level security;
alter table dp_audit_log enable row level security;

create policy dp_user_roles_self_select on dp_user_roles for select using (user_id = auth.uid() or dp_is_super_admin());
create policy dp_user_roles_admin_write on dp_user_roles for all using (dp_is_super_admin()) with check (dp_is_super_admin());

create policy dp_cohort_faculty_select on dp_cohort_faculty for select using (user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));
create policy dp_cohort_faculty_admin_write on dp_cohort_faculty for all using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_class_teachers_select on dp_class_teachers for select using (user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));
create policy dp_class_teachers_admin_write on dp_class_teachers for all using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_mentor_assignments_select on dp_mentor_assignments for select using (mentor_id = auth.uid() or student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));
create policy dp_mentor_assignments_admin_write on dp_mentor_assignments for all using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_audit_log_admin_select on dp_audit_log for select using (dp_is_super_admin());
create policy dp_audit_log_insert on dp_audit_log for insert
  with check (auth.uid() is not null and (actor_id = auth.uid() or actor_id is null));
