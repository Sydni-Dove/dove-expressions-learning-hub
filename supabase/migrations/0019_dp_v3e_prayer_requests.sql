-- dp_v3e_prayer_requests
--
-- Real backend for Prayer Requests (previously prototype-only, sample-data
-- UI). Visibility is a per-request enum: private / mentor / cohort /
-- community. "Anonymous" is a UI-only display choice — is_anonymous never
-- hides author_id from the database, so authorship is always auditable by
-- staff/admin even when displayed anonymously to other students. This
-- mirrors the guardian-consent "self-reported, not hidden from staff"
-- pattern already used elsewhere in this build.
--
-- dp_can_view_prayer_request() is a single SECURITY DEFINER helper that
-- encapsulates every visibility branch, so both dp_prayer_requests and
-- dp_prayer_responses can reference the same logic without duplicating it
-- (and risking the two getting out of sync).

create table if not exists dp_prayer_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  visibility text not null default 'private'
    check (visibility in ('private','mentor','cohort','community')),
  is_anonymous boolean not null default false,
  status text not null default 'active'
    check (status in ('active','answered','archived')),
  answered_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dp_prayer_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references dp_prayer_requests(id) on delete cascade,
  responder_id uuid not null references auth.users(id) on delete cascade,
  body text,
  created_at timestamptz not null default now()
);

alter table dp_prayer_requests enable row level security;
alter table dp_prayer_responses enable row level security;

create or replace function dp_can_view_prayer_request(target_request_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from dp_prayer_requests r
    where r.id = target_request_id
      and (
        r.author_id = auth.uid()
        or dp_is_super_admin()
        or dp_has_role('faculty')
        or r.visibility = 'community'
        or (r.visibility = 'mentor' and dp_is_mentor_of(r.author_id))
        or (r.visibility = 'cohort' and exists (
              select 1 from dp_enrollments e_author
              join dp_enrollments e_viewer
                on e_author.scope_id = e_viewer.scope_id
               and e_author.scope_type = 'cohort'
               and e_viewer.scope_type = 'cohort'
              where e_author.user_id = r.author_id
                and e_viewer.user_id = auth.uid()
            ))
      )
  );
$$;

create policy dp_prayer_requests_select
on dp_prayer_requests
for select
using (dp_can_view_prayer_request(id));

create policy dp_prayer_requests_insert
on dp_prayer_requests
for insert
with check (author_id = auth.uid());

create policy dp_prayer_requests_update
on dp_prayer_requests
for update
using (author_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'))
with check (author_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));

create policy dp_prayer_requests_delete
on dp_prayer_requests
for delete
using (author_id = auth.uid() or dp_is_super_admin());

create policy dp_prayer_responses_select
on dp_prayer_responses
for select
using (dp_can_view_prayer_request(request_id));

create policy dp_prayer_responses_insert
on dp_prayer_responses
for insert
with check (responder_id = auth.uid() and dp_can_view_prayer_request(request_id));

create policy dp_prayer_responses_delete
on dp_prayer_responses
for delete
using (responder_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty'));
