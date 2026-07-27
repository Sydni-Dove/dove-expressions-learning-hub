create table dp_assignment_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  prompts jsonb not null default '[]',
  instructions text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table dp_assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references dp_lessons(id) on delete cascade,
  course_id uuid references dp_courses(id) on delete cascade,
  template_id uuid references dp_assignment_templates(id),
  assigned_to_user_id uuid references auth.users(id),
  assigned_to_cohort_id uuid references dp_cohorts(id),
  title text not null,
  description text,
  assignment_type dp_assignment_type not null default 'written',
  due_at timestamptz,
  allow_late boolean not null default true,
  rubric jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table dp_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references dp_assignments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null default '{}',
  file_urls text[] not null default '{}',
  voice_memo_id uuid,
  status dp_submission_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dp_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references dp_submissions(id) on delete cascade,
  author_id uuid references auth.users(id),
  content text,
  voice_memo_id uuid,
  is_private boolean not null default false,
  grade text,
  created_at timestamptz not null default now()
);

create table dp_creative_projects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  product_type text,
  purpose text,
  target_audience text,
  current_phase text not null default 'define',
  progress_percent int not null default 0,
  specifications jsonb not null default '{}',
  vendor_options jsonb not null default '[]',
  quotes jsonb not null default '[]',
  estimated_cost numeric,
  selling_price numeric,
  profit_estimate numeric,
  design_uploads jsonb not null default '[]',
  canva_link text,
  cover_proof_url text,
  interior_proof_url text,
  sample_photos jsonb not null default '[]',
  revision_history jsonb not null default '[]',
  launch_checklist jsonb not null default '[]',
  production_timeline jsonb not null default '[]',
  sales_channels jsonb not null default '[]',
  final_product_link text,
  recommended_from_discipleship boolean not null default false,
  recommended_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dp_project_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references dp_creative_projects(id) on delete cascade,
  author_id uuid references auth.users(id),
  content text,
  voice_memo_id uuid,
  created_at timestamptz not null default now()
);

alter table dp_assignment_templates enable row level security;
alter table dp_assignments enable row level security;
alter table dp_submissions enable row level security;
alter table dp_feedback enable row level security;
alter table dp_creative_projects enable row level security;
alter table dp_project_feedback enable row level security;

create policy dp_assignment_templates_read on dp_assignment_templates for select using (auth.role() = 'authenticated');
create policy dp_assignment_templates_write on dp_assignment_templates for all using (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher') or dp_has_role('mentor')) with check (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher') or dp_has_role('mentor'));

create policy dp_assignments_select on dp_assignments for select using (
  assigned_to_user_id = auth.uid()
  or dp_is_super_admin() or dp_has_role('faculty')
  or dp_is_teacher_of_course(course_id)
  or dp_is_mentor_of(assigned_to_user_id)
  or assigned_to_cohort_id in (select scope_id from dp_enrollments where user_id = auth.uid() and scope_type = 'cohort')
);
create policy dp_assignments_write on dp_assignments for all using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_is_teacher_of_course(course_id) or dp_is_mentor_of(assigned_to_user_id)
) with check (
  dp_is_super_admin() or dp_has_role('faculty') or dp_is_teacher_of_course(course_id) or dp_is_mentor_of(assigned_to_user_id)
);

create policy dp_submissions_student_own on dp_submissions for select using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
  or dp_is_mentor_of(student_id)
  or exists (select 1 from dp_assignments a where a.id = assignment_id and dp_is_teacher_of_course(a.course_id))
);
create policy dp_submissions_student_insert on dp_submissions for insert with check (student_id = auth.uid());
create policy dp_submissions_student_update on dp_submissions for update using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
  or exists (select 1 from dp_assignments a where a.id = assignment_id and dp_is_teacher_of_course(a.course_id))
);

create policy dp_feedback_select on dp_feedback for select using (
  dp_is_super_admin() or dp_has_role('faculty')
  or author_id = auth.uid()
  or (is_private = false and exists (select 1 from dp_submissions s where s.id = submission_id and s.student_id = auth.uid()))
  or exists (
    select 1 from dp_submissions s join dp_assignments a on a.id = s.assignment_id
    where s.id = submission_id and (dp_is_teacher_of_course(a.course_id) or dp_is_mentor_of(s.student_id))
  )
);
create policy dp_feedback_write on dp_feedback for insert with check (
  dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher') or dp_has_role('mentor')
);

create policy dp_creative_projects_owner on dp_creative_projects for all using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
  or dp_has_role('teacher') or dp_is_mentor_of(student_id)
) with check (student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher'));

create policy dp_project_feedback_select on dp_project_feedback for select using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher')
  or author_id = auth.uid()
  or exists (select 1 from dp_creative_projects p where p.id = project_id and p.student_id = auth.uid())
);
create policy dp_project_feedback_write on dp_project_feedback for insert with check (
  dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher') or author_id = auth.uid()
);
