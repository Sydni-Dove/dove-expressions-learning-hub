import Link from "next/link";
import { notFound } from "next/navigation";
import AssignTeaching, { type Candidate } from "@/components/voice/AssignTeaching";
import TeachingEditor from "@/components/voice/teaching/TeachingEditor";
import { requireRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { listItems, sanitizeContent, sectionsOfType, type Payload } from "@/lib/voice-teaching/doc";
import type { TeachingStatus } from "@/lib/voice-teaching/constants";

export const dynamic = "force-dynamic";
export default async function TeachingEditorPage({ params }: { params: { key: string } }) {
  const { roles } = await requireRoles(["faculty", "teacher", "super_admin"]);
  if (!/^[a-z0-9-]+$/.test(params.key)) notFound();
  const canPublish = roles.some((r) => r === "faculty" || r === "super_admin");
  const supabase = createClient();
  const { data: t } = await supabase.from("dp_voice_teachings").select("id,key,status,template,draft_rev,published_rev,published_version_id").eq("key", params.key).maybeSingle();
  if (!t) notFound();
  const [{ data: d }, { data: cats }, { data: links }, { data: ver }, { data: people }, { data: assigns }] = await Promise.all([
    supabase.from("dp_voice_teaching_drafts").select("title,description,estimated_minutes,objectives,student,instructor").eq("teaching_id", t.id).single(),
    supabase.from("dp_voice_teaching_categories").select("id,slug,name").eq("is_active", true).order("sort_order"),
    supabase.from("dp_voice_teaching_category_links").select("category_id").eq("teaching_id", t.id),
    t.published_version_id ? supabase.from("dp_voice_teaching_versions").select("version_no,student").eq("id", t.published_version_id).single() : Promise.resolve({ data: null }),
    supabase.rpc("dp_voice_people"),
    supabase.from("dp_assignments").select("id,assigned_to_user_id,due_at,teaching_custom,teaching_version_id").eq("teaching_id", t.id)
  ]);
  if (!d) notFound();
  const initial: Payload = { title: d.title, description: d.description ?? "", estimated_minutes: d.estimated_minutes, objectives: Array.isArray(d.objectives) ? (d.objectives as string[]) : [], student: sanitizeContent(d.student), instructor: sanitizeContent(d.instructor) };
  const selected = (cats ?? []).filter((c) => (links ?? []).some((l) => l.category_id === c.id)).map((c) => c.slug);
  const roster = (people ?? []) as { id: string; full_name: string | null; email: string | null; enrolled: boolean; paid: boolean }[];
  const nameOf = (id: string) => { const p = roster.find((r) => r.id === id); return p?.full_name || p?.email || "Student"; };
  const assignedIds = new Set((assigns ?? []).map((a) => a.assigned_to_user_id));
  const candidates: Candidate[] = roster.filter((r) => r.enrolled).map((r) => ({ id: r.id, name: r.full_name || r.email || "Student", paid: r.paid, assigned: assignedIds.has(r.id) }));
  const ids = (assigns ?? []).map((a) => a.id);
  const { data: subs } = ids.length ? await supabase.from("dp_submissions").select("assignment_id,status").in("assignment_id", ids) : { data: [] };
  const pub = ver ? sanitizeContent(ver.student) : null;
  const assignSlot = (
    <div className="space-y-6">
      <section aria-labelledby="assign-h" className="card p-5"><h2 id="assign-h" className="font-display text-xl text-burgundy">Assign to a student</h2>
        <div className="mt-3"><AssignTeaching teachingKey={t.key} published={t.status === "published"} candidates={candidates}
          defaultReflection={pub ? sectionsOfType(pub, "reflection").flatMap((s) => listItems(s.doc)) : []} defaultHomework={pub ? sectionsOfType(pub, "homework").flatMap((s) => listItems(s.doc)) : []} /></div></section>
      <section aria-labelledby="assigned-h" className="card p-5"><h2 id="assigned-h" className="font-display text-xl text-burgundy">Assigned students</h2>
        {(assigns ?? []).length ? <ul className="mt-3 divide-y divide-charcoal/10">{(assigns ?? []).map((a) => { const s = (subs ?? []).find((x) => x.assignment_id === a.id); const vn = (a.teaching_custom as { version_no?: number } | null)?.version_no;
          return <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 font-body text-sm"><span>{nameOf(a.assigned_to_user_id)}{vn ? ` · received version ${vn}` : ""}{a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}</span>
            <span className="font-ui text-xs text-charcoal/70">{s ? `Submitted (${s.status})` : "Not submitted yet"}</span></li>; })}</ul> : <p className="mt-3 font-body text-sm text-charcoal/70">Not assigned to anyone yet.</p>}
        <p className="mt-3 font-body text-xs text-charcoal/60">Responses arrive in your usual review queue under Assignments, where you give feedback. Students keep the version they were given even if you edit or republish the teaching.</p></section>
    </div>);
  return (
    <div className="space-y-4 pb-20">
      <Link href="/staff/voice/worship" className="link-action font-ui text-sm">← Worship Development</Link>
      <TeachingEditor teaching={{ id: t.id, key: t.key, status: t.status as TeachingStatus, draft_rev: t.draft_rev, published_rev: t.published_rev, published_version_no: ver?.version_no ?? null, template: t.template }}
        initial={initial} categories={(cats ?? []).map((c) => ({ slug: c.slug, name: c.name }))} selected={selected} canPublish={canPublish} assignSlot={assignSlot} />
    </div>
  );
}
