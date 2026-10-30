"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration, listPending, pickRecorderType, removePending, savePending, uploadWithProgress, type PendingTake } from "@/lib/recording-client";

export const LABELS = ["Verse", "Chorus", "Bridge", "Warmup", "Pitch exercise", "Breath exercise", "Song", "Personal practice", "Other"];
export interface Limits { recommendedMinutes: number; warnMinutes: number; maxMinutes: number; maxMb: number }
export interface AssignmentOption { id: string; title: string; lessonId: string | null }

type Phase = "idle" | "recording" | "ready" | "uploading" | "failed" | "saved";

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch { return { ok: false, data: { error: "You appear to be offline." } as never }; }
}

/** Record in the app (works in iPhone Safari and the installed PWA) or choose an existing audio/video file. Always saves privately first. */
export default function PracticeRecorder({ assignments, limits, initialAssignmentId = "", reviseOf = null, reviseLabel }: {
  assignments: AssignmentOption[]; limits: Limits; initialAssignmentId?: string; reviseOf?: string | null; reviseLabel?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [assignmentId, setAssignmentId] = useState(initialAssignmentId);
  const [label, setLabel] = useState(reviseLabel ?? "Warmup");
  const [title, setTitle] = useState("");
  const [part, setPart] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<PendingTake[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const blobRef = useRef<{ blob: Blob; type: string; duration: number } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const refreshPending = useCallback(async () => setPending(await listPending()), []);
  useEffect(() => {
    refreshPending();
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); stopTimer(); stream.current?.getTracks().forEach((t) => t.stop()); };
  }, [refreshPending]);

  const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const assignment = assignments.find((a) => a.id === assignmentId);
  const canRecord = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  async function start() {
    setMessage("");
    const type = pickRecorderType((t) => MediaRecorder.isTypeSupported(t));
    if (!type) { setMessage("This browser cannot record audio. Choose a file instead."); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
    } catch { setMessage("Microphone access was blocked. Allow the microphone in your browser or phone settings, or choose a file instead."); return; }
    chunks.current = [];
    const r = new MediaRecorder(stream.current, { mimeType: type });
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      const duration = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
      const blob = new Blob(chunks.current, { type });
      blobRef.current = { blob, type, duration };
      setPreviewUrl(URL.createObjectURL(blob)); setSeconds(duration); setPhase("ready");
    };
    recorder.current = r; startedAt.current = Date.now(); r.start(1000);
    setSeconds(0); setPhase("recording");
    timer.current = setInterval(() => {
      const s = Math.round((Date.now() - startedAt.current) / 1000); setSeconds(s);
      if (s >= limits.maxMinutes * 60) stop();
    }, 500);
  }
  function stop() { stopTimer(); if (recorder.current?.state === "recording") recorder.current.stop(); }

  function chooseFile(file: File | undefined) {
    if (!file) return;
    const type = (file.type || "").split(";")[0];
    if (!/^(audio|video)\//.test(type)) { setMessage("Choose an audio or video recording."); return; }
    if (file.size > limits.maxMb * 1048576) { setMessage(`That file is larger than ${limits.maxMb} MB. Record a shorter part.`); return; }
    blobRef.current = { blob: file, type, duration: 0 };
    setPreviewUrl(URL.createObjectURL(file)); setSeconds(0); setPhase("ready"); setMessage("");
    const probe = document.createElement("audio"); probe.preload = "metadata"; probe.src = URL.createObjectURL(file);
    probe.onloadedmetadata = () => { if (Number.isFinite(probe.duration)) { blobRef.current!.duration = Math.round(probe.duration); setSeconds(Math.round(probe.duration)); } };
  }

  /** Reserve -> upload -> confirm. The take is stored on this device first, so any failure can simply be retried. */
  async function send(take: { blob: Blob; type: string; duration: number }, meta: Omit<PendingTake, "key" | "blob" | "contentType" | "durationSeconds" | "createdAt">, key: string) {
    setPhase("uploading"); setProgress(0); setMessage("");
    if (!navigator.onLine) { setPhase("failed"); setMessage("You are offline. Your recording is saved on this device; retry when you are back online."); return; }
    const begin = await post<{ id: string; uploadUrl: string; contentType: string }>("/api/recordings/begin", {
      assignmentId: meta.assignmentId, lessonId: meta.lessonId, label: meta.label, title: meta.title, part: meta.part, contentType: take.type, size: take.blob.size,
      durationSeconds: take.duration || undefined, reviseOf: meta.reviseOf });
    if (!begin.ok) { setPhase("failed"); setMessage(begin.data.error ?? "Could not start the upload."); if (/maximum|already has|larger|returned for revision|enrollment|Choose/i.test(begin.data.error ?? "")) await removePending(key); await refreshPending(); return; }
    const up = await uploadWithProgress(begin.data.uploadUrl, take.blob, begin.data.contentType, setProgress);
    if (!up.ok) {
      // The reserved row stays "pending" and is cleaned up automatically; retry reserves a fresh one.
      setPhase("failed"); setMessage(up.message); await refreshPending(); return;
    }
    const done = await post("/api/recordings/complete", { id: begin.data.id, durationSeconds: take.duration || undefined });
    if (!done.ok) { setPhase("failed"); setMessage(done.data.error ?? "Could not confirm the upload."); return; }
    await removePending(key); await refreshPending();
    setPhase("saved"); setMessage("Saved privately. Submit it for feedback when you are ready.");
    setPart((p) => p + 1); blobRef.current = null; setPreviewUrl(""); router.refresh();
  }

  async function saveCurrent() {
    const take = blobRef.current; if (!take) return;
    const meta = { label, title: title.trim(), part, assignmentId: assignmentId || null, lessonId: assignment?.lessonId ?? null, reviseOf };
    const key = `${Date.now()}-${part}`;
    await savePending({ key, blob: take.blob, contentType: take.type, durationSeconds: take.duration, createdAt: Date.now(), ...meta });
    await refreshPending();
    await send(take, meta, key);
  }
  async function retryPending(t: PendingTake) {
    await send({ blob: t.blob, type: t.contentType, duration: t.durationSeconds }, { label: t.label, title: t.title, part: t.part, assignmentId: t.assignmentId, lessonId: t.lessonId, reviseOf: t.reviseOf }, t.key);
  }
  async function discardPending(key: string) { await removePending(key); await refreshPending(); }
  function reset() { blobRef.current = null; setPreviewUrl(""); setSeconds(0); setPhase("idle"); setMessage(""); }

  const mins = seconds / 60;
  const advice = mins > limits.maxMinutes ? "over" : mins > limits.warnMinutes ? "long" : mins > limits.recommendedMinutes ? "past" : "ok";
  const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-[#630000]/25 bg-white px-3 py-2 font-body text-base text-[#201414]";

  return (
    <section aria-labelledby="record-heading" className="rounded-2xl border border-[#630000]/15 bg-white p-4 sm:p-6">
      <h2 id="record-heading" className="font-display text-2xl text-[#630000]">{reviseOf ? "Record a revised take" : "Record or upload"}</h2>
      <p className="mt-1 font-body text-sm text-[#4a3a3a]">Aim for {limits.recommendedMinutes} minutes or less. Several short recordings are better than one long one — save each part separately.</p>
      {!online && <p role="status" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 font-ui text-sm text-amber-900">You are offline. You can still record; uploads will wait until you are connected.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {!reviseOf && (
          <label className="font-ui text-sm font-semibold text-[#630000]">Assignment
            <select className={field} value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
              <option value="">Personal practice (no assignment)</option>
              {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </label>)}
        <label className="font-ui text-sm font-semibold text-[#630000]">Label
          <select className={field} value={label} onChange={(e) => setLabel(e.target.value)}>{LABELS.map((l) => <option key={l}>{l}</option>)}</select>
        </label>
        <label className="font-ui text-sm font-semibold text-[#630000]">Title (optional)
          <input className={field} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Verse 1, slower tempo" />
        </label>
        {!reviseOf && (
          <label className="font-ui text-sm font-semibold text-[#630000]">Part number
            <input className={field} type="number" min={1} max={50} value={part} onChange={(e) => setPart(Math.max(1, Number(e.target.value) || 1))} />
          </label>)}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {phase === "idle" && canRecord && <button type="button" onClick={start} className="min-h-[44px] rounded-full bg-[#630000] px-6 py-3 font-ui text-sm font-bold text-white">Start recording</button>}
        {phase === "recording" && <button type="button" onClick={stop} className="min-h-[44px] rounded-full bg-[#9b1c1c] px-6 py-3 font-ui text-sm font-bold text-white">Stop</button>}
        {(phase === "idle" || phase === "saved") && (
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-[#630000]/40 px-5 py-3 font-ui text-sm font-semibold text-[#630000]">
            Choose an audio or video file
            <input type="file" accept="audio/*,video/*,.m4a,.mp3,.wav,.mp4,.mov,.webm" className="sr-only" onChange={(e) => chooseFile(e.target.files?.[0])} />
          </label>)}
        {phase === "recording" && <span role="timer" aria-live="off" className="font-mono text-lg text-[#630000]">● {formatDuration(seconds)}</span>}
      </div>
      {!canRecord && phase === "idle" && <p className="mt-2 font-body text-sm text-[#4a3a3a]">In-app recording is not available in this browser. Record with your phone&apos;s voice memo app and choose the file.</p>}

      {(phase === "recording" || phase === "ready") && mins > limits.recommendedMinutes && (
        <p role="alert" className={`mt-3 rounded-xl px-3 py-2 font-ui text-sm ${advice === "ok" ? "" : advice === "past" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-900"}`}>
          {advice === "over" ? `This is longer than ${limits.maxMinutes} minutes and cannot be uploaded. Save it as separate parts.` : advice === "long" ? `This recording is getting long (${formatDuration(seconds)}). Consider stopping and saving it as Part ${part}, then starting the next part.` : `You have passed the recommended ${limits.recommendedMinutes} minutes.`}
        </p>)}

      {phase === "ready" && previewUrl && (
        <div className="mt-4 space-y-3">
          <p className="font-ui text-sm font-semibold text-[#630000]">Listen before saving ({formatDuration(seconds)})</p>
          <audio controls src={previewUrl} className="w-full" />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={saveCurrent} disabled={mins > limits.maxMinutes} className="min-h-[44px] rounded-full bg-[#630000] px-6 py-3 font-ui text-sm font-bold text-white disabled:opacity-50">Save privately</button>
            <button type="button" onClick={reset} className="min-h-[44px] rounded-full border border-[#630000]/40 px-5 py-3 font-ui text-sm font-semibold text-[#630000]">Record again</button>
          </div>
        </div>)}

      {phase === "uploading" && (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="h-3 overflow-hidden rounded-full bg-[#F2DFD8]"><div className="h-full bg-[#630000] transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p className="mt-1 font-ui text-sm text-[#630000]">Uploading… {Math.round(progress * 100)}%. Keep this page open.</p>
        </div>)}
      {message && <p role="status" className={`mt-3 font-ui text-sm ${phase === "failed" ? "text-[#9b1c1c]" : "text-[#630000]"}`}>{message}</p>}

      {pending.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <h3 className="font-ui text-sm font-bold text-amber-900">Waiting to upload ({pending.length})</h3>
          <ul className="mt-2 space-y-2">
            {pending.map((t) => (
              <li key={t.key} className="flex flex-wrap items-center gap-2 font-body text-sm text-amber-950">
                <span>{t.label}{t.title ? ` — ${t.title}` : ""} · part {t.part} · {formatDuration(t.durationSeconds)}</span>
                <button type="button" disabled={phase === "uploading" || !online} onClick={() => retryPending(t)} className="min-h-[44px] rounded-full bg-[#630000] px-4 font-ui text-xs font-bold text-white disabled:opacity-50">Retry upload</button>
                <button type="button" onClick={() => discardPending(t.key)} className="min-h-[44px] px-3 font-ui text-xs font-semibold text-[#630000] underline">Remove from this device</button>
              </li>))}
          </ul>
        </div>)}
    </section>
  );
}
