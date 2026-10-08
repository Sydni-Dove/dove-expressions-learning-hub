import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

/**
 * In-memory Postgres (PGlite) that replays the REAL supabase/migrations on top of
 * minimal stand-ins for Supabase's auth/storage schemas. Nothing here touches the
 * live project. `asUser()` impersonates a signed-in user so RLS is genuinely
 * evaluated (roles `authenticated`/`anon`, auth.uid() from a session setting).
 */
const BOOTSTRAP = `
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
-- migration 0020 grants super_admin to the real owner's id, which must exist.
insert into auth.users(id,email) values ('6a2bcb35-e14b-4f1e-a3e6-8fb2c00c4fdb','owner@example.test');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.uid', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('app.role', true), ''), 'anon') $$;
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
exception when duplicate_object then null; end $$;
create schema if not exists storage;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
create table public.profiles (id uuid primary key, full_name text, email text, role text);
alter table public.profiles enable row level security;
grant usage on schema public, auth, storage to anon, authenticated;
`;

export async function createDb(opts: { upTo?: string; skip?: string[] } = { skip: ["0025"] }) {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  const dir = path.join(__dirname, "../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
  const applied: string[] = [];
  for (const f of files) {
    if (opts.upTo && f.slice(0, 4) > opts.upTo) break;
    if (opts.skip?.includes(f.slice(0, 4))) continue; // mirrors live: 0025 is intentionally not applied
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
    applied.push(f);
  }
  await db.exec(`grant all on all tables in schema public to anon, authenticated;
                 grant execute on all functions in schema public to anon, authenticated;
                 grant select, insert, update, delete on all tables in schema storage to authenticated;`);
  return { db, applied };
}

/** Run a query as a given user (null = anon). Always reset afterwards. */
export async function asUser<T = any>(db: PGlite, uid: string | null, sql: string, params: any[] = []) {
  await db.exec(`set app.uid = '${uid ?? ""}'; set app.role = '${uid ? "authenticated" : "anon"}'; set role ${uid ? "authenticated" : "anon"};`);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec(`reset role; set app.uid = ''; set app.role = '';`);
  }
}
