"use client";

import SidePanel from "@/components/lesson/SidePanel";
import type { ScriptureRef } from "@/lib/types";

/** Handles both the single-reference detail view (opened from an inline Scripture
    button in a teaching section) and the full Scripture List view (opened from
    Lesson Tools) — same drawer, two modes, matching the prototype's two panels. */
export default function ScriptureDrawer({
  open,
  onClose,
  activeRef,
  allRefs,
  onSelectRef
}: {
  open: boolean;
  onClose: () => void;
  activeRef: ScriptureRef | null;
  allRefs: ScriptureRef[];
  onSelectRef: (ref: ScriptureRef) => void;
}) {
  return (
    <SidePanel open={open} onClose={onClose} title={activeRef ? "Scripture" : "Scripture List"}>
      {activeRef ? (
        <div>
          <p className="mb-2 font-ui text-xs font-bold uppercase tracking-[0.2em] text-sunrise">{activeRef.reference}</p>
          <p className="font-body text-2xl italic leading-snug text-burgundy" style={{ fontFamily: "var(--font-body)" }}>
            {activeRef.text}
          </p>
          {activeRef.note && <p className="mt-4 font-body leading-relaxed text-charcoal/75">{activeRef.note}</p>}
        </div>
      ) : (
        <div>
          <p className="mb-4 font-body text-sm text-charcoal/70">Every passage referenced in this lesson, for quick review.</p>
          <div className="flex flex-wrap gap-2">
            {allRefs.map((ref) => (
              <button
                key={ref.key}
                type="button"
                onClick={() => onSelectRef(ref)}
                className="min-h-[38px] rounded-control border border-burgundy/20 bg-white px-3 py-2 font-ui text-xs font-bold uppercase tracking-wide text-burgundy transition hover:-translate-y-0.5 hover:border-burgundy/40"
              >
                {ref.reference}
              </button>
            ))}
            {allRefs.length === 0 && <p className="font-body text-sm text-charcoal/50">No Scripture references in this lesson yet.</p>}
          </div>
        </div>
      )}
    </SidePanel>
  );
}
