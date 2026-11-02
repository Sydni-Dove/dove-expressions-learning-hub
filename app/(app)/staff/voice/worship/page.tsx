import Link from "next/link";
import { requireRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { AREA_DESCRIPTION, AREA_TITLE } from "@/lib/voice-teaching/types";

export const dynamic = "force-dynamic";
export default async function WorshipDevelopmentStaff() {
  await requireRoles(["faculty", "teacher", "super_admin"]);
  const supabase = createClient();
  const [{ data: modules }, { data: assigned }] = await Promise.all([
    supabase.from("dp_voice_teaching_modules").select("id,key,module_number,title,summary,estimated_minutes").eq("is_active", true).order("module_number"),
    supabase.from("dp_assignments").select("teaching_module_id").not("teaching_module_id", "is", null)
  ]);
  const counts = new Map<string, number>(); for (const a of assigned ?? []) counts.set(a.teaching_module_id, (counts.get(a.teaching_module_id) ?? 0) + 1);
  return (
    <div className="space-y-6 pb-20">
      <header><Link href="/staff/voice" className="link-action font-ui text-sm">← Voice command center</Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">{AREA_TITLE}</h1>
        <p className="mt-1 max-w-2xl font-body text-sm text-charcoal/70">{AREA_DESCRIPTION}</p></header>
      {!(modules ?? []).length && <p className="rounded-2xl border border-dashed border-burgundy/30 p-6 font-body text-sm">No teachings are loaded yet. They are added by the release migration.</p>}
      <ol className="space-y-4">{(modules ?? []).map((m) => (
        <li key={m.id} className="card p-5">
          <p className="font-ui text-xs font-bold uppercase tracking-wide text-charcoal/60">Teaching {m.module_number} · about {m.estimated_minutes} min</p>
          <h2 className="mt-1 font-display text-xl text-burgundy">{m.title}</h2>
          <p className="mt-2 font-body text-sm text-charcoal/80">{m.summary}</p>
          <p className="mt-2 font-ui text-xs text-charcoal/60">Assigned to {counts.get(m.id) ?? 0} student{(counts.get(m.id) ?? 0) === 1 ? "" : "s"}</p>
          <Link href={`/staff/voice/worship/${m.key}`} className="btn-secondary mt-3 inline-block">Open, read notes and assign</Link>
        </li>))}</ol>
    </div>
  );
}
