-- v6b: "How to Make an App with AI" — DRAFT SHELL ONLY.
--
-- Purely additive data seed. Requires 0027 (access_mode / lesson_style columns).
-- Creates ONE unpublished course in the Creative Studio learning area
-- (program_id = null, standalone) plus its seven module shells. No lessons, no
-- lesson content, nothing published. Modules 7–11 (Deeper Testing, Debugging,
-- Protecting What Works, Publishing Responsibly, Owning and Continuing the Build)
-- are intentionally NOT created yet. Guarded by slug, so re-running is a no-op.

do $$
declare
  v_area   uuid;
  v_course uuid;
  v_titles text[] := array[
    'Start Here',
    'Module 1: From Idea to Buildable App or Website',
    'Module 2: Direct AI Instead of Letting AI Direct the Build',
    'Module 3: Tech Without the Tech Speak',
    'Module 4: Choose the Right Build',
    'Module 5: Set Up Before You Build',
    'Module 6: Build With AI'
  ];
  i int;
begin
  if exists (select 1 from dp_courses where slug = 'how-to-make-an-app-with-ai') then
    raise notice 'How to Make an App with AI already seeded — skipping.';
    return;
  end if;

  select id into v_area from dp_learning_areas where area_key = 'creative_studio';
  if v_area is null then
    raise exception 'creative_studio learning area not found';
  end if;

  insert into dp_courses (
    area_id, program_id, title, subtitle, slug, description, order_index,
    is_published, is_standalone, content_status, access_mode, lesson_style
  ) values (
    v_area, null,
    'How to Make an App with AI',
    'Build your first app or website with AI—without knowing how to code.',
    'how-to-make-an-app-with-ai',
    'Build your first app or website with AI—without knowing how to code.',
    (select coalesce(max(order_index), 0) + 1 from dp_courses where area_id = v_area),
    false, true, 'draft', 'enrolled', 'practical'
  ) returning id into v_course;

  for i in 1 .. array_length(v_titles, 1) loop
    insert into dp_modules (course_id, title, order_index) values (v_course, v_titles[i], i - 1);
  end loop;
end $$;
