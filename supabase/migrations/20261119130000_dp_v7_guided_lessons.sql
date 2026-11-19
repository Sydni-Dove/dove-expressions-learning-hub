-- v7: Guided lessons — generic support for "one screen at a time" lessons.
--
-- ADDITIVE. Contains NO course content. Adds:
--   * dp_lesson_versions      archived snapshots of lesson content (history is never overwritten)
--   * dp_lesson_answer_keys   staff-only keys for objective checks (never sent to students)
--   * dp_lesson_drafts        each student's private, resumable work-in-progress
--   * dp_course_resources     private downloads (workbook PDFs) attached to a course
--   * dp_check_guided_answer  server-side checker: returns right/wrong + feedback AFTER a choice
--   * dp_import_guided_course atomic, staff-authorized import of a guided course
--
-- Preserved as-is (not modified here): enrollment/program gating, the one-attempt
-- submission guard, staff-only review (dp_review_submission), and the rule that Voice
-- lesson completion is recorded by an instructor after review.
--
-- Lesson content itself is stored in the existing dp_lesson_blocks table using new
-- block_type values (guided_intro, guided_page, guided_check, guided_question,
-- guided_exercise). block_type is free text, so no schema change is needed for them.

-- ---------------------------------------------------------------------------
-- 1. Archived lesson versions
-- ---------------------------------------------------------------------------
create table if not exists dp_lesson_versions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references dp_lessons(id) on delete cascade,
  content_version int not null,
  snapshot jsonb not null,
  note text,
  archived_by uuid references auth.users(id),
  archived_at timestamptz not null default now(),
  unique (lesson_id, content_version)
);
alter table dp_lesson_versions enable row level security;
revoke all on dp_lesson_versions from anon;

drop policy if exists dp_lesson_versions_staff on dp_lesson_versions;
create policy dp_lesson_versions_staff on dp_lesson_versions for all
  using (exists (select 1 from dp_lessons l join dp_modules m on m.id = l.module_id
                 where l.id = dp_lesson_versions.lesson_id and dp_private.manage_course(m.course_id)))
  with check (exists (select 1 from dp_lessons l join dp_modules m on m.id = l.module_id
                 where l.id = dp_lesson_versions.lesson_id and dp_private.manage_course(m.course_id)));

-- ---------------------------------------------------------------------------
-- 2. Answer keys (staff only)
-- ---------------------------------------------------------------------------
create table if not exists dp_lesson_answer_keys (
  lesson_id uuid not null references dp_lessons(id) on delete cascade,
  check_id text not null,
  correct_index int not null check (correct_index >= 0),
  feedback text not null default '',
  updated_at timestamptz not null default now(),
  primary key (lesson_id, check_id)
);
alter table dp_lesson_answer_keys enable row level security;
revoke all on dp_lesson_answer_keys from anon;

drop policy if exists dp_lesson_answer_keys_staff on dp_lesson_answer_keys;
create policy dp_lesson_answer_keys_staff on dp_lesson_answer_keys for all
  using (exists (select 1 from dp_lessons l join dp_modules m on m.id = l.module_id
                 where l.id = dp_lesson_answer_keys.lesson_id and dp_private.manage_course(m.course_id)))
  with check (exists (select 1 from dp_lessons l join dp_modules m on m.id = l.module_id
                 where l.id = dp_lesson_answer_keys.lesson_id and dp_private.manage_course(m.course_id)));

-- ---------------------------------------------------------------------------
-- 3. Student drafts (private to the student; visible to nobody else, staff included)
-- ---------------------------------------------------------------------------
create table if not exists dp_lesson_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references dp_lessons(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  content_version int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id),
  constraint dp_lesson_drafts_size check (pg_column_size(content) <= 250000)
);
alter table dp_lesson_drafts enable row level security;
revoke all on dp_lesson_drafts from anon;

-- A draft can only be read or written by its owner, and only for a lesson the owner can
-- currently read (the subquery is itself subject to dp_lessons RLS: published + enrolled, or staff).
drop policy if exists dp_lesson_drafts_owner on dp_lesson_drafts;
create policy dp_lesson_drafts_owner on dp_lesson_drafts for all
  using (user_id = auth.uid() and exists (select 1 from dp_lessons l where l.id = dp_lesson_drafts.lesson_id))
  with check (user_id = auth.uid() and exists (select 1 from dp_lessons l where l.id = dp_lesson_drafts.lesson_id));

