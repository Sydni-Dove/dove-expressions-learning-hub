-- v4d: Three top-level pathways with Rooted nested under Draw Near.
-- This is a corrective, backward-compatible migration after v4's four-pathway
-- model. Do not delete the rooted pathway record; existing courses/resources/
-- progress may still reference it.

alter table dp_pathways add column if not exists parent_pathway_code text null;
alter table dp_pathways add column if not exists is_primary boolean not null default true;
alter table dp_pathways add column if not exists pathway_level text not null default 'primary';

alter table dp_courses add column if not exists track_key text null;
alter table dp_courses add column if not exists series_key text null;

update dp_pathways
set
  subtitle = 'Foundations for Life With God',
  description = 'Relationship with God and spiritual formation: salvation and surrender, knowing God''s character, prayer, worship, Scripture, the Holy Spirit, intimacy with God, identity in Christ, grace, repentance, obedience, Christian community, healing and freedom, renewing the mind, maturity, character, discipline, perseverance, spiritual warfare, healthy relationships, and boundaries.',
  purpose = 'Help believers establish a real, consistent relationship with God and become spiritually and emotionally established in Christ.',
  expected_outcomes = array[
    'A stronger, more personal relationship with God',
    'Consistent spiritual practices rooted in grace and surrender',
    'Greater identity, healing, maturity, and stability in Christ'
  ],
  parent_pathway_code = null,
  is_primary = true,
  pathway_level = 'primary',
  order_index = 1,
  journey_order_index = 1
where code = 'draw_near';

update dp_pathways
set
  parent_pathway_code = null,
  is_primary = true,
  pathway_level = 'primary',
  order_index = 2,
  journey_order_index = 2
where code = 'hear_god';

update dp_pathways
set
  parent_pathway_code = 'draw_near',
  is_primary = false,
  pathway_level = 'track',
  order_index = 10,
  journey_order_index = 1
where code = 'rooted';

update dp_pathways
set
  parent_pathway_code = null,
  is_primary = true,
  pathway_level = 'primary',
  order_index = 3,
  journey_order_index = 3
where code = 'kingdom_mandate';

-- Rooted courses remain Rooted-classified, but Draw Near becomes the top-level
-- pathway for discovery and progress rollups.
update dp_courses
set
  pathways = case
    when pathways @> array['draw_near']::text[] then pathways
    else array_append(pathways, 'draw_near')
  end,
  track_key = coalesce(track_key, 'rooted')
where pathways @> array['rooted']::text[];

update dp_courses
set series_key = coalesce(series_key, 'mind_of_christ')
where slug = 'rooted-mind-of-christ' or title ilike '%mind of christ%';

-- Keep lessons/course tags readable for older code paths while making Draw Near
-- available as the parent pathway tag for Rooted-tagged lessons.
update dp_lessons
set pathways = case
  when pathways @> array['rooted']::text[] and not pathways @> array['draw_near']::text[] then array_append(pathways, 'draw_near')
  else pathways
end
where pathways @> array['rooted']::text[];
