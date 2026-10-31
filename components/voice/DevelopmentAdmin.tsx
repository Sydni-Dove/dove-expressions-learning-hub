"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/voice-rpc";
import {
  ASSESSMENTS, IMPORT_FIELDS, OBSERVATION_DIMENSIONS, OBSERVATION_LEVELS, PACKAGE_LESSONS, RATING_LABELS, assignableKinds, buildPreview, describeChange, draftPlan,
  type AssessmentKind, type ComparisonRow, type FieldId, type Mapping, type PackageType, type PlanInput, type PlanUnit, type Preview
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
export interface PlanVersion { version_no: number; reason: string; created_at: string; units: { week: number; area_title: string; level: string; objective: string; status?: string }[] }
export const unitPayload = (u: UnitRow, i: number) => ({ id: u.id, seq: i + 1, week: u.week, area_key: u.areaKey, area_title: u.areaTitle, level: u.level, objective: u.objective, exercise_keys: u.exerciseKeys, assignment_key: u.assignmentKey, checkpoint: u.checkpoint, follow_up: u.followUp, segment_advice: u.segmentAdvice });

export function PlanBuilder({ studentId, studentName, input, existing, versions = [] }: {
  studentId: string; studentName: string; input: Omit<PlanInput, "packageType">;
  existing: { id: string; title: string; status: string; package_type: PackageType; units: UnitRow[]; rationale: Record<string, string[]>; version_no?: number; source_sample_id?: string | null; sample_reviewed_at?: string | null } | null;
  versions?: PlanVersion[];
}) {
  const { run, busy, status } = useAct();
  const [pkg, setPkg] = useState<PackageType>(existing?.package_type ?? "monthly");
  const [units, setUnits] = useState<UnitRow[]>(existing?.units ?? []);
  const [rationale, setRationale] = useState<Record<string, string[]>>(existing?.rationale ?? {});
  const [due, setDue] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const isActive = existing?.status === "active"; const isDone = existing?.status === "completed"; const isDraft = !existing || existing.status === "draft";
  /** Draft: everything is editable. Active: only lessons that are still "planned" with no practice assigned (plus new lessons). Completed: nothing. */
  const editable = (u: UnitRow) => isDraft || (isActive && (!u.id || (u.status === "planned" && !u.assigned_assignment_id)));
  const tongues = !!(input as { tonguesRequested?: boolean }).tonguesRequested;

  function generate() {
    const d = draftPlan({ ...input, packageType: pkg });
    setUnits(d.units); setRationale(Object.fromEntries(d.units.map((u) => [String(u.seq), u.rationale]))); setHeld(d.tracksHeldBack.map((h) => `${TRACK_META[h.track].title}: ${h.reason}`));
  }
  const upd = (i: number, p: Partial<UnitRow>) => setUnits((us) => us.map((u, j) => (j === i ? { ...u, ...p } : u)));
  function addLesson() {
    const a = ALL_AREAS.find((x) => !x.track) ?? ALL_AREAS[0]; const week = units.length + 1;
    setUnits([...units, { seq: week, week, areaKey: a.key, areaTitle: a.title, level: "beginner", objective: a.levels.beginner.goals[0], exerciseKeys: a.exercises.filter((e) => !e.onlyOnRequest && (e.level === "beginner" || e.level === "all")).slice(0, 3).map((e) => e.key), assignmentKey: a.assignments[0]?.key ?? null, segmentAdvice: "Record practice in 3–5 minute segments; save each part separately.", rationale: [], checkpoint: null, followUp: [] }]);
  }
  async function save() {
    await run("dp_plan_save", { pid: existing?.id ?? null, student: studentId, plan_title: `Development plan for ${studentName}`, ptype: pkg, units: units.map(unitPayload), plan_basis: ["Intake", "Assessments", "Instructor observations"], plan_notes: ["Reviewed and edited by your instructor."], rationale, instructor_notes: null }, "Draft saved. Nothing is visible to the student until you approve it.");
  }
  async function revise() {
    await run("dp_plan_revise", { pid: existing!.id, units: units.map(unitPayload), reason, plan_notes: null }, "Plan revised. The previous version is kept in the history below; completed lessons, assignments, recordings and progress are untouched.");
    setReason("");
  }
  return (
    <div className="space-y-4">
      {existing?.source_sample_id && isDraft && (
        <div role="note" className="rounded-xl bg-amber-50 p-3 font-body text-sm text-amber-900">
          <p>This draft was copied from a <strong>sample pathway</strong>. It is not based on this student&apos;s findings yet. Edit each lesson, then confirm below. It cannot be approved until you do.</p>
          {existing.sample_reviewed_at ? <p className="mt-1 font-semibold">Confirmed on {new Date(existing.sample_reviewed_at).toLocaleDateString()}.</p>
            : <button className={`${btn2} mt-2`} disabled={busy} onClick={() => confirm("I have replaced the sample's assumptions with this student's own findings.") && run("dp_plan_mark_sample_reviewed", { pid: existing.id }, "Confirmed. You can now approve this plan.")}>I replaced the sample&apos;s assumptions with this student&apos;s findings</button>}
        </div>)}
      {isDraft && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="font-ui text-sm font-semibold text-[#630000]">Program
            <select className={field} value={pkg} onChange={(e) => setPkg(e.target.value as PackageType)}>
              <option value="single">Single lesson</option><option value="monthly">Monthly (4 lessons)</option><option value="twelve_week">12-week program</option></select></label>
          <button className={btn2} onClick={generate}>Draft from findings</button>
        </div>)}
      {isActive && <p className="font-body text-sm text-[#4a3a3a]">Approved plan, version {existing?.version_no ?? 1}. You can change lessons that have no practice assigned yet and add new ones. Assigned and finished lessons are locked so the student&apos;s record stays intact.</p>}
      {held.length > 0 && <ul className="rounded-xl bg-amber-50 p-3 font-body text-sm text-amber-900">{held.map((h) => <li key={h}>{h}</li>)}</ul>}
      {units.length === 0 && <p className="font-body text-sm text-[#4a3a3a]">No plan yet. Draft one from the intake, assessments and your observations, then edit anything.</p>}
      <ol className="space-y-3">
        {units.map((u, i) => {
          const area = areaByKey(u.areaKey); const can = editable(u);
          const choices = (area?.exercises ?? []).filter((e) => !e.onlyOnRequest || tongues || u.exerciseKeys.includes(e.key));
          return (
            <li key={u.id ?? `new-${i}`} className={`rounded-2xl border p-3 ${can ? "border-[#630000]/15 bg-white" : "border-[#630000]/10 bg-[#FBF4F1]"}`}>
              <p className="font-ui text-sm font-bold text-[#630000]">Lesson {u.week}{u.checkpoint ? ` · ${u.checkpoint === "final" ? "Final evaluation" : u.checkpoint === "midpoint" ? "Mid-program check" : "Progress check"}` : ""}
                {u.status === "done" ? " · done" : u.assigned_assignment_id ? " · practice assigned" : ""}{!can && isActive ? " · locked" : ""}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="font-ui text-xs font-semibold">Area<select disabled={!can} className={field} value={u.areaKey} onChange={(e) => { const a = areaByKey(e.target.value)!; upd(i, { areaKey: a.key, areaTitle: a.title, objective: a.levels[u.level].goals[0], exerciseKeys: a.exercises.filter((x) => !x.onlyOnRequest && (x.level === u.level || x.level === "all")).slice(0, 3).map((x) => x.key) }); }}>
                  {ALL_AREAS.filter((a) => !a.track || input.selectedTracks?.includes(a.track)).map((a) => <option key={a.key} value={a.key}>{a.number}. {a.title}</option>)}</select></label>
                <label className="font-ui text-xs font-semibold">Level<select disabled={!can} className={field} value={u.level} onChange={(e) => upd(i, { level: e.target.value as Level, objective: area?.levels[e.target.value as Level].goals[0] ?? u.objective })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
              </div>
              <label className="mt-2 block font-ui text-xs font-semibold">Objective<input disabled={!can} className={field} value={u.objective} onChange={(e) => upd(i, { objective: e.target.value })} /></label>
              <fieldset className="mt-2" disabled={!can}><legend className="font-ui text-xs font-semibold">Exercises</legend>
                {choices.map((e) => (<label key={e.key} className="flex min-h-[44px] items-center gap-3 font-body text-sm"><input type="checkbox" className="h-5 w-5" checked={u.exerciseKeys.includes(e.key)} onChange={() => upd(i, { exerciseKeys: u.exerciseKeys.includes(e.key) ? u.exerciseKeys.filter((k) => k !== e.key) : [...u.exerciseKeys, e.key] })} />{e.title} <span className="text-xs text-[#4a3a3a]">({e.level}, {e.minutes} min)</span></label>))}
              </fieldset>
              {(rationale[String(i + 1)] ?? u.rationale ?? []).length > 0 && <p className="mt-1 font-body text-xs text-[#4a3a3a]">Why (private): {(rationale[String(i + 1)] ?? u.rationale).join("; ")}</p>}
              {isActive && u.id && !u.assigned_assignment_id && u.status === "planned" && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="font-ui text-xs font-semibold">Due<input type="date" className={field} value={due[u.id] ?? ""} onChange={(e) => setDue({ ...due, [u.id!]: e.target.value })} /></label>
                  <button className={btn} disabled={busy || !due[u.id]} onClick={() => run("dp_plan_assign_unit", { uid: u.id, due: due[u.id!] }, `Practice assigned for lesson ${u.week}.`)}>Assign this lesson&apos;s practice</button>
                </div>)}
              {isActive && u.id && u.status !== "done" && <button className="mt-1 min-h-[44px] px-2 font-ui text-xs font-semibold text-[#630000] underline" disabled={busy} onClick={() => confirm("Mark this lesson done? It will be locked.") && run("dp_plan_unit_set_status", { uid: u.id, new_status: "done" }, `Lesson ${u.week} marked done.`)}>Mark lesson done</button>}
              {can && <button className="mt-1 min-h-[44px] px-2 font-ui text-xs font-semibold text-[#630000] underline" onClick={() => setUnits(units.filter((_, j) => j !== i))}>Remove lesson</button>}
            </li>);
        })}
      </ol>
      {(isDraft || isActive) && units.length > 0 && <button className={btn2} onClick={addLesson}>Add a lesson</button>}
      {isDraft && units.length > 0 && <div className="flex flex-wrap gap-3"><button className={btn} disabled={busy || units.length > PACKAGE_LESSONS.twelve_week} onClick={save}>Save draft</button>
        {existing && <button className={btn2} disabled={busy} onClick={async () => { if (confirm("Approve this plan and show it to the student?")) await run("dp_plan_activate", { pid: existing.id }, "Plan approved and shared with the student."); }}>Approve and share</button>}</div>}
      {isActive && (
        <div className="space-y-2 rounded-2xl border border-[#630000]/15 p-3">
          <label className="block font-ui text-sm font-semibold text-[#630000]">Why is the plan changing? (required, kept in the history)<input className={field} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></label>
          <button className={btn} disabled={busy || !reason.trim()} onClick={revise}>Save revision</button>
        </div>)}
      {isDone && <p className="font-body text-sm">This plan is completed and can no longer be edited.</p>}
      {versions.length > 0 && (
        <section aria-label="Plan history" className="space-y-2">
          <h3 className="font-display text-lg text-[#630000]">Plan history</h3>
          <ol className="space-y-2">{versions.map((v) => (
            <li key={v.version_no} className="rounded-xl bg-[#FBF4F1] p-3 font-body text-sm"><p className="font-semibold">Version {v.version_no} · replaced {new Date(v.created_at).toLocaleDateString()}</p><p>{v.reason}</p>
              <details><summary className="min-h-[44px] cursor-pointer text-[#630000] underline">Show lessons in this version</summary><ul className="list-disc pl-5">{v.units.map((u) => <li key={u.week}>Lesson {u.week}: {u.area_title} ({u.level}) — {u.objective}{u.status && u.status !== "planned" ? ` [${u.status}]` : ""}</li>)}</ul></details></li>))}</ol>
        </section>)}
      {status}
    </div>
  );
}

