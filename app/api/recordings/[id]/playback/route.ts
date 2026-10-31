import { NextResponse } from "next/server";
import { presign, recordingLimits } from "@/lib/r2";
import { fail, sessionContext } from "@/lib/recording-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streaming URL (not a download). Ownership is decided by RLS on the metadata row BEFORE anything is signed. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await sessionContext();
  if ("error" in ctx) return ctx.error;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return fail("Recording not found.", 404);
  const { data: rec } = await ctx.supabase.from("dp_practice_recordings").select("storage_key,content_type,status").eq("id", params.id).maybeSingle();
  if (!rec || rec.status === "pending" || rec.status === "discarded") return fail("Recording not found.", 404);
  const seconds = recordingLimits().playbackUrlSeconds;
  return NextResponse.json({ url: presign(ctx.cfg, "GET", rec.storage_key, seconds), contentType: rec.content_type, expiresIn: seconds }, { headers: { "Cache-Control": "no-store" } });
}
