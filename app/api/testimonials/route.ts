import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedOrigins, loadPublicTestimonials } from "@/lib/public-testimonials";

export const dynamic = "force-dynamic";

/** Live JSON of what may be shown publicly, for a custom design on the website. Never cached; only the website origins may read it from a browser. */
function headers(origin: string | null) {
  const h: Record<string, string> = { "cache-control": "no-store, max-age=0", vary: "Origin" };
  if (origin && embedOrigins().includes(origin)) { h["access-control-allow-origin"] = origin; h["access-control-allow-methods"] = "GET, OPTIONS"; }
  return h;
}
export async function OPTIONS(request: Request) { return new NextResponse(null, { status: 204, headers: headers(request.headers.get("origin")) }); }
export async function GET(request: Request) {
  const items = await loadPublicTestimonials(createClient());
  return NextResponse.json({ testimonials: items }, { headers: headers(request.headers.get("origin")) });
}
