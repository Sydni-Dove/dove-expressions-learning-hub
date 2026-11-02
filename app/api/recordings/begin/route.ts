import { NextResponse } from "next/server";
import { z } from "zod";
import { checkUpload, presign, recordingLimits } from "@/lib/r2";
import { fail, friendly, sessionContext } from "@/lib/recording-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  assignmentId: z.string().uuid().nullable().optional(), lessonId: z.string().uuid().nullable().optional(),
  label: z.string().max(40).default("Personal practice"), title: z.string().max(120).default(""),
  part: z.number().int().min(1).max(50).default(1), contentType: z.string().max(80), size: z.number().int().positive(),
  durationSeconds: z.number().int().positive().max(7200).optional(), reviseOf: z.string().uuid().nullable().optional()
});

/** Reserve a recording (database checks enrollment and assignment ownership), then hand back a short-lived upload URL. */
export async function POST(request: Request) {
  const ctx = await sessionContext();
  if ("error" in ctx) return ctx.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Check the recording details and try again.");
  const b = parsed.data; const limits = recordingLimits();
  const type = b.contentType.split(";")[0].trim().toLowerCase();
  const problem = checkUpload({ contentType: type, size: b.size, durationSeconds: b.durationSeconds }, limits);
  if (problem) return fail(problem);
  const { data, error } = await ctx.supabase.rpc("dp_recording_begin", {
    asg: b.assignmentId ?? null, lesson: b.lessonId ?? null, rec_label: b.label, rec_title: b.title, part: b.part, ctype: type,
    bytes: b.size, seconds: b.durationSeconds ?? null, revise: b.reviseOf ?? null, max_parts: limits.maxPartsPerAssignment, max_bytes: limits.maxBytes
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return fail(friendly(error), 403);
  const uploadUrl = presign(ctx.cfg, "PUT", row.storage_key, limits.uploadUrlSeconds, { contentType: type });
  return NextResponse.json({ id: row.id, uploadUrl, contentType: type, expiresIn: limits.uploadUrlSeconds }, { headers: { "Cache-Control": "no-store" } });
}
