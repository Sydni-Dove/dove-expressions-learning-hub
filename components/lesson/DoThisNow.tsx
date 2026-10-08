/**
 * "Do This Now" — a practical-action callout. Deliberately loud so it can't be
 * mistaken for teaching text: sunrise band, heavy label, checklist styling.
 */
export default function DoThisNow({ title, instruction, items }: { title?: string; instruction?: string; items?: string[] }) {
  const list = (items ?? []).filter(Boolean);
  return (
    <section
      className="my-8 rounded-card-lg border-2 border-sunrise bg-sunrise/[0.08] p-5 sm:p-6"
      aria-label={title || "Do this now"}
      data-testid="do-this-now"
    >
      <p className="font-ui text-xs font-extrabold uppercase tracking-[0.22em] text-sunrise-dark">{title || "Do this now"}</p>
      {instruction && <p className="mt-2 whitespace-pre-line font-body text-lg leading-relaxed text-charcoal">{instruction}</p>}
      {list.length > 0 && (
        <ul className="mt-3 space-y-2 font-body text-charcoal/90">
          {list.map((it, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sunrise" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
