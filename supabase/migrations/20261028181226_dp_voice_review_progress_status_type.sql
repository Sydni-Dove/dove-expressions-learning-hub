create or replace function public.dp_review_submission(target_id uuid,feedback_text text,next_status dp_submission_status)
returns void language plpgsql security invoker set search_path=public as $$
declare aid uuid; sid uuid; lid uuid; ready boolean;
begin
 select assignment_id,student_id into aid,sid from dp_submissions where id=target_id for update;
 if auth.uid() is null or aid is null or not dp_private.manage_assignment(aid) then raise exception 'Review not authorized'; end if;
 if next_status not in ('approved','returned','exempt') or length(trim(feedback_text))=0 then raise exception 'Choose an outcome and write feedback'; end if;
 insert into dp_feedback(submission_id,author_id,content,is_private) values(target_id,auth.uid(),trim(feedback_text),false);
 update dp_submissions set status=next_status where id=target_id;
 select lesson_id into lid from dp_assignments where id=aid;
 if lid is not null then
   select not exists(select 1 from dp_assignments a where a.lesson_id=lid
    and (a.assigned_to_user_id is null or a.assigned_to_user_id=sid)
    and (a.assigned_to_cohort_id is null or exists(select 1 from dp_enrollments e
      where e.user_id=sid and e.scope_type='cohort' and e.scope_id=a.assigned_to_cohort_id and e.status='active'))
    and not coalesce((select s.status in ('approved','exempt') from dp_submissions s
      where s.assignment_id=a.id and s.student_id=sid order by s.submitted_at desc limit 1),false)) into ready;
   insert into dp_lesson_progress(user_id,lesson_id,status,completion_method,completed_at)
   values(sid,lid,case when ready then 'completed'::dp_completion_status else 'in_progress'::dp_completion_status end,
     'instructor_review',case when ready then now() else null end)
   on conflict(user_id,lesson_id) do update set status=excluded.status,completion_method=excluded.completion_method,completed_at=excluded.completed_at;
 end if;
end $$;