export function ProgressCheckForm({ planId, weeks, areas }: { planId: string; weeks: number[]; areas: { key: string; title: string }[] }) {
  const { run, busy, status } = useAct();
  const [week, setWeek] = useState(weeks[0] ?? 1); const [kind, setKind] = useState("baseline"); const [good, setGood] = useState(""); const [focus, setFocus] = useState(""); const [priv, setPriv] = useState(""); const [share, setShare] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="font-ui text-sm font-semibold">Week<input type="number" min={1} max={60} className={field} value={week} onChange={(e) => setWeek(Number(e.target.value))} /></label>
        <label className="font-ui text-sm font-semibold">Kind<select className={field} value={kind} onChange={(e) => setKind(e.target.value)}><option value="baseline">Baseline (starting point)</option><option value="progress">Progress check</option><option value="midpoint">Mid-program check</option><option value="final">Final evaluation</option><option value="custom">Check-in</option></select></label>
      </div>
      <fieldset className="space-y-2"><legend className="font-ui text-sm font-semibold">Where the student is in each area of their plan (1 = just starting, 5 = strong; leave blank if not observed)</legend>
        {areas.map((a) => (
          <label key={a.key} className="flex flex-wrap items-center gap-3 font-body text-sm"><span className="min-w-[10rem] flex-1">{a.title}</span>
            <select aria-label={`Rating for ${a.title}`} className={`${field} !mt-0 !w-auto`} value={ratings[a.key] ?? ""} onChange={(e) => { const v = e.target.value; setRatings((r) => { const n = { ...r }; if (v) n[a.key] = Number(v); else delete n[a.key]; return n; }); }}>
              <option value="">Not rated</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {RATING_LABELS[n]}</option>)}</select></label>))}
      </fieldset>
      <label className="block font-ui text-sm font-semibold">Going well<textarea className={`${field} min-h-[72px]`} value={good} onChange={(e) => setGood(e.target.value)} /></label>
      <label className="block font-ui text-sm font-semibold">Next focus<textarea className={`${field} min-h-[72px]`} value={focus} onChange={(e) => setFocus(e.target.value)} /></label>
      <label className="block font-ui text-sm font-semibold">Private notes (staff only)<textarea className={`${field} min-h-[72px]`} value={priv} onChange={(e) => setPriv(e.target.value)} /></label>
      <label className="flex min-h-[44px] items-center gap-3 font-body text-sm"><input type="checkbox" className="h-5 w-5" checked={share} onChange={(e) => setShare(e.target.checked)} />Share with the student now</label>
      <button className={btn} disabled={busy} onClick={() => run("dp_progress_check_save", { pid: planId, wk: week, check_kind: kind, rate: ratings, good, focus, private_notes: priv, share }, share ? "Saved and shared." : "Saved privately.")}>Save progress check</button>{status}
    </div>
  );
}

