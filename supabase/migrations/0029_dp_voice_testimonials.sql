-- Voice testimonials: private by default; explicit separate marketing permission.
create table if not exists dp_voice_testimonials (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 review_text text,
 video_url text,
 allow_public_use boolean not null default false,
 status text not null default 'pending' check (status in ('pending','approved','declined')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint dp_voice_testimonials_content check (nullif(btrim(coalesce(review_text,'')), '') is not null or nullif(btrim(coalesce(video_url,'')), '') is not null),
 constraint dp_voice_testimonials_video_url check (video_url is null or video_url ~* '^https://[^[:space:]]+$')
);
create index if not exists dp_voice_testimonials_student_idx on dp_voice_testimonials(student_id,created_at desc);
alter table dp_voice_testimonials enable row level security;
drop policy if exists dp_voice_testimonials_student_read on dp_voice_testimonials;
create policy dp_voice_testimonials_student_read on dp_voice_testimonials for select to authenticated using (student_id=auth.uid());
drop policy if exists dp_voice_testimonials_staff_read on dp_voice_testimonials;
create policy dp_voice_testimonials_staff_read on dp_voice_testimonials for select to authenticated using (dp_is_super_admin() or dp_has_role('faculty'));
drop policy if exists dp_voice_testimonials_student_insert on dp_voice_testimonials;
create policy dp_voice_testimonials_student_insert on dp_voice_testimonials for insert to authenticated with check (student_id=auth.uid() and status='pending' and reviewed_at is null);
drop policy if exists dp_voice_testimonials_staff_update on dp_voice_testimonials;
create policy dp_voice_testimonials_staff_update on dp_voice_testimonials for update to authenticated using (dp_is_super_admin() or dp_has_role('faculty')) with check (dp_is_super_admin() or dp_has_role('faculty'));
-- No anonymous read, student update, or student delete policy. Even approved
-- testimonials are not automatically public; publication is a separate action.
