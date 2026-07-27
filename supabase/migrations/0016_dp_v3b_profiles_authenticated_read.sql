-- dp_v3b_profiles_authenticated_read
--
-- Root-cause fix for a latent bug discovered while building Messaging:
-- the pre-existing `profiles` table (not a dp_ table — it predates this
-- build) only had a self-select policy ("Users can view their own
-- profile", auth.uid() = id). That silently broke every staff page's
-- "show the other person's name" lookup in real authenticated sessions —
-- undetectable during earlier verification because the Supabase MCP runs
-- queries with elevated privileges that bypass RLS entirely.
--
-- This adds one new permissive SELECT policy allowing any authenticated
-- user to read profile rows. It does NOT touch, replace, or narrow the
-- three pre-existing policies (self-select, self-insert, self-update).
-- profiles has no sensitive columns (id, email, full_name, avatar_url,
-- role, created_at/updated_at only), so a platform-wide read policy is
-- an appropriate, low-risk fix — not a data exposure.

create policy "Authenticated users can view basic profile info"
on profiles
for select
using (auth.role() = 'authenticated');
