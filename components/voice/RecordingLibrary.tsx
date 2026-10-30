"use client";

import { useState } from "react";
import PracticeRecorder, { type AssignmentOption, type Limits } from "./PracticeRecorder";
import RecordingCard, { type RecordingRow } from "./RecordingCard";

/** Student view: recorder plus the library grouped by assignment. Revising a returned take reuses its assignment and part. */
export default function RecordingLibrary({ recordings, assignments, limits }: { recordings: RecordingRow[]; assignments: AssignmentOption[]; limits: Limits }) {
  const [revising, setRevising] = useState<RecordingRow | null>(null);
  const groups = new Map<string, RecordingRow[]>();
  for (const r of recordings) { const k = r.assignmentTitle ?? "Personal practice"; groups.set(k, [...(groups.get(k) ?? []), r]); }
  return (
    <div className="space-y-8">
      <PracticeRecorder key={revising?.id ?? "new"} assignments={assignments} limits={limits} reviseOf={revising?.id ?? null} reviseLabel={revising?.label} />
      {revising && <p className="font-body text-sm text-[#630000]">Revising “{revising.label}” part {revising.part_no}. Your original stays on file. <button className="min-h-[44px] underline" onClick={() => setRevising(null)}>Cancel</button></p>}
      {recordings.length === 0 && <p className="rounded-2xl border border-dashed border-[#630000]/30 p-6 text-center font-body text-[#4a3a3a]">No recordings yet. Your first one is private until you choose to submit it.</p>}
      {[...groups.entries()].map(([title, rows]) => (
        <section key={title} aria-label={title}>
          <h2 className="font-display text-xl text-[#630000]">{title}</h2>
          <ul className="mt-3 space-y-3">
            {rows.map((r) => <RecordingCard key={r.id} rec={r} mode="student" onRevise={(x) => { setRevising(x); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}
          </ul>
        </section>))}
    </div>
  );
}
