import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import AppShell from "@/components/AppShell";
import { getStudentPrograms } from "@/lib/student-programs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { roles } = await getCurrentUserAndRoles();
  const programs = await getStudentPrograms(user.id);
  const displayName = (user!.user_metadata as { full_name?: string })?.full_name || user!.email || "Friend";

  return (
    <AppShell roles={roles} programs={programs} userLabel={displayName}>
      {children}
    </AppShell>
  );
}
