import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, friendly, sessionContext } from "@/lib/recording-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Body = z.object({ id: z.string().uuid(), outcome: z.enum(["reviewed", "returned"]), feedback: z.string().trim().min(1).max(4000), followUp: z.string().trim().max(1000).optional() });

/** Instructor feedback. Appends; never edits the recording or earlier feedback. Authorization is enforced in the database. */
export async function POST(request: Request) {
  const ctx = await sessionContext();
  if ("error" in ctx) return ctx.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Write feedback before sending.");
  const { error } = await ctx.supabase.rpc("dp_recording_review", { rid: parsed.data.id, outcome: parsed.data.outcome, feedback_text: parsed.data.feedback, follow_up_text: parsed.data.followUp ?? null });
  if (error) return fail(friendly(error), 403);
  return NextResponse.json({ ok: true });
}
