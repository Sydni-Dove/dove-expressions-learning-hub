"use client";

import { useState } from "react";
import { PrototypePreviewBadge, Pill } from "@/components/ui";
import { mockResources } from "@/lib/mock-data";
import { pathwayDisplayLabel } from "@/lib/pathways";

const FILTERS = ["All", "Assigned", "Included with enrollment", "Purchased", "Free", "Downloads", "Audio", "Video", "Worksheets", "Products"];

const PATHWAY_FILTERS: { code: string; label: string }[] = [
  { code: "draw_near", label: "Draw Near" },
  { code: "hear_god", label: "Hear God" },
  { code: "kingdom_mandate", label: "Kingdom Mandate" }
];

const ACCESS_LABEL: Record<string, string> = {
  free: "Free",
  enrolled: "Included with enrollment",
  purchased: "Purchase required",
  role_restricted: "Restricted"
};

export default function LibraryPage() {
  const [filter, setFilter] = useState("All");
  const [pathwayFilter, setPathwayFilter] = useState<string | null>(null);

  const filtered = mockResources.filter((r) => {
    if (pathwayFilter === "draw_near" && !r.pathways.some((code) => code === "draw_near" || code === "rooted")) return false;
    if (pathwayFilter && pathwayFilter !== "draw_near" && !r.pathways.includes(pathwayFilter)) return false;
    if (filter === "All") return true;
    if (filter === "Free") return r.access === "free";
    if (filter === "Included with enrollment") return r.access === "enrolled";
    if (filter === "Purchased") return r.access === "purchased";
    return true; // Downloads/Audio/Video/Worksheets/Products/Assigned filters are illustrative until real media-type data exists
  });

  return (
    <div className="max-w-3xl pb-16">
      <h1 className="font-display text-3xl text-burgundy">Library</h1>
      <p className="mt-1 mb-4 font-body text-charcoal/70">
        One shelf for everything: resources and products, assigned or purchased, downloadable or streamed —
        connected to the pathway they support.
      </p>
      <PrototypePreviewBadge />

      <div className="mb-3">
        <p className="mb-1.5 font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">Pathway</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPathwayFilter(null)}
            className={`pill border ${!pathwayFilter ? "border-burgundy bg-burgundy text-soft" : "border-charcoal/20 text-charcoal/70"}`}
          >
            All Pathways
          </button>
          {PATHWAY_FILTERS.map((p) => (
            <button
              key={p.code}
              onClick={() => setPathwayFilter(p.code)}
              className={`pill border ${pathwayFilter === p.code ? "border-burgundy bg-burgundy text-soft" : "border-charcoal/20 text-charcoal/70"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`pill border ${filter === f ? "border-burgundy bg-burgundy text-soft" : "border-charcoal/20 text-charcoal/70"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-body text-sm text-charcoal/70">No resources match that filter yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={r.access === "free" ? "success" : "neutral"}>{ACCESS_LABEL[r.access]}</Pill>
                {r.pathways.map((code) => {
                  return <Pill key={code} tone="gold">{pathwayDisplayLabel(code)}</Pill>;
                })}
              </div>
              <h3 className="mt-2 font-display text-lg text-burgundy">{r.title}</h3>
              <p className="mt-1 font-ui text-sm text-charcoal/60">{r.category}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
