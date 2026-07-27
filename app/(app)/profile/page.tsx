import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import ProfileForm from "@/components/ProfileForm";
import { Pill } from "@/components/ui";

export default async function ProfilePage() {
  const supabase = createClient();
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name,email,avatar_url").eq("id", user!.id).maybeSingle();

  return (
    <div className="max-w-2xl space-y-8 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">My Profile</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {roles.map((r) => (
            <Pill key={r} tone="burgundy">
              {r.replace(/_/g, " ")}
            </Pill>
          ))}
        </div>
      </div>

      <ProfileForm userId={user!.id} initialFullName={profile?.full_name || ""} email={profile?.email || user!.email || ""} />

      <div className="card max-w-xl p-6">
        <h2 className="font-display text-lg text-burgundy">Privacy</h2>
        <p className="mt-2 font-body text-sm text-charcoal/70">
          Choose what's visible to faculty, your mentor, your cohort, the wider community, or nobody but you.
          Fine-grained privacy controls are part of Phase 2 — for now, everything you create (notes, journal
          entries, prayer requests) defaults to private and is only shared when you explicitly choose to
          share it.
        </p>
      </div>
    </div>
  );
}
