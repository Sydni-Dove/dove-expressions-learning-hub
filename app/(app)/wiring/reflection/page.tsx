import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import ReflectionForm from "@/components/ReflectionForm";

export default async function ReflectionPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: result } = await supabase
    .from("dp_wiring_results")
    .select("id")
    .eq("student_id", user!.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!result) redirect("/wiring");

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-burgundy">Reflect on Your Results</h1>
      <p className="mt-2 font-body text-charcoal/70">
        Take your time. This reflection is for you and your mentor, not a test to pass.
      </p>
      <div className="mt-8">
        <ReflectionForm resultId={result.id} studentId={user!.id} />
      </div>
    </div>
  );
}
