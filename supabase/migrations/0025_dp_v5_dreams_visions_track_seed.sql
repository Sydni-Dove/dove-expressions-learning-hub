-- v5: Dreams & Visions track seed (Hear God pathway).
--
-- ADDITIVE + NON-DESTRUCTIVE. This migration only INSERTs new rows. It creates
-- no tables, alters no columns, and touches no existing student data, progress,
-- enrollments, notes, or uploads. It reuses the existing learning hierarchy
-- (dp_courses -> dp_modules -> dp_lessons -> dp_lesson_blocks) exactly as the
-- rest of the platform does, so nothing new has to be taught to the renderer,
-- the pathway pages, or the staff builder.
--
-- Structure created:
--   Hear God (existing pathway, tagged via dp_courses.pathways = ['hear_god'])
--     └─ Dreams & Visions           (course, track_key='dreams_visions', coming_soon)
--          ├─ 8 modules (the 8 "units")
--          │    └─ placeholder lessons (draft / coming_soon)
--          │         └─ standard placeholder content blocks per lesson
--
-- No permanent teaching content is invented. Every lesson is seeded with the
-- full reusable field scaffold (learning objectives, key scriptures, video,
-- workbook, lesson content, reflection, assignment, quiz, prayer/activation,
-- resources) left empty, so Sydni fills them through the admin builder later.
--
-- Guarded: if the Dreams & Visions course already exists (by track_key), the
-- whole block is skipped, so re-running the migration set is safe.

do $$
declare
  v_area   uuid;
  v_course uuid;
  v_module uuid;
  v_lesson uuid;
  m        record;
  l        text;
  les_idx  int;
begin
  -- Idempotency guard.
  if exists (select 1 from dp_courses where track_key = 'dreams_visions') then
    raise notice 'Dreams & Visions track already seeded — skipping.';
    return;
  end if;

  select id into v_area from dp_learning_areas where area_key = 'discipleship_hub' limit 1;
  if v_area is null then
    raise exception 'discipleship_hub learning area not found; cannot seed Dreams & Visions.';
  end if;

  insert into dp_courses (
    area_id, title, slug, subtitle, description,
    pathways, track_key, content_format, difficulty_level,
    content_status, is_published, is_standalone, order_index, scripture_refs
  )
  values (
    v_area,
    'Dreams & Visions',
    'dreams-and-visions',
    'Learning to Hear, Interpret, and Respond to God in the Night',
    'A Hear God track for stewarding dreams and visions — from biblical foundations and preparation, through the principles and process of interpretation, into responding to what God reveals. Structure is in place; teaching content is added lesson by lesson.',
    array['hear_god'],
    'dreams_visions',
    'course',
    'foundational',
    'coming_soon',
    false,
    true,
    10,
    array['Job 33:14-16', 'Joel 2:28', 'Numbers 12:6']
  )
  returning id into v_course;

  -- Modules (the 8 units) and their placeholder lessons.
  -- Module 5 (Dream Symbols) uses the symbol *categories* as placeholder
  -- lessons for now; the dedicated searchable Symbol Library framework is a
  -- Phase 2 item and is intentionally not built here.
  for m in
    select * from (values
      (1, 'Biblical Foundations',
          'Why God speaks through dreams and visions, and what Scripture shows about their place in the life of a believer.',
          array['Why God speaks through dreams and visions','Dreams throughout Scripture','Dreams versus visions','The purpose of divine dreams','Common myths and misconceptions']),
      (2, 'Preparing to Hear God',
          'Posture, practices, and preparation for stewarding what God gives in the night.',
          array['Stewarding dreams','Dream recall','Recording dreams','Creating space to hear God','Prayer and spiritual preparation']),
      (3, 'Principles of Dream Interpretation',
          'The hermeneutics of dreams — how interpretation actually works before any symbol is considered.',
          array['God is the source of interpretation','Context before symbols','Literal versus symbolic dreams','Biblical symbolism','Personal symbolism','Avoiding dependence on dream dictionaries','Common interpretation mistakes']),
      (4, 'The Interpretation Process',
          'A repeatable, prayerful workflow for moving from a recorded dream to a responsible interpretation.',
          array['Record','Observe','Pray','Brainstorm','Study Scripture','Identify context and symbols','Seek understanding','Interpret','Apply and respond']),
      (5, 'Dream Symbols',
          'A reference library of common symbol categories. Students return here whenever a symbol appears in a dream, rather than watching in order.',
          array['People','Family','Animals','Vehicles and transportation','Buildings and locations','Colors','Numbers','Clothing','Food','Objects','Body parts','Weather and nature','Occupations','Spiritual beings','Transition symbols']),
      (6, 'Responding to Revelation',
          'What to do once you have an interpretation — testing, obedience, timing, and recording outcomes.',
          array['Interpretation versus application','Testing revelation','Obedience','Waiting versus acting','Revelation to execution','Recording outcomes and confirmations']),
      (7, 'Advanced Dream Topics',
          'Harder categories of dreams and how to discern and respond to each.',
          array['Warning dreams','Recurring dreams','Nightmares','Soul or emotional dreams','False or deceptive dreams','Spiritual warfare','Dreams involving deceased people','Corporate or ministry dreams','Prophetic and calling dreams']),
      (8, 'Dream Labs and Practicum',
          'Where interpretation becomes a skill — case studies, practice, feedback, and submissions.',
          array['Biblical dream case studies','Anonymous modern dream case studies','Student interpretation exercises','Instructor interpretation walkthroughs','Reflection assignments','Dream submissions','Feedback or discussion where supported'])
    ) as t(idx, title, descr, lessons)
  loop
    insert into dp_modules (course_id, title, description, order_index)
    values (v_course, m.title, m.descr, m.idx)
    returning id into v_module;

    les_idx := 0;
    foreach l in array m.lessons
    loop
      insert into dp_lessons (module_id, title, status, content_status, order_index)
      values (v_module, l, 'draft', 'coming_soon', les_idx)
      returning id into v_lesson;

      -- Standard reusable placeholder scaffold for every lesson. All fields are
      -- empty on purpose; the builder fills them. The lesson viewer renders an
      -- honest "coming soon" state for each empty block rather than faking it.
      insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
      select v_lesson, b.t, b.o, b.c
      from (values
        ('learning_objectives', 0, '{"items": []}'::jsonb),
        ('key_scriptures',      1, '{"refs": []}'::jsonb),
        ('lesson_media',        2, jsonb_build_object('overview_heading', 'Teaching Video', 'overview_summary', '', 'overview_points', '[]'::jsonb, 'transcript', '[]'::jsonb)),
        ('written',             3, jsonb_build_object('heading', 'Lesson Teaching', 'body', '')),
        ('workbook_download',   4, jsonb_build_object('label', 'Lesson Workbook', 'url', null)),
        ('reflection_question', 5, jsonb_build_object('prompt', 'What is God highlighting to you in this lesson?')),
        ('assignment_placeholder', 6, jsonb_build_object('title', 'Assignment', 'instructions', '')),
        ('quiz_placeholder',    7, jsonb_build_object('title', 'Quiz', 'note', '')),
        ('prayer_activation',   8, jsonb_build_object('heading', 'Prayer & Activation', 'body', '')),
        ('resources',           9, '{"items": []}'::jsonb)
      ) as b(t, o, c);

      les_idx := les_idx + 1;
    end loop;
  end loop;

  raise notice 'Dreams & Visions track seeded: course %, 8 modules.', v_course;
end $$;
