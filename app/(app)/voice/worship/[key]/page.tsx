import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StudentLesson } from "@/components/voice/teaching/DocView";
import { getStudentPrograms } from "@/lib/student-programs";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { safeHttps } from "@/lib/voice-teaching/doc";

export const dynamic = "force-dynamic";
interface Custom { instructions?: string | null; reflection?: string[]; homework?: string[]; resources?: { title: string; url: string }[] }
export default async function MyWorshipTeaching({ params }: { params: { key: string } }) {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  if (!(await getStudentPrograms(user.id)).includes("voice")) redirect("/dashboard");
  if (!/^[0-9a-f-]{36}$/i.test(params.key)) notFound();
  const supabase = createClient();
  // The route is the published VERSION you were given. Row-level security returns it only if your instructor assigned it to you.
  const { data: v } = await supabase.from("dp_voice_teaching_versions").select("id,version_no,title,description,estimated_minutes,objectives,student").eq("id", params.key).maybeSingle();
  if (!v) notFound();
  const { data: a } = await supabase.from("dp_assignments").select("due_at,teaching_custom").eq("teaching_version_id", v.id).eq("assigned_to_user_id", user.id).maybeSingle();
  const c = (a?.teaching_custom ?? {}) as Custom; const resources = (c.resources ?? []).flatMap((r) => { const u = safeHttps(r.url); return u ? [{ title: r.title, url: u }] : []; });
  return (
    <div className="space-y-6 pb-20">
      <Link href="/voice/worship" className="inline-flex min-h-[44px] items-center font-ui text-sm font-semibold text-[#630000] underline">← Worship Development</Link>
      {(c.instructions || c.reflection?.length || c.homework?.length || resources.length > 0 || a?.due_at) && (
        <section aria-labelledby="mine-h" className="rounded-3xl border-2 border-[#630000]/30 bg-[#FBF4F1] p-4 sm:p-5">
          <h2 id="mine-h" className="font-display text-xl text-[#630000]">From your instructor</h2>
          {a?.due_at && <p className="mt-1 font-ui text-sm font-semibold text-[#630000]">Due {new Date(a.due_at).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}</p>}
          {c.instructions && <p className="mt-2 whitespace-pre-wrap font-body text-[#1B1717]">{c.instructions}</p>}
          {c.reflection?.length ? <><h3 className="mt-3 font-ui font-bold text-[#630000]">Your reflection questions</h3><ol className="tt-ol mt-1 font-body">{c.reflection.map((x, i) => <li key={i}>{x}</li>)}</ol></> : null}
          {c.homework?.length ? <><h3 className="mt-3 font-ui font-bold text-[#630000]">Your homework</h3><ol className="tt-ol mt-1 font-body">{c.homework.map((x, i) => <li key={i}>{x}</li>)}</ol></> : null}
          {resources.length > 0 && <><h3 className="mt-3 font-ui font-bold text-[#630000]">Supporting resources</h3><ul className="tt-ul mt-1 font-body">{resources.map((r, i) => <li key={i}><a className="inline-flex min-h-[44px] items-center text-[#630000] underline" href={r.url} target="_blank" rel="noopener noreferrer nofollow">{r.title}</a></li>)}</ul></>}
        </section>)}
      <StudentLesson title={v.title} description={v.description} minutes={v.estimated_minutes} objectives={v.objectives} content={v.student} version={v.version_no} />
      <p className="rounded-2xl bg-[#F2DFD8] p-4 font-body text-[#630000]">Ready to submit your take-home work? <Link href="/assignments" className="inline-flex min-h-[44px] items-center font-semibold underline">Open My Assignments</Link></p>
    </div>
  );
}
