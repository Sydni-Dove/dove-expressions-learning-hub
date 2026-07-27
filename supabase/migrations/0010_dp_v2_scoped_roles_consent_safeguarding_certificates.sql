create table dp_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role dp_role not null,
  area_id uuid references dp_learning_areas(id),
  program_id uuid references dp_programs(id),
  cohort_id uuid references dp_cohorts(id),
  course_id uuid references dp_courses(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function dp_has_scoped_role(check_role dp_role, p_area_id uuid default null, p_program_id uuid default null, p_cohort_id uuid default null, p_course_id uuid default null)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from dp_role_assignments ra
    where ra.user_id = auth.uid()
      and ra.role = check_role
      and (ra.area_id is null or p_area_id is null or ra.area_id = p_area_id)
      and (ra.program_id is null or p_program_id is null or ra.program_id = p_program_id)
      and (ra.cohort_id is null or p_cohort_id is null or ra.cohort_id = p_cohort_id)
      and (ra.course_id is null or p_course_id is null or ra.course_id = p_course_id)
  );
$$;

alter table dp_role_assignments enable row level security;
create policy dp_role_assignments_select on dp_role_assignments for select using (
  user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
);
create policy dp_role_assignments_write on dp_role_assignments for all using (
  dp_is_super_admin() or dp_has_role('faculty')
) with check (dp_is_super_admin() or dp_has_role('faculty'));

drop policy if exists dp_programs_write on dp_programs;
create policy dp_programs_write on dp_programs for all using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_has_scoped_role('faculty', area_id, id, null, null)
) with check (
  dp_is_super_admin() or dp_has_role('faculty') or dp_has_scoped_role('faculty', area_id, id, null, null)
);

drop policy if exists dp_courses_write on dp_courses;
create policy dp_courses_write on dp_courses for all using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_is_teacher_of_course(id)
  or dp_has_scoped_role('faculty', area_id, program_id, null, null)
) with check (
  dp_is_super_admin() or dp_has_role('faculty') or dp_has_scoped_role('faculty', area_id, program_id, null, null)
);

create table dp_policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_type text not null check (policy_type in ('program_agreement','privacy_policy','recording_consent','guardian_consent','community_guidelines')),
  version int not null default 1,
  title text not null,
  body text not null,
  effective_date date not null default current_date,
  superseded_by uuid references dp_policy_documents(id),
  created_at timestamptz not null default now()
);

create table dp_policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_id uuid not null references dp_policy_documents(id),
  accepted_at timestamptz not null default now(),
  unique(user_id, policy_id)
);

alter table dp_sessions add column if not exists recording_consent boolean;
alter table dp_sessions add column if not exists recording_consent_at timestamptz;
alter table dp_sessions add column if not exists was_recorded boolean not null default false;

create table dp_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id),
  reported_user_id uuid references auth.users(id),
  content_type text,
  content_id uuid,
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table dp_mentor_transfer_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  from_mentor_id uuid references auth.users(id),
  to_mentor_id uuid references auth.users(id),
  reason text,
  transferred_by uuid references auth.users(id),
  transferred_at timestamptz not null default now()
);

create table dp_student_lifecycle (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade unique,
  status text not null default 'active' check (status in ('active','paused','withdrawn')),
  withdrawal_requested_at timestamptz,
  data_retention_until date,
  notes text,
  updated_at timestamptz not null default now()
);

create table dp_guardian_consents (
  id uuid primary key default gen_random_uuid(),
  minor_user_id uuid not null references auth.users(id) on delete cascade,
  guardian_name text not null,
  guardian_email text not null,
  guardian_relationship text,
  consent_given_at timestamptz not null default now(),
  policy_id uuid references dp_policy_documents(id),
  notes text
);

create table dp_certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  certificate_type text not null check (certificate_type in ('course_completion','training_completion','attendance')),
  title text not null,
  related_course_id uuid references dp_courses(id),
  related_program_id uuid references dp_programs(id),
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id),
  pdf_url text,
  disclaimer_text text not null default 'This certificate documents course completion, training completion, or attendance only. It does not constitute ministry authorization, commissioning, ordination, spiritual qualification, or endorsement.'
);

alter table dp_policy_documents enable row level security;
alter table dp_policy_acceptances enable row level security;
alter table dp_reports enable row level security;
alter table dp_mentor_transfer_log enable row level security;
alter table dp_student_lifecycle enable row level security;
alter table dp_guardian_consents enable row level security;
alter table dp_certificates enable row level security;

create policy dp_policy_documents_read on dp_policy_documents for select using (true);
create policy dp_policy_documents_write on dp_policy_documents for all using (dp_is_super_admin()) with check (dp_is_super_admin());

create policy dp_policy_acceptances_owner on dp_policy_acceptances for all using (
  user_id = auth.uid() or dp_is_super_admin()
) with check (user_id = auth.uid());

create policy dp_reports_select on dp_reports for select using (
  reporter_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
);
create policy dp_reports_insert on dp_reports for insert with check (auth.uid() is not null);
create policy dp_reports_update on dp_reports for update using (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_mentor_transfer_select on dp_mentor_transfer_log for select using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
  or from_mentor_id = auth.uid() or to_mentor_id = auth.uid()
);
create policy dp_mentor_transfer_write on dp_mentor_transfer_log for insert with check (
  dp_is_super_admin() or dp_has_role('faculty')
);

create policy dp_student_lifecycle_select on dp_student_lifecycle for select using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
);
create policy dp_student_lifecycle_write on dp_student_lifecycle for all using (
  dp_is_super_admin() or dp_has_role('faculty')
) with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_guardian_consents_select on dp_guardian_consents for select using (
  dp_is_super_admin() or dp_has_role('faculty') or minor_user_id = auth.uid()
);
create policy dp_guardian_consents_write on dp_guardian_consents for all using (
  dp_is_super_admin() or dp_has_role('faculty')
) with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_certificates_select on dp_certificates for select using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
  or (related_course_id is not null and dp_is_teacher_of_course(related_course_id))
);
create policy dp_certificates_write on dp_certificates for all using (
  dp_is_super_admin() or dp_has_role('faculty')
) with check (dp_is_super_admin() or dp_has_role('faculty'));
