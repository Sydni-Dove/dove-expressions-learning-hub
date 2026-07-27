-- A small, realistic seed of Discipleship Hub content so the prototype dashboard/course/lesson
-- pages have something real to render. This is demo content, not final curriculum.

insert into dp_courses (area_id, program_id, title, slug, pillar, order_index, is_published, is_standalone)
select a.id, p.id, 'Foundations: Drawing Near', 'foundations-drawing-near', 'draw_near', 1, true, false
from dp_learning_areas a
join dp_programs p on p.area_id = a.id and p.slug = 'guided-discipleship-journey'
where a.area_key = 'discipleship_hub';

insert into dp_modules (course_id, title, description, order_index)
select c.id, 'Week 1 — Establishing Rhythm', 'Beginning the journey: prayer, Scripture, and listening rhythms.', 1
from dp_courses c where c.slug = 'foundations-drawing-near';

insert into dp_lessons (module_id, title, slug, order_index, status, estimated_duration_minutes)
select m.id, l.title, l.slug, l.order_index, 'published', l.mins
from dp_modules m
cross join (values
  ('Welcome to the Journey', 'welcome-to-the-journey', 1, 12),
  ('Why Rhythm Matters', 'why-rhythm-matters', 2, 18),
  ('Your First Scripture Study', 'your-first-scripture-study', 3, 25)
) as l(title, slug, order_index, mins)
where m.title = 'Week 1 — Establishing Rhythm';

insert into dp_lesson_blocks (lesson_id, block_type, order_index, content)
select l.id, b.block_type, b.order_index, b.content::jsonb
from dp_lessons l
join dp_modules m on m.id = l.module_id and m.title = 'Week 1 — Establishing Rhythm'
cross join (values
  ('written', 1, '{"heading":"Welcome","body":"You are beginning a guided journey: Hear God, Record what He says, Interpret with Him, Respond in obedience, Build what was spoken. This is not a content library to consume — it is a rhythm to practice."}'),
  ('scripture', 2, '{"reference":"Ephesians 4:12","text":"To equip the saints for the work of ministry, for building up the body of Christ."}'),
  ('reflection_question', 3, '{"prompt":"What do you sense God inviting you into as you begin this journey?"}')
) as b(block_type, order_index, content)
where l.slug = 'welcome-to-the-journey';

insert into dp_live_sessions (title, provider, join_url, starts_at, ends_at, description, prep_instructions)
values (
  'Orientation & Welcome Gathering',
  'zoom',
  'https://zoom.us/j/example',
  now() + interval '4 days',
  now() + interval '4 days' + interval '75 minutes',
  'A welcome gathering for new students beginning the Guided Discipleship Journey.',
  'Come with a journal and a quiet space. We''ll open in worship and prayer.'
);

insert into dp_assessment_questions (assessment_id, section, prompt, question_type, options, weight_map, is_required, order_index)
select id, q.section, q.prompt, q.question_type::dp_question_type, q.options::jsonb, q.weight_map::jsonb, true, q.order_index
from dp_assessment_definitions
cross join (values
  ('Gifts & Functions', 'In a group setting, I most naturally find myself...', 'multiple_choice',
   '["Explaining what a passage of Scripture means","Sensing what someone is feeling before they say it","Organizing the plan so things actually happen","Noticing a picture or impression and wondering if it''s from God","Encouraging someone who feels discouraged"]',
   '{"0":"teacher","1":"mercy_giver","2":"administrator","3":"seer","4":"encourager"}', 2),
  ('Communication & Reception Style', 'When God gets my attention, it''s usually through...', 'multiple_choice',
   '["A verse or phrase of Scripture that won''t leave me","A picture, image, or vision in my mind","A strong knowing or conviction, without words","A dream while sleeping","A physical sense of peace or unease"]',
   '{"0":"teacher","1":"seer","2":"prophet","3":"seer","4":"watchman"}', 3),
  ('Ministry Environment', 'I feel most alive serving in an environment that is...', 'multiple_choice',
   '["Teaching or explaining truth to a group","One-on-one, helping someone process and find clarity","Behind the scenes, making things run well","Prayer-focused, interceding for others","Creative — building or designing something that communicates truth"]',
   '{"0":"teacher","1":"counselor","2":"servant","3":"intercessor","4":"creative"}', 4),
  ('Scenario Discernment', 'A friend tells you she had a troubling dream. Your first instinct is to...', 'scenario',
   '["Ask her to walk you through the whole dream before saying anything","Immediately offer what you think it means","Pray with her about it and encourage her to seek confirmation over time","Point her to Scripture principles about testing revelation"]',
   '{"0":"seer","1":"prophet","2":"intercessor","3":"teacher"}', 5)
) as q(section, prompt, question_type, options, weight_map, order_index)
where dp_assessment_definitions.title = 'Spiritual Wiring Assessment' and dp_assessment_definitions.version = 1;
