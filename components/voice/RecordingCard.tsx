"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/recording-client";

export interface RecordingRow {
  id: string; label: string; title: string; part_no: number; revision_no: number; status: string; duration_seconds: number | null;
  created_at: string; submitted_at: string | null; assignmentTitle: string | null; studentName?: string;
  feedback: { id: string; kind: string; body: string; follow_up: string | null; created_at: string }[];
}
const STATUS: Record<string, { text: string; cls: string }> = {
  pending: { text: "Uploading", cls: "bg-amber-100 text-amber-900" },
  saved: { text: "Saved privately", cls: "bg-[#F2DFD8] text-[#630000]" },
  submitted: { text: "Submitted", cls: "bg-blue-100 text-blue-900" },
  reviewed: { text: "Reviewed", cls: "bg-green-100 text-green-900" },
  returned: { text: "Returned for revision", cls: "bg-red-100 text-red-900" }
};

/** One recording: stream it (no download), see its history and feedback, and take the next action. */
export default function RecordingCard({ rec, mode, onRevise }: { rec: RecordingRow; mode: "student" | "staff"; onRevise?: (r: RecordingRow) => void }) {
  const router = useRouter();
  const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(""); const [followUp, setFollowUp] = useState("");
  const st = STATUS[rec.status] ?? STATUS.saved;

  async function load() {
    setError(""); setBusy(true);
    const res = await fetch(`/api/recordings/${rec.id}/playback`).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError("Could not load this recording. Check your connection and try again."); return; }
    setUrl((await res.json()).url);
  }
  async function act(path: string, body: unknown) {
    setBusy(true); setError("");
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError((await res?.json().catch(() => ({})))?.error ?? "That did not go through. Try again."); return false; }
    router.refresh(); return true;
  }

  return (
    <li className="rounded-2xl border border-[#630000]/15 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-ui text-sm font-bold text-[#630000]">{rec.label}{rec.title ? ` — ${rec.title}` : ""}</span>
        <span className={`rounded-full px-2.5 py-1 font-ui text-xs font-semibold ${st.cls}`}>{st.text}</span>
        <span className="font-body text-xs text-[#4a3a3a]">Part {rec.part_no}{rec.revision_no > 1 ? ` · Revision ${rec.revision_no}` : ""}{rec.duration_seconds ? ` · ${formatDuration(rec.duration_seconds)}` : ""} · {new Date(rec.created_at).toLocaleDateString()}</span>
      </div>
      {mode === "staff" && <p className="mt-1 font-body text-xs text-[#4a3a3a]">{rec.studentName ?? "Student"}{rec.assignmentTitle ? ` · ${rec.assignmentTitle}` : ""}</p>}
      <div className="mt-3">
        {url ? <audio controls autoPlay src={url} className="w-full" controlsList="nodownload" onError={() => { setUrl(""); setError("The link expired. Press play again."); }} />
          : <button type="button" onClick={load} disabled={busy || rec.status === "pending"} className="min-h-[44px] rounded-full bg-[#630000] px-5 font-ui text-sm font-bold text-white disabled:opacity-50">{busy ? "Loading…" : "Play"}</button>}
      </div>
      {rec.feedback.length > 0 && (
        <div className="mt-3 space-y-2" aria-label="Feedback history">
          {rec.feedback.map((f) => (
            <blockquote key={f.id} className="rounded-xl bg-[#FBF4F1] p-3 font-body text-sm text-[#201414]">
              <p className="font-ui text-xs font-semibold text-[#630000]">{f.kind === "return_for_revision" ? "Returned for revision" : "Feedback"} · {new Date(f.created_at).toLocaleDateString()}</p>
              <p className="mt-1 whitespace-pre-wrap">{f.body}</p>
              {f.follow_up && <p className="mt-2 font-semibold">Next practice: <span className="font-normal">{f.follow_up}</span></p>}
            </blockquote>))}
        </div>)}
      {mode === "student" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {rec.status === "saved" && <button type="button" disabled={busy} onClick={() => act("/api/recordings/submit", { ids: [rec.id] })} className="min-h-[44px] rounded-full bg-[#630000] px-5 font-ui text-sm font-bold text-white">Submit for feedback</button>}
          {rec.status === "saved" && <button type="button" disabled={busy} onClick={() => confirm("Remove this unsubmitted recording?") && act("/api/recordings/discard", { id: rec.id })} className="min-h-[44px] px-4 font-ui text-sm font-semibold text-[#630000] underline">Remove draft</button>}
          {rec.status === "returned" && onRevise && <button type="button" onClick={() => onRevise(rec)} className="min-h-[44px] rounded-full bg-[#630000] px-5 font-ui text-sm font-bold text-white">Record a revised take</button>}
          {["submitted", "reviewed"].includes(rec.status) && <p className="font-body text-xs text-[#4a3a3a]">Your submitted recording is kept as originally sent.</p>}
        </div>)}
      {mode === "staff" && rec.status === "submitted" && (
        <form className="mt-3 space-y-2" onSubmit={(e) => e.preventDefault()}>
          <label className="block font-ui text-sm font-semibold text-[#630000]">Feedback
            <textarea className="mt-1 block min-h-[96px] w-full rounded-xl border border-[#630000]/25 p-3 font-body text-base" value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={4000} />
          </label>
          <label className="block font-ui text-sm font-semibold text-[#630000]">Follow-up exercise (optional)
            <input className="mt-1 block min-h-[44px] w-full rounded-xl border border-[#630000]/25 px-3 font-body text-base" value={followUp} onChange={(e) => setFollowUp(e.target.value)} maxLength={1000} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !feedback.trim()} onClick={() => act("/api/recordings/review", { id: rec.id, outcome: "reviewed", feedback, followUp: followUp || undefined })} className="min-h-[44px] rounded-full bg-[#630000] px-5 font-ui text-sm font-bold text-white disabled:opacity-50">Send feedback</button>
            <button type="button" disabled={busy || !feedback.trim()} onClick={() => act("/api/recordings/review", { id: rec.id, outcome: "returned", feedback, followUp: followUp || undefined })} className="min-h-[44px] rounded-full border border-[#630000]/40 px-5 font-ui text-sm font-semibold text-[#630000] disabled:opacity-50">Return for revision</button>
          </div>
        </form>)}
      {error && <p role="alert" className="mt-2 font-ui text-sm text-[#9b1c1c]">{error}</p>}
    </li>
  );
}
