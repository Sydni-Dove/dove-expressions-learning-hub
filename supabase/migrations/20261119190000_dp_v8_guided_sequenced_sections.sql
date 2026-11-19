-- dp_v8: sequenced guided sections
--
-- A guided lesson can now show each teaching page followed by ITS OWN questions/exercise screen,
-- instead of collecting every question at the end. New block types (free-text block_type, so no schema
-- change): guided_screen (starts a response screen) and guided_note (instructions inside one).
-- This migration adds ONE function that replaces a single lesson's screens in that shape. It is generic:
-- no course text lives here. Run by staff, as the staff member (SECURITY INVOKER, row-level security applies).
--
--   p_section = { "steps": [
--       { "kind": "page", "id": text, "title": text, "body": text },
--       { "kind": "responses", "id": text, "label": text, "title": text, "forPage": text,
--         "items": [ { "kind": "question", "id": text, "prompt": text, "type": text },
--                    { "kind": "note", "title": text, "body": text } ] } ],
--     "opening": boolean (default false) }
--
-- The previous title/slug/placement/blocks are archived in dp_lesson_versions and content_version is bumped.
-- Existing drafts and submissions are NOT touched. Question ids that are reused would keep matching their
-- answers, so callers must give new questions NEW ids. Nothing is published and nobody is enrolled.
create or replace function dp_replace_guided_section(p_lesson_id uuid, p_section jsonb, p_note text default null)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lesson dp_lessons%rowtype;
  v_course uuid;
  v_steps jsonb := p_section -> 'steps';
  v_step jsonb;
  v_item jsonb;
  v_order int := 0;
  v_pages int := 0;
  v_screens int := 0;
  v_questions int := 0;
  v_page_ids text[] := '{}';
  v_q_ids text[] := '{}';
  v_s_ids text[] := '{}';
  v_kind text;
  v_drafts int;
  v_subs int;
