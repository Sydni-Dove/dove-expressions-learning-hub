import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { r2Config, recordingLimits } from "@/lib/r2";
import { r2Delete } from "@/lib/recording-server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Scheduled cleanup (e.g. a daily cron): deletes abandoned and discarded uploads from R2, then marks the rows purged.
 *  Submitted, reviewed and returned recordings are never touched. Requires CRON_SECRET and the service-role key. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET; const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; const cfg = r2Config();
  if (!secret || !url || !key || !cfg) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("dp_recording_cleanup_candidates", { pending_hours: recordingLimits().pendingExpiryHours });
  if (error) return NextResponse.json({ error: "Could not list candidates" }, { status: 500 });
  const done: string[] = [];
  for (const row of (data ?? []) as { id: string; storage_key: string }[]) if (await r2Delete(cfg, row.storage_key).catch(() => false)) done.push(row.id);
  if (done.length) await admin.rpc("dp_recording_mark_purged", { ids: done });
  return NextResponse.json({ candidates: (data ?? []).length, purged: done.length });
}
