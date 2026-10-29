"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Tier = { id: string; slug: string; name: string; description: string | null; lesson_minutes: number; lesson_count: number; valid_days: number | null;
  resource_level: number; personal_plan: boolean; assessments_included: number; recording_feedback_included: number; woo_product_ids: string[]; is_active: boolean };
const msg = (e: unknown) => (e as { message?: string })?.message ?? "Something went wrong. Please try again.";
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "package";

function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  async function run(work: () => Promise<string>) { setBusy(true); setError(""); setOk(""); try { setOk(await work()); router.refresh(); } catch (e) { setError(msg(e)); } finally { setBusy(false); } }
  return { busy, error, ok, run };
}
const Note = ({ error, ok }: { error: string; ok: string }) => <>{error && <p role="alert" className="font-ui text-sm text-[#7a2c1c]">{error}</p>}{ok && <p role="status" className="font-ui text-sm">{ok}</p>}</>;

export function TierManager({ programId, tiers }: { programId: string; tiers: Tier[] }) {
  const { busy, error, ok, run } = useAct();
  const blank = { name: "", description: "", minutes: "60", count: "4", days: "", level: "0", plan: false, assess: "0", feedback: "0", products: "" };
  const [f, setF] = useState(blank); const [edit, setEdit] = useState<Tier | null>(null);
  const load = (t: Tier | null) => { setEdit(t); setF(t ? { name: t.name, description: t.description ?? "", minutes: String(t.lesson_minutes), count: String(t.lesson_count), days: t.valid_days ? String(t.valid_days) : "", level: String(t.resource_level), plan: t.personal_plan, assess: String(t.assessments_included), feedback: String(t.recording_feedback_included), products: t.woo_product_ids.join(", ") } : blank); };
  const submit = (ev: React.FormEvent) => { ev.preventDefault(); run(async () => {
    if (!f.name.trim()) throw new Error("Give the package a name.");
    const products = f.products.split(/[,\s]+/).filter(Boolean);
    if (products.some(p => !/^\d+$/.test(p))) throw new Error("Store product IDs are numbers, separated by commas.");
    const row = { program_id: programId, name: f.name.trim(), description: f.description.trim() || null, lesson_minutes: Number(f.minutes), lesson_count: Number(f.count), valid_days: f.days ? Number(f.days) : null,
      resource_level: Number(f.level), personal_plan: f.plan, assessments_included: Number(f.assess), recording_feedback_included: Number(f.feedback), woo_product_ids: products };
    const supabase = createClient();
    const { error: e } = edit ? await supabase.from("dp_coaching_tiers").update(row).eq("id", edit.id) : await supabase.from("dp_coaching_tiers").insert({ ...row, slug: `${slugify(f.name)}-${Date.now().toString(36)}` });
    if (e) throw e; load(null); return edit ? "Package updated. Students who already bought it keep what they purchased." : "Package created.";
  }); };
  const toggle = (t: Tier) => run(async () => { const { error: e } = await createClient().from("dp_coaching_tiers").update({ is_active: !t.is_active }).eq("id", t.id); if (e) throw e; return t.is_active ? "Package retired." : "Package restored."; });
  const field = "input mt-1 w-full";
  return <div className="space-y-4">
    <form onSubmit={submit} className="card grid gap-3 p-5 sm:grid-cols-2">
      <h3 className="font-display text-lg text-burgundy sm:col-span-2">{edit ? "Edit package" : "Create a package"}</h3>
      <label className="font-ui text-sm">Name<input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={field} placeholder="Monthly, four 60-minute lessons" /></label>
      <label className="font-ui text-sm">Store product IDs (comma separated)<input value={f.products} onChange={e => setF({ ...f, products: e.target.value })} className={field} placeholder="Leave blank until prices are final" /></label>
      <label className="font-ui text-sm">Lesson length<select value={f.minutes} onChange={e => setF({ ...f, minutes: e.target.value })} className={field}><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
      <label className="font-ui text-sm">Number of lessons<input type="number" min={1} max={200} value={f.count} onChange={e => setF({ ...f, count: e.target.value })} className={field} /></label>
      <label className="font-ui text-sm">Lessons expire after (days, blank = never)<input type="number" min={1} max={1095} value={f.days} onChange={e => setF({ ...f, days: e.target.value })} className={field} /></label>
      <label className="font-ui text-sm">Library access level (0 = open items only)<select value={f.level} onChange={e => setF({ ...f, level: e.target.value })} className={field}>{[0, 1, 2, 3].map(n => <option key={n} value={n}>Level {n}</option>)}</select></label>
      <label className="font-ui text-sm">Assessments included<input type="number" min={0} value={f.assess} onChange={e => setF({ ...f, assess: e.target.value })} className={field} /></label>
      <label className="font-ui text-sm">Recording feedback reviews included<input type="number" min={0} value={f.feedback} onChange={e => setF({ ...f, feedback: e.target.value })} className={field} /></label>
      <label className="flex items-center gap-2 font-ui text-sm sm:col-span-2"><input type="checkbox" checked={f.plan} onChange={e => setF({ ...f, plan: e.target.checked })} />Includes a personalized development plan</label>
      <label className="font-ui text-sm sm:col-span-2">Description (staff only)<input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className={field} /></label>
      <div className="flex gap-3 sm:col-span-2"><button disabled={busy} className="btn-primary">{busy ? "Saving…" : edit ? "Save changes" : "Create package"}</button>{edit && <button type="button" className="btn-secondary" onClick={() => load(null)}>Cancel</button>}</div>
      <div className="sm:col-span-2"><Note error={error} ok={ok} /></div>
    </form>
    <ul className="space-y-2">{tiers.map(t => <li key={t.id} className="card flex flex-wrap items-center justify-between gap-2 p-4"><span className={`font-body text-sm ${t.is_active ? "" : "text-charcoal/40 line-through"}`}><strong>{t.name}</strong> · {t.lesson_count} × {t.lesson_minutes} min · {t.valid_days ? `${t.valid_days} days` : "no expiry"}{t.personal_plan ? " · development plan" : ""}{t.recording_feedback_included ? ` · ${t.recording_feedback_included} recording reviews` : ""}{t.woo_product_ids.length ? ` · store products ${t.woo_product_ids.join(", ")}` : " · not linked to the store"}</span>
      <span className="flex gap-1 font-ui text-xs"><button className="link-action" onClick={() => load(t)}>Edit</button><button disabled={busy} className="link-action" onClick={() => toggle(t)}>{t.is_active ? "Retire" : "Restore"}</button></span></li>)}</ul>
  </div>;
}

