-- Avoid the legacy notes -> shares -> notes RLS recursion.
create or replace function dp_private.can_read_note(nid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from dp_notes n where n.id=nid and
 (n.author_id=auth.uid() or dp_is_super_admin() or
 (n.visibility='mentor' and dp_is_mentor_of(n.author_id)) or n.visibility='community'
 or exists(select 1 from dp_note_shares s where s.note_id=n.id and
 (s.shared_with_user_id=auth.uid() or exists(select 1 from dp_enrollments e
 where e.user_id=auth.uid() and e.scope_type='cohort' and e.scope_id=s.shared_with_cohort_id and e.status='active')))))
$$;
revoke all on function dp_private.can_read_note(uuid) from public,anon;
grant execute on function dp_private.can_read_note(uuid) to authenticated;
drop policy dp_notes_owner_select on dp_notes;
create policy dp_notes_owner_select on dp_notes for select to authenticated using(dp_private.can_read_note(id));
create policy dp_note_update_owner_boundary on dp_notes as restrictive for update to authenticated
using(author_id=auth.uid() or dp_is_super_admin()) with check(author_id=auth.uid() or dp_is_super_admin());

