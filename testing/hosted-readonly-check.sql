-- READ-ONLY verification of the hosted project before any migration is applied. A single SELECT: it cannot change anything.
-- Run it (SQL editor or MCP execute_sql) against project jnlvvlkwskidloripvtp ("Dove Expressions App 2"), then compare with
-- docs/voice-reconciliation.md. It returns counts and names only, never student content.
with
wanted_tables as (select unnest(array[
 'dp_programs','dp_courses','dp_modules','dp_lessons','dp_lesson_blocks','dp_enrollments','dp_assignments','dp_submissions','dp_feedback',
 'dp_sessions','dp_lesson_progress','dp_assignment_progress','dp_voice_testimonials','dp_notes','dp_user_roles','dp_role_assignments','dp_class_teachers','profiles']) t),
new_tables as (select unnest(array[
 'dp_coaching_plans','dp_coaching_tiers','dp_coaching_packages','dp_package_payments','dp_unmatched_payments','dp_submission_attempts','dp_lesson_access',
 'dp_consultation_inquiries','dp_voice_skills','dp_voice_exercises','dp_voice_plan_templates','dp_voice_goals','dp_voice_goal_updates','dp_voice_resource_content',
 'dp_voice_assessments','dp_voice_assessment_notes','dp_voice_assessment_reviews','dp_voice_profiles','dp_voice_learning_plans','dp_voice_plan_units',
 'dp_voice_plan_unit_private','dp_voice_progress_checks','dp_voice_tracks','dp_voice_track_assignments','dp_voice_exercise_coaching']) t),
new_cols as (select * from (values
 ('dp_sessions','lesson_minutes'),('dp_sessions','appointment_status'),('dp_sessions','plan_id'),('dp_sessions','package_id'),('dp_sessions','credit_waived'),('dp_sessions','waive_reason'),
 ('dp_assignments','practice_items'),('dp_voice_testimonials','video_path'),('dp_voice_testimonials','consented_at'),('dp_voice_testimonials','published_at'),
 ('dp_voice_testimonials','published_by'),('dp_voice_testimonials','consent_withdrawn_at')) v(t,c)),
needed_cols as (select * from (values
 ('profiles','id'),('profiles','full_name'),('profiles','email'),('dp_submissions','file_urls'),('dp_assignment_progress','recording_url'),
 ('dp_sessions','program_id'),('dp_sessions','student_visible_notes'),('dp_sessions','private_faculty_notes'),('dp_assignments','practice_steps'),
 ('dp_assignments','assigned_to_user_id'),('dp_lessons','module_id'),('dp_lessons','status'),('dp_courses','program_id'),('dp_courses','is_published')) v(t,c)),
needed_funcs as (select unnest(array['dp_safe_uuid','dp_is_super_admin','dp_has_role','dp_is_mentor_of','dp_can_access_course','dp_has_scoped_role','dp_review_submission','dp_my_session_summaries','dp_course_students']) f),
needed_private as (select unnest(array['manage_course','manage_assignment','student_assignment','enrolled_course','manage_session','check_submission']) f),
new_funcs as (select unnest(array['dp_generate_appointments','dp_set_lesson_status','dp_my_coaching_overview','dp_program_students','dp_record_package_purchase','dp_resolve_unmatched_payment',
 'dp_create_package','dp_assign_weekly_plan','dp_withdraw_testimonial_consent','dp_delete_my_testimonial','dp_public_testimonials','dp_my_lesson_lock','dp_is_published_testimonial_video']) f)
select jsonb_pretty(jsonb_build_object(
 'project', current_database(),
 'server_version', current_setting('server_version'),
 'read_only_note', 'single SELECT; nothing was written',
 'missing_existing_tables', (select coalesce(jsonb_agg(t),'[]') from wanted_tables w where not exists(select 1 from pg_tables p where p.schemaname='public' and p.tablename=w.t)),
 'new_tables_already_present(conflict)', (select coalesce(jsonb_agg(t),'[]') from new_tables n where exists(select 1 from pg_tables p where p.schemaname='public' and p.tablename=n.t)),
 'view_already_present(conflict)', (select coalesce(jsonb_agg(viewname),'[]') from pg_views where schemaname='public' and viewname='dp_package_balances'),
 'new_columns_already_present', (select coalesce(jsonb_agg(t||'.'||c),'[]') from new_cols n where exists(select 1 from information_schema.columns i where i.table_schema='public' and i.table_name=n.t and i.column_name=n.c)),
 'needed_columns_missing', (select coalesce(jsonb_agg(t||'.'||c),'[]') from needed_cols n where not exists(select 1 from information_schema.columns i where i.table_schema='public' and i.table_name=n.t and i.column_name=n.c)),
 'needed_public_functions_missing', (select coalesce(jsonb_agg(f),'[]') from needed_funcs n where not exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname=n.f)),
 'needed_dp_private_functions_missing', (select coalesce(jsonb_agg(f),'[]') from needed_private n where not exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='dp_private' and p.proname=n.f)),
 'new_functions_already_present(conflict)', (select coalesce(jsonb_agg(f),'[]') from new_funcs n where exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname=n.f)),
 'session_type_enum', (select jsonb_agg(enumlabel order by enumsortorder) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='dp_session_type'),
 'profiles_columns', (select jsonb_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='profiles'),
 'storage_buckets', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit)),'[]') from storage.buckets),
 'storage_bucket_columns_ok', (select count(*)=2 from information_schema.columns where table_schema='storage' and table_name='buckets' and column_name in ('file_size_limit','allowed_mime_types')),
 'dp_tables_without_rls', (select coalesce(jsonb_agg(c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'dp\_%' escape '\' and not c.relrowsecurity),
 'policy_names_that_would_collide', (select coalesce(jsonb_agg(policyname||' on '||tablename),'[]') from pg_policies where policyname in ('dp_lesson_blocks_level_boundary','dp_private_file_level_boundary','voice_recordings_student_insert','voice_recordings_read','voice_recordings_student_delete','voice_testimonials_student_insert','voice_testimonials_read','voice_testimonials_student_delete','voice_testimonials_published_read','dp_lesson_level_boundary')),
 'roles_present', (select jsonb_agg(rolname order by rolname) from pg_roles where rolname in ('anon','authenticated','service_role','authenticator')),
 'applied_dp_voice_migrations', (select coalesce(jsonb_agg(version||' '||name order by version),'[]') from supabase_migrations.schema_migrations where name ilike '%voice%'),
 'latest_migration', (select version||' '||name from supabase_migrations.schema_migrations order by version desc limit 1),
 'counts', jsonb_build_object(
   'enrollments',(select count(*) from dp_enrollments),'submissions',(select count(*) from dp_submissions),'sessions',(select count(*) from dp_sessions),
   'testimonials',(select count(*) from dp_voice_testimonials),'voice_programs',(select count(*) from dp_programs where slug='vocal-coaching'),
   'voice_courses_published',(select count(*) from dp_courses c join dp_programs p on p.id=c.program_id where p.slug='vocal-coaching' and c.is_published),
   'voice_lessons_published',(select count(*) from dp_lessons l join dp_modules m on m.id=l.module_id join dp_courses c on c.id=m.course_id join dp_programs p on p.id=c.program_id where p.slug='vocal-coaching' and l.status='published'),
   'voice_lessons_total',(select count(*) from dp_lessons l join dp_modules m on m.id=l.module_id join dp_courses c on c.id=m.course_id join dp_programs p on p.id=c.program_id where p.slug='vocal-coaching'))
)) as report;
