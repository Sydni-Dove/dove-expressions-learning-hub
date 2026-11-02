"use client";

import { useMemo, useState } from "react";
import { ALL_AREAS, LEVELS, TRACK_META, type Level } from "@/lib/voice-curriculum";

/** Interactive curriculum for instructors: filter by area, level and optional track; expand to teaching outline, exercises, coaching notes, assignments, progress and follow-up. */
export default function CurriculumBrowser() {
  const [q, setQ] = useState(""); const [level, setLevel] = useState<Level | "all">("all"); const [scope, setScope] = useState<"all" | "core" | "tracks">("all");
  const areas = useMemo(() => ALL_AREAS.filter((a) => (scope === "all" || (scope === "tracks") === !!a.track) && (`${a.title} ${a.keywords.join(" ")}`.toLowerCase().includes(q.toLowerCase()))), [q, scope]);
  const field = "min-h-[44px] rounded-xl border border-charcoal/25 bg-white px-3 font-body text-sm";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="font-ui text-xs font-semibold">Search<input className={`${field} mt-1 block`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="breath, pitch, ad-lib…" /></label>
        <label className="font-ui text-xs font-semibold">Level<select className={`${field} mt-1 block`} value={level} onChange={(e) => setLevel(e.target.value as never)}><option value="all">All levels</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
        <label className="font-ui text-xs font-semibold">Show<select className={`${field} mt-1 block`} value={scope} onChange={(e) => setScope(e.target.value as never)}><option value="all">Core and optional tracks</option><option value="core">12 core areas</option><option value="tracks">Optional tracks only</option></select></label>
      </div>
      <p className="font-body text-sm text-charcoal/70" aria-live="polite">{areas.length} area{areas.length === 1 ? "" : "s"}</p>
      {areas.map((a) => (
        <details key={a.key} className="card p-4">
          <summary className="min-h-[44px] cursor-pointer font-display text-xl text-burgundy">{a.number}. {a.title}{a.track && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-ui text-xs text-amber-900">Optional track · {TRACK_META[a.track].title}</span>}</summary>
          <div className="mt-3 space-y-4 font-body text-sm">
            <p>{a.instructorSummary}</p>
            {a.instructorCaution && <p className="rounded-xl bg-amber-50 p-3 text-amber-900"><strong>Caution: </strong>{a.instructorCaution}</p>}
            <div><h3 className="font-ui font-bold">Initial assessment</h3><ul className="list-disc pl-5">{a.assessment.tasks.map((t) => <li key={t}>{t}</li>)}</ul><p className="mt-1 font-semibold">Observable indicators</p><ul className="list-disc pl-5">{a.assessment.indicators.map((t) => <li key={t}>{t}</li>)}</ul></div>
            {LEVELS.filter((l) => level === "all" || l === level).map((l) => <div key={l}><h3 className="font-ui font-bold capitalize">{l}: {a.levels[l].focus}</h3><ul className="list-disc pl-5">{a.levels[l].goals.map((g) => <li key={g}>{g}</li>)}</ul></div>)}
            <div><h3 className="font-ui font-bold">Teaching outline</h3><ol className="list-decimal pl-5">{a.outline.map((t) => <li key={t}>{t}</li>)}</ol></div>
            <div><h3 className="font-ui font-bold">Exercises</h3>
              {a.exercises.filter((e) => level === "all" || e.level === level || e.level === "all").map((e) => (
                <details key={e.key} className="mt-2 rounded-xl border border-charcoal/15 p-3"><summary className="min-h-[44px] cursor-pointer font-semibold">{e.title} <span className="font-normal text-charcoal/60">({e.level}, {e.minutes} min){e.onlyOnRequest ? " · only on the student's explicit request" : ""}</span></summary>
                  <p className="mt-2"><strong>Student instructions: </strong>{e.student}</p><p className="mt-1"><strong>Demonstrate: </strong>{e.demonstrate}</p><p className="mt-1"><strong>Coach: </strong>{e.coach}</p>
                  <p className="mt-1 font-semibold">Common difficulties</p><ul className="list-disc pl-5">{e.difficulties.map((d) => <li key={d.issue}>{d.issue} → {d.adjust}</li>)}</ul>{e.safety && <p className="mt-1 text-amber-900">{e.safety}</p>}</details>))}</div>
            <div><h3 className="font-ui font-bold">Practice assignments</h3><ul className="list-disc pl-5">{a.assignments.filter((x) => level === "all" || x.level === level || x.level === "all").map((x) => <li key={x.key}><strong>{x.title}</strong> ({x.level}, {x.minutes} min): {x.steps.join(" → ")}</li>)}</ul></div>
            <div><h3 className="font-ui font-bold">Measurable progress</h3><ul className="list-disc pl-5">{a.progress.map((p) => <li key={p.indicator}>{p.indicator} — {p.measure}</li>)}</ul></div>
            <div><h3 className="font-ui font-bold">Follow-up assessment ({a.followUp.when})</h3><ul className="list-disc pl-5">{a.followUp.tasks.map((t) => <li key={t}>{t}</li>)}</ul><p className="mt-1 font-semibold">What improvement looks like</p><ul className="list-disc pl-5">{a.followUp.looksLike.map((t) => <li key={t}>{t}</li>)}</ul></div>
            {a.scripture && <div><h3 className="font-ui font-bold">Scripture</h3><ul className="list-disc pl-5">{a.scripture.map((s) => <li key={s.ref}><strong>{s.ref}</strong>: {s.use}</li>)}</ul></div>}
          </div>
        </details>))}
    </div>
  );
}
