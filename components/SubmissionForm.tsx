"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RECORDING_BUCKET, RECORDING_TYPES, MAX_RECORDING_MB, validateMediaFile, recordingPath, recordingRef, isUploadedRecording, isVideoName, recordingLabel } from "@/lib/recordings";
import { parseStorageRef } from "@/lib/storage";

export interface PracticeDraft {
  checked_steps: number[]; minutes: number; response: string; recording_url: string;
}
export interface PracticeAttempt {
  id: string; status: string; content: { response?: string }; file_urls: string[];
}

export default function SubmissionForm({ assignmentId, studentId, steps = [], draft, attempt, preview: staffPreview = false }: {
  assignmentId: string; studentId: string; steps?: string[]; draft?: PracticeDraft;
  attempt?: PracticeAttempt; preview?: boolean;
}) {
  const router = useRouter();
  const [response, setResponse] = useState(draft?.response ?? attempt?.content?.response ?? "");
  const [link, setLink] = useState(draft?.recording_url ?? attempt?.file_urls?.[0] ?? "");
  const [minutes, setMinutes] = useState(draft?.minutes ?? 0);
  const [checked, setChecked] = useState<number[]>(draft?.checked_steps ?? []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const locked = staffPreview || (!!attempt && !["returned", "revised"].includes(attempt.status));

  async function save(submit: boolean) {
    setError(""); setNotice("");
    if (submit && !response.trim() && !link.trim()) { setError("Add a reflection or recording before submitting."); return; }
    if (link && !/^https:\/\//i.test(link) && !isUploadedRecording(link)) { setError("Use an HTTPS recording link or upload a recording."); return; }
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

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(""); setNotice("");
    const problem = validateMediaFile(file);
    if (problem) { setError(problem); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const path = recordingPath(studentId, assignmentId, file.name);
      const { error: upErr } = await supabase.storage.from(RECORDING_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
      if (upErr) throw upErr;
      setLink(recordingRef(path)); setPreview("");
      setNotice("Recording uploaded privately. Save progress or submit to keep it with your practice.");
    } catch (err) { setError((err as {message?:string}).message ?? "Upload failed. Check your connection and try again."); }
    finally { setUploading(false); }
  }
  async function showPreview() {
    const ref = parseStorageRef(link);
    if (!ref) return;
    const { data, error: e } = await createClient().storage.from(ref.bucket).createSignedUrl(ref.path, 600);
    if (e || !data?.signedUrl) setError("Could not load your recording."); else setPreview(data.signedUrl);
  }

  return <div className="mt-4 space-y-4 border-t border-burgundy/10 pt-4">
    <fieldset disabled={busy || locked} className="space-y-3">
      <legend className="font-ui font-semibold text-burgundy">Guided practice</legend>
      {steps.map((step, i) => <label key={i} className="flex items-start gap-3 font-body text-sm"><input type="checkbox" checked={checked.includes(i)} onChange={e => setChecked(e.target.checked ? [...checked, i] : checked.filter(n => n !== i))}/>{step}</label>)}
      <label className="block font-ui text-sm">Practice minutes<input type="number" min={0} max={1440} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="input mt-1 block"/></label>
      <label className="block font-ui text-sm">Practice reflection<textarea rows={4} value={response} onChange={e => setResponse(e.target.value)} className="input mt-1 w-full"/></label>
      {isUploadedRecording(link) ? <div className="space-y-2 rounded-xl bg-pale-pink/30 p-3">
        <p className="font-ui text-sm font-semibold">Private recording: {recordingLabel(link)}</p>
        {preview ? (isVideoName(link) ? <video controls playsInline src={preview} className="w-full max-w-md rounded-xl"/> : <audio controls src={preview} className="w-full max-w-md"/>)
          : <button type="button" onClick={showPreview} className="btn-secondary">Play back</button>}
        <button type="button" onClick={() => { setLink(""); setPreview(""); }} className="ml-2 font-ui text-sm underline">Replace recording</button>
      </div> : <>
        <label className="block font-ui text-sm">Record or upload your singing (private)<input type="file" accept={RECORDING_TYPES.join(",")} disabled={uploading} onChange={e => { upload(e.target.files?.[0]); e.target.value = ""; }} className="mt-1 block w-full font-body text-sm"/></label>
        <p className="font-body text-xs text-charcoal/65">{uploading ? "Uploading…" : `On a phone this lets you record with your microphone or camera. Audio or video up to ${MAX_RECORDING_MB} MB. Only you and your instructor can play it.`}</p>
        <label className="block font-ui text-sm">Or paste a private recording link (optional)<input type="url" value={link} onChange={e => setLink(e.target.value)} className="input mt-1 w-full" placeholder="https://…"/></label>
        <p className="font-body text-xs text-charcoal/65">Use a recording shared only with your instructor. Links follow the hosting service’s sharing settings.</p>
      </>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-burgundy">{error}</p>}
    <p role="status" className="font-ui text-sm text-charcoal/75">{notice}</p>
    {staffPreview ? <p className="font-ui text-sm">Staff preview — student saving is disabled.</p> : locked ? <p className="font-ui text-sm">{attempt?.status === "approved" ? "Approved by your instructor." : attempt?.status === "exempt" ? "Exempted by your instructor." : "Submitted — awaiting instructor review."}</p> : <div className="flex flex-wrap gap-3">
      <button disabled={busy} onClick={() => save(false)} className="btn-secondary">{busy ? "Saving…" : "Save progress"}</button>
      <button disabled={busy} onClick={() => save(true)} className="btn-primary">{attempt ? "Resubmit practice" : "Submit practice"}</button>
    </div>}
  </div>;
}
