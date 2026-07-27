-- Grants super_admin on the Discipleship Platform to Sydni's existing account
-- (sydnimb@gmail.com, auth.users id 6a2bcb35-e14b-4f1e-a3e6-8fb2c00c4fdb), which
-- predates this build and already has role='owner' on the pre-existing profiles
-- table for the original Dove Expressions app sharing this same Supabase project.
-- Data-only insert into dp_user_roles, additive, no schema change.
insert into dp_user_roles (user_id, role)
values ('6a2bcb35-e14b-4f1e-a3e6-8fb2c00c4fdb', 'super_admin')
on conflict do nothing;