export function GrantPackageForm({ students, tiers }: { students: { id: string; full_name: string | null; email: string | null }[]; tiers: Tier[] }) {
  const { busy, error, ok, run } = useAct();
  const active = tiers.filter(t => t.is_active);
  const [f, setF] = useState({ student: "", tier: "", status: "paid", qty: "1" });
  const submit = (ev: React.FormEvent) => { ev.preventDefault(); run(async () => {
    if (!f.student || !f.tier) throw new Error("Choose a student and a package.");
    const { error: e } = await createClient().rpc("dp_create_package", { student: f.student, tier: f.tier, pay_status: f.status, quantity: Number(f.qty) });
    if (e) throw e; return "Package recorded.";
  }); };
  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
    <p className="font-body text-xs text-charcoal/65 sm:col-span-2">Use only for payments made outside the website (cash, transfer, complimentary). Website purchases are recorded automatically once the store connection is enabled.</p>
    <label className="font-ui text-sm sm:col-span-2">Student<select value={f.student} onChange={e => setF({ ...f, student: e.target.value })} className="input mt-1 w-full"><option value="">Choose…</option>{students.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}</select></label>
    <label className="font-ui text-sm sm:col-span-2">Package<select value={f.tier} onChange={e => setF({ ...f, tier: e.target.value })} className="input mt-1 w-full"><option value="">Choose…</option>{active.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label className="font-ui text-sm">Payment<select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className="input mt-1 w-full"><option value="paid">Paid</option><option value="complimentary">Complimentary</option><option value="pending">Pending</option></select></label>
    <label className="font-ui text-sm">Quantity<input type="number" min={1} max={20} value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} className="input mt-1 w-full" /></label>
    <div className="sm:col-span-2"><button disabled={busy} className="btn-primary">{busy ? "Saving…" : "Record package"}</button></div><div className="sm:col-span-2"><Note error={error} ok={ok} /></div>
  </form>;
}

export function LessonLevels({ lessons }: { lessons: { id: string; title: string; course: string; status: string; level: number }[] }) {
  const { busy, error, ok, run } = useAct();
  const set = (id: string, level: number) => run(async () => {
    const supabase = createClient();
    const { error: e } = level === 0 ? await supabase.from("dp_lesson_access").delete().eq("lesson_id", id) : await supabase.from("dp_lesson_access").upsert({ lesson_id: id, min_level: level, updated_at: new Date().toISOString() });
    if (e) throw e; return "Access updated.";
  });
  return <div className="card p-5"><p className="font-body text-sm text-charcoal/70">Every lesson and exercise is written once and shared. A lesson is open to all enrolled students unless you give it a level; then only packages at that level or higher can open it.</p>
    {lessons.length ? <ul className="mt-3 divide-y divide-charcoal/10">{lessons.map(l => <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="font-body text-sm">{l.title} <em className="text-charcoal/50">({l.course}, {l.status})</em></span>
      <label className="font-ui text-xs"><span className="sr-only">Access level for {l.title}</span><select disabled={busy} value={l.level} onChange={e => set(l.id, Number(e.target.value))} className="input !py-1"><option value={0}>Open to all enrolled</option>{[1, 2, 3].map(n => <option key={n} value={n}>Level {n} and up</option>)}</select></label></li>)}</ul> : <p className="mt-3 font-body text-sm">No lessons yet.</p>}
    <Note error={error} ok={ok} /></div>;
}
