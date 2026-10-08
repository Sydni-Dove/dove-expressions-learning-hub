import { Sparkles, Ear, Wind, Compass, type LucideIcon } from "lucide-react";
import type { PathwayCode } from "@/lib/types";

/** Three top-level pathways. Rooted is retained as a nested formation track
    within Draw Near so older course/resource/progress tags remain readable. */
export const PRIMARY_PATHWAY_ORDER: PathwayCode[] = ["draw_near", "hear_god", "kingdom_mandate"];
export const INTERNAL_PATHWAY_ORDER: PathwayCode[] = ["draw_near", "hear_god", "rooted", "kingdom_mandate"];
export const PATHWAY_ORDER = PRIMARY_PATHWAY_ORDER;

export const ROOTED_TRACK = {
  code: "rooted",
  parentCode: "draw_near",
  name: "Rooted",
  title: "Rooted: Spiritual Formation, Healing, and Maturity",
  description:
    "Become established in Christ in your identity, thinking, character, emotional life, and spiritual practices.",
  seriesTitle: "The Mind of Christ",
  seriesSubtitle: "Learning to Think, Discern, and Respond From Christ's Perspective"
} as const;

export function isPrimaryPathwayCode(code: string): code is PathwayCode {
  return PRIMARY_PATHWAY_ORDER.includes(code as PathwayCode);
}

export function getPrimaryPathwayCode(code: string): PathwayCode {
  return code === ROOTED_TRACK.code ? ROOTED_TRACK.parentCode : (code as PathwayCode);
}

export function pathwayDisplayLabel(code: string): string {
  if (code === ROOTED_TRACK.code) return "Draw Near · Rooted";
  const labels: Record<string, string> = {
    draw_near: "Draw Near",
    hear_god: "Hear God",
    kingdom_mandate: "Kingdom Mandate"
  };
  return labels[code] ?? code.replace(/_/g, " ");
}

export const PATHWAY_ICONS: Record<PathwayCode, LucideIcon> = {
  draw_near: Sparkles,
  hear_god: Ear,
  rooted: Wind,
  kingdom_mandate: Compass
};

export const PATHWAY_STYLES: Record<PathwayCode, { badge: string; band: string; text: string; wash: string }> = {
  draw_near: { badge: "bg-pale-pink text-burgundy", band: "card-band-burgundy", text: "text-burgundy", wash: "bg-pink-wash" },
  hear_god: { badge: "bg-coral/15 text-coral-dark", band: "card-band-coral", text: "text-coral-dark", wash: "bg-coral/5" },
  rooted: { badge: "bg-gold/15 text-gold-dark", band: "card-band-gold", text: "text-gold-dark", wash: "bg-gold/5" },
  kingdom_mandate: { badge: "bg-sunrise/15 text-sunrise-dark", band: "card-band-sunrise", text: "text-sunrise-dark", wash: "bg-sunrise/5" }
};

/** Qualitative formation-stage language — used alongside (never instead of) a
    numeric progress indicator, per the "don't reduce spiritual growth to
    percentages alone" direction. */
export function formationStage(percent: number): string {
  if (percent <= 0) return "Exploring";
  if (percent < 25) return "Establishing";
  if (percent < 50) return "Practicing";
  if (percent < 75) return "Growing";
  if (percent < 100) return "Applying";
  return "Completed";
}

export function pathwayHref(code: PathwayCode): string {
  return `/discipleship/${getPrimaryPathwayCode(code)}`;
}
