"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/voice-rpc";
import { isAnswered, type AssessmentDef, type Answers } from "@/lib/voice-assessments";

export interface RecordingChoice { id: string; label: string }

/** Student assessment: every question optional, answers saved as a draft at any time, resumable, locked after submit. */
export default function AssessmentForm({ id, def, initial, status, recordings, sharedSummary }: {
  id: string; def: AssessmentDef; initial: Answers; status: string; recordings: RecordingChoice[]; sharedSummary: string | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initial);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const locked = !["assigned", "in_progress"].includes(status);
  const total = def.sections.flatMap((s) => s.questions).length;
  const done = def.sections.flatMap((s) => s.questions).filter((q) => isAnswered(answers[q.id])).length;

  function set(qid: string, v: string | string[]) { dirty.current = true; setMsg(""); setAnswers((a) => ({ ...a, [qid]: v })); }
  async function save(): Promise<boolean> {
    setBusy(true); setErr("");
    const r = await callRpc("dp_assessment_save", { aid: id, a: answers });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return false; }
    dirty.current = false; setMsg("Draft saved. You can leave and come back to finish."); return true;
  }
  async function submit() {
    if (!confirm("Submit? You will not be able to change your answers after this.")) return;
    if (!(await save())) return;
    setBusy(true);
    const r = await callRpc("dp_assessment_submit", { aid: id });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    router.refresh();
  }

  const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-[#630000]/25 bg-white px-3 py-2 font-body text-base text-[#201414]";
  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
      <p className="font-body text-[#4a3a3a]">{def.intro}</p>
      {!locked && <p className="font-ui text-sm text-[#630000]" aria-live="polite">{done} of {total} answered. Skipping is fine.</p>}
      {def.sections.map((sec) => (
        <fieldset key={sec.id} className="space-y-6" disabled={locked}>
          {def.sections.length > 1 && <legend className="font-display text-2xl text-[#630000]">{sec.title}</legend>}
          {sec.description && <p className="font-body text-sm text-[#4a3a3a]">{sec.description}</p>}
          {sec.questions.map((q) => (
            <div key={q.id} className="rounded-2xl border border-[#630000]/15 bg-white p-4">
              <p id={`${q.id}-l`} className="font-ui text-base font-semibold text-[#201414]">{q.text}</p>
              {q.help && <p className="font-body text-xs text-[#4a3a3a]">{q.help}</p>}
              {q.type === "text" && <textarea aria-labelledby={`${q.id}-l`} className={`${field} min-h-[96px]`} maxLength={2000} value={(answers[q.id] as string) ?? ""} onChange={(e) => set(q.id, e.target.value)} />}
              {q.type === "single" && (
                <div role="radiogroup" aria-labelledby={`${q.id}-l`} className="mt-2 flex flex-wrap gap-2">
                  {q.options!.map((o) => (
                    <label key={o} className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-4 py-2 font-body text-sm ${answers[q.id] === o ? "border-[#630000] bg-[#630000] text-white" : "border-[#630000]/30"}`}>
                      <input type="radio" className="sr-only" name={q.id} checked={answers[q.id] === o} onChange={() => set(q.id, o)} />{o}
                    </label>))}
                </div>)}
              {q.type === "multi" && (
                <div role="group" aria-labelledby={`${q.id}-l`} className="mt-2 flex flex-wrap gap-2">
                  {q.options!.map((o) => {
                    const cur = (answers[q.id] as string[] | undefined) ?? []; const on = cur.includes(o);
                    return (
                      <label key={o} className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-4 py-2 font-body text-sm ${on ? "border-[#630000] bg-[#630000] text-white" : "border-[#630000]/30"}`}>
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => set(q.id, on ? cur.filter((x) => x !== o) : [...cur, o])} />{o}
                      </label>);
                  })}
                </div>)}
              {q.type === "recording" && (
                <div className="mt-2">
                  <select aria-labelledby={`${q.id}-l`} className={field} value={(answers[q.id] as string) ?? ""} onChange={(e) => set(q.id, e.target.value)}>
                    <option value="">No recording yet</option>
                    {recordings.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  {!locked && <a href="/voice/recordings" className="mt-2 inline-flex min-h-[44px] items-center font-ui text-sm font-semibold text-[#630000] underline">Record or upload one in My Practice Recordings</a>}
                </div>)}
            </div>))}
        </fieldset>))}
      {!locked && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className="min-h-[44px] rounded-full border border-[#630000]/50 px-6 font-ui text-sm font-bold text-[#630000]">Save draft</button>
          <button type="button" onClick={submit} disabled={busy} className="min-h-[44px] rounded-full bg-[#630000] px-6 font-ui text-sm font-bold text-white">Submit</button>
        </div>)}
      {msg && <p role="status" className="font-ui text-sm text-[#630000]">{msg}</p>}
      {err && <p role="alert" className="font-ui text-sm text-[#9b1c1c]">{err}</p>}
      {locked && <p role="status" className="rounded-xl bg-[#F2DFD8] p-3 font-ui text-sm text-[#630000]">{status === "reviewed" ? "Your instructor has reviewed this." : "Submitted. Your instructor will review it privately."}</p>}
      {sharedSummary && <section aria-label="Shared with you" className="rounded-2xl bg-[#FBF4F1] p-4"><h2 className="font-display text-xl text-[#630000]">What we noticed together</h2><p className="mt-2 whitespace-pre-wrap font-body">{sharedSummary}</p></section>}
    </form>
  );
}
