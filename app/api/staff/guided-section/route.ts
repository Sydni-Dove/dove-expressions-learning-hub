import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles, hasAnyRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Staff replacement of ONE guided lesson's screens (teaching pages, each followed by its own questions).
 * All validation and writing happens in dp_replace_guided_section, which runs as the signed-in staff member
 * (row-level security applies), archives what it replaces, never publishes, and never enrolls anyone.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!hasAnyRole(roles, ["super_admin", "faculty", "teacher"])) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That isn't valid JSON." }, { status: 400 });
  }
  const { lessonId, section, note } = body ?? {};
  if (typeof lessonId !== "string" || !section || typeof section !== "object" || !Array.isArray(section.steps)) {
    return NextResponse.json({ error: "Send a lesson id and a section with steps." }, { status: 400 });
  }
  if (JSON.stringify(section).length > 1_000_000) return NextResponse.json({ error: "That section is too large." }, { status: 413 });

  const { data, error } = await supabase.rpc("dp_replace_guided_section", {
    p_lesson_id: lessonId,
    p_section: section,
    p_note: typeof note === "string" ? note : null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ result: data });
}
