create or replace function dp_private.check_coaching_progress() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.status='completed' and exists(select 1 from dp_lessons l
 join dp_modules m on m.id=l.module_id join dp_courses c on c.id=m.course_id
 join dp_programs p on p.id=c.program_id
 where l.id=new.lesson_id and p.slug='vocal-coaching' and not dp_private.manage_course(c.id))
 then raise exception 'Your instructor records Voice lesson completion after reviewing practice'; end if;
 return new;
end $$;
revoke all on function dp_private.check_coaching_progress() from public,anon;
grant execute on function dp_private.check_coaching_progress() to authenticated;
create trigger dp_voice_completion_review_guard before insert or update on dp_lesson_progress
for each row execute function dp_private.check_coaching_progress();
