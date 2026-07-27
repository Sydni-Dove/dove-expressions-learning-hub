-- The single most important chain in the platform: assessment -> session -> profile -> plan.
create table dp_assessment_definitions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  version int not null default 1,
  sections jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table dp_assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references dp_assessment_definitions(id) on delete cascade,
  section text,
  prompt text not null,
  question_type dp_question_type not null,
  options jsonb not null default '[]',
  weight_map jsonb not null default '{}',
  is_required boolean not null default true,
  order_index int not null default 0
);

create table dp_assessment_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references dp_assessment_definitions(id),
  student_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}',
  status dp_response_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  version int not null default 1
);

create table dp_wiring_categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  scriptures text[] not null default '{}',
  strengths text[] not null default '{}',
  blind_spots text[] not null default '{}',
  recommended_courses uuid[] not null default '{}',
  recommended_practices text[] not null default '{}'
);

create table dp_wiring_results (
  id uuid primary key default gen_random_uuid(),
  response_id uuid references dp_assessment_responses(id),
  student_id uuid not null references auth.users(id) on delete cascade,
  primary_category_id uuid references dp_wiring_categories(id),
  secondary_category_id uuid references dp_wiring_categories(id),
  scores jsonb not null default '{}',
  version int not null default 1,
  generated_at timestamptz not null default now()
);

create table dp_wiring_reflections (
  id uuid primary key default gen_random_uuid(),
  result_id uuid references dp_wiring_results(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  resonated text,
  did_not_resonate text,
  surprised text,
  others_recognized text,
  most_alive text,
  want_to_grow text,
  questions text,
  created_at timestamptz not null default now()
);

create table dp_pre_session_questionnaires (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null default 'discovery',
  answers jsonb not null default '{}',
  status dp_response_status not null default 'in_progress',
  saved_at timestamptz not null default now()
);

create table dp_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  mentor_id uuid not null references auth.users(id),
  session_type dp_session_type not null default 'follow_up',
  scheduled_at timestamptz,
  agenda text,
  student_updates text,
  assignment_review text,
  mentor_observations text,
  student_visible_notes text,
  private_faculty_notes text,
  scriptures text[] not null default '{}',
  prayer_focus text,
  voice_memo_id uuid,
  file_urls text[] not null default '{}',
  related_result_id uuid references dp_wiring_results(id),
  new_assignments jsonb not null default '[]',
  follow_up_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table dp_wiring_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  version int not null default 1,
  primary_role text,
  secondary_role text,
  functions text[] not null default '{}',
  burdens text[] not null default '{}',
  reception_style text,
  strengths text[] not null default '{}',
  growth_areas text[] not null default '{}',
  current_season text,
  ministry_environments text[] not null default '{}',
  source_breakdown jsonb not null default '{}',
  recommended_next_steps text,
  recommended_courses uuid[] not null default '{}',
  review_date date,
  session_id uuid references dp_sessions(id),
  superseded_by uuid references dp_wiring_profiles(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table dp_discipleship_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  current_season text,
  mentor_notes text,
  review_date date,
  status dp_plan_status not null default 'active',
  wiring_profile_id uuid references dp_wiring_profiles(id),
  version int not null default 1,
  superseded_by uuid references dp_discipleship_plans(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table dp_goals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references dp_discipleship_plans(id) on delete cascade,
  title text not null,
  pillar text,
  reason text,
  starting_condition text,
  desired_growth text,
  scriptures text[] not null default '{}',
  practices text[] not null default '{}',
  resources uuid[] not null default '{}',
  evidence_of_growth text,
  mentor_review text,
  student_reflection text,
  start_date date,
  review_date date,
  status dp_plan_status not null default 'active',
  created_at timestamptz not null default now()
);

create table dp_action_steps (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references dp_goals(id) on delete cascade,
  plan_id uuid references dp_discipleship_plans(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status dp_step_status not null default 'pending',
  evidence_url text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table dp_mandate_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  version int not null default 1,
  repeated_words text,
  people_needs text,
  natural_builds text,
  roles text[] not null default '{}',
  gifts_fruit text,
  scriptures text[] not null default '{}',
  preparation text,
  barriers text,
  for_now text,
  for_later text,
  others_involved text,
  next_obedience text,
  faithful_completion text,
  superseded_by uuid references dp_mandate_records(id),
  created_at timestamptz not null default now()
);

alter table dp_assessment_definitions enable row level security;
alter table dp_assessment_questions enable row level security;
alter table dp_assessment_responses enable row level security;
alter table dp_wiring_categories enable row level security;
alter table dp_wiring_results enable row level security;
alter table dp_wiring_reflections enable row level security;
alter table dp_pre_session_questionnaires enable row level security;
alter table dp_sessions enable row level security;
alter table dp_wiring_profiles enable row level security;
alter table dp_discipleship_plans enable row level security;
alter table dp_goals enable row level security;
alter table dp_action_steps enable row level security;
alter table dp_mandate_records enable row level security;

create policy dp_assessment_definitions_read on dp_assessment_definitions for select using (auth.role() = 'authenticated');
create policy dp_assessment_definitions_write on dp_assessment_definitions for all using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));
create policy dp_assessment_questions_read on dp_assessment_questions for select using (auth.role() = 'authenticated');
create policy dp_assessment_questions_write on dp_assessment_questions for all using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));
create policy dp_wiring_categories_read on dp_wiring_categories for select using (auth.role() = 'authenticated');
create policy dp_wiring_categories_write on dp_wiring_categories for all using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_assessment_responses_owner on dp_assessment_responses for all using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id)
) with check (student_id = auth.uid());

