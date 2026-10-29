import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/roles";
import { ExerciseManager, TemplateManager, ContentEditor } from "@/components/voice/ResourceAdmin";
import type { Exercise, Skill } from "@/lib/voice-resources";

export const dynamic = "force-dynamic";
export default async function VoiceLibraryPage() {
  await requireRoles(["faculty", "teacher", "super_admin"]);
  const supabase = createClient();
  const [s, e, t, c] = await Promise.all([
    supabase.from("dp_voice_skills").select("id,slug,name,sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("dp_voice_exercises").select("id,skill_id,title,instructions,video_url,source_name,minutes,is_active").order("title"),
    supabase.from("dp_voice_plan_templates").select("id,title,description,items,is_active").order("created_at", { ascending: false }),
    supabase.from("dp_voice_resource_content").select("key,title,body").order("key", { ascending: false })
  ]);
  const failed = [s, e, t, c].some(r => r.error);
  return <div className="space-y-8 pb-20">
    <div><Link href="/staff/voice" className="font-ui text-sm underline">← Voice command center</Link><h1 className="mt-2 font-display text-3xl text-burgundy">Library and guides</h1>
      <p className="mt-1 font-body text-sm text-charcoal/70">Write an exercise once and reuse it in any student’s plan. Videos stay on the site that hosts them; only the link is stored.</p></div>
    {failed && <p role="alert" className="card p-4 text-sm">This area is not available yet. The student resources database migration may not be applied.</p>}
    <section aria-labelledby="ex-h"><h2 id="ex-h" className="mb-3 font-display text-2xl text-burgundy">Exercise library</h2><ExerciseManager skills={(s.data ?? []) as Skill[]} exercises={(e.data ?? []) as Exercise[]} /></section>
    <section aria-labelledby="tp-h"><h2 id="tp-h" className="mb-3 font-display text-2xl text-burgundy">Plan templates</h2><TemplateManager exercises={(e.data ?? []) as Exercise[]} templates={(t.data ?? []) as never} /></section>
    <section aria-labelledby="ct-h"><h2 id="ct-h" className="mb-3 font-display text-2xl text-burgundy">Welcome and practice guide</h2><ContentEditor content={c.data ?? []} /></section>
  </div>;
}
