-- dp_v3c_messaging
--
-- Real backend for direct/group messaging (previously prototype-only,
-- sample-data UI). Three tables plus one SECURITY DEFINER helper function
-- that both the app and RLS policies use to determine participation
-- without a self-referential RLS recursion problem.
--
-- MVP scope, enforced in the app layer, not this schema: students may only
-- start conversations with faculty/teacher/mentor/super_admin; staff may
-- start conversations with any student. No peer-to-peer student messaging.
-- The schema itself is generic (any auth.users id can be a participant) —
-- the restriction lives in the "who can I message" candidate list the UI
-- builds, not in a table constraint, so a future product decision to allow
-- peer messaging doesn't require a schema change.

create table if not exists dp_conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists dp_conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references dp_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  unique (conversation_id, user_id)
);

create table if not exists dp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references dp_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

alter table dp_conversations enable row level security;
alter table dp_conversation_participants enable row level security;
alter table dp_messages enable row level security;

-- SECURITY DEFINER + STABLE + pinned search_path, matching the pattern
-- used by every other dp_ RLS helper function in this build.
create or replace function dp_is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from dp_conversation_participants
    where conversation_id = target_conversation_id and user_id = auth.uid()
  );
$$;

create policy dp_conversations_select
on dp_conversations
for select
using (dp_is_conversation_participant(id) or dp_is_super_admin());

create policy dp_conversations_insert
on dp_conversations
for insert
with check (created_by = auth.uid());

create policy dp_conversation_participants_select
on dp_conversation_participants
for select
using (dp_is_conversation_participant(conversation_id) or dp_is_super_admin());

create policy dp_conversation_participants_insert
on dp_conversation_participants
for insert
with check (
  dp_is_super_admin()
  or exists (
    select 1 from dp_conversations c
    where c.id = dp_conversation_participants.conversation_id
      and c.created_by = auth.uid()
  )
  or dp_is_conversation_participant(conversation_id)
);

create policy dp_conversation_participants_update_own
on dp_conversation_participants
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy dp_messages_select
on dp_messages
for select
using (dp_is_conversation_participant(conversation_id) or dp_is_super_admin());

create policy dp_messages_insert
on dp_messages
for insert
with check (sender_id = auth.uid() and dp_is_conversation_participant(conversation_id));