begin
  if v_uid is null then raise exception 'Not authorized'; end if;
  select * into v_lesson from dp_lessons where id = p_lesson_id;
  if not found then raise exception 'Lesson not found'; end if;
  select course_id into v_course from dp_modules where id = v_lesson.module_id;
  if not dp_private.manage_course(v_course) then raise exception 'Not authorized'; end if;

  -- ---- validate everything before changing anything ----
  if v_steps is null or jsonb_typeof(v_steps) <> 'array' or jsonb_array_length(v_steps) = 0 then raise exception 'Payload has no steps'; end if;
  for v_step in select * from jsonb_array_elements(v_steps) loop
    v_kind := v_step ->> 'kind';
    if v_kind = 'page' then
      if coalesce(btrim(v_step ->> 'id'), '') = '' or coalesce(btrim(v_step ->> 'title'), '') = '' or coalesce(btrim(v_step ->> 'body'), '') = '' then
        raise exception 'Every page needs an id, a title and text';
      end if;
      if (v_step ->> 'id') = any (v_page_ids) then raise exception 'Duplicate page id %', v_step ->> 'id'; end if;
      v_page_ids := v_page_ids || (v_step ->> 'id');
      v_pages := v_pages + 1;
    elsif v_kind = 'responses' then
      if coalesce(btrim(v_step ->> 'id'), '') = '' or coalesce(btrim(v_step ->> 'title'), '') = '' then raise exception 'Every response screen needs an id and a title'; end if;
      if (v_step ->> 'id') = any (v_s_ids) then raise exception 'Duplicate screen id %', v_step ->> 'id'; end if;
      v_s_ids := v_s_ids || (v_step ->> 'id');
      if coalesce(btrim(v_step ->> 'forPage'), '') <> '' and not ((v_step ->> 'forPage') = any (v_page_ids)) then
        raise exception 'Screen % belongs to a page that does not come before it', v_step ->> 'id';
      end if;
      if coalesce(jsonb_typeof(v_step -> 'items'), '') <> 'array' then raise exception 'Screen % needs items', v_step ->> 'id'; end if;
      if not exists (select 1 from jsonb_array_elements(v_step -> 'items') i where i ->> 'kind' = 'question') then raise exception 'Screen % needs at least one question', v_step ->> 'id'; end if;
      for v_item in select * from jsonb_array_elements(v_step -> 'items') loop
        if v_item ->> 'kind' = 'question' then
          if coalesce(btrim(v_item ->> 'id'), '') = '' or coalesce(btrim(v_item ->> 'prompt'), '') = '' then raise exception 'Every question needs an id and a prompt'; end if;
          if (v_item ->> 'id') = any (v_q_ids) then raise exception 'Duplicate question id %', v_item ->> 'id'; end if;
          v_q_ids := v_q_ids || (v_item ->> 'id');
          v_questions := v_questions + 1;
        elsif v_item ->> 'kind' = 'note' then
          if coalesce(btrim(v_item ->> 'title'), '') = '' and coalesce(btrim(v_item ->> 'body'), '') = '' then raise exception 'A note needs a heading or text'; end if;
        else
          raise exception 'Unknown item kind %', v_item ->> 'kind';
        end if;
      end loop;
      v_screens := v_screens + 1;
    else
      raise exception 'Unknown step kind %', v_kind;
    end if;
  end loop;
  if v_pages = 0 then raise exception 'A section needs at least one teaching page'; end if;

  -- ---- archive what is there, then replace ----
  insert into dp_lesson_versions (lesson_id, content_version, snapshot, note, archived_by)
  values (v_lesson.id, coalesce(v_lesson.content_version, 1),
    jsonb_build_object('title', v_lesson.title, 'subtitle', v_lesson.subtitle, 'slug', v_lesson.slug,
      'module_id', v_lesson.module_id, 'order_index', v_lesson.order_index, 'status', v_lesson.status,
      'content_status', v_lesson.content_status,
      'blocks', coalesce((select jsonb_agg(jsonb_build_object('block_type', b.block_type, 'order_index', b.order_index, 'content', b.content) order by b.order_index)
                          from dp_lesson_blocks b where b.lesson_id = v_lesson.id), '[]'::jsonb),
      'answer_keys', coalesce((select jsonb_agg(jsonb_build_object('check_id', k.check_id, 'correct_index', k.correct_index, 'feedback', k.feedback))
                               from dp_lesson_answer_keys k where k.lesson_id = v_lesson.id), '[]'::jsonb)),
    coalesce(p_note, 'Replaced by a sequenced section update'), v_uid)
  on conflict (lesson_id, content_version) do nothing;

  delete from dp_lesson_blocks where lesson_id = v_lesson.id;
  delete from dp_lesson_answer_keys where lesson_id = v_lesson.id;

  insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
  values (v_lesson.id, 'guided_intro', v_order, jsonb_build_object(
    'section_id', coalesce(v_lesson.slug, ''), 'goal', '', 'reading', '[]'::jsonb, 'timing', '', 'exercise_timing', '',
    'opening', coalesce((p_section ->> 'opening')::boolean, false)));

  for v_step in select * from jsonb_array_elements(v_steps) loop
    if v_step ->> 'kind' = 'page' then
      v_order := v_order + 1;
      insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
        values (v_lesson.id, 'guided_page', v_order, jsonb_build_object('page_id', v_step ->> 'id', 'title', v_step ->> 'title', 'body', v_step ->> 'body'));
    else
      v_order := v_order + 1;
      insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
        values (v_lesson.id, 'guided_screen', v_order, jsonb_build_object(
          'screen_id', v_step ->> 'id', 'label', coalesce(nullif(btrim(v_step ->> 'label'), ''), 'Questions'),
          'title', v_step ->> 'title', 'for_page', coalesce(v_step ->> 'forPage', '')));
      for v_item in select * from jsonb_array_elements(v_step -> 'items') loop
        v_order := v_order + 1;
        if v_item ->> 'kind' = 'question' then
          insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
            values (v_lesson.id, 'guided_question', v_order, jsonb_build_object('question_id', v_item ->> 'id', 'type', coalesce(v_item ->> 'type', 'reflection'), 'prompt', v_item ->> 'prompt'));
        else
          insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
            values (v_lesson.id, 'guided_note', v_order, jsonb_build_object('title', coalesce(v_item ->> 'title', ''), 'body', coalesce(v_item ->> 'body', '')));
        end if;
      end loop;
    end if;
  end loop;

  update dp_lessons set
    status = case when v_lesson.status = 'published' then 'published'::dp_lesson_status else 'draft'::dp_lesson_status end,
    content_status = case when v_lesson.status = 'published' then 'published' else 'draft' end,
    content_version = coalesce(v_lesson.content_version, 1) + 1, updated_at = now()
  where id = v_lesson.id;

  update dp_assignments set description = 'Answer the questions and do the exercise on each page, then submit for instructor review.'
    where lesson_id = v_lesson.id and assignment_type = 'reflection' and assigned_to_user_id is null and assigned_to_cohort_id is null;

  select count(*) into v_drafts from dp_lesson_drafts where lesson_id = v_lesson.id;
  select count(*) into v_subs from dp_submissions s join dp_assignments a on a.id = s.assignment_id where a.lesson_id = v_lesson.id;

  return jsonb_build_object('lesson', v_lesson.title, 'pages', v_pages, 'screens', v_screens, 'questions', v_questions,
    'contentVersion', coalesce(v_lesson.content_version, 1) + 1, 'existingDraftsKept', v_drafts, 'existingSubmissionsKept', v_subs);
end $$;
revoke all on function dp_replace_guided_section(uuid, jsonb, text) from public, anon;
grant execute on function dp_replace_guided_section(uuid, jsonb, text) to authenticated;
