import Link from "next/link";
import { redirect } from "next/navigation";
import IntakeForm from "@/components/voice/IntakeForm";
import { createClient } from "@/lib/supabase/server";
import { getMyAccess } from "@/lib/voice-access";
import { getCurrentUserAndRoles } from "@/lib/roles";

export const dynamic = "force-dynamic";
export default async function IntakePage() {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  // Intake needs no payment: enrolled students and people the instructor invited after a consultation.
  if (!(await getMyAccess(createClient())).intake) redirect("/dashboard");
  return (
    <div className="space-y-6 pb-20">
      <Link href="/voice" className="inline-flex min-h-[44px] items-center font-ui text-sm font-semibold text-[#630000] underline">← Voice Home</Link>
      <h1 className="font-display text-4xl text-[#630000]">Tell us your goals</h1>
      <p className="max-w-2xl font-body text-[#4a3a3a]">This follows your consultation. It is about what you want, not how well you sing today. Skip anything you like. Your answers are private to you and your Voice instructor.</p>
      <IntakeForm />
    </div>
  );
}
