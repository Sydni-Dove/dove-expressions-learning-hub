-- Voice is a first-class learning area and program, separate from discipleship.
insert into dp_learning_areas (area_key,name,tagline,description,accent_color,order_index)
values ('voice_studio','Dove Expressions Voice Studio','Develop your voice with purpose.',
 'Private vocal coaching, technique, practice assignments, and worship leadership training.','#630000',3)
on conflict (area_key) do update set name=excluded.name,tagline=excluded.tagline,description=excluded.description;

insert into dp_programs (area_id,name,slug,description,phase_structure,is_template,version)
select id,'Voice Coaching & Development','vocal-coaching',
 'Individual vocal coaching, evaluation, technique, song preparation, and progress reviews.',
 '{"phases":[{"key":"evaluation","name":"Initial Vocal Evaluation"},{"key":"foundation","name":"Breath, Pitch & Vocal Foundations"},{"key":"application","name":"Song Application & Musicality"},{"key":"performance","name":"Confidence, Worship Leadership & Progress Review"}]}'::jsonb,
 true,1
from dp_learning_areas where area_key='voice_studio'
on conflict (slug) do update set description=excluded.description,phase_structure=excluded.phase_structure;

-- Course shells are intentionally unpublished until the instructor supplies teaching materials.
insert into dp_courses(area_id,program_id,title,slug,description,order_index,is_published,is_standalone)
select p.area_id,p.id,c.title,c.slug,c.description,c.sort,false,false
from dp_programs p
cross join (values
 ('Vocal Foundations','voice-vocal-foundations','Breath support, posture, resonance, and healthy vocal production.',1),
 ('Pitch, Range & Control','voice-pitch-range-control','Pitch accuracy, controlled transitions, and range development.',2),
 ('Song Preparation & Interpretation','voice-song-preparation','Apply vocal technique to songs with targeted coaching.',3),
 ('Confidence & Worship Leadership','voice-confidence-leadership','Lead with confidence while following musical direction.',4)
) c(title,slug,description,sort)
where p.slug='vocal-coaching'
and not exists (select 1 from dp_courses existing where existing.slug=c.slug);
