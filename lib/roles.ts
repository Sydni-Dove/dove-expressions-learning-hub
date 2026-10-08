import { createClient } from "@/lib/supabase/server";
import type { DpRole } from "@/lib/types";

/**
 * Reads the current user's roles server-side. This is a UX convenience for deciding what to
 * render — it is NOT the security boundary. The real boundary is Postgres RLS on every dp_
 * table (see supabase/migrations). Even if this function is wrong or bypassed, the database
 * itself will refuse unauthorized reads/writes.
 */
export async function getCurrentUserAndRoles() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { user: null, roles: [] as DpRole[] };

  const { data: roleRows } = await supabase.from("dp_user_roles").select("role").eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role as DpRole);

  return { user, roles: roles.length ? roles : (["student"] as DpRole[]) };
}

export function hasAnyRole(roles: DpRole[], check: DpRole[]) {
  return roles.some((r) => check.includes(r));
}

/**
 * Route guard for staff-only sections. Redirects anyone without one of the given
 * roles (signed-out users to /login, everyone else to /dashboard). This hides the
 * staff UI shell from students; it is defense in depth — the real boundary is
 * still Postgres RLS on every dp_ table.
 */
export async function requireRoles(allowed: DpRole[]) {
  const { redirect } = await import("next/navigation");
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  if (!hasAnyRole(roles, allowed)) redirect("/dashboard");
  return { user: user!, roles };
}