/** Baseline vs progress vs midpoint vs final for the skill areas in the plan. Used for staff (all checks) and students (shared checks only). */
export function RatingsComparison({ rows }: { rows: ComparisonRow[] }) {
  const has = rows.some((r) => r.baseline !== null || r.latest !== null);
  if (!has) return <p className="font-body text-sm text-[#4a3a3a]">No ratings yet.</p>;
  const cell = (n: number | null) => (n === null ? <span aria-label="not rated">—</span> : <span>{n}<span className="sr-only"> ({RATING_LABELS[n]})</span></span>);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse font-body text-sm">
        <caption className="sr-only">Skill ratings over time, 1 to 5</caption>
        <thead><tr className="text-left font-ui text-xs text-[#630000]"><th scope="col" className="py-2 pr-3">Skill area</th><th scope="col">Baseline</th><th scope="col">Progress</th><th scope="col">Midpoint</th><th scope="col">Final</th><th scope="col">Change</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.areaKey} className="border-t border-[#630000]/10"><th scope="row" className="py-2 pr-3 text-left font-semibold">{r.areaTitle}</th><td>{cell(r.baseline)}</td><td>{cell(r.progress)}</td><td>{cell(r.midpoint)}</td><td>{cell(r.final)}</td><td className="font-semibold">{describeChange(r.change)}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

