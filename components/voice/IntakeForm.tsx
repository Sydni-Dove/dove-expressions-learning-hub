"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/voice-rpc";
import { INTAKE_QUESTIONS, requestedTracks, type IntakeAnswers } from "@/lib/voice-assessments";

/** Post-consultation intake: goals and choices, not ability. Skills are looked at separately. */
export default function IntakeForm() {
  const router = useRouter();
  const [a, setA] = useState<Record<string, string | string[]>>({});
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-[#630000]/25 bg-white px-3 py-2 font-body text-base text-[#201414]";
  async function send() {
    setBusy(true); setErr("");
    const r = await callRpc("dp_voice_submit_intake", { a, requested_tracks: requestedTracks(a as IntakeAnswers) });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    router.push("/voice/plan"); router.refresh();
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="space-y-5">
      {INTAKE_QUESTIONS.map((q) => (
        <div key={q.id} className="rounded-2xl border border-[#630000]/15 bg-white p-4">
          <p id={`${q.id}-l`} className="font-ui font-semibold text-[#201414]">{q.text}</p>
          {q.type === "text" && <textarea aria-labelledby={`${q.id}-l`} className={`${field} min-h-[88px]`} maxLength={2000} value={(a[q.id] as string) ?? ""} onChange={(e) => setA({ ...a, [q.id]: e.target.value })} />}
          {q.type === "single" && <select aria-labelledby={`${q.id}-l`} className={field} value={(a[q.id] as string) ?? ""} onChange={(e) => setA({ ...a, [q.id]: e.target.value })}><option value="">Choose…</option>{q.options!.map((o) => <option key={o}>{o}</option>)}</select>}
          {q.type === "multi" && <div role="group" aria-labelledby={`${q.id}-l`} className="mt-2 space-y-1">{q.options!.map((o) => { const cur = (a[q.id] as string[]) ?? []; return (
            <label key={o} className="flex min-h-[44px] items-center gap-3 font-body text-sm"><input type="checkbox" className="h-5 w-5" checked={cur.includes(o)} onChange={() => setA({ ...a, [q.id]: cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o] })} />{o}</label>); })}</div>}
        </div>))}
      <button type="submit" disabled={busy} className="min-h-[44px] rounded-full bg-[#630000] px-6 font-ui text-sm font-bold text-white">Send to my instructor</button>
      {err && <p role="alert" className="font-ui text-sm text-[#9b1c1c]">{err}</p>}
    </form>
  );
}
