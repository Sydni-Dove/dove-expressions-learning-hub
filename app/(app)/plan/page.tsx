import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill } from "@/components/ui";
import ActionStepToggle from "@/components/ActionStepToggle";
import { pathwayDisplayLabel } from "@/lib/pathways";

export default async function PlanPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: plan } = await supabase
    .from("dp_discipleship_plans")
    .select("id,current_season,mentor_notes,review_date,status,version")
    .eq("student_id", user!.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl text-burgundy">My Discipleship Plan</h1>
        <div className="mt-6">
          <EmptyState
            title="Your plan isn't built yet"
            body="After your Spiritual Wiring review and discovery session, your mentor will build a personalized plan with you here."
          />
        </div>
      </div>
    );
  }

  const { data: goals } = await supabase
    .from("dp_goals")
    .select("id,title,pillar,pathways,reason,desired_growth,status,review_date")
    .eq("plan_id", plan.id);

  const goalIds = (goals ?? []).map((g) => g.id);
  const { data: steps } = goalIds.length
    ? await supabase.from("dp_action_steps").select("id,goal_id,title,description,due_date,status").in("goal_id", goalIds)
    : { data: [] };

  return (
    <div className="max-w-3xl space-y-8 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">My Discipleship Plan</h1>
        {plan.current_season && <p className="mt-2 font-body text-charcoal/80">Current season: <strong>{plan.current_season}</strong></p>}
        {plan.review_date && (
          <p className="mt-1 font-ui text-xs text-charcoal/50">Next review: {new Date(plan.review_date).toLocaleDateString()}</p>
        )}
      </div>

      <div className="space-y-6">
        {(goals ?? []).map((goal) => (
          <div key={goal.id} className="card p-6">
            <div className="flex flex-wrap items-center gap-2">
              {goal.pathways && goal.pathways.length > 0 ? (
                goal.pathways.map((code: string) => (
                  <Pill key={code} tone="burgundy">{pathwayDisplayLabel(code)}</Pill>
                ))
              ) : (
                goal.pillar && <Pill tone="burgundy">{goal.pillar.replace(/_/g, " ")}</Pill>
              )}
              <Pill tone={goal.status === "completed" ? "success" : "neutral"}>{goal.status}</Pill>
            </div>
            <h2 className="mt-3 font-display text-xl text-burgundy">{goal.title}</h2>
            {goal.reason && <p className="mt-2 font-body text-sm text-charcoal/70">{goal.reason}</p>}
            {goal.desired_growth && (
              <p className="mt-2 font-body text-sm text-charcoal/80">
                <strong>Desired growth:</strong> {goal.desired_growth}
              </p>
            )}

            <div className="mt-4 space-y-2">
              {(steps ?? [])
                .filter((s) => s.goal_id === goal.id)
                .map((step) => (
                  <ActionStepToggle key={step.id} step={step} />
                ))}
              {(steps ?? []).filter((s) => s.goal_id === goal.id).length === 0 && (
                <p className="font-ui text-xs text-charcoal/50">No action steps yet for this goal.</p>
              )}
            </div>
          </div>
        ))}
        {(!goals || goals.length === 0) && (
          <EmptyState title="No goals yet" body="Your mentor will add seasonal goals here after your next session." />
        )}
      </div>
    </div>
  );
}
