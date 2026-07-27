export default function LessonTakeaways({ items }: { items: { heading: string; body: string }[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="grid max-w-[820px] gap-3 pt-2">
      {items.map((item, i) => (
        <article key={i} className="card grid grid-cols-[42px_1fr] gap-3.5 p-4">
          <b className="flex h-[42px] items-center justify-center rounded-control bg-burgundy/8 font-display text-lg text-burgundy">{i + 1}</b>
          <div>
            <h3 className="font-display text-lg text-burgundy">{item.heading}</h3>
            <p className="mt-0.5 font-body text-sm text-charcoal/75">{item.body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
