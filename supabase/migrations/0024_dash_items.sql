-- Dove Expressions Command Center inventory.
-- Single flexible table mirroring the dashboard's unified record model.
-- Namespaced (dash_) so it never collides with existing app tables.
-- RLS: owner-only — each account sees and edits only its own inventory.

create table if not exists public.dash_items (
  id           text primary key,
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null,              -- app|product|video|series|content_idea|idea|community|course|document|design
  name         text not null,
  category     text,
  status       text,
  priority     text,                        -- high|medium|low
  pillar       text,                        -- draw|hear|fulfill
  tier         text,                        -- now|next|later|vault
  description  text,
  location     text,
  next_action  text,
  notes        text,
  format       text,
  platform     text,
  ptype        text,                        -- product type
  dtype        text,                        -- document/design type
  grp          text,                        -- course/document group
  bucket       text,                        -- idea vault bucket
  maturity     text,                        -- community maturity
  performance  text,                        -- video performance
  build        text,                        -- app "current build"
  source       text,                        -- idea source/context
  progress     int,
  stack        jsonb not null default '[]'::jsonb,
  related      jsonb not null default '[]'::jsonb,
  episodes     jsonb not null default '[]'::jsonb,
  thumb        text,
  sort         int not null default 0,
  updated      date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists dash_items_owner_idx on public.dash_items (owner_id);
create index if not exists dash_items_kind_idx  on public.dash_items (owner_id, kind, sort);

alter table public.dash_items enable row level security;

create policy dash_items_select on public.dash_items
  for select to authenticated using (owner_id = auth.uid());
create policy dash_items_insert on public.dash_items
  for insert to authenticated with check (owner_id = auth.uid());
create policy dash_items_update on public.dash_items
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy dash_items_delete on public.dash_items
  for delete to authenticated using (owner_id = auth.uid());

-- keep updated_at fresh (search_path pinned per Supabase linter guidance)
create or replace function public.dash_items_touch() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists dash_items_touch_trg on public.dash_items;
create trigger dash_items_touch_trg before update on public.dash_items
  for each row execute function public.dash_items_touch();
