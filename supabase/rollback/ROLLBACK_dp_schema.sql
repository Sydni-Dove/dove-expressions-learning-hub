-- ============================================================================
-- ROLLBACK SCRIPT — Discipleship Platform (dp_) schema only
-- ============================================================================
-- Removes every object this build added to "Dove Expressions App 2"
-- (jnlvvlkwskidloripvtp). Nothing outside the dp_ namespace is touched by
-- this script, because nothing outside the dp_ namespace was touched by the
-- build. Run this only if you need to fully remove the Discipleship
-- Platform schema and start over. It is NOT run automatically by anything.
--
-- Order matters: child tables (with foreign keys into other dp_ tables)
-- are dropped before the tables they reference. `cascade` is used defensively
-- so a forgotten dependency doesn't block the rollback.
-- ============================================================================

begin;


-- ---- v3 additions (messaging, community, prayer requests) ----
drop table if exists dp_messages cascade;
drop table if exists dp_conversation_participants cascade;
drop table if exists dp_conversations cascade;
drop function if exists dp_is_conversation_participant(uuid) cascade;
drop table if exists dp_community_comments cascade;
drop table if exists dp_community_posts cascade;
drop table if exists dp_community_spaces cascade;
drop table if exists dp_prayer_responses cascade;
drop table if exists dp_prayer_requests cascade;
drop function if exists dp_can_view_prayer_request(uuid) cascade;


-- ---- v2 additions (pillars, scoped roles, consent/safeguarding, certificates) ----
drop table if exists dp_certificates cascade;
drop table if exists dp_guardian_consents cascade;
drop table if exists dp_student_lifecycle cascade;
drop table if exists dp_mentor_transfer_log cascade;
drop table if exists dp_reports cascade;
drop table if exists dp_policy_acceptances cascade;
drop table if exists dp_policy_documents cascade;
drop table if exists dp_role_assignments cascade;
drop table if exists dp_creative_project_collaborators cascade;
drop table if exists dp_pillars cascade;
drop function if exists dp_has_scoped_role(dp_role, uuid, uuid, uuid, uuid) cascade;
drop type if exists dp_creative_visibility;
drop type if exists dp_wiring_result_status;


-- Note: v2 also added columns (pillars text[], result_status, content_version, visibility,
-- recording_consent, etc.) to existing dp_ tables via ALTER TABLE ADD COLUMN. Those columns
-- are removed automatically when their parent table is dropped above/below — no separate
-- DROP COLUMN statements are needed.
-- Junction / leaf tables first
drop table if exists dp_project_feedback cascade;
drop table if exists dp_attendance cascade;
drop table if exists dp_announcement_acknowledgments cascade;
drop table if exists dp_note_shares cascade;
drop table if exists dp_action_steps cascade;
drop table if exists dp_goals cascade;
drop table if exists dp_feedback cascade;
drop table if exists dp_submissions cascade;
drop table if exists dp_wiring_reflections cascade;
drop table if exists dp_lesson_progress cascade;
drop table if exists dp_lesson_blocks cascade;
drop table if exists dp_enrollments cascade;

-- Mid-level tables
drop table if exists dp_creative_projects cascade;
drop table if exists dp_assignments cascade;
drop table if exists dp_assignment_templates cascade;
drop table if exists dp_wiring_profiles cascade;
drop table if exists dp_wiring_results cascade;
drop table if exists dp_assessment_responses cascade;
drop table if exists dp_assessment_questions cascade;
drop table if exists dp_assessment_definitions cascade;
drop table if exists dp_wiring_categories cascade;
drop table if exists dp_sessions cascade;
drop table if exists dp_pre_session_questionnaires cascade;
drop table if exists dp_discipleship_plans cascade;
drop table if exists dp_mandate_records cascade;
drop table if exists dp_meetings_with_god cascade;
drop table if exists dp_two_way_journal_entries cascade;
drop table if exists dp_scripture_journey_entries cascade;
drop table if exists dp_notes cascade;
drop table if exists dp_voice_memos cascade;
drop table if exists dp_announcements cascade;
drop table if exists dp_calendar_events cascade;
drop table if exists dp_live_sessions cascade;
drop table if exists dp_lessons cascade;
drop table if exists dp_modules cascade;

-- Top-level tables
drop table if exists dp_courses cascade;
drop table if exists dp_cohorts cascade;
drop table if exists dp_tracks cascade;
drop table if exists dp_programs cascade;
drop table if exists dp_learning_areas cascade;
drop table if exists dp_cohort_faculty cascade;
drop table if exists dp_class_teachers cascade;
drop table if exists dp_mentor_assignments cascade;
drop table if exists dp_audit_log cascade;
drop table if exists dp_user_roles cascade;

-- Helper functions
drop function if exists dp_is_faculty_of_cohort(uuid) cascade;
drop function if exists dp_is_teacher_of_course(uuid) cascade;
drop function if exists dp_is_mentor_of(uuid) cascade;
drop function if exists dp_is_super_admin() cascade;
drop function if exists dp_has_role(dp_role) cascade;

-- Enums (must drop after every table/function using them is gone)
drop type if exists dp_journey_status;
drop type if exists dp_mwg_status;
drop type if exists dp_provider;
drop type if exists dp_announcement_target;
drop type if exists dp_step_status;
drop type if exists dp_plan_status;
drop type if exists dp_save_status;
drop type if exists dp_visibility;
drop type if exists dp_note_kind;
drop type if exists dp_session_type;
drop type if exists dp_response_status;
drop type if exists dp_question_type;
drop type if exists dp_submission_status;
drop type if exists dp_assignment_type;
drop type if exists dp_completion_status;
drop type if exists dp_lesson_status;
drop type if exists dp_scope_type;
drop type if exists dp_role;

commit;

-- After running this, confirm with:
--   select count(*) from information_schema.tables where table_name like 'dp_%';
-- Expected result: 0
