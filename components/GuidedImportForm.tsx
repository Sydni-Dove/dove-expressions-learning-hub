"use client";

import { useState } from "react";

interface Summary { title: string; version: string; sections: number; pages: number; questions: number; checks: number; exercises: number }

function summarize(json: any): Summary | null {
  if (!json || !Array.isArray(json.sections)) return null;
  const s = json.sections as any[];
  return {
    title: String(json.title ?? ""),
    version: String(json.version ?? ""),
    sections: s.length,
    pages: s.reduce((n, x) => n + (x.pages?.length ?? 0), 0),
    questions: s.reduce((n, x) => n + (x.questions?.length ?? 0), 0),
    checks: s.filter((x) => x.knowledgeCheck).length,
    exercises: s.filter((x) => x.exercise).length
  };
}

/**
 * Staff import of a guided-course JSON file. The file is read in the browser and sent straight to the
 * authorized import route — it is never stored in the code repository.
 */
export default function GuidedImportForm({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [payload, setPayload] = useState<any>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, any> | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    setPayload(null);
    setSummary(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const json = JSON.parse(await file.text());
      const s = summarize(json);
      if (!s || s.sections === 0) throw new Error("This file has no sections.");
      setPayload(json);
      setSummary(s);
    } catch (err: any) {
      setError(`Couldn't read that file: ${err?.message ?? "not valid JSON"}`);
    }
  }

  async function run() {
    if (!payload) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/staff/guided-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, payload, options: note.trim() ? { note: note.trim() } : {} })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "The import failed. Nothing was changed.");
      return;
    }
    setResult(data.result);
  }

  return (
    <div className="space-y-4" data-testid="guided-import">
      <div className="card space-y-3 p-5">
        <label htmlFor="guided-file" className="block font-ui text-sm font-semibold text-charcoal">Course file (JSON)</label>
        <input id="guided-file" type="file" accept="application/json,.json" onChange={onFile} className="font-ui text-sm" data-testid="guided-file" />
        {summary && (
          <div className="rounded-control bg-charcoal/[0.04] p-3 font-ui text-sm" data-testid="guided-summary">
            <p><strong>{fileName}</strong>{summary.title ? ` — ${summary.title}` : ""}{summary.version ? ` (${summary.version})` : ""}</p>
            <p className="mt-1">{summary.sections} sections · {summary.pages} teaching pages · {summary.questions} reflection questions · {summary.checks} knowledge checks · {summary.exercises} exercises</p>
          </div>
        )}
        <label htmlFor="guided-note" className="block font-ui text-sm font-semibold text-charcoal">Note for the version history (optional)</label>
        <input id="guided-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="input w-full" placeholder="e.g. New edition from my November notes" />
        <p className="font-ui text-xs text-charcoal/60">
          This updates <strong>{courseTitle}</strong> as a draft. Anything already in these lessons is archived first (never deleted), nothing is published, and nobody is enrolled.
        </p>
        <button type="button" className="btn-primary" disabled={!payload || busy} onClick={run} data-testid="guided-run">{busy ? "Importing…" : "Import as new draft version"}</button>
        {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]" data-testid="guided-error">{error}</p>}
      </div>
      {result && (
        <div role="status" className="card border-green-600/30 bg-green-50 p-5 font-ui text-sm text-green-900" data-testid="guided-result">
          <p className="font-bold">Imported as a draft.</p>
          <ul className="mt-2 list-disc pl-5">
            <li>{result.sections} sections, {result.pages} pages, {result.questions} questions, {result.checks} checks, {result.exercises} exercises</li>
            <li>{result.archivedLessonVersions} earlier lesson version(s) archived</li>
            <li>{result.emptyModulesArchived} old empty module(s) moved to the archive</li>
            {result.lessonsNotInThisEdition > 0 && <li>{result.lessonsNotInThisEdition} existing lesson(s) not part of this edition were left untouched</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
