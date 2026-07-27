"use client";

/** Real HTML5 audio playback, or an honest empty state if no audio file has
    been added to this lesson yet. */
export default function AudioPlayer({ url }: { url?: string }) {
  if (!url) {
    return (
      <div className="rounded-card border border-charcoal/10 bg-charcoal/5 px-5 py-8 text-center">
        <p className="font-body text-sm text-charcoal/60">Audio for this lesson hasn't been added yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-charcoal/10 bg-pale-pink/25 p-4">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls className="w-full">
        <source src={url} />
      </audio>
    </div>
  );
}
