import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, friendly, sessionContext } from "@/lib/recording-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Body = z.object({ id: z.string().uuid(), exerciseId: z.string().uuid(), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().trim().max(1000).optional() });

/** Assigns a specific library exercise to the student from a recording's feedback. The database checks staff rights, that the recording was
 *  submitted, and that optional-track / request-only exercises are allowed for this student. Adds a new feedback entry; nothing is overwritten. */
export async function POST(request: Request) {
  const ctx = await sessionContext();
  if ("error" in ctx) return ctx.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Choose an exercise and a due date.");
  const { data, error } = await ctx.supabase.rpc("dp_recording_assign_followup", { rid: parsed.data.id, exercise: parsed.data.exerciseId, due: parsed.data.due, note: parsed.data.note ?? null });
  if (error) return fail(friendly(error), 403);
  return NextResponse.json({ assignmentId: data });
}
