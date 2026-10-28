-- Instructor-editable 12-session Voice Coaching curriculum scaffold.
-- No automatic enrollment, schedules, payment, or published lessons.
with course_modules as (
 insert into dp_modules(course_id,title,description,order_index)
 select c.id,m.title,m.description,1
 from dp_courses c
 join (values
 ('voice-vocal-foundations','Vocal Technique Foundations','Posture, breathing, warmups, and resonance'),
 ('voice-pitch-range-control','Pitch and Range Development','Pitch accuracy, transitions, registers'),
 ('voice-song-preparation','Song Coaching','Song study, phrasing, dynamics, interpretation'),
 ('voice-confidence-leadership','Performance and Leadership','Confidence, congregational engagement, progress review')
 ) as m(slug,title,description) on c.slug=m.slug
 where not exists(select 1 from dp_modules existing where existing.course_id=c.id and existing.title=m.title)
 returning id,course_id
)
select count(*) from course_modules;
-- Each title is intentionally a starting point. Teachers author content before publishing.
insert into dp_lessons(module_id,title,slug,order_index,status)
select m.id,l.title,l.slug,l.n,'draft'::dp_lesson_status
from dp_modules m
join dp_courses c on c.id=m.course_id
join (values
 ('voice-vocal-foundations',1,'Vocal Evaluation and Personal Goals','voice-evaluation-goals'),
 ('voice-vocal-foundations',2,'Breath Support and Vocal Posture','voice-breath-posture'),
 ('voice-vocal-foundations',3,'Resonance, Warmups and Vocal Care','voice-resonance-care'),
 ('voice-pitch-range-control',1,'Pitch Matching and Ear Training','voice-pitch-matching'),
 ('voice-pitch-range-control',2,'Register Transitions and Range Mapping','voice-register-transitions'),
 ('voice-pitch-range-control',3,'Agility, Control and Intonation','voice-agility-control'),
 ('voice-song-preparation',1,'Choose and Analyze Your Song','voice-song-analysis'),
 ('voice-song-preparation',2,'Phrasing, Dynamics and Expression','voice-phrasing-dynamics'),
 ('voice-song-preparation',3,'Rehearsal Recording and Feedback','voice-song-feedback'),
 ('voice-confidence-leadership',1,'Lead While Following Musical Direction','voice-follow-direction'),
 ('voice-confidence-leadership',2,'Confidence and Congregational Engagement','voice-confidence-engagement'),
 ('voice-confidence-leadership',3,'Final Evaluation and Next Steps','voice-final-evaluation')
) l(course_slug,n,title,slug) on l.course_slug=c.slug
where m.title = case c.slug
 when 'voice-vocal-foundations' then 'Vocal Technique Foundations'
 when 'voice-pitch-range-control' then 'Pitch and Range Development'
 when 'voice-song-preparation' then 'Song Coaching'
 when 'voice-confidence-leadership' then 'Performance and Leadership'
 else '' end
and not exists(select 1 from dp_lessons existing where existing.module_id=m.id and existing.slug=l.slug);
