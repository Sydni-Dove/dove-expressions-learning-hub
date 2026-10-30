"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/voice-rpc";
import {
  ASSESSMENTS, OBSERVATION_DIMENSIONS, OBSERVATION_LEVELS, PACKAGE_LESSONS, assignableKinds, draftPlan, parseIntakeCsv, requestedTracks,
  type AssessmentKind, type PackageType, type PlanInput, type PlanUnit
} from "@/lib/voice-assessments";
import { ALL_AREAS, LEVELS, TRACK_META, TRACK_KEYS, areaByKey, type Level, type TrackKey } from "@/lib/voice-curriculum";

const btn = "min-h-[44px] rounded-full bg-[#630000] px-5 font-ui text-sm font-bold text-white disabled:opacity-50";
const btn2 = "min-h-[44px] rounded-full border border-[#630000]/50 px-5 font-ui text-sm font-semibold text-[#630000] disabled:opacity-50";
const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-[#630000]/25 bg-white px-3 py-2 font-body text-base text-[#201414]";

function useAct() {
  const router = useRouter();
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function run(name: string, args: Record<string, unknown>, ok: string) {
    setBusy(true); setErr(""); setMsg("");
    const r = await callRpc(name, args);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return null; }
    setMsg(ok); router.refresh(); return r.data;
  }
  const status = <>{msg && <p role="status" className="font-ui text-sm text-[#630000]">{msg}</p>}{err && <p role="alert" className="font-ui text-sm text-[#9b1c1c]">{err}</p>}</>;
  return { run, busy, status, setErr, setMsg };
}

export function TrackApproval({ studentId, selected, approved, tongues }: { studentId: string; selected: TrackKey[]; approved: TrackKey[]; tongues: boolean }) {
  const [ap, setAp] = useState<TrackKey[]>(approved); const { run, busy, status } = useAct();
  return (
    <div className="space-y-2">
      <p className="font-body text-sm text-[#4a3a3a]">A track enters a plan only when the student has chosen it and you approve it. Student's choices: {selected.length ? selected.map((k) => TRACK_META[k].title).join(", ") : "none"}.</p>
      {TRACK_KEYS.map((k) => (
        <label key={k} className={`flex min-h-[44px] items-center gap-3 font-body text-sm ${selected.includes(k) ? "" : "opacity-50"}`}>
          <input type="checkbox" className="h-5 w-5" disabled={!selected.includes(k)} checked={ap.includes(k)} onChange={() => setAp(ap.includes(k) ? ap.filter((x) => x !== k) : [...ap, k])} />{TRACK_META[k].title}{!selected.includes(k) && " (not chosen by the student)"}
        </label>))}
      {tongues && <p className="rounded-xl bg-[#FBF4F1] p-2 font-body text-sm">The student explicitly requested singing in tongues. Honour their stated tradition; it is never a requirement.</p>}
      <button className={btn} disabled={busy} onClick={() => run("dp_voice_approve_tracks", { student: studentId, tracks: ap }, "Approvals saved.")}>Save approvals</button>{status}
    </div>
  );
}

export function AssignAssessment({ studentId, selected }: { studentId: string; selected: TrackKey[] }) {
  const ok = assignableKinds(selected); const { run, busy, status } = useAct(); const [kind, setKind] = useState<AssessmentKind | "">("");
  return (
    <div className="space-y-2">
      <label className="font-ui text-sm font-semibold text-[#630000]">Assign an assessment
        <select className={field} value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
          <option value="">Choose…</option>
          {Object.values(ASSESSMENTS).map((d) => <option key={d.kind} value={d.kind} disabled={!ok.includes(d.kind)}>{d.title}{d.status === "awaiting_source" ? " — awaiting the source document" : d.requiresTrack && !ok.includes(d.kind) ? " — student has not chosen Prophetic Worship Development" : ""}</option>)}
        </select></label>
      <button className={btn} disabled={busy || !kind} onClick={() => run("dp_assessment_assign", { student: studentId, assessment_kind: kind }, "Assigned.")}>Assign</button>{status}
    </div>
  );
}

