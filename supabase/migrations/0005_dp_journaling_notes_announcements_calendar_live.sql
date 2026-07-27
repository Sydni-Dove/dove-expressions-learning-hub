create table dp_meetings_with_god (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  subject text,
  scriptures text[] not null default '{}',
  images_visions text,
  internal_words text,
  feelings text,
  knowings text,
  names text,
  dates text,
  instructions text,
  questions text,
  possible_interpretation text,
  confirmations text,
  research_notes text,
  wise_counsel text,
  strategy_map jsonb not null default '{}',
  prayer_checkpoints text,
  follow_up_date date,
  status dp_mwg_status not null default 'received',
  voice_memo_id uuid,
  visibility dp_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dp_two_way_journal_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  question_or_prayer text,
  received_text text,
  reflection text,
  scripture_testing text,
  confirmation text,
  further_questions text,
  response_action text,
  visibility dp_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dp_scripture_journey_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  week_number int not null,
  assigned_passages text[] not null default '{}',
  author text,
  historical_setting text,
  original_audience text,
  original_meaning text,
  key_observations text,
  reveals_about_god text,
  personal_highlight text,
  questions text,
  prayer text,
  response_step text,
  share_with_mentor boolean not null default false,
  status dp_journey_status not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, week_number)
);

create table dp_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text,
  note_kind dp_note_kind not null default 'personal',
  tags text[] not null default '{}',
  scripture_refs text[] not null default '{}',
  linked_type text,
  linked_id uuid,
  folder_id uuid,
  is_pinned boolean not null default false,
  visibility dp_visibility not null default 'private',
  save_status dp_save_status not null default 'saved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dp_note_shares (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references dp_notes(id) on delete cascade,
  shared_with_user_id uuid references auth.users(id),
  shared_with_cohort_id uuid references dp_cohorts(id),
  shared_at timestamptz not null default now()
);

create table dp_voice_memos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  description text,
  storage_path text,
  public_url text,
  duration_seconds int,
  transcript text,
  transcript_status text default 'none',
  linked_type text,
  linked_id uuid,
  created_at timestamptz not null default now()
);

create table dp_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  media jsonb not null default '[]',
  target_type dp_announcement_target not null default 'everyone',
  target_id uuid,
  target_user_ids uuid[] not null default '{}',
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  is_pinned boolean not null default false,
  requires_acknowledgment boolean not null default false,
  comments_enabled boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table dp_announcement_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references dp_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique(announcement_id, user_id)
);

create table dp_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  related_id uuid,
  related_type text,
  visibility dp_visibility not null default 'community',
  created_at timestamptz not null default now()
);

create table dp_live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  teacher_id uuid references auth.users(id),
  course_id uuid references dp_courses(id),
  cohort_id uuid references dp_cohorts(id),
  provider dp_provider not null default 'zoom',
  join_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text default 'America/New_York',
  description text,
  prep_instructions text,
  replay_url text,
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table dp_attendance (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references dp_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attended boolean not null default false,
  joined_at timestamptz,
  unique(live_session_id, user_id)
);

alter table dp_meetings_with_god enable row level security;
alter table dp_two_way_journal_entries enable row level security;
alter table dp_scripture_journey_entries enable row level security;
alter table dp_notes enable row level security;
alter table dp_note_shares enable row level security;
alter table dp_voice_memos enable row level security;
alter table dp_announcements enable row level security;
alter table dp_announcement_acknowledgments enable row level security;
alter table dp_calendar_events enable row level security;
alter table dp_live_sessions enable row level security;
alter table dp_attendance enable row level security;

create policy dp_mwg_owner on dp_meetings_with_god for all using (
  student_id = auth.uid() or dp_is_super_admin()
  or (visibility = 'mentor' and dp_is_mentor_of(student_id))
  or (visibility in ('teacher','cohort','selected_students','community') and (dp_has_role('faculty') or dp_has_role('teacher')))
) with check (student_id = auth.uid());

create policy dp_twj_owner on dp_two_way_journal_entries for all using (
  student_id = auth.uid() or dp_is_super_admin()
  or (visibility = 'mentor' and dp_is_mentor_of(student_id))
  or (visibility in ('teacher','cohort','selected_students','community') and (dp_has_role('faculty') or dp_has_role('teacher')))
) with check (student_id = auth.uid());

create policy dp_scripture_journey_owner on dp_scripture_journey_entries for all using (
  student_id = auth.uid() or dp_is_super_admin()
  or (share_with_mentor = true and dp_is_mentor_of(student_id))
  or dp_has_role('faculty')
) with check (student_id = auth.uid());

create policy dp_notes_owner_select on dp_notes for select using (
  author_id = auth.uid() or dp_is_super_admin()
  or exists (
    select 1 from dp_note_shares s
    where s.note_id = dp_notes.id
      and (s.shared_with_user_id = auth.uid()
        or s.shared_with_cohort_id in (select scope_id from dp_enrollments where user_id = auth.uid() and scope_type = 'cohort'))
  )
  or (visibility = 'mentor' and dp_is_mentor_of(author_id))
  or (visibility = 'community' and auth.role() = 'authenticated')
);
create policy dp_notes_owner_write on dp_notes for insert with check (author_id = auth.uid());
create policy dp_notes_owner_update on dp_notes for update using (author_id = auth.uid() or dp_is_super_admin());
create policy dp_notes_owner_delete on dp_notes for delete using (author_id = auth.uid() or dp_is_super_admin());

create policy dp_note_shares_select on dp_note_shares for select using (
  shared_with_user_id = auth.uid()
  or exists (select 1 from dp_notes n where n.id = note_id and n.author_id = auth.uid())
  or dp_is_super_admin()
);
create policy dp_note_shares_write on dp_note_shares for insert with check (
  exists (select 1 from dp_notes n where n.id = note_id and n.author_id = auth.uid())
);

create policy dp_voice_memos_owner on dp_voice_memos for all using (
  owner_id = auth.uid() or dp_is_super_admin()
) with check (owner_id = auth.uid());

create policy dp_announcements_read on dp_announcements for select using (auth.role() = 'authenticated');
create policy dp_announcements_write on dp_announcements for all using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher')
) with check (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher'));

create policy dp_ack_owner on dp_announcement_acknowledgments for all using (
  user_id = auth.uid() or dp_is_super_admin()
) with check (user_id = auth.uid());

create policy dp_calendar_read on dp_calendar_events for select using (auth.role() = 'authenticated');
create policy dp_calendar_write on dp_calendar_events for all using (
  dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher') or dp_has_role('mentor')
) with check (dp_is_super_admin() or dp_has_role('faculty') or dp_has_role('teacher') or dp_has_role('mentor'));

create policy dp_live_sessions_read on dp_live_sessions for select using (auth.role() = 'authenticated');
create policy dp_live_sessions_write on dp_live_sessions for all using (
  dp_is_super_admin() or dp_has_role('faculty') or teacher_id = auth.uid()
) with check (dp_is_super_admin() or dp_has_role('faculty') or teacher_id = auth.uid());

create policy dp_attendance_select on dp_attendance for select using (
  user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
  or exists (select 1 from dp_live_sessions ls where ls.id = live_session_id and ls.teacher_id = auth.uid())
);
create policy dp_attendance_write on dp_attendance for all using (
  user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
  or exists (select 1 from dp_live_sessions ls where ls.id = live_session_id and ls.teacher_id = auth.uid())
) with check (
  user_id = auth.uid() or dp_is_super_admin() or dp_has_role('faculty')
  or exists (select 1 from dp_live_sessions ls where ls.id = live_session_id and ls.teacher_id = auth.uid())
);
