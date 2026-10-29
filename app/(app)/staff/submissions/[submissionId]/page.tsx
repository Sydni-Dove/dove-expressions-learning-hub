import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill } from "@/components/ui";
import PrivateReviewNote from "@/components/PrivateReviewNote";
import RecordingPlayer from "@/components/RecordingPlayer";
import { signMediaList } from "@/lib/storage";
import { recordingLabel } from "@/lib/recordings";
import FeedbackForm from "@/components/FeedbackForm";

export default async function SubmissionReviewPage({ params }: { params: { submissionId: string } }) {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: submission } = await supabase
    .from("dp_submissions")
    .select("id,student_id,status,submitted_at,content,file_urls,dp_assignments(title,description)")
    .eq("id", params.submissionId)
    .maybeSingle();

  if (!submission) {
    return <EmptyState title="Not available" body="This submission doesn't exist, or you don't have an assigned relationship to the student who submitted it." />;
  }

  const { data: profile } = await supabase.from("profiles").select("full_name,email").eq("id", submission.student_id).maybeSingle();
  const { data: feedback } = await supabase
    .from("dp_feedback")
    .select("id,content,created_at,author_id,is_private")
    .eq("submission_id", submission.id)
    .order("created_at", { ascending: false });

  const { data: attempts } = await supabase.from("dp_submission_attempts")
    .select("id,attempt_no,content,file_urls,submitted_at").eq("submission_id", submission.id).order("attempt_no", { ascending: false });
  const allRefs = [...new Set([...(submission.file_urls ?? []), ...(attempts ?? []).flatMap(a => a.file_urls ?? [])])];
  const signed = await signMediaList(supabase, allRefs);
  const signedFor = (u: string) => signed.find(x => x.original === u)?.signed ?? "";
  const assignment: any = submission.dp_assignments;
  const content: any = submission.content || {};

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <Link href="/staff/dashboard" className="font-ui text-sm text-charcoal/60 underline">
          ← Staff Dashboard
        </Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">{assignment?.title || "Assignment"}</h1>
        <p className="font-ui text-sm text-charcoal/50">
          {profile?.full_name || profile?.email || "Student"} · submitted {new Date(submission.submitted_at).toLocaleDateString()}
        </p>
        <Pill tone={submission.status === "approved" ? "success" : "sunrise"}>{submission.status.replace(/_/g, " ")}</Pill>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg text-burgundy">Response</h2>
        <p className="mt-2 whitespace-pre-line font-body text-sm text-charcoal/80">{content.response || "No written response."}</p>
        {(submission.file_urls ?? []).length > 0 && (
          <div className="mt-3 space-y-3">
            {submission.file_urls.map((u: string) => <RecordingPlayer key={u} label={`Current ${recordingLabel(u)}`} original={u} signedUrl={signedFor(u)} />)}
          </div>
        )}
      </div>

      {(attempts ?? []).length > 1 && (
        <div className="card p-5">
          <h2 className="font-display text-lg text-burgundy">Attempt history</h2>
          <ol className="mt-3 space-y-3">{attempts!.map(t => <li key={t.id} className="rounded-xl border border-burgundy/10 p-3">
            <p className="font-ui text-xs font-semibold">Attempt {t.attempt_no} · {new Date(t.submitted_at).toLocaleDateString()}{typeof (t.content as any)?.minutes === "number" ? ` · ${(t.content as any).minutes} min` : ""}</p>
            {(t.content as any)?.response && <p className="mt-1 whitespace-pre-wrap font-body text-sm">{(t.content as any).response}</p>}
            <div className="mt-2 space-y-2">{(t.file_urls ?? []).map((u: string) => <RecordingPlayer key={u} label={`Attempt ${t.attempt_no} · ${recordingLabel(u)}`} original={u} signedUrl={signedFor(u)} />)}</div>
          </li>)}</ol>
        </div>
      )}

      {(feedback ?? []).length > 0 && (
        <div>
          <h2 className="font-display text-lg text-burgundy">Review history</h2>
          <div className="mt-2 space-y-2">
            {feedback!.map((f) => (
              <div key={f.id} className="card p-4">
                <p className="font-ui text-xs font-bold text-burgundy">{f.is_private ? "Instructor-private note" : "Shared with student"}</p>
                <p className="font-body text-sm text-charcoal/80">{f.content}</p>
                <p className="mt-1 font-ui text-xs text-charcoal/40">{new Date(f.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <PrivateReviewNote submissionId={submission.id} authorId={user!.id} />
      <FeedbackForm submissionId={submission.id} />
    </div>
  );
}

