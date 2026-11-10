import Link from "next/link";
import NewTeaching from "@/components/voice/teaching/NewTeaching";
import { requireRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { AREA_DESCRIPTION, AREA_TITLE, STATUS_LABEL, STATUS_STYLE, type TeachingStatus } from "@/lib/voice-teaching/constants";

export const dynamic = "force-dynamic";
const FILTERS: [string, string][] = [["", "All"], ["ready_for_review", "Ready for review"], ["draft", "Drafts"], ["published", "Published"], ["archived", "Archived"]];
export default async function WorshipDevelopmentStaff({ searchParams }: { searchParams: { status?: string } }) {
  await requireRoles(["faculty", "teacher", "super_admin"]);
  const supabase = createClient(); const filter = FILTERS.some(([v]) => v === searchParams.status) ? searchParams.status ?? "" : "";
  const [{ data: ts }, { data: drafts }, { data: cats }, { data: links }, { data: assigned }] = await Promise.all([
    supabase.from("dp_voice_teachings").select("id,key,status,sort_order,draft_rev,published_rev,updated_at").order("sort_order").order("created_at"),
    supabase.from("dp_voice_teaching_drafts").select("teaching_id,title,description,estimated_minutes"),
    supabase.from("dp_voice_teaching_categories").select("id,slug,name,sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("dp_voice_teaching_category_links").select("teaching_id,category_id"),
    supabase.from("dp_assignments").select("teaching_id").not("teaching_id", "is", null)
  ]);
  const draftOf = new Map((drafts ?? []).map((d) => [d.teaching_id, d])); const counts = new Map<string, number>();
  for (const a of assigned ?? []) counts.set(a.teaching_id, (counts.get(a.teaching_id) ?? 0) + 1);
  const all = (ts ?? []).filter((t) => draftOf.has(t.id)); const shown = all.filter((t) => !filter || t.status === filter);
  const waiting = all.filter((t) => t.status === "ready_for_review").length;
  const inCat = (cid: string) => shown.filter((t) => (links ?? []).some((l) => l.teaching_id === t.id && l.category_id === cid));
  const uncategorized = shown.filter((t) => !(links ?? []).some((l) => l.teaching_id === t.id));
  const card = (t: (typeof all)[number]) => { const d = draftOf.get(t.id)!; const st = t.status as TeachingStatus;
    return (
      <li key={t.id} className="card p-4">
        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
          {st === "published" && t.published_rev !== t.draft_rev && <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-900">Unpublished changes</span>}
          {d.estimated_minutes ? <span className="font-ui text-xs text-charcoal/60">about {d.estimated_minutes} min</span> : null}
          <span className="font-ui text-xs text-charcoal/60">Assigned to {counts.get(t.id) ?? 0}</span></div>
        <h3 className="mt-2 font-display text-xl text-burgundy">{d.title}</h3>
        {d.description && <p className="mt-1 line-clamp-3 font-body text-sm text-charcoal/80">{d.description}</p>}
        <Link href={`/staff/voice/worship/${t.key}`} className="btn-secondary mt-3 inline-block">Open editor</Link>
      </li>); };
  return (
    <div className="space-y-6 pb-20">
      <header><Link href="/staff/voice" className="link-action font-ui text-sm">← Voice command center</Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">{AREA_TITLE}</h1>
        <p className="mt-1 max-w-2xl font-body text-sm text-charcoal/70">{AREA_DESCRIPTION}</p></header>
      {waiting > 0 && <p role="status" className="rounded-2xl bg-sky-50 p-4 font-body text-sm text-sky-900"><strong>{waiting} teaching{waiting === 1 ? " is" : "s are"} waiting for your review and approval.</strong> Nothing is visible to students until you publish it.</p>}
      <NewTeaching categories={(cats ?? []).map((c) => ({ slug: c.slug, name: c.name }))} />
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">{FILTERS.map(([v, l]) => <Link key={v} href={v ? `/staff/voice/worship?status=${v}` : "/staff/voice/worship"} aria-current={filter === v ? "page" : undefined} className={`inline-flex min-h-[44px] items-center rounded-full px-4 font-ui text-sm font-semibold ${filter === v ? "bg-burgundy text-white" : "border border-burgundy/30 text-burgundy"}`}>{l}</Link>)}</nav>
      {!shown.length && <p className="rounded-2xl border border-dashed border-burgundy/30 p-6 font-body text-sm">No teachings match. Use “New teaching” to start one.</p>}
      {(cats ?? []).map((c) => { const items = inCat(c.id); return items.length ? <section key={c.id} aria-labelledby={`c-${c.slug}`}><h2 id={`c-${c.slug}`} className="font-display text-2xl text-burgundy">{c.name}</h2><ul className="mt-3 grid gap-3 md:grid-cols-2">{items.map(card)}</ul></section> : null; })}
      {uncategorized.length > 0 && <section aria-labelledby="c-none"><h2 id="c-none" className="font-display text-2xl text-burgundy">Uncategorized</h2><ul className="mt-3 grid gap-3 md:grid-cols-2">{uncategorized.map(card)}</ul></section>}
    </div>
  );
}
