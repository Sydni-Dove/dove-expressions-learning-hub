import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill } from "@/components/ui";
import RecordingPlayer from "@/components/RecordingPlayer";
import { signMediaList } from "@/lib/storage";
import { recordingLabel } from "@/lib/recordings";
import { linkHost, safeLink, type PlanItem } from "@/lib/voice-resources";
import SubmissionForm, { PracticeDraft, PracticeAttempt } from "@/components/SubmissionForm";

export default async function AssignmentsPage() {
  const supabase = createClient();
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  // RLS handles direct, cohort, course AND program membership. Never fetch every
  // assignment on an enrolled course and accidentally expose another student's work.
  const { data: assignments, error } = await supabase.from("dp_assignments")
    .select("id,title,description,assignment_type,due_at,course_id,lesson_id,song,goal,pacing,practice_steps,practice_items")
    .order("due_at", { ascending: true, nullsFirst: false });
  const [{ data: submissions, error: submissionError }, { data: drafts, error: draftError }] = await Promise.all([
    supabase.from("dp_submissions").select("id,assignment_id,status,submitted_at,content,file_urls").eq("student_id", user.id).order("submitted_at", { ascending: false }),
    supabase.from("dp_assignment_progress").select("*").eq("student_id", user.id)
  ]);
  const ids = (submissions ?? []).map(s => s.id);
  const { data: feedback, error: feedbackError } = ids.length ? await supabase.from("dp_feedback")
    .select("id,submission_id,content,created_at").in("submission_id", ids).eq("is_private", false).order("created_at", { ascending: false }) : { data: [], error: null };
  const { data: attempts } = await supabase.from("dp_submission_attempts")
    .select("id,assignment_id,attempt_no,content,file_urls,submitted_at").eq("student_id", user.id).order("attempt_no", { ascending: false });
  const signed = await signMediaList(supabase, [...new Set((attempts ?? []).flatMap(a => a.file_urls ?? []))]);
  const signedFor = (u: string) => signed.find(x => x.original === u)?.signed ?? "";
  if (error || submissionError || draftError || feedbackError) return <div role="alert" className="card p-6">Your practice could not be loaded. Reload this page before making changes.</div>;
  const approved = (assignments ?? []).filter(a => ["approved", "exempt"].includes(submissions?.find(s => s.assignment_id === a.id)?.status ?? "")).length;
  return <div className="max-w-3xl space-y-5 pb-16">
    <h1 className="font-display text-3xl text-burgundy">My practice & assignments</h1>
    <p className="font-body text-sm text-charcoal/70">{approved} of {assignments?.length ?? 0} assignments reviewed and complete. Save your practice, submit it, then apply your instructor’s feedback.</p>
    {error && <p role="alert">Assignments could not be loaded. Please try again later.</p>}
    {!error && !assignments?.length && <EmptyState title="Nothing assigned yet" body="Your instructor will add personalized work here when it is ready."/>}
    {(assignments ?? []).map(a => {
      const sub = submissions?.find(s => s.assignment_id === a.id);
      const draft = drafts?.find(d => d.assignment_id === a.id);
      return <article id={`assignment-${a.id}`} key={a.id} className="card p-5">
        <div className="flex flex-wrap gap-2"><Pill tone="burgundy">{sub?.status ?? (draft ? "In practice" : "Assigned")}</Pill>{a.due_at && <Pill tone="neutral">Due {new Date(a.due_at).toLocaleDateString()}</Pill>}</div>
        <h2 className="mt-3 font-display text-xl text-burgundy">{a.title}</h2>
        {a.description && <p className="mt-2 whitespace-pre-wrap font-body text-sm">{a.description}</p>}
        <dl className="mt-3 space-y-1 font-body text-sm">{a.song && <div><dt className="inline font-bold">Song: </dt><dd className="inline">{a.song}</dd></div>}{a.goal && <div><dt className="inline font-bold">Goal: </dt><dd className="inline">{a.goal}</dd></div>}{a.pacing && <div><dt className="inline font-bold">Pace: </dt><dd className="inline">{a.pacing}</dd></div>}</dl>
        {Array.isArray(a.practice_items) && a.practice_items.length > 0 && <ol className="mt-3 space-y-2" aria-label="Exercises in this plan">{(a.practice_items as PlanItem[]).map((it, i) => { const href = safeLink(it.video_url); return <li key={i} className="rounded-xl bg-pale-pink/30 p-3 font-body text-sm"><span className="font-ui font-bold">{i + 1}. {it.title}{it.minutes ? ` · ${it.minutes} min` : ""}</span>{it.note && <span className="block italic">{it.note}</span>}{it.instructions && <span className="block whitespace-pre-wrap">{it.instructions}</span>}{href && <a href={href} target="_blank" rel="noopener noreferrer" className="block font-ui text-burgundy underline">Watch demonstration ({linkHost(href)})</a>}</li>; })}</ol>}
        {a.lesson_id && a.course_id && <Link className="mt-3 inline-block font-ui text-sm text-burgundy underline" href={`/courses/${a.course_id}/lessons/${a.lesson_id}`}>Open assigned lesson</Link>}
        <SubmissionForm key={`${a.id}-${sub?.status ?? "draft"}`} preview={roles.some(r=>["super_admin","faculty","teacher","mentor"].includes(r))} assignmentId={a.id} studentId={user.id} steps={a.practice_steps ?? []} draft={draft as PracticeDraft | undefined} attempt={sub as PracticeAttempt | undefined}/>
        {(attempts ?? []).filter(t => t.assignment_id === a.id).length > 0 && <section className="mt-4" aria-label="Your submitted attempts"><h3 className="font-display text-lg text-burgundy">Your submitted attempts</h3>
          <ol className="mt-2 space-y-3">{(attempts ?? []).filter(t => t.assignment_id === a.id).map(t => <li key={t.id} className="rounded-xl border border-burgundy/10 p-3">
            <p className="font-ui text-xs font-semibold text-charcoal/70">Attempt {t.attempt_no} · {new Date(t.submitted_at).toLocaleDateString()}{typeof t.content?.minutes === "number" ? ` · ${t.content.minutes} min practice` : ""}</p>
            {t.content?.response && <p className="mt-1 whitespace-pre-wrap font-body text-sm">{t.content.response}</p>}
            <div className="mt-2 space-y-2">{(t.file_urls ?? []).map((u: string) => <RecordingPlayer key={u} label={`Attempt ${t.attempt_no} · ${recordingLabel(u)}`} original={u} signedUrl={signedFor(u)}/>)}</div>
          </li>)}</ol></section>}
        {sub && <section className="mt-4 space-y-2" aria-label="Shared instructor feedback"><h3 className="font-display text-lg text-burgundy">From your instructor</h3>{(feedback ?? []).filter(f => f.submission_id === sub.id).map(f => <div key={f.id} className="rounded-xl bg-pale-pink/40 p-4"><p className="whitespace-pre-wrap font-body text-sm">{f.content}</p><p className="mt-2 font-ui text-xs">{new Date(f.created_at).toLocaleDateString()}</p></div>)}</section>}
      </article>;
    })}
  </div>;
}
