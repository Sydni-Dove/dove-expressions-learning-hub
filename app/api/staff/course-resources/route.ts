import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles, hasAnyRole } from "@/lib/roles";
import { PRIVATE_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

const KINDS = ["workbook", "reading_edition", "other"];
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Staff upload of a course resource (PDF). The file goes to the private bucket under the first lesson
 * of the course (the existing storage rules require private files to live under lessons/<id>/…), and a
 * dp_course_resources row makes it downloadable by enrolled students through the authorized route.
 * Every write is checked by row-level security as the signed-in staff member.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!hasAnyRole(roles, ["super_admin", "faculty", "teacher"])) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const form = await req.formData();
  const courseId = String(form.get("courseId") || "");
  const title = String(form.get("title") || "").trim();
  const kind = String(form.get("kind") || "workbook");
  const version = String(form.get("version") || "").trim() || null;
  const file = form.get("file");
  if (!courseId || !title || title.length > 120) return NextResponse.json({ error: "Add a title (up to 120 characters)." }, { status: 400 });
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Unknown resource type." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF file." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "The file must be a PDF under 25 MB." }, { status: 400 });
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== "%PDF-") return NextResponse.json({ error: "That doesn't look like a PDF file." }, { status: 400 });

  // anchor: the course's first lesson, in module then lesson order
  const { data: modules } = await supabase.from("dp_modules").select("id,order_index").eq("course_id", courseId).order("order_index");
  const moduleIds = (modules ?? []).map((m) => m.id);
  if (!moduleIds.length) return NextResponse.json({ error: "Add a lesson to the course first." }, { status: 400 });
  const { data: lessons } = await supabase.from("dp_lessons").select("id,module_id,order_index").in("module_id", moduleIds);
  const modOrder = new Map((modules ?? []).map((m) => [m.id, m.order_index]));
  const first = [...(lessons ?? [])].sort((a, b) => (modOrder.get(a.module_id)! - modOrder.get(b.module_id)!) || a.order_index - b.order_index)[0];
  if (!first) return NextResponse.json({ error: "Add a lesson to the course first." }, { status: 400 });

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "file.pdf";
  const path = `lessons/${first.id}/workbooks/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false, cacheControl: "3600" });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const { data: row, error: insErr } = await supabase
    .from("dp_course_resources")
    .insert({ course_id: courseId, kind, title, storage_path: path, file_name: safe, version, created_by: user.id })
    .select("id,kind,title,file_name,version,is_active,created_at")
    .single();
  if (insErr) {
    await supabase.storage.from(PRIVATE_BUCKET).remove([path]);
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }
  return NextResponse.json({ resource: row });
}
