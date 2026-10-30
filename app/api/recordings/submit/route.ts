import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, friendly, sessionContext } from "@/lib/recording-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Body = z.object({ ids: z.array(z.string().uuid()).min(1).max(20) });

export async function POST(request: Request) {
  const ctx = await sessionContext();
  if ("error" in ctx) return ctx.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Choose at least one saved recording.");
  const { data, error } = await ctx.supabase.rpc("dp_recording_submit", { ids: parsed.data.ids });
  if (error) return fail(friendly(error), 403);
  return NextResponse.json({ submitted: data ?? 0 });
}
