import { Sparkles, Ear, Wind, Compass, type LucideIcon } from "lucide-react";
import type { PathwayCode } from "@/lib/types";

/** The Four Pathways — the platform's primary discipleship organizing model.
    Official listing order stays Draw Near, Hear God, Rooted, Kingdom Mandate
    everywhere (nav, cards, staff builder). The general-progression narrative
    shown alongside it (e.g. on the Discipleship home page) uses
    journey_order_index instead: Draw Near -> Rooted -> Hear God -> Kingdom Mandate. */
export const PATHWAY_ORDER: PathwayCode[] = ["draw_near", "hear_god", "rooted", "kingdom_mandate"];

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
  return `/discipleship/${code}`;
}
