"use client";

import { useState } from "react";

/** Real, searchable transcript rendered from lesson data — not hard-coded JSX.
    If the lesson has no transcript yet, says so honestly. */
export default function TranscriptPanel({ transcript }: { transcript: { time: string; text: string }[] }) {
  const [query, setQuery] = useState("");

  if (!transcript || transcript.length === 0) {
    return (
      <div className="rounded-card border border-charcoal/10 bg-charcoal/5 px-5 py-8 text-center">
        <p className="font-body text-sm text-charcoal/60">A transcript hasn't been added to this lesson yet.</p>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const visible = transcript.filter((row) => !q || row.text.toLowerCase().includes(q) || row.time.includes(q));

  return (
    <div>
      <label className="field-label" htmlFor="transcript-search">
        Search transcript
      </label>
      <input
        id="transcript-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search this transcript…"
        className="input mb-3"
      />
      <div className="max-h-[320px] space-y-0 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <p className="py-4 font-body text-sm text-charcoal/50">No matching lines.</p>
        ) : (
          visible.map((row, i) => (
            <p key={i} className="grid grid-cols-[54px_1fr] gap-3 border-b border-charcoal/10 py-3 font-body text-sm leading-relaxed text-charcoal/85">
              <time className="font-ui text-xs font-bold text-burgundy">{row.time}</time>
              <span>{row.text}</span>
            </p>
          ))
        )}
      </div>
    </div>
  );
}
