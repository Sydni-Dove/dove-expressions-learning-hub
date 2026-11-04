-- v6c: "Worship Development" — DRAFT SHELL ONLY, in Voice Studio.
--
-- Purely additive. Creates ONE unpublished, enrollment-only course under the
-- "Voice Coaching & Development" program, with module shells and 11 EMPTY draft
-- lessons (titles only). No lesson text, no blocks, nothing published. Teaching
-- content and the Lesson 1 workbook are loaded later through the staff builder.
-- PART TWO instructor notes are never loaded anywhere in the Hub.
--
-- Lesson order (decided by Sydni): Teaching 1, Teaching 11, then Teachings 2–10.
--
-- The live project already has the Voice Studio area + "vocal-coaching" program
-- (created by hand; there was no migration). The two guarded inserts below only
-- fire on a database that lacks them, so a rebuild from migrations matches live.
-- Re-runnable: skips entirely if the course slug exists.

do $$
declare
  v_area   uuid;
  v_prog   uuid;
  v_course uuid;
  v_mod    uuid;
  m        record;
  l        record;
begin
  if exists (select 1 from dp_courses where slug = 'worship-development') then
    raise notice 'Worship Development already seeded — skipping.';
    return;
  end if;

  select id into v_area from dp_learning_areas where area_key = 'voice_studio';
  if v_area is null then
    insert into dp_learning_areas (area_key, name, tagline)
    values ('voice_studio', 'Dove Expressions Voice Studio', 'Develop your voice with purpose.')
    returning id into v_area;
  end if;

  select id into v_prog from dp_programs where slug = 'vocal-coaching';
  if v_prog is null then
    insert into dp_programs (area_id, name, slug)
    values (v_area, 'Voice Coaching & Development', 'vocal-coaching')
    returning id into v_prog;
  end if;

  insert into dp_courses (
    area_id, program_id, title, slug, order_index,
    is_published, is_standalone, content_status, access_mode, lesson_style
  ) values (
    v_area, v_prog, 'Worship Development', 'worship-development', 0,
    false, false, 'draft', 'enrolled', 'reflective'
  ) returning id into v_course;

  -- module order, then lesson order inside each module = the course order.
  for m in
    select * from (values
      (0, 'Start Here', array[]::text[]),
      (1, 'Module 1: A Life of Worship', array[
        'Praise Is What I Do: Developing a Lifestyle of True Worship',
        'What Is a True Worshiper? Worship in Spirit and Truth (John 4)',
        'The Importance of Being in the Word: Growing in God as a Worshiper']),
      (2, 'Module 2: Heart and Offering', array[
        'The Psyche of a Praiser: Understanding the Mental and Spiritual Battles of Worship Ministry',
        'What Did You Bring to the Altar? Worship as Sacrifice, Surrender and Offering',
        'The Heart of a Praiser: Worship From Intimacy, Experience and Testimony',
        'When Your Heart Interrupts Your Worship: Bringing What Surfaces to the Altar']),
      (3, 'Module 3: Praise in Action', array[
        'The Purpose, Power and Functions of Praise: We Are Doing More Than Singing',
        'The Worshiping Warrior: Praise, Spiritual Warfare and the Ministry of Freedom',
        'From Scripture and Testimony to Spontaneous Worship: Developing Authentic Creative Expression',
        'The Tabernacle of David: Personal Devotion and Organized Praise'])
    ) as t(idx, title, lessons)
  loop
    insert into dp_modules (course_id, title, order_index) values (v_course, m.title, m.idx) returning id into v_mod;
    for l in select ord, t from unnest(m.lessons) with ordinality as u(t, ord) loop
      -- content_status is set explicitly: its column default is 'published'.
      insert into dp_lessons (module_id, title, status, content_status, order_index)
      values (v_mod, l.t, 'draft', 'draft', l.ord);
    end loop;
  end loop;
end $$;
