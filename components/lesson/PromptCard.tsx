"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";

/**
 * A copyable prompt resource inside a lesson. Visually distinct from teaching
 * text (monospace, tinted card, label strip) and preserves the author's line
 * breaks/indentation exactly so it pastes cleanly into an AI tool.
 */
export default function PromptCard({ label, prompt }: { label?: string; prompt: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const ok = await copyText(prompt);
    setState(ok ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 2200);
  }

  return (
    <section className="my-6 overflow-hidden rounded-card border border-burgundy/15 bg-pale-pink/20" aria-label={label || "Prompt"}>
      <div className="flex items-center justify-between gap-3 border-b border-burgundy/10 bg-burgundy/5 px-4 py-2.5">
        <span className="font-ui text-xs font-bold uppercase tracking-[0.16em] text-burgundy">{label || "Prompt"}</span>
        <button
          type="button"
          onClick={copy}
          className="btn-secondary !min-h-[40px] !px-4 !py-2 !text-xs"
          data-testid="prompt-copy"
        >
          {state === "copied" ? "Copied ✓" : state === "failed" ? "Copy failed — select the text" : "Copy prompt"}
        </button>
      </div>
      <pre
        className="m-0 max-w-full whitespace-pre-wrap break-words px-4 py-4 font-mono text-[0.9rem] leading-relaxed text-charcoal"
        data-testid="prompt-text"
      >
        {prompt}
      </pre>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Prompt copied to clipboard" : ""}
      </span>
    </section>
  );
}
