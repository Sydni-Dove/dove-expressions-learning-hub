import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { DiscernmentNote } from "@/components/ui";

export default async function WiringHomePage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: response } = await supabase
    .from("dp_assessment_responses")
    .select("id,status")
    .eq("student_id", user!.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: result } = await supabase
    .from("dp_wiring_results")
    .select("id")
    .eq("student_id", user!.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <h1 className="font-display text-3xl text-burgundy">Spiritual Wiring</h1>
      <p className="font-body text-charcoal/80">
        This assessment helps you and your mentor discern your likely spiritual gifts, motivations,
        strengths, reception style, and ministry function — a starting point for conversation, not a final
        word.
      </p>
      <DiscernmentNote>
        This tool supports prayerful discernment, biblical reflection, and mentorship. It does not replace
        the Holy Spirit, Scripture, wise counsel, or the fruit of your life over time.
      </DiscernmentNote>

      <div className="card p-6">
        {result ? (
          <>
            <p className="font-body text-charcoal/80">You've completed your Spiritual Wiring Assessment.</p>
            <Link href="/wiring/results" className="btn-primary mt-4">
              View my results
            </Link>
          </>
        ) : response?.status === "in_progress" ? (
          <>
            <p className="font-body text-charcoal/80">You have an assessment in progress. Pick up where you left off.</p>
            <Link href="/wiring/assessment" className="btn-primary mt-4">
              Resume assessment
            </Link>
          </>
        ) : (
          <>
            <p className="font-body text-charcoal/80">
              Five short sections: motivations, gifts &amp; functions, communication &amp; reception style,
              ministry environment, and scenario discernment. You can save and resume at any point.
            </p>
            <Link href="/wiring/assessment" className="btn-primary mt-4">
              Begin assessment
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
