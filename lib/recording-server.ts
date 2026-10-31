import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presign, r2Config, type R2Config } from "@/lib/r2";

/** Shared by the /api/recordings routes. Every route authenticates with the caller's session; R2 keys stay on the server. */
export async function sessionContext() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) } as const;
  const cfg = r2Config();
  if (!cfg) return { error: NextResponse.json({ error: "Recording storage is not configured yet" }, { status: 503 }) } as const;
  return { supabase, user: data.user, cfg } as const;
}

export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
/** Database errors are written for people; hide anything that is not one of ours. */
export function friendly(error: { message: string } | null | undefined) {
  const m = error?.message ?? "";
  if (/Voice enrollment|not yours|maximum number|larger|returned for revision|unsubmitted|not authorized|not found|already saved|submitted|not available for this student|Follow-up/i.test(m)) return m;
  if (/duplicate key|unique/i.test(m)) return "That part already has a recording. Choose the next part number or revise the returned one.";
  return "Could not complete that request.";
}

export async function r2Head(cfg: R2Config, key: string): Promise<{ ok: boolean; size?: number; type?: string }> {
  const res = await fetch(presign(cfg, "HEAD", key, 60), { method: "HEAD" });
  if (!res.ok) return { ok: false };
  return { ok: true, size: Number(res.headers.get("content-length") ?? 0), type: res.headers.get("content-type") ?? undefined };
}
export async function r2Delete(cfg: R2Config, key: string) {
  const res = await fetch(presign(cfg, "DELETE", key, 60), { method: "DELETE" });
  return res.ok || res.status === 404;
}
