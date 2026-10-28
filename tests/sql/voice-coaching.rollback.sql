-- Run against the verified project, or a disposable Supabase database.
-- Every fixture and assertion is transactional. Always ends with ROLLBACK.
begin;
insert into auth.users(id,email) values
 ('f0f00000-0000-4000-8000-000000000001','voice-fixture-a@example.invalid'),
 ('f0f00000-0000-4000-8000-000000000002','creative-fixture-b@example.invalid'),
 ('f0f00000-0000-4000-8000-000000000003','multi-fixture-c@example.invalid'),
 ('f0f00000-0000-4000-8000-000000000004','instructor-fixture@example.invalid'),
 ('f0f00000-0000-4000-8000-000000000005','other-instructor-fixture@example.invalid');
insert into dp_programs(id,name,slug) values
 ('f0f00000-0000-4000-8000-000000000011','Fixture Voice','fixture-voice'),
 ('f0f00000-0000-4000-8000-000000000012','Fixture Creative','fixture-creative');
insert into dp_courses(id,area_id,program_id,title,is_published,access_mode)
 select 'f0f00000-0000-4000-8000-000000000021',id,'f0f00000-0000-4000-8000-000000000011','Fixture Voice',true,'open' from dp_learning_areas where area_key='voice_studio';
insert into dp_courses(id,area_id,program_id,title,is_published,access_mode)
 select 'f0f00000-0000-4000-8000-000000000022',id,'f0f00000-0000-4000-8000-000000000012','Fixture Creative',true,'open' from dp_learning_areas where area_key='creative_studio';
insert into dp_modules(id,course_id,title) values
 ('f0f00000-0000-4000-8000-000000000031','f0f00000-0000-4000-8000-000000000021','Voice fixture'),
 ('f0f00000-0000-4000-8000-000000000032','f0f00000-0000-4000-8000-000000000022','Creative fixture');
insert into dp_lessons(id,module_id,title,status) values
 ('f0f00000-0000-4000-8000-000000000041','f0f00000-0000-4000-8000-000000000031','Voice fixture','published'),
 ('f0f00000-0000-4000-8000-000000000042','f0f00000-0000-4000-8000-000000000032','Creative fixture','published'),
 ('f0f00000-0000-4000-8000-000000000043','f0f00000-0000-4000-8000-000000000031','Voice draft fixture','draft');
insert into dp_enrollments(user_id,scope_type,scope_id,status) values
 ('f0f00000-0000-4000-8000-000000000001','program','f0f00000-0000-4000-8000-000000000011','active'),
 ('f0f00000-0000-4000-8000-000000000002','program','f0f00000-0000-4000-8000-000000000012','active'),
 ('f0f00000-0000-4000-8000-000000000003','program','f0f00000-0000-4000-8000-000000000011','active'),
 ('f0f00000-0000-4000-8000-000000000003','program','f0f00000-0000-4000-8000-000000000012','active');
insert into dp_user_roles(user_id,role) values
 ('f0f00000-0000-4000-8000-000000000004','teacher'),
 ('f0f00000-0000-4000-8000-000000000005','teacher');
insert into dp_role_assignments(user_id,role,course_id) values
 ('f0f00000-0000-4000-8000-000000000005','teacher','f0f00000-0000-4000-8000-000000000022');
insert into storage.objects(bucket_id,name) values
 ('course-media-private','lessons/f0f00000-0000-4000-8000-000000000041/voice-fixture.mp3'),
 ('course-media-private','lessons/f0f00000-0000-4000-8000-000000000042/creative-fixture.mp3');
insert into dp_notes(author_id,title,linked_type,linked_id,visibility) values
 ('f0f00000-0000-4000-8000-000000000005','Creative community fixture','lesson','f0f00000-0000-4000-8000-000000000042','community');
insert into dp_class_teachers(course_id,user_id) values
 ('f0f00000-0000-4000-8000-000000000021','f0f00000-0000-4000-8000-000000000004');