export interface SavedMapping { id: string; name: string; header_map: Record<string, string> }
/** Google Forms import: paste -> map columns (suggested or saved) -> preview every row -> import only new responses. */
export function ImportIntake({ roster, savedMappings, existingKeys }: { roster: { id: string; email: string | null; full_name: string | null }[]; savedMappings: SavedMapping[]; existingKeys: string[] }) {
  const router = useRouter(); const { run, busy, status, setErr, setMsg } = useAct();
  const [csv, setCsv] = useState(""); const [preview, setPreview] = useState<Preview | null>(null); const [override, setOverride] = useState<Mapping>({});
  const [chosen, setChosen] = useState(savedMappings[0]?.name ?? ""); const [name, setName] = useState(savedMappings[0]?.name ?? "Google Form"); const [report, setReport] = useState<string[]>([]);
  const saved = savedMappings.find((m) => m.name === chosen)?.header_map ?? {};
  const known = new Set(existingKeys);
  async function build(ov: Mapping = override, sv = saved) {
    setReport([]);
    const p = await buildPreview(csv, { saved: sv, override: ov, roster, existingKeys: known });
    setPreview(p);
    if (!p.rows.length && !p.headers.length) setErr(p.warnings[0]);
  }
  async function doImport() {
    if (!preview) return; setMsg(""); setErr(""); const lines: string[] = [];
    for (const r of preview.rows.filter((x) => x.status === "new")) {
      const res = await callRpc<{ id: string; duplicate: boolean }[]>("dp_voice_import_intake", { student: r.studentId, a: r.answers, requested_tracks: r.tracks, submitted: r.submittedAt && !isNaN(Date.parse(r.submittedAt)) ? new Date(r.submittedAt).toISOString() : null, import_key: r.key });
      lines.push(`${r.email}: ${!res.ok ? `failed — ${res.error}` : res.data?.[0]?.duplicate ? "already imported" : "imported"}`);
    }
    setReport(lines); setMsg(`Import finished: ${lines.filter((l) => l.endsWith("imported") && !l.endsWith("already imported")).length} new.`); router.refresh();
  }
  async function saveMap() {
    if (!preview) return;
    const r = await run("dp_voice_save_mapping", { map_name: name, map: preview.mapping }, `Mapping "${name}" saved. It is applied automatically next time.`);
    if (r !== null) setChosen(name);
  }
  const fieldOptions = IMPORT_FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>);
  return (
    <div className="space-y-3">
      {savedMappings.length > 0 && <label className="block font-ui text-sm font-semibold text-[#630000]">Saved column mapping<select className={field} value={chosen} onChange={(e) => { setChosen(e.target.value); setName(e.target.value || name); setOverride({}); setPreview(null); }}><option value="">None (suggest from wording)</option>{savedMappings.map((m) => <option key={m.id}>{m.name}</option>)}</select></label>}
      <label className="block font-ui text-sm font-semibold text-[#630000]">Paste the Google Forms responses (CSV)<textarea className={`${field} min-h-[120px] font-mono text-xs`} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} /></label>
      <button className={btn2} disabled={!csv.trim()} onClick={() => build()}>Preview import</button>
      {preview && preview.headers.length > 0 && (
        <div className="space-y-3">
          {preview.warnings.length > 0 && <ul role="alert" className="list-disc rounded-xl bg-amber-50 p-3 pl-7 font-body text-sm text-amber-900">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          <fieldset className="space-y-2"><legend className="font-ui text-sm font-semibold text-[#630000]">Which column holds which answer?</legend>
            {preview.headers.map((h) => (
              <label key={h} className="block font-body text-sm"><span className="block">{h} <span className="text-xs text-[#4a3a3a]">({preview.source[h] === "saved" ? "saved mapping" : preview.source[h] === "suggested" ? "suggested" : "not matched"})</span></span>
                <select aria-label={`Map column ${h}`} className={field} value={preview.mapping[h] ?? ""} onChange={async (e) => { const ov = { ...override, [h]: e.target.value as FieldId | "" }; setOverride(ov); await build(ov); }}><option value="">Ignore this column</option>{fieldOptions}</select></label>))}
          </fieldset>
          <div className="flex flex-wrap items-end gap-2"><label className="font-ui text-sm font-semibold">Save this mapping as<input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label><button className={btn2} disabled={busy || !name.trim()} onClick={saveMap}>Save mapping</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[30rem] border-collapse font-body text-sm"><caption className="mb-1 text-left font-ui text-sm font-semibold text-[#630000]">Preview: {preview.counts.new} new · {preview.counts.duplicate} already imported · {preview.counts.not_enrolled} not enrolled · {preview.counts.invalid} invalid</caption>
            <thead><tr className="text-left font-ui text-xs"><th scope="col">Line</th><th scope="col">Email</th><th scope="col">Result</th><th scope="col">Goals</th></tr></thead>
            <tbody>{preview.rows.map((r) => <tr key={r.line} className="border-t border-[#630000]/10"><td>{r.line}</td><td>{r.email || "—"}</td><td>{r.status === "new" ? "Will import" : r.reason}</td><td className="max-w-[16rem] truncate">{r.answers.goals ?? ""}</td></tr>)}</tbody></table></div>
          <button className={btn} disabled={busy || preview.counts.new === 0} onClick={doImport}>Import {preview.counts.new} new {preview.counts.new === 1 ? "response" : "responses"}</button>
        </div>)}
      {report.length > 0 && <ul className="font-body text-sm" aria-label="Import results">{report.map((l) => <li key={l}>{l}</li>)}</ul>}{status}
    </div>
  );
}

