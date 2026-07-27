create table dp_learning_areas (
  id uuid primary key default gen_random_uuid(),
  area_key text not null unique,
  name text not null,
  tagline text,
  description text,
  accent_color text,
  hero_image_url text,
  is_active boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table dp_programs (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references dp_learning_areas(id),
  name text not null,
  slug text unique,
  description text,
  phase_structure jsonb not null default '{}',
  is_template boolean not null default true,
  version int not null default 1,
  superseded_by uuid references dp_programs(id),
  created_by uuid references auth.users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table dp_tracks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references dp_programs(id) on delete cascade,
  name text not null,
  description text,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table dp_cohorts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references dp_programs(id),
  track_id uuid references dp_tracks(id),
  name text not null,
  start_date date,
  end_date date,
  timezone text default 'America/New_York',
  status text not null default 'upcoming',
  created_at timestamptz not null default now()
);

create table dp_courses (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references dp_learning_areas(id),
  program_id uuid references dp_programs(id),
  track_id uuid references dp_tracks(id),
  title text not null,
  slug text,
  description text,
  cover_image_url text,
  pillar text,
  order_index int not null default 0,
  is_published boolean not null default false,
  is_standalone boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table dp_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references dp_courses(id) on delete cascade,
  title text not null,
  description text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table dp_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references dp_modules(id) on delete cascade,
  title text not null,
  slug text,
  order_index int not null default 0,
  status dp_lesson_status not null default 'draft',
  publish_at timestamptz,
  drip_rule jsonb not null default '{}',
  prerequisite_lesson_id uuid references dp_lessons(id),
  estimated_duration_minutes int,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dp_lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references dp_lessons(id) on delete cascade,
  block_type text not null,
  order_index int not null default 0,
  content jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table dp_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid references dp_learning_areas(id),
  scope_type dp_scope_type not null,
  scope_id uuid not null,
  status text not null default 'active',
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz
);

create table dp_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references dp_lessons(id) on delete cascade,
  status dp_completion_status not null default 'not_started',
  completion_method text,
  completed_at timestamptz,
  time_spent_seconds int not null default 0,
  unique(user_id, lesson_id)
);

alter table dp_learning_areas enable row level security;
alter table dp_programs enable row level security;
alter table dp_tracks enable row level security;
alter table dp_cohorts enable row level security;
alter table dp_courses enable row level security;
alter table dp_modules enable row level security;
alter table dp_lessons enable row level security;
alter table dp_lesson_blocks enable row level security;
alter table dp_enrollments enable row level security;
alter table dp_lesson_progress enable row level security;

create policy dp_learning_areas_read on dp_learning_areas for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy dp_learning_areas_write on dp_learning_areas for all using (dp_is_super_admin()) with check (dp_is_super_admin());

create policy dp_programs_read on dp_programs for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy dp_programs_write on dp_programs for all using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_tracks_read on dp_tracks for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy dp_tracks_write on dp_tracks for all using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_cohorts_read on dp_cohorts for select using (auth.role() = 'authenticated');
create policy dp_cohorts_write on dp_cohorts for all using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_courses_read on dp_courses for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy dp_courses_write on dp_courses for all using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_is_teacher_of_course(id)
) with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_modules_read on dp_modules for select using (auth.role() = 'authenticated');
create policy dp_modules_write on dp_modules for all using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_is_teacher_of_course(course_id)
) with check (dp_is_super_admin() or dp_has_role('faculty') or dp_is_teacher_of_course(course_id));

create policy dp_lessons_read_published on dp_lessons for select using (
  status = 'published' or dp_is_super_admin() or dp_has_role('faculty')
  or dp_is_teacher_of_course((select course_id from dp_modules where dp_modules.id = module_id))
);
create policy dp_lessons_write on dp_lessons for all using (
  dp_is_super_admin() or dp_has_role('faculty')
  or dp_is_teacher_of_course((select course_id from dp_modules where dp_modules.id = module_id))
) with check (
  dp_is_super_admin() or dp_has_role('faculty')
  or dp_is_teacher_of_course((select course_id from dp_modules where dp_modules.id = module_id))
);

create policy dp_lesson_blocks_read on dp_lesson_blocks for select using (auth.role() = 'authenticated');
create policy dp_lesson_blocks_write on dp_lesson_blocks for all using (
  dp_is_super_admin() or dp_has_role('faculty')
  or dp_is_teacher_of_course((select m.course_id from dp_modules m join dp_lessons l on l.module_id = m.id where l.id = lesson_id))
) with check (
  dp_is_super_admin() or dp_has_role('faculty')
  or dp_is_teacher_of_course((select m.course_id from dp_modules m join dp_lessons l on l.module_id = m.id where l.id = lesson_id))
);

create policy dp_enrollments_self_select on dp_enrollments for select using (
  user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(user_id)
);
create policy dp_enrollments_self_insert on dp_enrollments for insert with check (
  user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
);
create policy dp_enrollments_staff_update on dp_enrollments for update using (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_lesson_progress_owner on dp_lesson_progress for all using (
  user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(user_id)
) with check (user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));
