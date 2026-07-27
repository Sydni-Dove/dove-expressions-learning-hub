-- ============================================================================
-- v4: Four Pathways discipleship model (Draw Near, Hear God, Rooted, Kingdom
-- Mandate) replaces the Three Pillars framework as the primary organizing
-- structure for the Discipleship Hub. Fully additive:
--   - dp_pillars / the `pillars text[]` tagging columns from migration 9 are
--     left in place untouched (legacy/deprecated, documented as such).
--   - a new dp_pathways table + new `pathways text[]` tagging columns are
--     introduced alongside them so nothing existing breaks.
--   - richer `content_status` text columns are added alongside the existing
--     dp_lesson_status enum / is_published boolean rather than altering
--     them, avoiding any enum-in-same-transaction hazards.
-- ============================================================================

create table dp_pathways (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  subtitle text,
  description text,
  purpose text,
  expected_outcomes text[] not null default '{}',
  scripture_ref text,
  order_index int not null default 0,
  journey_order_index int not null default 0,
  accent_color text,
  icon_key text,
  status text not null default 'published'
    check (status in ('draft','published','scheduled','archived','coming_soon')),
  created_at timestamptz not null default now()
);

insert into dp_pathways
  (code, name, subtitle, description, purpose, expected_outcomes, scripture_ref, order_index, journey_order_index, accent_color, icon_key)
values
(
  'draw_near', 'Draw Near', 'Foundations for Life With God',
  'Establishing a real, consistent relationship with God — salvation and surrender, knowing His character, identity as His child, prayer, worship, Scripture, the Holy Spirit, and life in Christian community.',
  'Help believers establish a real, consistent relationship with God.',
  array['Consistent spiritual practices', 'A stronger, more personal relationship with God'],
  'Draw near to God, and he will draw near to you. — James 4:8',
  1, 1, 'burgundy', 'Sparkles'
),
(
  'hear_god', 'Hear God', 'Recognizing and Discerning His Voice',
  'Learning how God communicates and how to recognize, understand, test, and steward what you receive — through Scripture, the Holy Spirit, dreams and visions, prophecy, and everyday impressions.',
  'Teach believers how God communicates and how to recognize, understand, test, and steward what they receive.',
  array['Growth in biblical discernment', 'Greater responsibility in receiving and responding to God''s communication'],
  'My sheep hear my voice, and I know them, and they follow me. — John 10:27',
  2, 3, 'coral', 'Ear'
),
(
  'rooted', 'Rooted', 'Spiritual Formation, Healing, and Maturity',
  'Becoming internally established in Christ — the mind of Christ, identity, healing from past wounds, spiritual warfare, forgiveness, healthy boundaries, character, discipline, and stewarding your gifts with maturity.',
  'Help believers become internally established in Christ so they can remain stable, discern clearly, and obey faithfully.',
  array['A more grounded, mature, and stable walk', 'Healing from past wounds', 'Living from biblical truth rather than unhealthy patterns'],
  'Rooted and built up in him and established in the faith. — Colossians 2:7',
  3, 2, 'gold', 'Wind'
),
(
  'kingdom_mandate', 'Kingdom Mandate', 'From Revelation to Execution',
  'Understanding what God has assigned you and moving from revelation into practical, faithful obedience — calling, spiritual wiring, planning with God, and finishing what He instructed.',
  'Help believers understand what God has assigned them and move from revelation into practical obedience.',
  array['Movement beyond inspiration into completed acts of obedience', 'Clarity on calling and Kingdom assignment'],
  'Whatever your hand finds to do, do it with all your might. — Ecclesiastes 9:10',
  4, 4, 'sunrise', 'Compass'
);

alter table dp_pathways enable row level security;
create policy dp_pathways_read on dp_pathways for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy dp_pathways_write on dp_pathways for all using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));