/** Turns a hypothetical sample scenario into a DRAFT for a chosen student. Nothing is shown to the student, and the draft cannot be approved
 *  until the instructor confirms the sample's assumptions were replaced with that student's own findings. Lessons for tracks the student has not
 *  chosen and you have not approved are left out. */
export function SampleDraft({ scenarioId, title, units, existingSampleId, roster }: {
  scenarioId: string; title: string; units: UnitRow[]; existingSampleId: string | null; roster: { id: string; full_name: string | null; email: string | null }[];
}) {
  const router = useRouter(); const { busy, status, setErr, setMsg } = useAct(); const [student, setStudent] = useState(""); const [working, setWorking] = useState(false);
  async function go() {
    setErr(""); setMsg(""); setWorking(true);
    let sample = existingSampleId;
    if (!sample) {
      const made = await callRpc<string>("dp_plan_save", { pid: null, student: null, plan_title: title, ptype: "twelve_week", units: units.map(unitPayload), plan_basis: ["Hypothetical sample"], plan_notes: ["Sample only. Not a student record."], rationale: {}, instructor_notes: null });
      if (!made.ok) { setWorking(false); setErr(made.error); return; }
      sample = made.data;
    }
    const copy = await callRpc<string>("dp_plan_copy_sample", { sample, student });
    setWorking(false);
    if (!copy.ok) { setErr(copy.error); return; }
    router.push(`/staff/voice/development/${student}`);
  }
  return (
    <div className="space-y-2 rounded-xl bg-[#FBF4F1] p-3">
      <label className="block font-ui text-sm font-semibold text-[#630000]">Start a draft for a student from this scenario
        <select aria-label={`Student for scenario ${scenarioId}`} className={field} value={student} onChange={(e) => setStudent(e.target.value)}><option value="">Choose a student…</option>{roster.map((r) => <option key={r.id} value={r.id}>{r.full_name || r.email}</option>)}</select></label>
      <button className={btn2} disabled={busy || working || !student} onClick={go}>Create draft for review</button>
      <p className="font-body text-xs text-[#4a3a3a]">The draft is private to staff and cannot be approved until you confirm it reflects this student&apos;s own findings.</p>{status}
    </div>
  );
}
