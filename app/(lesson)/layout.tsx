import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Dedicated layout for the lesson-viewing experience. Deliberately does NOT wrap
 * children in the standard <AppShell> sidebar/nav — the lesson page has its own
 * compact sticky header (LessonHeader), matching the preserved prototype design,
 * which would otherwise be redundant alongside the full app sidebar. Every other
 * route keeps the normal AppShell via app/(app)/layout.tsx; this route group only
 * covers the lesson-detail page itself. Auth is still enforced the same way.
 */
export default async function LessonLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <div className="min-h-screen bg-soft">{children}</div>;
}