-- Fixture assignments inserted as the authorized teacher, exercising scope validation.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f0f00000-0000-4000-8000-000000000004","role":"authenticated"}',true);
insert into dp_sessions(id,student_id,mentor_id,program_id,session_type,student_visible_notes,private_faculty_notes) values
 ('f0f00000-0000-4000-8000-000000000071','f0f00000-0000-4000-8000-000000000001','f0f00000-0000-4000-8000-000000000004','f0f00000-0000-4000-8000-000000000011','follow_up','Shared session summary','Private session secret');
insert into dp_assignments(id,course_id,lesson_id,assigned_to_user_id,title,practice_steps) values
 ('f0f00000-0000-4000-8000-000000000051','f0f00000-0000-4000-8000-000000000021','f0f00000-0000-4000-8000-000000000041','f0f00000-0000-4000-8000-000000000001','Voice practice',array['Warm up','Record']);
select set_config('request.jwt.claims','{"sub":"f0f00000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin
 if not dp_can_access_course('f0f00000-0000-4000-8000-000000000021') then raise exception 'Voice membership denied'; end if;
 if exists(select 1 from dp_sessions where id='f0f00000-0000-4000-8000-000000000071') then raise exception 'Student read private session row'; end if;
 if not exists(select 1 from dp_my_session_summaries('fixture-voice') where student_visible_notes='Shared session summary') then raise exception 'Shared session summary missing'; end if;
 if exists(select 1 from storage.objects where name='lessons/f0f00000-0000-4000-8000-000000000042/creative-fixture.mp3') then raise exception 'Cross-program file leaked'; end if;
 if not exists(select 1 from storage.objects where name='lessons/f0f00000-0000-4000-8000-000000000041/voice-fixture.mp3') then raise exception 'Voice file missing'; end if;
 if exists(select 1 from dp_notes where title='Creative community fixture') then raise exception 'Cross-program note leaked'; end if;
 if dp_can_access_course('f0f00000-0000-4000-8000-000000000022') then raise exception 'Cross-program open-course bypass'; end if;
 if exists(select 1 from dp_lessons where id in ('f0f00000-0000-4000-8000-000000000042','f0f00000-0000-4000-8000-000000000043')) then raise exception 'Other program/draft leaked'; end if;
end$$;
insert into dp_assignment_progress(assignment_id,student_id,response,minutes,checked_steps) values
 ('f0f00000-0000-4000-8000-000000000051','f0f00000-0000-4000-8000-000000000001','Saved practice',12,array[0,1]);
do $$begin
 if (select response from dp_assignment_progress where assignment_id='f0f00000-0000-4000-8000-000000000051')<>'Saved practice' then raise exception 'Draft reload failed'; end if;
end$$;
insert into dp_submissions(id,assignment_id,student_id,content) values
 ('f0f00000-0000-4000-8000-000000000061','f0f00000-0000-4000-8000-000000000051','f0f00000-0000-4000-8000-000000000001','{"response":"First attempt"}');
do $$begin
 begin
 update dp_submissions set status='approved' where id='f0f00000-0000-4000-8000-000000000061';
 raise exception 'Student approved own work';
 exception when raise_exception then if sqlerrm='Student approved own work' then raise; end if; end;
end$$;
-- Creative-only and multi-program students cannot see another student's assignment/draft.
select set_config('request.jwt.claims','{"sub":"f0f00000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin
 if dp_can_access_course('f0f00000-0000-4000-8000-000000000021') then raise exception 'Creative student entered Voice'; end if;
 if exists(select 1 from dp_assignments where id='f0f00000-0000-4000-8000-000000000051') then raise exception 'Private assignment leaked'; end if;
 begin
 insert into dp_submissions(assignment_id,student_id) values('f0f00000-0000-4000-8000-000000000051','f0f00000-0000-4000-8000-000000000002');
 raise exception 'Cross-student submission accepted';
 exception when insufficient_privilege or raise_exception then if sqlerrm='Cross-student submission accepted' then raise; end if; end;
end$$;
select set_config('request.jwt.claims','{"sub":"f0f00000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$begin
 if not dp_can_access_course('f0f00000-0000-4000-8000-000000000021') or not dp_can_access_course('f0f00000-0000-4000-8000-000000000022') then raise exception 'Multi-program access failed'; end if;
 if exists(select 1 from dp_assignment_progress where assignment_id='f0f00000-0000-4000-8000-000000000051') then raise exception 'Other student draft leaked'; end if;
end$$;
-- Authorized instructor sees drafts, saves private notes, and atomically returns work.
select set_config('request.jwt.claims','{"sub":"f0f00000-0000-4000-8000-000000000004","role":"authenticated"}',true);
do $$begin
 if not exists(select 1 from dp_lessons where id='f0f00000-0000-4000-8000-000000000043') then raise exception 'Staff draft preview denied'; end if;
end$$;
insert into dp_feedback(submission_id,author_id,content,is_private) values
 ('f0f00000-0000-4000-8000-000000000061','f0f00000-0000-4000-8000-000000000004','Instructor secret',true);
select dp_review_submission('f0f00000-0000-4000-8000-000000000061','Try gentler breath support','returned');
select set_config('request.jwt.claims','{"sub":"f0f00000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from dp_feedback where content='Instructor secret') then raise exception 'Private feedback leaked'; end if;
 if not exists(select 1 from dp_feedback where content='Try gentler breath support') then raise exception 'Shared feedback missing'; end if;
end$$;
update dp_submissions set content='{"response":"Revised practice"}',status='revised' where id='f0f00000-0000-4000-8000-000000000061';
select set_config('request.jwt.claims','{"sub":"f0f00000-0000-4000-8000-000000000005","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from dp_submissions where id='f0f00000-0000-4000-8000-000000000061') then raise exception 'Unassigned teacher read submission'; end if;
 if dp_can_access_course('f0f00000-0000-4000-8000-000000000021') then raise exception 'Scoped teacher course boundary failed'; end if;
 if not dp_can_access_course('f0f00000-0000-4000-8000-000000000022') then raise exception 'Scoped teacher preview denied'; end if;
 if exists(select 1 from storage.objects where name='lessons/f0f00000-0000-4000-8000-000000000041/voice-fixture.mp3') then raise exception 'Scoped teacher read another program file'; end if;
 begin
 perform dp_review_submission('f0f00000-0000-4000-8000-000000000061','Unauthorized','approved');
 raise exception 'Unassigned teacher reviewed work';
 exception when raise_exception then if sqlerrm='Unassigned teacher reviewed work' then raise; end if; end;
end$$;
select set_config('request.jwt.claims','{"sub":"f0f00000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select dp_review_submission('f0f00000-0000-4000-8000-000000000061','Well done','approved');
select set_config('request.jwt.claims','{"sub":"f0f00000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin
 if not exists(select 1 from dp_submissions where id='f0f00000-0000-4000-8000-000000000061' and status='approved') then raise exception 'Progress approval did not persist'; end if;
 if not exists(select 1 from dp_lesson_progress where user_id=auth.uid() and lesson_id='f0f00000-0000-4000-8000-000000000041' and status='completed' and completion_method='instructor_review') then raise exception 'Reviewed lesson progress missing'; end if;
end$$;
reset role;
update dp_enrollments set status='withdrawn' where user_id='f0f00000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f0f00000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from dp_assignment_progress where assignment_id='f0f00000-0000-4000-8000-000000000051') then raise exception 'Withdrawn student retained practice access'; end if;
 if exists(select 1 from dp_my_session_summaries('fixture-voice')) then raise exception 'Withdrawn student retained session access'; end if;
end$$;
reset role;
rollback;
select 'PASS: Voice/Creative/multi-program isolation, save/reload, submission, private review, shared feedback, revision, approval; fixtures rolled back' as result;
