-- ============================================================================
-- v2d correction: enable the minimum safeguarding UI required before real
-- students use the platform (privacy-policy acceptance, recording consent,
-- report submission, guardian consent). Two changes:
--
-- 1. dp_guardian_consents currently only allows faculty/admin to INSERT,
--    which makes a self-service "I am under 18" signup branch impossible --
--    nobody could ever write the very first guardian-consent row for a new
--    minor account. Add a narrow INSERT-only policy so a newly created
--    account can submit its own guardian consent record during onboarding.
--    SELECT/UPDATE/DELETE remain faculty/admin-only via the existing
--    dp_guardian_consents_write policy -- a minor cannot edit or remove a
--    consent record once submitted, only create the initial one.
--
-- 2. Seed real, versioned policy documents so the privacy-acceptance and
--    consent UIs have actual content to present, matching the language
--    already committed to in 07-trust-safety-and-consent.md.
-- ============================================================================

create policy dp_guardian_consents_self_insert on dp_guardian_consents for insert
with check (minor_user_id = auth.uid());

insert into dp_policy_documents (policy_type, version, title, body, effective_date) values
(
  'privacy_policy',
  1,
  'Dove Expressions Discipleship Platform — Privacy Summary',
  E'What we collect and why: your profile, intake answers, Spiritual Wiring Assessment responses, and session notes -- collected so your mentor and faculty can walk with you well.\n\nWho can see what: your notes, journal entries, and prayer requests are private by default. You choose if and when to share them. Session notes are split into what your mentor shares with you and what stays in their private working notes. The one documented exception: a program may grant faculty standing access to specific fields, and if so, you will be told that here, not discovered later.\n\nYour rights: you can request a copy of your data or ask for it to be deleted at any time by contacting an administrator.\n\nThis summary is versioned. If it changes in a way that matters, you will be shown the new version and asked to accept it again.',
  current_date
),
(
  'recording_consent',
  1,
  'Session Recording Consent',
  E'A one-on-one or group session is never recorded by default. If your mentor or faculty member would like to record a session -- so you can revisit the conversation, and so it can be referenced in your discipleship plan -- they will ask you directly before recording begins. You may say yes or no, and you may decline recording and still receive full mentoring. If you agree and later change your mind mid-session, recording stops and the file is deleted.',
  current_date
),
(
  'guardian_consent',
  1,
  'Guardian Consent for Minors',
  E'If you are under 18 (or the age of majority where you live, if that is higher), a parent or guardian must give consent before your account is activated for anything beyond public browsing. We will ask for their name, email, and relationship to you, and they will be asked to explicitly agree. Community spaces and messaging involving a minor account receive additional review.',
  current_date
);
