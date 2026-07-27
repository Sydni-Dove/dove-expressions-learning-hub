-- Backfill FK references to dp_voice_memos now that it exists
alter table dp_submissions add constraint dp_submissions_voice_memo_fkey foreign key (voice_memo_id) references dp_voice_memos(id);
alter table dp_feedback add constraint dp_feedback_voice_memo_fkey foreign key (voice_memo_id) references dp_voice_memos(id);
alter table dp_sessions add constraint dp_sessions_voice_memo_fkey foreign key (voice_memo_id) references dp_voice_memos(id);
alter table dp_meetings_with_god add constraint dp_mwg_voice_memo_fkey foreign key (voice_memo_id) references dp_voice_memos(id);
alter table dp_project_feedback add constraint dp_project_feedback_voice_memo_fkey foreign key (voice_memo_id) references dp_voice_memos(id);

alter table dp_cohort_faculty add constraint dp_cohort_faculty_cohort_fkey foreign key (cohort_id) references dp_cohorts(id) on delete cascade;
alter table dp_class_teachers add constraint dp_class_teachers_course_fkey foreign key (course_id) references dp_courses(id) on delete cascade;

-- Seed: Learning Areas
insert into dp_learning_areas (area_key, name, tagline, description, accent_color, order_index) values
('discipleship_hub', 'Dove Expressions Discipleship Hub', 'Hear God. Record. Interpret. Respond. Build.',
 'The primary spiritual formation and mentorship environment: guided discipleship, Scripture study, hearing God, spiritual wiring, identity, roles and Kingdom mandate, one-on-one mentoring, group discussions, prayer gatherings, journaling.',
 '#630000', 1),
('creative_studio', 'Dove Expressions Creative Studio', 'From concept to launched product.',
 'A practical training academy for believers called to create journals, devotionals, study guides, planners, stationery products, and related resources — from product definition through post-launch growth.',
 '#D97904', 2);

-- Seed: Spiritual Wiring categories (discernment tool, not declaration)
insert into dp_wiring_categories (code, name, description) values
('teacher', 'Teacher', 'Gifted to clarify and explain truth so others can understand and apply it.'),
('prophet', 'Prophet', 'Carries a strong burden for God''s truth and direction to be heard and heeded.'),
('seer', 'Seer', 'Tends to receive through pictures, visions, and symbolic impressions.'),
('intercessor', 'Intercessor', 'Carries others before God consistently in prayer, often burdened for specific people or situations.'),
('worshipper', 'Worshipper', 'Draws near to God and leads others near through worship and adoration.'),
('encourager', 'Encourager', 'Strengthens and comforts others, drawing out courage and hope.'),
('administrator', 'Administrator', 'Organizes people and resources toward a shared goal with clarity and order.'),
('leader', 'Leader', 'Casts vision and mobilizes others to move toward it.'),
('shepherd', 'Shepherd', 'Cares for the ongoing wellbeing and growth of a specific group of people.'),
('evangelist', 'Evangelist', 'Carries a burden to see people come to know Christ, often gifted to communicate the gospel clearly.'),
('mercy_giver', 'Mercy Giver', 'Feels others'' pain deeply and is moved to comfort and relieve suffering.'),
('servant', 'Servant', 'Meets practical needs faithfully, often behind the scenes.'),
('giver', 'Giver', 'Generously and strategically resources Kingdom work.'),
('creative', 'Creative', 'Expresses and communicates truth through art, design, writing, or craft.'),
('builder', 'Builder', 'Turns vision into structure — systems, products, and organizations.'),
('strategist', 'Strategist', 'Sees the path from where things are to where they need to go.'),
('counselor', 'Counselor', 'Helps others process, discern, and find wise next steps.'),
('watchman', 'Watchman', 'Discerns spiritual atmospheres and alerts others to what''s coming.'),
('spiritual_midwife', 'Spiritual Midwife', 'Helps others identify, develop, and bring forth what God has placed inside them.'),
('deliverance_minister', 'Deliverance / Freedom Minister', 'Gifted to help others find freedom from spiritual bondage and walk in wholeness.');