create or replace function dp_lesson_drafts_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists dp_lesson_drafts_touch on dp_lesson_drafts;
create trigger dp_lesson_drafts_touch before insert or update on dp_lesson_drafts
  for each row execute function dp_lesson_drafts_touch();

-- ---------------------------------------------------------------------------
-- 4. Course resources (private downloads such as a workbook PDF)
-- ---------------------------------------------------------------------------
-- The file itself lives in the existing PRIVATE bucket 'course-media-private'. The existing
-- storage boundary policies require private objects to sit under lessons/<lessonId>/..., so
-- storage_path points at such a path (anchored to one lesson of the course). Students never
-- get a URL: the download route mints a short-lived signed URL after the checks below.
create table if not exists dp_course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references dp_courses(id) on delete cascade,
  kind text not null default 'workbook' check (kind in ('workbook', 'reading_edition', 'other')),
  title text not null,
  storage_path text not null,
  file_name text,
  version text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint dp_course_resources_path check (storage_path like 'lessons/%' and storage_path not like '%..%')
);
alter table dp_course_resources enable row level security;
revoke all on dp_course_resources from anon;

drop policy if exists dp_course_resources_read on dp_course_resources;
create policy dp_course_resources_read on dp_course_resources for select using (
  dp_private.manage_course(course_id)
  or (is_active and dp_can_access_course(course_id) and dp_private.enrolled_course(course_id, auth.uid()))
);
drop policy if exists dp_course_resources_staff_write on dp_course_resources;
create policy dp_course_resources_staff_write on dp_course_resources for all
  using (dp_private.manage_course(course_id))
  with check (dp_private.manage_course(course_id));

