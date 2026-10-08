import { requireRoles } from "@/lib/roles";

// Mirrors the role list for this section in components/nav-config.ts (staffNav).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRoles(["faculty", "teacher", "mentor", "super_admin"]);
  return <>{children}</>;
}
