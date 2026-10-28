"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface PracticeDraft {
  checked_steps: number[]; minutes: number; response: string; recording_url: string;
}
export interface PracticeAttempt {
  id: string; status: string; content: { response?: string }; file_urls: string[];
}

export default function SubmissionForm({ assignmentId, studentId, steps = [], draft, attempt, preview = false }: {
  assignmentId: string; studentId: string; steps?: string[]; draft?: PracticeDraft;
  attempt?: PracticeAttempt; preview?: boolean;
}) {
  const router = useRouter();
  const [response, setResponse] = useState(draft?.response ?? attempt?.content?.response ?? "");
  const [link, setLink] = useState(draft?.recording_url ?? attempt?.file_urls?.[0] ?? "");
  const [minutes, setMinutes] = useState(draft?.minutes ?? 0);
  const [checked, setChecked] = useState<number[]>(draft?.checked_steps ?? []);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const locked = preview || (!!attempt && !["returned", "revised"].includes(attempt.status));

  async function save(submit: boolean) {
    setError(""); setNotice("");
    if (submit && !response.trim() && !link.trim()) { setError("Add a reflection or recording before submitting."); return; }
    if (link && !/^https:\/\//i.test(link)) { setError("Use an HTTPS recording link."); return; }
    if (submit && steps.some((_, i) => !checked.includes(i))) { setError("Complete each practice step before submitting."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: draftError } = await supabase.from("dp_assignment_progress").upsert({
        assignment_id: assignmentId, student_id: studentId, checked_steps: checked,
        minutes, response, recording_url: link, updated_at: new Date().toISOString()
      }, { onConflict: "assignment_id,student_id" });
      if (draftError) throw draftError;
      if (submit) {
        const payload = { content: { response, minutes, checked_steps: checked }, file_urls: link ? [link] : [], status: attempt ? "revised" : "submitted", submitted_at: new Date().toISOString() };
        const result = attempt
          ? await supabase.from("dp_submissions").update(payload).eq("id", attempt.id).select("id").single()
          : await supabase.from("dp_submissions").insert({ ...payload, assignment_id: assignmentId, student_id: studentId }).select("id").single();
        if (result.error) throw result.error;
      }
      setNotice(submit ? "Practice submitted. Your instructor will review it privately before sharing feedback." : "Progress saved. You can return to this practice later.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : (err as {message?:string}).message ?? "Could not save. Please retry."); }
    finally { setBusy(false); }
  }

  return <div className="mt-4 space-y-4 border-t border-burgundy/10 pt-4">
    <fieldset disabled={busy || locked} className="space-y-3">
      <legend className="font-ui font-semibold text-burgundy">Guided practice</legend>
      {steps.map((step, i) => <label key={i} className="flex items-start gap-3 font-body text-sm"><input type="checkbox" checked={checked.includes(i)} onChange={e => setChecked(e.target.checked ? [...checked, i] : checked.filter(n => n !== i))}/>{step}</label>)}
      <label className="block font-ui text-sm">Practice minutes<input type="number" min={0} max={1440} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="input mt-1 block"/></label>
      <label className="block font-ui text-sm">Practice reflection<textarea rows={4} value={response} onChange={e => setResponse(e.target.value)} className="input mt-1 w-full"/></label>
      <label className="block font-ui text-sm">Private recording link (optional)<input type="url" value={link} onChange={e => setLink(e.target.value)} className="input mt-1 w-full" placeholder="https://…"/></label>
      <p className="font-body text-xs text-charcoal/65">Use a recording shared only with your instructor. Links follow the hosting service’s sharing settings.</p>
    </fieldset>
    {error && <p role="alert" className="text-sm text-burgundy">{error}</p>}
    <p role="status" className="font-ui text-sm text-charcoal/75">{notice}</p>
    {preview ? <p className="font-ui text-sm">Staff preview — student saving is disabled.</p> : locked ? <p className="font-ui text-sm">{attempt?.status === "approved" ? "Approved by your instructor." : attempt?.status === "exempt" ? "Exempted by your instructor." : "Submitted — awaiting instructor review."}</p> : <div className="flex flex-wrap gap-3">
      <button disabled={busy} onClick={() => save(false)} className="btn-secondary">{busy ? "Saving…" : "Save progress"}</button>
      <button disabled={busy} onClick={() => save(true)} className="btn-primary">{attempt ? "Resubmit practice" : "Submit practice"}</button>
    </div>}
  </div>;
}
