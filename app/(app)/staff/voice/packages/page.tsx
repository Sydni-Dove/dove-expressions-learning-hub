import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/roles";
import { TierManager, GrantPackageForm, LessonLevels, type Tier } from "@/components/voice/PackageAdmin";

export const dynamic = "force-dynamic";
export default async function VoicePackagesPage() {
  await requireRoles(["faculty", "teacher", "super_admin"]);
  const supabase = createClient();
  const { data: program } = await supabase.from("dp_programs").select("id").eq("slug", "vocal-coaching").maybeSingle();
  const [tiers, roster, lessons, access] = await Promise.all([
    supabase.from("dp_coaching_tiers").select("id,slug,name,description,lesson_minutes,lesson_count,valid_days,installments,resource_level,personal_plan,assessments_included,recording_feedback_included,woo_product_ids,is_active").order("sort_order").order("created_at"),
    supabase.rpc("dp_program_students", { target_program_slug: "vocal-coaching" }),
    supabase.from("dp_lessons").select("id,title,status,order_index,dp_modules!inner(order_index,dp_courses!inner(title,order_index,dp_programs!inner(slug)))").eq("dp_modules.dp_courses.dp_programs.slug", "vocal-coaching"),
    supabase.from("dp_lesson_access").select("lesson_id,min_level")
  ]);
  type L = { id: string; title: string; status: string; order_index: number; dp_modules: { order_index: number; dp_courses: { title: string; order_index: number } } };
  const rows = ((lessons.data ?? []) as unknown as L[]).sort((a, b) => a.dp_modules.dp_courses.order_index - b.dp_modules.dp_courses.order_index || a.dp_modules.order_index - b.dp_modules.order_index || a.order_index - b.order_index)
    .map(l => ({ id: l.id, title: l.title, status: l.status, course: l.dp_modules.dp_courses.title, level: access.data?.find(a => a.lesson_id === l.id)?.min_level ?? 0 }));
  return <div className="space-y-8 pb-20">
    <div><Link href="/staff/voice" className="link-action font-ui text-sm">← Voice command center</Link><h1 className="mt-2 font-display text-3xl text-burgundy">Packages and library access</h1>
      <p className="mt-1 font-body text-sm text-charcoal/70">Prices stay in the store. Here you decide what each package includes. Nothing is created for you; change any of it at any time.</p></div>
    {[tiers, roster, lessons].some(r => r.error) && <p role="alert" className="card p-4 text-sm">This area is not available yet. The coaching packages database migration may not be applied.</p>}
    <section aria-labelledby="t-h"><h2 id="t-h" className="mb-3 font-display text-2xl text-burgundy">Packages</h2>{program ? <TierManager programId={program.id} tiers={(tiers.data ?? []) as Tier[]} /> : null}</section>
    <section aria-labelledby="g-h"><h2 id="g-h" className="mb-3 font-display text-2xl text-burgundy">Record a package for a student</h2><div className="card p-5"><GrantPackageForm students={roster.data ?? []} tiers={(tiers.data ?? []) as Tier[]} /></div></section>
    <section aria-labelledby="l-h"><h2 id="l-h" className="mb-3 font-display text-2xl text-burgundy">Library access levels</h2><LessonLevels lessons={rows} /></section>
  </div>;
}