-- Seed: Discipleship Hub flagship program
insert into dp_programs (area_id, name, slug, description, phase_structure, is_template, version)
select id, 'Dove Expressions Guided Discipleship Journey', 'guided-discipleship-journey',
 'The default 25-week discipleship journey: Draw Near, Hear God, Identity & Wiring, Roles & Mandate.',
 '{"phases":[{"key":"draw_near","name":"Draw Near & Establish Foundations","weeks":"1-10"},{"key":"hear_god","name":"Hear God & Steward Revelation","weeks":"11-15"},{"key":"identity_wiring","name":"Identity & Spiritual Wiring","weeks":"16-20"},{"key":"roles_mandate","name":"Roles, Mandate & Execution","weeks":"21-25"}]}'::jsonb,
 true, 1
from dp_learning_areas where area_key = 'discipleship_hub';

-- Seed: Creative Studio flagship program — Stationery Product Creation Roadmap (8 courses)
insert into dp_programs (area_id, name, slug, description, phase_structure, is_template, version)
select id, 'Stationery Product Creation Roadmap', 'stationery-product-creation-roadmap',
 'The flagship Creative Studio program: 8 courses from defining a product idea through post-launch growth.',
 '{}'::jsonb, true, 1
from dp_learning_areas where area_key = 'creative_studio';

insert into dp_courses (area_id, program_id, title, slug, pillar, order_index, is_published, is_standalone)
select a.id, p.id, c.title, c.slug, c.pillar, c.order_index, true, true
from dp_learning_areas a
join dp_programs p on p.area_id = a.id and p.slug = 'stationery-product-creation-roadmap'
cross join (values
  ('Define Your Product', 'define-your-product', 'define', 1),
  ('Plan Product Specifications', 'plan-product-specifications', 'specify', 2),
  ('Design the Product', 'design-the-product', 'design', 3),
  ('Source Production', 'source-production', 'source', 4),
  ('Sales and Business Infrastructure', 'sales-and-business-infrastructure', 'sell', 5),
  ('Prepare for Launch', 'prepare-for-launch', 'launch_prep', 6),
  ('Production and Launch', 'production-and-launch', 'launch', 7),
  ('Post-Launch Growth', 'post-launch-growth', 'growth', 8)
) as c(title, slug, pillar, order_index)
where a.area_key = 'creative_studio';

-- Seed: Assignment Library templates
insert into dp_assignment_templates (title, category, instructions, prompts) values
('Biblical Character Reflection — Hannah', 'scripture_study',
 'Read Hannah''s story (1 Samuel 1-2) and respond to the prompts.',
 '["What stands out in this person''s story?","How did this person contribute to another person''s calling?","How did personal desire align with God''s desire?","Can you relate to this person''s experience or heart posture?","What does surrendering something precious to God look like in daily life?"]'::jsonb),
('Biblical Ministry & Prayer Study — Elijah', 'prayer',
 'Study Elijah''s life and ministry and respond to the prompts.',
 '["How does Scripture define prayer through this person''s life?","What did prayer look like?","What did spiritual warfare look like?","What spiritual gifts or functions were demonstrated?","How did God speak to and move through this person?","What aspects of this person''s journey resonate with you?"]'::jsonb),
('Two-Way Journaling Practice', 'hear_god',
 'Document three specific occasions when you believe you heard from God during journaling.',
 '["What you asked or were processing","What you received","How you received it","Why you believed it may have been from God","Supporting Scripture","Confirmation","What response was required","What happened afterward","How your recognition of God''s voice is developing"]'::jsonb);

-- Seed: Spiritual Wiring Assessment definition (v1) with a starter question
insert into dp_assessment_definitions (title, version, sections, is_active)
values ('Spiritual Wiring Assessment', 1,
 '["Motivations","Gifts & Functions","Communication & Reception Style","Ministry Environment","Scenario Discernment"]'::jsonb,
 true);

insert into dp_assessment_questions (assessment_id, section, prompt, question_type, options, weight_map, is_required, order_index)
select id, 'Motivations', 'When I see someone struggling, my first instinct is to...', 'multiple_choice',
 '["Teach them what Scripture says about their situation","Comfort and encourage them","Pray for them immediately","Organize practical help for them","Ask God for insight into what''s really going on"]'::jsonb,
 '{"0":"teacher","1":"encourager","2":"intercessor","3":"servant","4":"seer"}'::jsonb,
 true, 1
from dp_assessment_definitions where title = 'Spiritual Wiring Assessment' and version = 1;
