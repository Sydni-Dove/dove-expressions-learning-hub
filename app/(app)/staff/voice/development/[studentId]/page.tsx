import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessBadge, AssignAssessment, DemoForm, PlanBuilder, ProgressCheckForm, RatingsComparison, ReviewAssessment, TrackApproval, type Access, type DemoEntry, type PlanVersion, type UnitRow } from "@/components/voice/DevelopmentAdmin";
import { requireRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { ASSESSMENTS, INTAKE_QUESTIONS, compareRatings, questionsOf, summarizeCreative, summarizePersonalTime, type AssessmentKind, type IntakeAnswers, type PackageType } from "@/lib/voice-assessments";
import type { TrackKey } from "@/lib/voice-curriculum";

export const dynamic = "force-dynamic";
export default async function StudentDevelopment({ params }: { params: { studentId: string } }) {
  await requireRoles(["faculty", "teacher", "super_admin"]);
  if (!/^[0-9a-f-]{36}$/i.test(params.studentId)) notFound();
  const sid = params.studentId; const supabase = createClient();
  const { data: roster } = await supabase.rpc("dp_voice_people");
  const student = ((roster ?? []) as { id: string; full_name: string | null; email: string | null; enrolled: boolean; prospect: boolean; paid: boolean; paid_status: string }[]).find((s) => s.id === sid);
  if (!student) notFound();
  const access: Access = { enrolled: student.enrolled, prospect: student.prospect, paid: student.paid, paid_status: student.paid_status };
  const [{ data: profile }, { data: intakes }, { data: assessments }, { data: plans }, { data: checks }, { data: demoRows }] = await Promise.all([
    supabase.from("dp_voice_profiles").select("selected_tracks,approved_tracks,tongues_requested").eq("student_id", sid).maybeSingle(),
    supabase.from("dp_voice_intakes").select("id,source,answers,submitted_at").eq("student_id", sid).order("submitted_at", { ascending: false }).limit(1),
    supabase.from("dp_voice_assessments").select("id,kind,status,answers,shared_summary,submitted_at").eq("student_id", sid).order("assigned_at", { ascending: false }),
    supabase.from("dp_voice_plans").select("id,title,status,package_type,version_no,source_sample_id,sample_reviewed_at").eq("student_id", sid).order("created_at", { ascending: false }),
    supabase.from("dp_voice_progress_checks").select("id,week,kind,ratings,strengths,next_focus,shared_at,created_at").eq("student_id", sid).order("created_at", { ascending: false }),
    supabase.from("dp_voice_demos").select("id,observed_at,ratings,strengths,next_focus,shared_at").eq("student_id", sid).order("observed_at", { ascending: false }).order("created_at", { ascending: false })
  ]);
  const demoIds = (demoRows ?? []).map((d) => d.id);
  const { data: demoPriv } = demoIds.length ? await supabase.from("dp_voice_demo_private").select("demo_id,notes").in("demo_id", demoIds) : { data: [] };
  const demos: DemoEntry[] = (demoRows ?? []).map((d: any) => ({ ...d, notes: (demoPriv ?? []).find((p: any) => p.demo_id === d.id)?.notes ?? null }));
  const baseline = demos[0] ?? null;
  const ids = (assessments ?? []).map((a) => a.id);
  const { data: priv } = ids.length ? await supabase.from("dp_voice_assessment_private").select("assessment_id,observations,notes").in("assessment_id", ids) : { data: [] };
  const selected = (profile?.selected_tracks ?? []) as TrackKey[]; const approved = (profile?.approved_tracks ?? []) as TrackKey[];
  const intake = (intakes?.[0]?.answers ?? undefined) as IntakeAnswers | undefined;
  const plan = (plans ?? []).find((p) => p.status === "draft") ?? (plans ?? []).find((p) => p.status === "active") ?? null;
  const { data: unitRows } = plan ? await supabase.from("dp_voice_plan_units").select("*").eq("plan_id", plan.id).order("seq") : { data: [] };
  const { data: versionRows } = plan ? await supabase.from("dp_voice_plan_versions").select("version_no,reason,created_at,snapshot").eq("plan_id", plan.id).order("version_no", { ascending: false }) : { data: [] };
  const versions: PlanVersion[] = (versionRows ?? []).map((v: any) => ({ version_no: v.version_no, reason: v.reason, created_at: v.created_at, units: (v.snapshot?.units ?? []).map((u: any) => ({ week: u.week, area_title: u.area_title, level: u.level, objective: u.objective, status: u.status })) }));
  const { data: planPriv } = plan ? await supabase.from("dp_voice_plan_private").select("rationale").eq("plan_id", plan.id).maybeSingle() : { data: null };
  const creative = (assessments ?? []).find((a) => a.kind === "creative_expression" && ["submitted", "reviewed"].includes(a.status));
  const creativeObs = (priv ?? []).find((p) => p.assessment_id === creative?.id)?.observations as Record<string, string> | undefined;
  const creativeSummary = creative ? summarizeCreative((creative.answers ?? {}) as never, creativeObs ?? {}) : null;
  const units: UnitRow[] = (unitRows ?? []).map((u: any) => ({ id: u.id, seq: u.seq, week: u.week, areaKey: u.area_key, areaTitle: u.area_title, level: u.level, objective: u.objective, exerciseKeys: u.exercise_keys, assignmentKey: u.assignment_key, segmentAdvice: u.segment_advice, rationale: [], checkpoint: u.checkpoint, followUp: u.follow_up, status: u.status, assigned_assignment_id: u.assigned_assignment_id }));
  return (
    <div className="space-y-10 pb-20">
      <header><Link href="/staff/voice/development" className="link-action font-ui text-sm">← Student development</Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">{student.full_name || student.email}</h1>
        <p className="mt-1"><AccessBadge a={access} /></p>
        <p className="font-body text-sm text-charcoal/70">Private to you and this student. Nothing here is scored or used to label spiritual maturity.</p></header>

      <section aria-labelledby="demo-h"><h2 id="demo-h" className="mb-2 font-display text-xl text-burgundy">Vocal Demo (consultation baseline)</h2>
        <DemoForm studentId={sid} history={demos} /></section>

      <section aria-labelledby="intake-h"><h2 id="intake-h" className="mb-2 font-display text-xl text-burgundy">Intake (goals and choices)</h2>
        {intake ? <dl className="card space-y-2 p-4 font-body text-sm">{INTAKE_QUESTIONS.map((q) => { const v = (intake as Record<string, unknown>)[q.id]; return v ? <div key={q.id}><dt className="font-semibold">{q.text}</dt><dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd></div> : null; })}<p className="text-xs text-charcoal/60">Source: {intakes?.[0]?.source === "google_forms_import" ? "Google Forms import" : "completed in the Hub"}</p></dl>
          : <p className="font-body text-sm">No intake yet. The student can complete it at /voice/intake, or import it from Google Forms on the previous page.</p>}</section>

      <section aria-labelledby="trk-h"><h2 id="trk-h" className="mb-2 font-display text-xl text-burgundy">Optional Creative Worship tracks</h2>
        <TrackApproval studentId={sid} selected={selected} approved={approved} tongues={!!profile?.tongues_requested} /></section>

      <section aria-labelledby="as-h"><h2 id="as-h" className="mb-2 font-display text-xl text-burgundy">Assessments</h2>
        <AssignAssessment studentId={sid} selected={selected} approved={approved} access={access} />
        <ul className="mt-4 space-y-4">{(assessments ?? []).map((a) => {
          const def = ASSESSMENTS[a.kind as AssessmentKind]; const p = (priv ?? []).find((x) => x.assessment_id === a.id);
          const answers = (a.answers ?? {}) as Record<string, string | string[]>;
          return (
            <li key={a.id} className="card space-y-3 p-4"><p className="font-ui font-bold text-burgundy">{def?.title} · {a.status}</p>
              {["submitted", "reviewed"].includes(a.status) && a.kind === "personal_time" && (() => { const s = summarizePersonalTime(answers as never); return <div className="font-body text-sm"><ul>{s.lines.map((l) => <li key={l.label}><strong>{l.label}</strong> {l.answer}</li>)}</ul>{s.doNotInclude && <p className="mt-2 font-semibold">Student asked not to include: {s.doNotInclude}</p>}<p className="mt-1 text-xs text-charcoal/60">{s.note}</p></div>; })()}
              {["submitted", "reviewed"].includes(a.status) && a.kind === "creative_expression" && (() => { const s = summarizeCreative(answers as never, (p?.observations ?? {}) as never); return <div className="font-body text-sm"><ul>{s.self.filter((x) => x.answer).map((x) => <li key={x.id}>{x.label}: <strong>{x.answer}</strong></li>)}</ul><p className="mt-2">Recorded demonstrations: {s.recordedCount} of {s.demos.length}. <Link href="/staff/voice/recordings" className="link-action">Listen in Practice Recordings</Link></p>{s.suggestedAreas.length > 0 && <p>Areas to look at first (suggestion): {s.suggestedAreas.join(", ")}</p>}</div>; })()}
              {["submitted", "reviewed"].includes(a.status) && !questionsOf(def).length && <p className="text-sm">No questions.</p>}
              {["submitted", "reviewed"].includes(a.status) && <ReviewAssessment id={a.id} kind={a.kind as AssessmentKind} existingObs={(p?.observations ?? {}) as never} existingNotes={p?.notes ?? ""} existingSummary={a.shared_summary ?? ""} />}
            </li>); })}</ul></section>

      <section aria-labelledby="plan-h"><h2 id="plan-h" className="mb-2 font-display text-xl text-burgundy">Personalized plan {plan ? `(${plan.status})` : ""}</h2>
        <PlanBuilder studentId={sid} studentName={student.full_name || student.email || "student"} existing={plan ? { id: plan.id, title: plan.title, status: plan.status, package_type: plan.package_type as PackageType, units, rationale: (planPriv?.rationale ?? {}) as never, version_no: plan.version_no, source_sample_id: plan.source_sample_id, sample_reviewed_at: plan.sample_reviewed_at } : null} versions={versions}
          input={{ intake, demo: baseline?.ratings, selectedTracks: selected, approvedTracks: approved, creativeSuggestions: creativeSummary?.suggestedAreas, tonguesRequested: !!profile?.tongues_requested } as never} /></section>

      {plan?.status === "active" && <section aria-labelledby="pc-h"><h2 id="pc-h" className="mb-2 font-display text-xl text-burgundy">Progress checks</h2>
        <ProgressCheckForm planId={plan.id} weeks={units.filter((u) => u.checkpoint).map((u) => u.week)} areas={[...new Map(units.map((u) => [u.areaKey, { key: u.areaKey, title: u.areaTitle }])).values()]} />
        <h3 className="mt-6 font-display text-lg text-burgundy">Baseline (Vocal Demo), progress, midpoint and final</h3>
        <RatingsComparison rows={compareRatings((checks ?? []) as never, units.map((u) => u.areaKey), baseline ? { ratings: baseline.ratings } : null)} />
        <ul className="mt-4 space-y-2">{(checks ?? []).map((c) => <li key={c.id} className="card p-3 font-body text-sm">Week {c.week} · {c.kind} · {c.shared_at ? "shared" : "private"} — {c.strengths}</li>)}</ul></section>}
    </div>
  );
}