create policy dp_wiring_results_select on dp_wiring_results for select using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id)
);
create policy dp_wiring_results_write on dp_wiring_results for insert with check (
  dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('mentor') or student_id = auth.uid()
);

create policy dp_wiring_reflections_owner on dp_wiring_reflections for all using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id)
) with check (student_id = auth.uid());

create policy dp_pre_session_owner on dp_pre_session_questionnaires for all using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id)
) with check (student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_sessions_select on dp_sessions for select using (
  dp_is_super_admin() or dp_has_role('faculty')
  or mentor_id = auth.uid()
  or student_id = auth.uid()
);
create policy dp_sessions_write on dp_sessions for all using (
  dp_is_super_admin() or dp_has_role('faculty') or mentor_id = auth.uid()
) with check (dp_is_super_admin() or dp_has_role('faculty') or mentor_id = auth.uid());

create policy dp_wiring_profiles_select on dp_wiring_profiles for select using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id)
);
create policy dp_wiring_profiles_write on dp_wiring_profiles for all using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id)
) with check (dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id));

create policy dp_plans_select on dp_discipleship_plans for select using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id)
);
create policy dp_plans_write on dp_discipleship_plans for all using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id)
) with check (dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id));

create policy dp_goals_select on dp_goals for select using (
  dp_is_super_admin() or dp_has_role('faculty')
  or exists (select 1 from dp_discipleship_plans p where p.id = plan_id and (p.student_id = auth.uid() or dp_is_mentor_of(p.student_id)))
);
create policy dp_goals_write on dp_goals for all using (
  dp_is_super_admin() or dp_has_role('faculty')
  or exists (select 1 from dp_discipleship_plans p where p.id = plan_id and dp_is_mentor_of(p.student_id))
) with check (
  dp_is_super_admin() or dp_has_role('faculty')
  or exists (select 1 from dp_discipleship_plans p where p.id = plan_id and dp_is_mentor_of(p.student_id))
);

create policy dp_action_steps_select on dp_action_steps for select using (
  dp_is_super_admin() or dp_has_role('faculty')
  or exists (select 1 from dp_goals g join dp_discipleship_plans p on p.id = g.plan_id where g.id = goal_id and (p.student_id = auth.uid() or dp_is_mentor_of(p.student_id)))
  or exists (select 1 from dp_discipleship_plans p where p.id = plan_id and (p.student_id = auth.uid() or dp_is_mentor_of(p.student_id)))
);
create policy dp_action_steps_student_update on dp_action_steps for update using (
  dp_is_super_admin() or dp_has_role('faculty')
  or exists (select 1 from dp_goals g join dp_discipleship_plans p on p.id = g.plan_id where g.id = goal_id and (p.student_id = auth.uid() or dp_is_mentor_of(p.student_id)))
  or exists (select 1 from dp_discipleship_plans p where p.id = plan_id and (p.student_id = auth.uid() or dp_is_mentor_of(p.student_id)))
);
create policy dp_action_steps_insert on dp_action_steps for insert with check (
  dp_is_super_admin() or dp_has_role('faculty')
  or exists (select 1 from dp_goals g join dp_discipleship_plans p on p.id = g.plan_id where g.id = goal_id and dp_is_mentor_of(p.student_id))
  or exists (select 1 from dp_discipleship_plans p where p.id = plan_id and dp_is_mentor_of(p.student_id))
);

create policy dp_mandate_owner on dp_mandate_records for all using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id)
) with check (student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_is_mentor_of(student_id));
