import type { ScriptureRef } from "@/lib/types";

export default function TeachingSection({
  anchor,
  sectionNumber,
  heading,
  paragraphs,
  scriptureRefs,
  quote,
  takeaway,
  onOpenScripture
}: {
  anchor: string;
  sectionNumber?: string;
  heading: string;
  paragraphs: string[];
  scriptureRefs?: ScriptureRef[];
  quote?: string;
  takeaway?: string;
  onOpenScripture: (ref: ScriptureRef) => void;
}) {
  return (
    <section id={anchor} aria-labelledby={`${anchor}-heading`} className="scroll-mt-24 border-b border-charcoal/10 py-8 first:pt-0">
      {sectionNumber && <span className="mb-2 block font-display text-2xl text-gold">{sectionNumber}</span>}
      <h2 id={`${anchor}-heading`} className="mb-3 font-display text-2xl text-burgundy sm:text-3xl">
        {heading}
      </h2>

      <div className="max-w-[760px] space-y-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="font-body text-[1.02rem] leading-[1.85] text-charcoal/85">
            {p}
          </p>
        ))}
      </div>

      {scriptureRefs && scriptureRefs.length > 0 && (
        <div className="my-4 flex flex-wrap gap-2" aria-label="Scripture references">
          {scriptureRefs.map((ref) => (
            <button
              key={ref.key}
              type="button"
              onClick={() => onOpenScripture(ref)}
              className="min-h-[38px] rounded-control border border-burgundy/20 bg-white px-3 py-2 font-ui text-xs font-bold uppercase tracking-wide text-burgundy transition hover:-translate-y-0.5 hover:border-burgundy/40"
            >
              {ref.reference}
            </button>
          ))}
        </div>
      )}

      {quote && (
        <blockquote className="my-5 max-w-[760px] border-l-[3px] border-gold bg-pale-pink/30 px-5 py-4 font-body text-xl italic leading-snug text-burgundy sm:text-2xl">
          {quote}
        </blockquote>
      )}

      {takeaway && (
        <div className="max-w-[760px] rounded-control border border-gold/40 bg-gold/10 px-4 py-3.5 font-body text-sm text-charcoal">
          <strong className="text-burgundy">Teaching takeaway:</strong> {takeaway}
        </div>
      )}
    </section>
  );
}
