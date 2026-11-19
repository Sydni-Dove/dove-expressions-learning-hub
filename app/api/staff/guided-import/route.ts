import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles, hasAnyRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Staff import of a guided course (JSON) into an existing course. All validation and writing happens in
 * the database function dp_import_guided_course, which runs as the signed-in staff member (row-level
 * security applies), archives what it replaces, never publishes, and never enrolls anyone.
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
  const { courseId, payload, options } = body ?? {};
  if (typeof courseId !== "string" || !payload || typeof payload !== "object" || !Array.isArray(payload.sections)) {
    return NextResponse.json({ error: "Send a course id and a guided-course JSON with sections." }, { status: 400 });
  }
  if (JSON.stringify(payload).length > 3_000_000) return NextResponse.json({ error: "That file is too large to import." }, { status: 413 });

  const { data, error } = await supabase.rpc("dp_import_guided_course", {
    p_course_id: courseId,
    p_payload: payload,
    p_options: options && typeof options === "object" ? options : {}
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ result: data });
}
