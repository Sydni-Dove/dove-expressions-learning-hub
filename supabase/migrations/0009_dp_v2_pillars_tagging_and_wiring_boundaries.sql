-- ============================================================================
-- v2 correction: platform-wide Three Pillars framework (Draw Near to God /
-- Hear God / Fulfill Your Kingdom Mandate) replaces the single linear
-- "Hear -> Record -> Interpret -> Respond -> Build" sentence as the primary
-- organizing structure. All additive; nothing here removes or renames an
-- existing column.
-- ============================================================================

create table dp_pillars (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  order_index int not null default 0
);

insert into dp_pillars (code, name, description, order_index) values
('draw_near', 'Draw Near to God', 'Intimacy with God, prayer, worship, Scripture study, healing, identity in Christ, spiritual disciplines, rest, trust, surrender.', 1),
('hear_god', 'Hear God', 'Recognizing, recording, understanding, testing, and stewarding God''s communication.', 2),
('fulfill_mandate', 'Fulfill Your Kingdom Mandate', 'Obedience, maturity, function, calling, assignment, and completion.', 3);

alter table dp_courses add column if not exists pillars text[] not null default '{}';
alter table dp_lessons add column if not exists pillars text[] not null default '{}';
alter table dp_assignments add column if not exists pillars text[] not null default '{}';
alter table dp_assignment_templates add column if not exists pillars text[] not null default '{}';
alter table dp_goals add column if not exists pillars text[] not null default '{}';
alter table dp_notes add column if not exists pillars text[] not null default '{}';
alter table dp_wiring_results add column if not exists pillars text[] not null default '{"fulfill_mandate"}';
alter table dp_discipleship_plans add column if not exists pillars text[] not null default '{}';
alter table dp_meetings_with_god add column if not exists pillars text[] not null default '{"hear_god"}';
alter table dp_two_way_journal_entries add column if not exists pillars text[] not null default '{"hear_god"}';
alter table dp_scripture_journey_entries add column if not exists pillars text[] not null default '{"draw_near"}';
alter table dp_mandate_records add column if not exists pillars text[] not null default '{"fulfill_mandate"}';

update dp_courses set pillars = array['draw_near'] where slug = 'foundations-drawing-near';
update dp_lessons set pillars = array['draw_near']
  where module_id in (select id from dp_modules where title = 'Week 1 — Establishing Rhythm');
update dp_assignment_templates set pillars = array['draw_near'] where title = 'Biblical Character Reflection — Hannah';
update dp_assignment_templates set pillars = array['draw_near','hear_god'] where title = 'Biblical Ministry & Prayer Study — Elijah';
update dp_assignment_templates set pillars = array['hear_god'] where title = 'Two-Way Journaling Practice';
update dp_courses set pillars = array['fulfill_mandate']
  where area_id = (select id from dp_learning_areas where area_key = 'creative_studio');

create type dp_wiring_result_status as enum (
  'clear_pattern', 'developing_pattern', 'inconclusive', 'requires_discussion', 'multiple_close_results'
);

alter table dp_wiring_results add column if not exists result_status dp_wiring_result_status not null default 'requires_discussion';
alter table dp_wiring_results add column if not exists close_secondary_ids uuid[] not null default '{}';

alter table dp_wiring_profiles add column if not exists student_agrees boolean;
alter table dp_wiring_profiles add column if not exists student_disagreement_note text;
alter table dp_wiring_profiles add column if not exists faculty_adjusted boolean not null default false;
alter table dp_wiring_profiles add column if not exists faculty_adjustment_note text;
alter table dp_wiring_profiles add column if not exists public_visibility boolean not null default false;

alter table dp_wiring_categories add column if not exists category_type text not null default 'gift_or_role'
  check (category_type in ('gift_or_role','function','burden','reception_style'));

alter table dp_lessons add column if not exists content_version int not null default 1;
alter table dp_assignments add column if not exists version int not null default 1;
alter table dp_sessions add column if not exists summary_version int not null default 1;

create type dp_creative_visibility as enum (
  'private_draft', 'shared_instructor', 'shared_collaborators', 'shared_cohort', 'public_portfolio'
);
alter table dp_creative_projects add column if not exists visibility dp_creative_visibility not null default 'private_draft';

create table dp_creative_project_collaborators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references dp_creative_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique(project_id, user_id)
);
alter table dp_creative_project_collaborators enable row level security;
create policy dp_creative_collab_select on dp_creative_project_collaborators for select using (
  user_id = auth.uid() or dp_is_super_admin()
  or exists (select 1 from dp_creative_projects p where p.id = project_id and p.student_id = auth.uid())
);
create policy dp_creative_collab_write on dp_creative_project_collaborators for all using (
  dp_is_super_admin() or exists (select 1 from dp_creative_projects p where p.id = project_id and p.student_id = auth.uid())
) with check (
  dp_is_super_admin() or exists (select 1 from dp_creative_projects p where p.id = project_id and p.student_id = auth.uid())
);

alter table dp_pillars enable row level security;
create policy dp_pillars_read on dp_pillars for select using (true);
create policy dp_pillars_write on dp_pillars for all using (dp_is_super_admin()) with check (dp_is_super_admin());
