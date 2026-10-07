import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage buckets (created in migration 0026).
 *  - PUBLIC_BUCKET  — cover images / thumbnails. Served at permanent public URLs.
 *  - PRIVATE_BUCKET — lesson video/audio/workbooks/resources. NEVER public; only
 *    reachable through short-lived signed URLs minted server-side, gated by the
 *    private bucket's RLS (which inherits lesson-access rules).
 */
export const PUBLIC_BUCKET = "course-media";
export const PRIVATE_BUCKET = "course-media-private";

/** How long a signed URL to protected media stays valid (seconds). */
export const SIGNED_URL_TTL = 60 * 60; // 1 hour

/**
 * Marker a media field resolves to when a storage reference EXISTS but a signed
 * URL could not be minted — i.e. the caller is not authorized, the object is
 * missing, or signing errored. Distinct from an empty/absent field (which means
 * "no media added yet"). Renderers use this to show a "restricted / unavailable"
 * state instead of a misleading "not added yet" state. Not a real URL.
 */
export const MEDIA_UNAVAILABLE = "unavailable://denied";

const STORAGE_PREFIX = "storage://";

/**
 * A reference to a PRIVATE object, stored in lesson-block content in place of a
 * URL. Shape: `storage://<bucket>/<path>`. We never store a URL for protected
 * media because any URL we could store would either be public (a leak) or expire.
 */
export function makeStorageRef(bucket: string, path: string): string {
  return `${STORAGE_PREFIX}${bucket}/${path}`;
}

export function isStorageRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(STORAGE_PREFIX);
}

export function parseStorageRef(value: string): { bucket: string; path: string } | null {
  if (!isStorageRef(value)) return null;
  const rest = value.slice(STORAGE_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

/**
 * Recursively walk a block-content value and replace every `storage://…`
 * reference with a freshly-signed URL. Signing uses the passed (session-scoped)
 * Supabase client, so it is subject to the private bucket's RLS — a caller who
 * can't read the owning lesson simply can't sign, and the ref resolves to an
 * empty string (fails closed → the viewer shows its honest "not added" state).
 *
 * Called server-side, on the lesson page, before content reaches the browser.
 */
export async function resolveStorageContent(
  supabase: SupabaseClient,
  value: any
): Promise<any> {
  if (isStorageRef(value)) {
    const ref = parseStorageRef(value);
    if (!ref) return MEDIA_UNAVAILABLE;
    const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, SIGNED_URL_TTL);
    // A ref existed but we couldn't sign it: not authorized, missing, or errored.
    // Surface it as unavailable — never as "no media" — so denied ≠ not-added.
    if (error || !data?.signedUrl) return MEDIA_UNAVAILABLE;
    return data.signedUrl;
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => resolveStorageContent(supabase, v)));
  }
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = await resolveStorageContent(supabase, v);
    }
    return out;
  }
  return value;
}
