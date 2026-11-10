import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, friendly, r2Delete, sessionContext } from "@/lib/recording-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Body = z.object({ id: z.string().uuid() });

/** Removes an unsubmitted draft. The database refuses submitted/reviewed/returned recordings, so history is never lost. */
export async function POST(request: Request) {
  const ctx = await sessionContext();
  if ("error" in ctx) return ctx.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Missing recording id.");
  const { data: key, error } = await ctx.supabase.rpc("dp_recording_discard", { rid: parsed.data.id });
  if (error || !key) return fail(friendly(error), 409);
  // Best effort now; the cleanup job removes anything this misses.
  const removed = await r2Delete(ctx.cfg, key as string).catch(() => false);
  if (removed) await ctx.supabase.rpc("dp_recording_mark_purged", { ids: [parsed.data.id] }).then(() => null, () => null);
  return NextResponse.json({ ok: true });
}
