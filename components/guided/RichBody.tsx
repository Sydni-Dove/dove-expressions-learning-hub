import { parseBody } from "@/lib/guided-lesson";

/**
 * Renders a lesson page body: paragraphs, "## " sub-headings, "> " Scripture quotations and "—" source lines.
 * Text is rendered as text (never as HTML), so instructor-entered content cannot inject markup.
 */
export default function RichBody({ body, testId }: { body: string; testId?: string }) {
  const nodes = parseBody(body);
  return (
    <div className="space-y-4 font-body text-[1.08rem] leading-relaxed text-charcoal/90" data-testid={testId}>
      {nodes.map((n, i) => {
        if (n.kind === "h") {
          return <h2 key={i} className="pt-2 font-display text-xl leading-snug text-burgundy">{n.text}</h2>;
        }
        if (n.kind === "list") {
          return <ul key={i} className="list-disc space-y-2 pl-6">{n.items.map((it, j) => <li key={j} className="pl-1">{it}</li>)}</ul>;
        }
        if (n.kind === "quote") {
          return (
            <blockquote key={i} className="rounded-r-control border-l-4 border-gold bg-pale-pink/30 px-4 py-3 text-charcoal">
              {n.lines.map((l, j) => <p key={j} className={j > 0 ? "mt-2" : ""}>{l}</p>)}
              {n.cite && <cite className="mt-2 block font-ui text-sm not-italic text-charcoal/65">{n.cite}</cite>}
            </blockquote>
          );
        }
        return (
          <div key={i}>
            <p className="whitespace-pre-line">{n.lines.join("\n")}</p>
            {n.cite && <cite className="mt-1 block font-ui text-sm not-italic text-charcoal/65">{n.cite}</cite>}
          </div>
        );
      })}
    </div>
  );
}
