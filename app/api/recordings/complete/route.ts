import { NextResponse } from "next/server";
import { z } from "zod";
import { recordingLimits } from "@/lib/r2";
import { fail, friendly, r2Delete, r2Head, sessionContext } from "@/lib/recording-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Body = z.object({ id: z.string().uuid(), durationSeconds: z.number().int().positive().max(7200).optional() });

/** Confirms the bytes really reached R2 (HEAD) and are within limits before the recording becomes a saved draft. */
export async function POST(request: Request) {
  const ctx = await sessionContext();
  if ("error" in ctx) return ctx.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Missing recording id.");
  // RLS limits this select to the student's own rows (or Voice staff), so a guessed id reveals nothing.
  const { data: rec } = await ctx.supabase.from("dp_practice_recordings").select("id,storage_key,student_id,status").eq("id", parsed.data.id).maybeSingle();
  if (!rec || rec.student_id !== ctx.user.id) return fail("Recording not found.", 404);
  if (rec.status !== "pending") return NextResponse.json({ ok: true, status: rec.status });
  const head = await r2Head(ctx.cfg, rec.storage_key);
  if (!head.ok || !head.size) return fail("The upload did not finish. Try again.", 409);
  if (head.size > recordingLimits().maxBytes) { await r2Delete(ctx.cfg, rec.storage_key); return fail("That file is too large.", 413); }
  const { error } = await ctx.supabase.rpc("dp_recording_mark_saved", { rid: rec.id, actual_bytes: head.size, seconds: parsed.data.durationSeconds ?? null });
  if (error) return fail(friendly(error), 409);
  return NextResponse.json({ ok: true, status: "saved" });
}
