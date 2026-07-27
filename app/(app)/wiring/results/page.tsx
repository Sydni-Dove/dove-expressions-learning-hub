import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { DiscernmentNote, Pill, EmptyState } from "@/components/ui";

export default async function WiringResultsPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: result } = await supabase
    .from("dp_wiring_results")
    .select("id,generated_at,scores,primary_category_id,secondary_category_id,result_status,close_secondary_ids")
    .eq("student_id", user!.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!result) {
    return (
      <div className="max-w-2xl">
        <EmptyState title="No results yet" body="Complete the Spiritual Wiring Assessment to see your results here." />
        <Link href="/wiring/assessment" className="btn-primary mt-4">
          Take the assessment
        </Link>
      </div>
    );
  }

  const categoryIds = [result.primary_category_id, result.secondary_category_id].filter(Boolean) as string[];
  const { data: categories } = categoryIds.length
    ? await supabase.from("dp_wiring_categories").select("*").in("id", categoryIds)
    : { data: [] };
  const primary = categories?.find((c) => c.id === result.primary_category_id);
  const secondary = categories?.find((c) => c.id === result.secondary_category_id);

  const { data: reflection } = await supabase
    .from("dp_wiring_reflections")
    .select("id")
    .eq("result_id", result.id)
    .maybeSingle();

  const STATUS_LABEL: Record<string, string> = {
    clear_pattern: "A fairly clear pattern emerged",
    developing_pattern: "A developing pattern — likely to sharpen with more reflection",
    inconclusive: "Inconclusive — treat this as a starting point, not a conclusion",
    requires_discussion: "Requires discussion with your mentor before drawing conclusions",
    multiple_close_results: "Several results were close together — no single dominant pattern yet"
  };

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">Your Spiritual Wiring</h1>
        <p className="mt-1 font-ui text-xs text-charcoal/50">
          Automated result — generated {new Date(result.generated_at).toLocaleDateString()}
        </p>
      </div>

      <div className="rounded-card border border-charcoal/15 bg-white px-4 py-3">
        <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">Result status</p>
        <p className="mt-1 font-body text-sm text-charcoal">{STATUS_LABEL[result.result_status] ?? result.result_status}</p>
      </div>

      <DiscernmentNote>
        This is a discernment tool, not a declaration of who you are. It reflects your responses to a
        questionnaire, not a word from God about your identity. Hold it loosely, test it against Scripture
        and the fruit of your life, and talk it through with your mentor — including any part of it you
        disagree with. A full disagreement/adjustment record is captured with your mentor during your
        Spiritual Wiring Profile review.
      </DiscernmentNote>

      {primary && (
        <div className="card p-6">
          <Pill tone="burgundy">Primary</Pill>
          <h2 className="mt-2 font-display text-2xl text-burgundy">{primary.name}</h2>
          {primary.description && <p className="mt-2 font-body text-charcoal/80">{primary.description}</p>}
        </div>
      )}
      {secondary && (
        <div className="card p-6">
          <Pill tone="sunrise">Secondary</Pill>
          <h2 className="mt-2 font-display text-xl text-burgundy">{secondary.name}</h2>
          {secondary.description && <p className="mt-2 font-body text-charcoal/80">{secondary.description}</p>}
        </div>
      )}

      <div className="card p-6">
        <h3 className="font-display text-lg text-burgundy">Result Reflection</h3>
        {reflection ? (
          <p className="mt-2 font-body text-sm text-charcoal/70">You've completed your reflection. Your mentor can now review it alongside your results.</p>
        ) : (
          <>
            <p className="mt-2 font-body text-sm text-charcoal/70">
              Before your discovery session, reflect on what resonates, what surprises you, and what you want
              to grow in.
            </p>
            <Link href="/wiring/reflection" className="btn-primary mt-4">
              Start my reflection
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
