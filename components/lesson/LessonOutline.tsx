"use client";

import { useEffect, useState } from "react";

export type OutlineItem = { anchor: string; label: string };

export default function LessonOutline({ items }: { items: OutlineItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.anchor ?? "");

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0.01 }
    );
    items.forEach((item) => {
      const el = document.getElementById(item.anchor);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <>
      {/* Mobile: collapsible outline */}
      <details className="card mb-4 lg:hidden">
        <summary className="min-h-[48px] cursor-pointer list-none px-4 py-3 font-ui text-sm font-bold uppercase tracking-wide text-burgundy">
          Lesson Outline
        </summary>
        <nav aria-label="Mobile lesson outline" className="grid gap-1 px-4 pb-4">
          {items.map((item) => (
            <a key={item.anchor} href={`#${item.anchor}`} className="min-h-[40px] py-2 font-body text-sm text-charcoal/75">
              {item.label}
            </a>
          ))}
        </nav>
      </details>

      {/* Desktop: sticky outline */}
      <aside aria-labelledby="outline-heading" className="card sticky top-24 hidden self-start p-4 lg:block">
        <h2 id="outline-heading" className="mb-3 font-ui text-sm font-bold uppercase tracking-wide text-charcoal/70">
          Lesson Outline
        </h2>
        <nav aria-label="Lesson sections" className="grid gap-1">
          {items.map((item) => {
            const isActive = active === item.anchor;
            return (
              <a
                key={item.anchor}
                href={`#${item.anchor}`}
                aria-current={isActive ? "location" : undefined}
                className={`min-h-[40px] rounded-r-control border-l-[3px] px-3 py-2 font-body text-sm leading-snug transition ${
                  isActive ? "border-gold bg-pale-pink/40 font-bold text-burgundy" : "border-transparent text-charcoal/60 hover:text-burgundy"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
