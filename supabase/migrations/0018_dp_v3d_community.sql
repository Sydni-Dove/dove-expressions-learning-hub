-- dp_v3d_community
--
-- Real backend for Community spaces/posts/comments (previously
-- prototype-only, sample-data UI). Per-space moderation via
-- requires_approval: posts/comments land as status='pending' in a
-- moderated space, 'published' otherwise. Author always sees their own
-- content regardless of status; faculty/admin see everything for
-- moderation. No general space-creation UI for students in this pass —
-- space creation is faculty/admin only, matching dp_community_spaces_write.

create table if not exists dp_community_spaces (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references dp_learning_areas(id),
  name text not null,
  description text,
  space_type text not null default 'general'
    check (space_type in ('general','prayer','testimonies','dreams','kingdom_mandate','creative_builders','course','cohort','faculty_led')),
  requires_approval boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists dp_community_posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references dp_community_spaces(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  status text not null default 'published' check (status in ('pending','published','removed')),
  created_at timestamptz not null default now()
);

create table if not exists dp_community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references dp_community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  status text not null default 'published' check (status in ('pending','published','removed')),
  created_at timestamptz not null default now()
);

alter table dp_community_spaces enable row level security;
alter table dp_community_posts enable row level security;
alter table dp_community_comments enable row level security;

create policy dp_community_spaces_select
on dp_community_spaces
for select
using (is_active = true or dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_community_spaces_write
on dp_community_spaces
for all
using (dp_is_super_admin() or dp_has_role('faculty'))
with check (dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_community_posts_select
on dp_community_posts
for select
using (status = 'published' or author_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_community_posts_insert
on dp_community_posts
for insert
with check (author_id = auth.uid());

create policy dp_community_posts_update
on dp_community_posts
for update
using (author_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'))
with check (author_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_community_posts_delete
on dp_community_posts
for delete
using (author_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_community_comments_select
on dp_community_comments
for select
using (status = 'published' or author_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_community_comments_insert
on dp_community_comments
for insert
with check (author_id = auth.uid());

create policy dp_community_comments_update
on dp_community_comments
for update
using (author_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'))
with check (author_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_community_comments_delete
on dp_community_comments
for delete
using (author_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));

-- Seed three starter spaces so the feature isn't an empty shell on launch.
-- General and Testimonies are open (no approval needed); Dreams & Visions
-- requires faculty approval given the discernment sensitivity of dream
-- content shared publicly.
insert into dp_community_spaces (name, description, space_type, requires_approval, is_active)
values
  ('General', 'Open fellowship and discussion for the whole community.', 'general', false, true),
  ('Testimonies', 'Share what God has done — answered prayers, breakthroughs, testimonies.', 'testimonies', false, true),
  ('Dreams & Visions', 'Share a dream or vision for community reflection. Posts are reviewed before publishing.', 'dreams', true, true)
on conflict do nothing;
