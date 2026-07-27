/** Shared helpers for turning a pasted YouTube/Vimeo URL into a real embeddable
    player URL. Used by both the simple "video" lesson block and the richer
    "lesson_media" block so there's one source of truth for this logic. */

export function detectVideoProvider(url: string): "youtube" | "vimeo" | "video" {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  return "video";
}

export function getEmbedUrl(url?: string | null, provider?: string | null): string | null {
  if (!url) return null;
  if (provider === "youtube" || /youtube\.com|youtu\.be/i.test(url)) {
    const idMatch = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/);
    return idMatch ? `https://www.youtube.com/embed/${idMatch[1]}` : null;
  }
  if (provider === "vimeo" || /vimeo\.com/i.test(url)) {
    const idMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return idMatch ? `https://player.vimeo.com/video/${idMatch[1]}` : null;
  }
  return null;
}

export function isDirectMediaFile(url?: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4a|mp3|wav)(\?.*)?$/i.test(url);
}