export function ReviewAssessment({ id, kind, existingObs, existingNotes, existingSummary }: { id: string; kind: AssessmentKind; existingObs: Record<string, string>; existingNotes: string; existingSummary: string }) {
  const [obs, setObs] = useState<Record<string, string>>(existingObs); const [notes, setNotes] = useState(existingNotes); const [summary, setSummary] = useState(existingSummary);
  const { run, busy, status } = useAct();
  return (
    <div className="space-y-3">
      {kind === "creative_expression" && (
        <fieldset className="space-y-2"><legend className="font-ui text-sm font-semibold text-[#630000]">What you heard (private)</legend>
          {OBSERVATION_DIMENSIONS.map((d) => (
            <label key={d.id} className="block font-body text-sm">{d.label}
              <select className={field} value={obs[d.id] ?? "Not yet observed"} onChange={(e) => setObs({ ...obs, [d.id]: e.target.value })}>{OBSERVATION_LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>))}
        </fieldset>)}
      <label className="block font-ui text-sm font-semibold text-[#630000]">Private notes (staff only)<textarea className={`${field} min-h-[96px]`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={8000} /></label>
      <label className="block font-ui text-sm font-semibold text-[#630000]">Summary to share with the student (optional; leave empty to share nothing)<textarea className={`${field} min-h-[96px]`} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={4000} /></label>
      <button className={btn} disabled={busy} onClick={() => run("dp_assessment_review", { aid: id, obs, private_notes: notes, summary_for_student: summary || null }, "Review saved.")}>Save review</button>{status}
    </div>
  );
}

export interface UnitRow extends PlanUnit { id?: string; status?: string; assigned_assignment_id?: string | null }
export function PlanBuilder({ studentId, studentName, input, existing }: {
  studentId: string; studentName: string; input: Omit<PlanInput, "packageType">; existing: { id: string; title: string; status: string; package_type: PackageType; units: UnitRow[]; rationale: Record<string, string[]> } | null;
}) {
  const { run, busy, status, setErr } = useAct();
  const [pkg, setPkg] = useState<PackageType>(existing?.package_type ?? "monthly");
  const [units, setUnits] = useState<UnitRow[]>(existing?.units ?? []);
  const [rationale, setRationale] = useState<Record<string, string[]>>(existing?.rationale ?? {});
  const [due, setDue] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string[]>([]);
  const locked = existing && existing.status !== "draft";
  const tongues = input.selectedTracks?.includes("prophetic_worship") && !!(input as { tonguesRequested?: boolean }).tonguesRequested;

  function generate() {
    const d = draftPlan({ ...input, packageType: pkg });
    setUnits(d.units); setRationale(Object.fromEntries(d.units.map((u) => [String(u.seq), u.rationale]))); setHeld(d.tracksHeldBack.map((h) => `${TRACK_META[h.track].title}: ${h.reason}`));
  }
  const upd = (i: number, p: Partial<UnitRow>) => setUnits((us) => us.map((u, j) => (j === i ? { ...u, ...p } : u)));
  async function save() {
    const payload = units.map((u, i) => ({ seq: i + 1, week: u.week, area_key: u.areaKey, area_title: u.areaTitle, level: u.level, objective: u.objective, exercise_keys: u.exerciseKeys, assignment_key: u.assignmentKey, checkpoint: u.checkpoint, follow_up: u.followUp, segment_advice: u.segmentAdvice }));
    await run("dp_plan_save", { pid: existing?.id ?? null, student: studentId, plan_title: `Development plan for ${studentName}`, ptype: pkg, units: payload, plan_basis: ["Intake", "Assessments", "Instructor observations"], plan_notes: ["Reviewed and edited by your instructor."], rationale, instructor_notes: null }, "Draft saved. Nothing is visible to the student until you approve it.");
  }
  return (
    <div className="space-y-4">
      {!locked && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="font-ui text-sm font-semibold text-[#630000]">Program
            <select className={field} value={pkg} onChange={(e) => setPkg(e.target.value as PackageType)}>
              <option value="single">Single lesson</option><option value="monthly">Monthly (4 lessons)</option><option value="twelve_week">12-week program</option></select></label>
          <button className={btn2} onClick={generate}>Draft from findings</button>
        </div>)}
      {held.length > 0 && <ul className="rounded-xl bg-amber-50 p-3 font-body text-sm text-amber-900">{held.map((h) => <li key={h}>{h}</li>)}</ul>}
      {units.length === 0 && <p className="font-body text-sm text-[#4a3a3a]">No plan yet. Draft one from the intake, assessments and your observations, then edit anything.</p>}
      <ol className="space-y-3">
        {units.map((u, i) => {
          const area = areaByKey(u.areaKey); const choices = (area?.exercises ?? []).filter((e) => !e.onlyOnRequest || tongues || u.exerciseKeys.includes(e.key));
          return (
            <li key={i} className="rounded-2xl border border-[#630000]/15 bg-white p-3">
              <p className="font-ui text-sm font-bold text-[#630000]">Lesson {u.week}{u.checkpoint ? ` · ${u.checkpoint === "final" ? "Final evaluation" : u.checkpoint === "midpoint" ? "Mid-program check" : "Progress check"}` : ""}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="font-ui text-xs font-semibold">Area<select disabled={!!locked} className={field} value={u.areaKey} onChange={(e) => { const a = areaByKey(e.target.value)!; upd(i, { areaKey: a.key, areaTitle: a.title, objective: a.levels[u.level].goals[0], exerciseKeys: a.exercises.filter((x) => !x.onlyOnRequest && (x.level === u.level || x.level === "all")).slice(0, 3).map((x) => x.key) }); }}>
                  {ALL_AREAS.filter((a) => !a.track || input.selectedTracks?.includes(a.track)).map((a) => <option key={a.key} value={a.key}>{a.number}. {a.title}</option>)}</select></label>
                <label className="font-ui text-xs font-semibold">Level<select disabled={!!locked} className={field} value={u.level} onChange={(e) => upd(i, { level: e.target.value as Level, objective: area?.levels[e.target.value as Level].goals[0] ?? u.objective })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
              </div>
              <label className="mt-2 block font-ui text-xs font-semibold">Objective<input disabled={!!locked} className={field} value={u.objective} onChange={(e) => upd(i, { objective: e.target.value })} /></label>
              <fieldset className="mt-2" disabled={!!locked}><legend className="font-ui text-xs font-semibold">Exercises</legend>
                {choices.map((e) => (<label key={e.key} className="flex min-h-[44px] items-center gap-3 font-body text-sm"><input type="checkbox" className="h-5 w-5" checked={u.exerciseKeys.includes(e.key)} onChange={() => upd(i, { exerciseKeys: u.exerciseKeys.includes(e.key) ? u.exerciseKeys.filter((k) => k !== e.key) : [...u.exerciseKeys, e.key] })} />{e.title} <span className="text-xs text-[#4a3a3a]">({e.level}, {e.minutes} min)</span></label>))}
              </fieldset>
              {(rationale[String(i + 1)] ?? u.rationale ?? []).length > 0 && <p className="mt-1 font-body text-xs text-[#4a3a3a]">Why (private): {(rationale[String(i + 1)] ?? u.rationale).join("; ")}</p>}
              {locked && (u.assigned_assignment_id ? <p className="font-ui text-sm text-[#630000]">Practice assigned.</p> : u.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="font-ui text-xs font-semibold">Due<input type="date" className={field} value={due[u.id] ?? ""} onChange={(e) => setDue({ ...due, [u.id!]: e.target.value })} /></label>
                  <button className={btn} disabled={busy || !due[u.id]} onClick={() => run("dp_plan_assign_unit", { uid: u.id, due: due[u.id!] }, `Practice assigned for lesson ${u.week}.`)}>Assign this lesson&apos;s practice</button>
                </div>))}
              {!locked && <button className="mt-1 min-h-[44px] px-2 font-ui text-xs font-semibold text-[#630000] underline" onClick={() => setUnits(units.filter((_, j) => j !== i))}>Remove lesson</button>}
            </li>);
        })}
      </ol>
      {!locked && units.length > 0 && <div className="flex flex-wrap gap-3"><button className={btn} disabled={busy || units.length > PACKAGE_LESSONS.twelve_week} onClick={save}>Save draft</button>
        {existing && <button className={btn2} disabled={busy} onClick={async () => { if (confirm("Approve this plan and show it to the student?")) await run("dp_plan_activate", { pid: existing.id }, "Plan approved and shared with the student."); }}>Approve and share</button>}</div>}
      {status}
    </div>
  );
}

export function ProgressCheckForm({ planId, weeks }: { planId: string; weeks: number[] }) {
  const { run, busy, status } = useAct();
  const [week, setWeek] = useState(weeks[0] ?? 4); const [kind, setKind] = useState("progress"); const [good, setGood] = useState(""); const [focus, setFocus] = useState(""); const [priv, setPriv] = useState(""); const [share, setShare] = useState(false);
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="font-ui text-sm font-semibold">Week<input type="number" min={1} max={60} className={field} value={week} onChange={(e) => setWeek(Number(e.target.value))} /></label>
        <label className="font-ui text-sm font-semibold">Kind<select className={field} value={kind} onChange={(e) => setKind(e.target.value)}><option value="progress">Progress check</option><option value="midpoint">Mid-program check</option><option value="final">Final evaluation</option><option value="custom">Check-in</option></select></label>
      </div>
      <label className="block font-ui text-sm font-semibold">Going well<textarea className={`${field} min-h-[72px]`} value={good} onChange={(e) => setGood(e.target.value)} /></label>
      <label className="block font-ui text-sm font-semibold">Next focus<textarea className={`${field} min-h-[72px]`} value={focus} onChange={(e) => setFocus(e.target.value)} /></label>
      <label className="block font-ui text-sm font-semibold">Private notes (staff only)<textarea className={`${field} min-h-[72px]`} value={priv} onChange={(e) => setPriv(e.target.value)} /></label>
      <label className="flex min-h-[44px] items-center gap-3 font-body text-sm"><input type="checkbox" className="h-5 w-5" checked={share} onChange={(e) => setShare(e.target.checked)} />Share with the student now</label>
      <button className={btn} disabled={busy} onClick={() => run("dp_progress_check_save", { pid: planId, wk: week, check_kind: kind, rate: {}, good, focus, private_notes: priv, share }, share ? "Saved and shared." : "Saved privately.")}>Save progress check</button>{status}
    </div>
  );
}

