import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudentPrograms } from "@/lib/student-programs";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { AREA_TITLE } from "@/lib/voice-teaching/constants";

export const dynamic = "force-dynamic";
export default async function MyWorshipTeachings() {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  if (!(await getStudentPrograms(user.id)).includes("voice")) redirect("/dashboard");
  const supabase = createClient();
  // Row-level security returns only the published versions your instructor assigned to you.
  const { data: versions } = await supabase.from("dp_voice_teaching_versions").select("id,version_no,title,description,estimated_minutes").order("published_at");
  return (
    <div className="space-y-6 pb-20">
      <header><Link href="/voice" className="inline-flex min-h-[44px] items-center font-ui text-sm font-semibold text-[#630000] underline">← Voice Home</Link>
        <h1 className="font-display text-4xl text-[#630000]">{AREA_TITLE}</h1>
        <p className="mt-1 max-w-2xl font-body text-[#4a3a3a]">Teachings your instructor has assigned to you. You can come back to them any time.</p></header>
      {(versions ?? []).length ? <ul className="space-y-4">{(versions ?? []).map((m) => (
        <li key={m.id} className="rounded-2xl border border-[#630000]/15 bg-white p-5">
          <h2 className="font-display text-2xl text-[#630000]">{m.title}</h2><p className="mt-2 font-body text-[#201414]">{m.description}</p>
          <Link href={`/voice/worship/${m.id}`} className="mt-3 inline-flex min-h-[44px] items-center font-ui font-semibold text-[#630000] underline">Open this teaching</Link></li>))}</ul>
        : <p className="rounded-2xl border border-dashed border-[#630000]/30 p-6 font-body text-[#4a3a3a]">Your instructor has not assigned a teaching yet. When they do, it will appear here.</p>}
    </div>
  );
}
