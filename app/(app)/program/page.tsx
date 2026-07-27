import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill } from "@/components/ui";

const PHASES = [
  { key: "draw_near", name: "Draw Near & Establish Foundations", weeks: "Weeks 1–10" },
  { key: "hear_god", name: "Hear God & Steward Revelation", weeks: "Weeks 11–15" },
  { key: "identity_wiring", name: "Identity & Spiritual Wiring", weeks: "Weeks 16–20" },
  { key: "roles_mandate", name: "Roles, Mandate & Execution", weeks: "Weeks 21–25" }
];

export default async function ProgramPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: program } = await supabase
    .from("dp_programs")
    .select("id,name,description,phase_structure")
    .eq("slug", "guided-discipleship-journey")
    .maybeSingle();

  const { data: enrollment } = await supabase
    .from("dp_enrollments")
    .select("id,status,enrolled_at")
    .eq("user_id", user!.id)
    .eq("scope_type", "program")
    .eq("scope_id", program?.id)
    .maybeSingle();

  return (
    <div className="max-w-3xl space-y-8 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">{program?.name || "My Program"}</h1>
        {program?.description && <p className="mt-2 font-body text-charcoal/70">{program.description}</p>}
        {enrollment ? (
          <Pill tone="success">Enrolled since {new Date(enrollment.enrolled_at).toLocaleDateString()}</Pill>
        ) : (
          <p className="mt-3 font-body text-sm text-charcoal/60">
            You're not formally enrolled in this program yet — talk with your mentor about beginning.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {PHASES.map((phase, i) => (
          <div key={phase.key} className="card flex items-start gap-4 p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy font-ui text-sm font-bold text-soft">
              {i + 1}
            </span>
            <div>
              <h2 className="font-display text-lg text-burgundy">{phase.name}</h2>
              <p className="font-ui text-xs text-charcoal/50">{phase.weeks}</p>
            </div>
          </div>
        ))}
      </div>

      {!program && <EmptyState title="Program not found" body="Your default discipleship program will appear here once configured." />}
    </div>
  );
}
