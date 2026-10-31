-- READ-ONLY pre-flight for the Voice release. Run in the Supabase SQL editor (or via the MCP execute_sql tool) BEFORE applying anything.
-- Every statement is a SELECT. Save the output with your backup notes: part (2) is the ACL snapshot used to restore function permissions.

-- (1) None of the objects the release creates may exist yet (expect: all zero). A non-zero row means something was applied by hand.
select 'relations_already_present' as check, count(*) as n from pg_class c join pg_namespace s on s.oid=c.relnamespace
 where s.nspname='public' and c.relname in ('dp_submission_attempts','dp_coaching_plans','dp_coaching_tiers','dp_coaching_packages','dp_package_payments','dp_unmatched_payments',
  'dp_consultation_inquiries','dp_lesson_access','dp_voice_skills','dp_voice_exercises','dp_voice_plan_templates','dp_voice_goals','dp_voice_goal_updates','dp_voice_resource_content',
  'dp_practice_recordings','dp_practice_recording_feedback','dp_voice_profiles','dp_voice_intakes','dp_voice_assessments','dp_voice_assessment_private','dp_voice_plans','dp_voice_plan_units',
  'dp_voice_plan_private','dp_voice_progress_checks','dp_voice_progress_check_private','dp_voice_plan_versions','dp_voice_import_mappings','dp_package_balances');
select 'voice_buckets_already_present' as check, count(*) as n from storage.buckets where id in ('voice-recordings','voice-testimonials');
select 'last_applied_migration' as check, max(version) as version from supabase_migrations.schema_migrations;   -- expect 20261028193254

-- (2) ACL snapshot of every function in dp_private (20261029110000 revokes from public/anon and grants execute to authenticated on ALL of them).
select p.proname, pg_get_function_identity_arguments(p.oid) as args, coalesce(p.proacl::text,'(default)') as acl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dp_private' order by 1,2;

-- (3) Sizes of the existing tables the release alters or inserts into (rollback and backup scope).
select 'dp_sessions' as t, count(*) from dp_sessions union all select 'dp_submissions', count(*) from dp_submissions union all select 'dp_assignment_progress', count(*) from dp_assignment_progress
 union all select 'dp_assignments', count(*) from dp_assignments union all select 'dp_voice_testimonials', count(*) from dp_voice_testimonials
 union all select 'dp_lesson_blocks (all)', count(*) from dp_lesson_blocks union all select 'storage.objects (voice-*)', count(*) from storage.objects where bucket_id like 'voice-%';

-- (4) Policies on storage.objects (the release adds named policies; none may collide).
select policyname from pg_policies where schemaname='storage' and tablename='objects' and (policyname like 'voice_%' or policyname like 'dp_private_file_level_boundary' ) order by 1;