export function ImportIntake({ roster }: { roster: { id: string; email: string | null; full_name: string | null }[] }) {
  const { run, busy, status, setErr } = useAct(); const [csv, setCsv] = useState(""); const [report, setReport] = useState<string[]>([]);
  async function go() {
    const parsed = parseIntakeCsv(csv); const lines: string[] = [];
    for (const r of parsed.rows) {
      const s = roster.find((x) => x.email?.toLowerCase() === r.email);
      if (!s) { lines.push(`${r.email}: not enrolled in Voice — skipped`); continue; }
      const res = await run("dp_voice_import_intake", { student: s.id, a: r.answers, requested_tracks: requestedTracks(r.answers), submitted: r.submittedAt ? new Date(r.submittedAt).toISOString() : null }, "");
      lines.push(`${r.email}: ${res ? "imported" : "failed"}`);
    }
    for (const x of parsed.rejected) lines.push(`Line ${x.line}: ${x.reason}`);
    if (parsed.unmatchedColumns.length) lines.push(`Ignored columns: ${parsed.unmatchedColumns.join("; ")}`);
    if (!parsed.rows.length && !parsed.rejected.length) setErr("No rows found. Paste the CSV exported from Google Forms, including the header row.");
    setReport(lines);
  }
  return (
    <div className="space-y-2">
      <label className="block font-ui text-sm font-semibold text-[#630000]">Paste the Google Forms responses (CSV)<textarea className={`${field} min-h-[120px] font-mono text-xs`} value={csv} onChange={(e) => setCsv(e.target.value)} /></label>
      <button className={btn} disabled={busy || !csv.trim()} onClick={go}>Import</button>
      {report.length > 0 && <ul className="font-body text-sm" aria-label="Import results">{report.map((l) => <li key={l}>{l}</li>)}</ul>}{status}
    </div>
  );
}
