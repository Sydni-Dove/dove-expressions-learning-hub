import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import AssessmentForm from "@/components/AssessmentForm";

export default async function AssessmentPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: definition } = await supabase
    .from("dp_assessment_definitions")
    .select("id,title")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: questions } = await supabase
    .from("dp_assessment_questions")
    .select("id,assessment_id,section,prompt,question_type,options,weight_map,is_required,order_index")
    .eq("assessment_id", definition?.id)
    .order("order_index");

  const { data: categories } = await supabase.from("dp_wiring_categories").select("id,code");
  const categoryCodeToId: Record<string, string> = {};
  (categories ?? []).forEach((c) => (categoryCodeToId[c.code] = c.id));

  const { data: existingResponse } = await supabase
    .from("dp_assessment_responses")
    .select("id,answers")
    .eq("student_id", user!.id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl text-burgundy">{definition?.title || "Spiritual Wiring Assessment"}</h1>
      <p className="mt-2 font-body text-charcoal/70">Answer honestly and prayerfully. There are no wrong answers.</p>
      <div className="mt-8">
        <AssessmentForm
          assessmentId={definition!.id}
          questions={(questions as any) ?? []}
          userId={user!.id}
          existingResponseId={existingResponse?.id ?? null}
          existingAnswers={(existingResponse?.answers as Record<string, number>) ?? {}}
          categoryCodeToId={categoryCodeToId}
        />
      </div>
    </div>
  );
}