alter table dp_courses add column if not exists pathways text[] not null default '{}';
alter table dp_lessons add column if not exists pathways text[] not null default '{}';
alter table dp_assignments add column if not exists pathways text[] not null default '{}';
alter table dp_assignment_templates add column if not exists pathways text[] not null default '{}';
alter table dp_goals add column if not exists pathways text[] not null default '{}';
alter table dp_notes add column if not exists pathways text[] not null default '{}';

alter table dp_courses add column if not exists subtitle text;
alter table dp_courses add column if not exists content_format text not null default 'course'
  check (content_format in ('course','series'));
alter table dp_courses add column if not exists instructor_id uuid references auth.users(id);
alter table dp_courses add column if not exists difficulty_level text
  check (difficulty_level in ('foundational','growing','deepening'));
alter table dp_courses add column if not exists estimated_duration text;
alter table dp_courses add column if not exists scripture_refs text[] not null default '{}';
alter table dp_courses add column if not exists prerequisite_course_id uuid references dp_courses(id);
alter table dp_courses add column if not exists content_status text not null default 'published'
  check (content_status in ('draft','published','scheduled','archived','coming_soon'));

alter table dp_lessons add column if not exists content_status text not null default 'published'
  check (content_status in ('draft','published','scheduled','archived','coming_soon'));

create table dp_lesson_reflections (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references dp_lessons(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  what_learned text,
  what_god_highlighting text,
  belief_or_pattern_to_change text,
  response_action text,
  prayer_response text,
  scripture_to_meditate text,
  practical_next_step text,
  follow_up_date date,
  private_notes text,
  shared_with_mentor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_id)
);
alter table dp_lesson_reflections enable row level security;
create policy dp_lesson_reflections_owner on dp_lesson_reflections for all using (
  student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
  or (shared_with_mentor = true and dp_is_mentor_of(student_id))
) with check (student_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));

update dp_courses set pathways = array['draw_near'] where slug = 'foundations-drawing-near';
update dp_lessons set pathways = array['draw_near']
  where module_id in (select id from dp_modules where title = 'Week 1 — Establishing Rhythm');

with area as (select id from dp_learning_areas where area_key = 'discipleship_hub' limit 1),
new_course as (
  insert into dp_courses (area_id, title, slug, subtitle, description, pathways, content_format, difficulty_level, content_status, is_published, is_standalone, order_index)
  select area.id,
    'Rooted: The Mind of Christ',
    'rooted-the-mind-of-christ',
    'Learning to Think, Discern, and Respond From Christ''s Perspective',
    'The first teaching series under the Rooted pathway. Over the coming weeks this series will walk through renewing the mind, identity in Christ, and learning to think, discern, and respond the way Christ does — with lessons, reflection exercises, Scripture study, declarations, and journal prompts. Lessons are being developed and will be released here as they''re ready.',
    array['rooted'],
    'series',
    'growing',
    'coming_soon',
    false,
    true,
    1
  from area
  returning id
),
new_module as (
  insert into dp_modules (course_id, title, description, order_index)
  select id, 'Series Introduction', 'What to expect from Rooted: The Mind of Christ.', 1 from new_course
  returning id, course_id
)
insert into dp_lessons (module_id, title, slug, status, content_status, order_index, estimated_duration_minutes)
select id, 'Lessons coming soon', 'lessons-coming-soon', 'draft', 'coming_soon', 1, null from new_module;

with new_lesson as (
  select l.id from dp_lessons l
  join dp_modules m on m.id = l.module_id
  join dp_courses c on c.id = m.course_id
  where c.slug = 'rooted-the-mind-of-christ' and l.slug = 'lessons-coming-soon'
)
insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
select id, 'written', 1,
  jsonb_build_object('text', 'Rooted: The Mind of Christ is being developed. This series will include teaching lessons, reflection exercises, Scripture study, declarations, journal prompts, and practical activation — all centered on learning to think, discern, and respond from Christ''s perspective. Check back as new lessons are released, or ask your mentor what''s available now.')
from new_lesson;