-- ---------------------------------------------------------------------------
-- 5. Objective-check answer checker (server side; the key never reaches the browser early)
-- ---------------------------------------------------------------------------
create or replace function dp_check_guided_answer(p_lesson_id uuid, p_check_id text, p_choice int)
returns table (correct boolean, feedback text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course uuid;
  v_status dp_lesson_status;
  k record;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select m.course_id, l.status into v_course, v_status
    from dp_lessons l join dp_modules m on m.id = l.module_id where l.id = p_lesson_id;
  if v_course is null then raise exception 'Lesson unavailable'; end if;
  if not (
    dp_private.manage_course(v_course)
    or (v_status = 'published' and dp_can_access_course(v_course) and dp_private.enrolled_course(v_course, auth.uid()))
  ) then
    raise exception 'Lesson unavailable';
  end if;
  select * into k from dp_lesson_answer_keys where lesson_id = p_lesson_id and check_id = p_check_id;
  if not found then raise exception 'Check unavailable'; end if;
  return query select (p_choice is not null and p_choice = k.correct_index), k.feedback;
end $$;
revoke all on function dp_check_guided_answer(uuid, text, int) from public, anon;
grant execute on function dp_check_guided_answer(uuid, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Staff import of a guided course (SECURITY INVOKER: row-level security of the caller applies)
-- ---------------------------------------------------------------------------
-- p_payload shape (generic):
--   { "title": text, "version": text,
--     "format": { "teachingMinutes": text, "exerciseMinutes": text,
--                 "originalSectionCount": int, "supplementalSectionCount": int },
--     "sections": [ { "id": text, "title": text, "goal": text, "reading": [text],
--         "pages": [ { "id": text, "title": text, "body": text } ],
--         "questions": [ { "id": text, "type": text, "prompt": text } ],
--         "exercise": { "title": text, "minutes": text, "steps": [text], "response": text },
--         "knowledgeCheck": { "id": text, "prompt": text, "options": [text], "correctIndex": int, "feedback": text } } ] }
-- p_options (optional): { "modules": [ { "title": text, "from": int, "to": int } ], "note": text }
--
-- Existing lessons found by slug = section id are re-versioned in place. Otherwise empty,
-- unslugged shell lessons are reused in order, otherwise a lesson is created. Before any
-- lesson is changed its title/slug/placement/blocks are archived in dp_lesson_versions and
-- content_version is bumped. Nothing is deleted except the lesson's previous block rows
-- (which are in the archive), nothing is published, and nobody is enrolled.
create or replace function dp_import_guided_course(p_course_id uuid, p_payload jsonb, p_options jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_course dp_courses%rowtype;
  v_sections jsonb := p_payload -> 'sections';
  v_n int;
  v_fmt jsonb := coalesce(p_payload -> 'format', '{}'::jsonb);
  v_mods jsonb;
  v_mod_ids uuid[] := '{}';
  v_mod jsonb;
  v_mod_id uuid;
  v_sec jsonb;
  v_idx int;
  v_pos int;
  v_lesson dp_lessons%rowtype;
  v_used uuid[] := '{}';
  v_archived int := 0;
  v_moved int := 0;
  v_pages int := 0;
  v_questions int := 0;
  v_checks int := 0;
  v_exercises int := 0;
  v_order int;
  v_page jsonb;
  v_q jsonb;
  v_kc jsonb;
  v_ex jsonb;
  v_ids text[];
  v_archive_course uuid;
  v_note text := coalesce(p_options ->> 'note', 'Replaced by guided course import');
  v_assignment uuid;
  v_unmapped int;
  m record;
begin
  if v_uid is null or not dp_private.manage_course(p_course_id) then
    raise exception 'Import not authorized';
  end if;
  select * into v_course from dp_courses where id = p_course_id;
  if not found then raise exception 'Course not found'; end if;

  -- ---- validate before changing anything ----
  if v_sections is null or jsonb_typeof(v_sections) <> 'array' or jsonb_array_length(v_sections) = 0 then
    raise exception 'Payload has no sections';
  end if;
  v_n := jsonb_array_length(v_sections);
  select array_agg(s ->> 'id') into v_ids from jsonb_array_elements(v_sections) s;
  if exists (select 1 from unnest(v_ids) x where x is null or btrim(x) = '') then raise exception 'Every section needs an id'; end if;
  if (select count(distinct x) from unnest(v_ids) x) <> v_n then raise exception 'Section ids must be unique'; end if;
  for v_idx in 0 .. v_n - 1 loop
    v_sec := v_sections -> v_idx;
    if coalesce(btrim(v_sec ->> 'title'), '') = '' then raise exception 'Section % needs a title', v_idx + 1; end if;
    if coalesce(jsonb_typeof(v_sec -> 'pages'), '') <> 'array' or jsonb_array_length(v_sec -> 'pages') = 0 then
      raise exception 'Section % needs at least one page', v_idx + 1;
    end if;
    if exists (select 1 from jsonb_array_elements(v_sec -> 'pages') p where coalesce(btrim(p ->> 'title'), '') = '' or coalesce(btrim(p ->> 'body'), '') = '') then
      raise exception 'Section % has a page without a title or body', v_idx + 1;
    end if;
    v_kc := v_sec -> 'knowledgeCheck';
    if v_kc is not null and v_kc <> 'null'::jsonb then
      if coalesce(jsonb_typeof(v_kc -> 'options'), '') <> 'array' or jsonb_array_length(v_kc -> 'options') < 2 then raise exception 'Section % check needs at least two options', v_idx + 1; end if;
      if (v_kc ->> 'correctIndex') is null or (v_kc ->> 'correctIndex')::int < 0 or (v_kc ->> 'correctIndex')::int >= jsonb_array_length(v_kc -> 'options') then
        raise exception 'Section % check has an invalid correct answer', v_idx + 1;
      end if;
    end if;
  end loop;

  -- ---- module plan ----
  v_mods := p_options -> 'modules';
  if v_mods is null or jsonb_typeof(v_mods) <> 'array' or jsonb_array_length(v_mods) = 0 then
    if (v_fmt ->> 'originalSectionCount') is not null and (v_fmt ->> 'supplementalSectionCount') is not null
       and (v_fmt ->> 'originalSectionCount')::int + (v_fmt ->> 'supplementalSectionCount')::int = v_n
       and (v_fmt ->> 'supplementalSectionCount')::int > 0 then
      v_mods := jsonb_build_array(
        jsonb_build_object('title', 'Core Sections', 'from', 1, 'to', (v_fmt ->> 'originalSectionCount')::int),
        jsonb_build_object('title', 'Supplements', 'from', (v_fmt ->> 'originalSectionCount')::int + 1, 'to', v_n));
    else
      v_mods := jsonb_build_array(jsonb_build_object('title', 'Sections', 'from', 1, 'to', v_n));
    end if;
  end if;

  -- one module per plan entry: reuse a module with the SAME title, otherwise create one.
  -- Existing modules with other titles are never renamed; if they end up empty they are
  -- moved to the archive course below with their titles intact.
  v_idx := 0;
  for v_mod in select * from jsonb_array_elements(v_mods) loop
    select id into v_mod_id from dp_modules
      where course_id = p_course_id and not (id = any (v_mod_ids)) and title = (v_mod ->> 'title')
      order by order_index limit 1;
    if v_mod_id is null then
      insert into dp_modules (course_id, title, order_index) values (p_course_id, v_mod ->> 'title', v_idx) returning id into v_mod_id;
    else
      update dp_modules set order_index = v_idx where id = v_mod_id;
    end if;
    v_mod_ids := v_mod_ids || v_mod_id;
    v_idx := v_idx + 1;
  end loop;

  -- ---- sections -> lessons ----
  for v_idx in 1 .. v_n loop
    v_sec := v_sections -> (v_idx - 1);

    -- which module (and position inside it)?
    v_mod_id := null; v_pos := null;
    for m in select ord, e from jsonb_array_elements(v_mods) with ordinality as t(e, ord) loop
      if v_idx between (m.e ->> 'from')::int and (m.e ->> 'to')::int then
        v_mod_id := v_mod_ids[m.ord::int];
        v_pos := v_idx - (m.e ->> 'from')::int + 1;
        exit;
      end if;
    end loop;
    if v_mod_id is null then raise exception 'Section % is not covered by the module plan', v_idx; end if;

    -- find the lesson: by slug, else a reusable empty shell, else create
    select l.* into v_lesson from dp_lessons l join dp_modules m2 on m2.id = l.module_id
      where m2.course_id = p_course_id and l.slug = v_sec ->> 'id' limit 1;
    if not found then
      select l.* into v_lesson from dp_lessons l join dp_modules m2 on m2.id = l.module_id
        where m2.course_id = p_course_id and l.slug is null and not (l.id = any (v_used))
          and not exists (select 1 from dp_lesson_blocks b where b.lesson_id = l.id)
        order by m2.order_index, l.order_index limit 1;
    end if;
    if not found then
      insert into dp_lessons (module_id, title, slug, order_index, status, content_status)
        values (v_mod_id, v_sec ->> 'title', v_sec ->> 'id', v_pos, 'draft', 'draft')
        returning * into v_lesson;
    else
      -- archive what is there before touching it
      insert into dp_lesson_versions (lesson_id, content_version, snapshot, note, archived_by)
      values (v_lesson.id, coalesce(v_lesson.content_version, 1),
        jsonb_build_object('title', v_lesson.title, 'subtitle', v_lesson.subtitle, 'slug', v_lesson.slug,
          'module_id', v_lesson.module_id, 'order_index', v_lesson.order_index, 'status', v_lesson.status,
          'content_status', v_lesson.content_status,
          'blocks', coalesce((select jsonb_agg(jsonb_build_object('block_type', b.block_type, 'order_index', b.order_index, 'content', b.content) order by b.order_index)
                              from dp_lesson_blocks b where b.lesson_id = v_lesson.id), '[]'::jsonb)),
        v_note, v_uid)
      on conflict (lesson_id, content_version) do nothing;
      v_archived := v_archived + 1;
      delete from dp_lesson_blocks where lesson_id = v_lesson.id;
      update dp_lessons set
        title = v_sec ->> 'title', subtitle = null, slug = v_sec ->> 'id',
        module_id = v_mod_id, order_index = v_pos,
        status = case when v_lesson.status = 'published' then 'published'::dp_lesson_status else 'draft'::dp_lesson_status end,
        content_status = case when v_lesson.status = 'published' then 'published' else 'draft' end,
        content_version = coalesce(v_lesson.content_version, 1) + 1, updated_at = now()
      where id = v_lesson.id returning * into v_lesson;
    end if;
    v_used := v_used || v_lesson.id;

    -- blocks, in screen order
    v_order := 0;
    insert into dp_lesson_blocks (lesson_id, block_type, order_index, content) values
      (v_lesson.id, 'guided_intro', v_order, jsonb_build_object(
        'section_id', v_sec ->> 'id', 'goal', coalesce(v_sec ->> 'goal', ''),
        'reading', coalesce(v_sec -> 'reading', '[]'::jsonb),
        'timing', coalesce(v_fmt ->> 'teachingMinutes', ''),
        'exercise_timing', coalesce(v_fmt ->> 'exerciseMinutes', '')));
    for v_page in select * from jsonb_array_elements(v_sec -> 'pages') loop
      v_order := v_order + 1; v_pages := v_pages + 1;
      insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
        values (v_lesson.id, 'guided_page', v_order, jsonb_build_object('page_id', v_page ->> 'id', 'title', v_page ->> 'title', 'body', v_page ->> 'body'));
    end loop;
    v_kc := v_sec -> 'knowledgeCheck';
    delete from dp_lesson_answer_keys where lesson_id = v_lesson.id;
    if v_kc is not null and v_kc <> 'null'::jsonb then
      v_order := v_order + 1; v_checks := v_checks + 1;
      -- NOTE: the block carries only the prompt and options. The key lives in dp_lesson_answer_keys.
      insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
        values (v_lesson.id, 'guided_check', v_order, jsonb_build_object('check_id', coalesce(v_kc ->> 'id', 'check'), 'prompt', v_kc ->> 'prompt', 'options', v_kc -> 'options'));
      insert into dp_lesson_answer_keys (lesson_id, check_id, correct_index, feedback)
        values (v_lesson.id, coalesce(v_kc ->> 'id', 'check'), (v_kc ->> 'correctIndex')::int, coalesce(v_kc ->> 'feedback', ''));
    end if;
    for v_q in select * from jsonb_array_elements(coalesce(v_sec -> 'questions', '[]'::jsonb)) loop
      v_order := v_order + 1; v_questions := v_questions + 1;
      insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
        values (v_lesson.id, 'guided_question', v_order, jsonb_build_object('question_id', v_q ->> 'id', 'type', coalesce(v_q ->> 'type', 'reflection'), 'prompt', v_q ->> 'prompt'));
    end loop;
    v_ex := v_sec -> 'exercise';
    if v_ex is not null and v_ex <> 'null'::jsonb then
      v_order := v_order + 1; v_exercises := v_exercises + 1;
      insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
        values (v_lesson.id, 'guided_exercise', v_order, jsonb_build_object(
          'title', coalesce(v_ex ->> 'title', 'Practice'), 'minutes', coalesce(v_ex ->> 'minutes', ''),
          'steps', coalesce(v_ex -> 'steps', '[]'::jsonb), 'response_prompt', coalesce(v_ex ->> 'response', '')));
    end if;

    -- the one assignment that carries the student's submission for this lesson
    select id into v_assignment from dp_assignments
      where lesson_id = v_lesson.id and assigned_to_user_id is null and assigned_to_cohort_id is null and assignment_type = 'reflection' limit 1;
    if v_assignment is null then
      insert into dp_assignments (lesson_id, course_id, title, description, assignment_type, created_by, allow_late)
        values (v_lesson.id, p_course_id, (v_sec ->> 'title') || ' — reflection and practice',
          'Complete the knowledge check, reflection questions and practice exercise, then submit for instructor review.', 'reflection', v_uid, true);
    else
      update dp_assignments set title = (v_sec ->> 'title') || ' — reflection and practice' where id = v_assignment;
    end if;
  end loop;

  -- ---- tidy: empty modules left over from an earlier structure go to an archive course (never deleted) ----
  for m in select id from dp_modules mm where mm.course_id = p_course_id and not (mm.id = any (v_mod_ids))
           and not exists (select 1 from dp_lessons l where l.module_id = mm.id) loop
    if v_archive_course is null then
      select id into v_archive_course from dp_courses where slug = v_course.slug || '-archive';
      if v_archive_course is null then
        -- no RETURNING here: the read policy can't see a row created in the same statement
        insert into dp_courses (area_id, program_id, title, slug, order_index, is_published, is_standalone, content_status, access_mode, lesson_style)
          values (v_course.area_id, v_course.program_id, v_course.title || ' — archived draft', v_course.slug || '-archive', 99, false, false, 'archived', 'enrolled', v_course.lesson_style);
        select id into v_archive_course from dp_courses where slug = v_course.slug || '-archive';
      end if;
    end if;
    update dp_modules set course_id = v_archive_course where id = m.id;
    v_moved := v_moved + 1;
  end loop;

  select count(*) into v_unmapped from dp_lessons l join dp_modules mm on mm.id = l.module_id
    where mm.course_id = p_course_id and not (l.id = any (v_used));

  return jsonb_build_object('sections', v_n, 'pages', v_pages, 'questions', v_questions, 'checks', v_checks,
    'exercises', v_exercises, 'archivedLessonVersions', v_archived, 'emptyModulesArchived', v_moved,
    'lessonsNotInThisEdition', v_unmapped, 'version', p_payload ->> 'version');
end $$;
revoke all on function dp_import_guided_course(uuid, jsonb, jsonb) from public, anon;
grant execute on function dp_import_guided_course(uuid, jsonb, jsonb) to authenticated;
