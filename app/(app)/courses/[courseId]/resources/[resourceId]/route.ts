import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PRIVATE_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Authorized download of a course resource (e.g. the workbook PDF). The file lives in the private
 * bucket; nobody receives a permanent URL. Access is decided by the database: the resource row is only
 * readable by staff or by an enrolled student of a published course, and the storage object is only
 * signable under the same lesson-access rules. A short-lived signed URL is minted for this request only.
 */
export async function GET(_req: Request, { params }: { params: { courseId: string; resourceId: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Sign in to download this file.", { status: 401, headers: NO_STORE });

  const { data: resource } = await supabase
    .from("dp_course_resources")
    .select("id,course_id,storage_path,file_name,is_active")
    .eq("id", params.resourceId)
    .eq("course_id", params.courseId)
    .maybeSingle();
  if (!resource) return new NextResponse("This file isn't available to your account.", { status: 404, headers: NO_STORE });

  const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(resource.storage_path, 60, { download: resource.file_name || true });
  if (error || !data?.signedUrl) return new NextResponse("This file isn't available to your account.", { status: 404, headers: NO_STORE });

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: NO_STORE });
}
