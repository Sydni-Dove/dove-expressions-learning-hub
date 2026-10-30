import Link from "next/link";
import { requireRoles } from "@/lib/roles";
import { stephanieScenarios, STEPHANIE_INTEREST } from "@/lib/voice-assessments/stephanie";

export default async function SamplePathway() {
  await requireRoles(["faculty", "teacher", "super_admin"]);
  const scenarios = stephanieScenarios();
  return (
    <div className="space-y-6 pb-20">
      <header><Link href="/staff/voice/development" className="link-action font-ui text-sm">← Student development</Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">Sample pathway: Stephanie</h1>
        <p role="note" className="mt-2 max-w-2xl rounded-xl bg-amber-50 p-3 font-body text-sm text-amber-900">This is a <strong>sample</strong>, not a student record. The only thing known is her interest ({STEPHANIE_INTEREST}). Her reception type, private practice, whether she sings in tongues, and her technical level are <strong>not assumed</strong>; the instructor chooses activities from what is actually found. Each scenario below is hypothetical, and the same interest leads to different plans for different findings.</p></header>
      {scenarios.map((s) => (
        <section key={s.id} className="card space-y-3 p-4" aria-label={`Scenario ${s.id}`}>
          <h2 className="font-display text-xl text-burgundy">{s.finding}</h2>
          {s.plan.tracksHeldBack.length > 0 && <p className="font-body text-sm text-amber-900">Held back: {s.plan.tracksHeldBack.map((h) => h.reason).join("; ")}</p>}
          <ol className="space-y-1 font-body text-sm">{s.plan.units.slice(0, 6).map((u) => <li key={u.seq}><strong>Lesson {u.week}{u.checkpoint ? ` (${u.checkpoint})` : ""}:</strong> {u.areaTitle} ({u.level}) — {u.objective} <span className="text-charcoal/60">Why: {u.rationale.join("; ")}</span></li>)}<li className="text-charcoal/60">…and {s.plan.units.length - 6} more lessons, with progress checks at weeks 4 and 8 and a final evaluation in week 12.</li></ol>
        </section>))}
      <p className="font-body text-sm">To start a real plan, open the student under <Link href="/staff/voice/development" className="link-action">Student development</Link> and draft from their own findings.</p>
    </div>
  );
}
