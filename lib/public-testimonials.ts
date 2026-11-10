import type { SupabaseClient } from "@supabase/supabase-js";
import { TESTIMONIAL_BUCKET } from "@/lib/recordings";

export type PublicTestimonial = { id: string; name: string; text: string | null; videoUrl: string | null };

/** How long a video link lives. Withdrawal stops new links at once; an already issued link can play until it expires. */
export const VIDEO_LINK_SECONDS = 600;

/**
 * Everything that may be shown publicly, read live on every request (never cached): approved, consented, published and not
 * withdrawn. Every public surface (page, embed, JSON) goes through here so a withdrawal removes the review from all of them.
 */
export async function loadPublicTestimonials(supabase: SupabaseClient): Promise<PublicTestimonial[]> {
  const { data, error } = await supabase.rpc("dp_public_testimonials");
  if (error) return [];
  return Promise.all((data ?? []).map(async (r: { id: string; display_name: string; review_text: string | null; video_path: string | null }) => ({
    id: r.id, name: r.display_name, text: r.review_text,
    videoUrl: r.video_path ? (await supabase.storage.from(TESTIMONIAL_BUCKET).createSignedUrl(r.video_path, VIDEO_LINK_SECONDS)).data?.signedUrl ?? null : null
  })));
}

export const DEFAULT_EMBED_ORIGINS = ["https://doveexpressions.org", "https://www.doveexpressions.org"];
export function embedOrigins(env = process.env.TESTIMONIAL_EMBED_ORIGINS): string[] {
  const list = (env ?? "").split(",").map(s => s.trim()).filter(s => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(s));
  return list.length ? list : DEFAULT_EMBED_ORIGINS;
}
