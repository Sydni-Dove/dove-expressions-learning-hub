"use client";

import { getEmbedUrl, isDirectMediaFile } from "@/lib/video";

/** Real video playback: an actual <video> element for a direct file URL, a real
    YouTube/Vimeo iframe embed for a provider link, or an honest "not added yet"
    state — never a fake player with inert controls. */
export default function VideoPlayer({
  url,
  provider,
  posterEyebrow,
  title
}: {
  url?: string;
  provider?: string;
  posterEyebrow?: string;
  title: string;
}) {
  if (!url) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 bg-charcoal/5 px-6 py-10 text-center">
        <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">Video</p>
        <p className="font-body text-sm text-charcoal/60">Video for this lesson hasn't been added yet.</p>
      </div>
    );
  }

  if (isDirectMediaFile(url)) {
    return (
      <div className="bg-charcoal">
        {posterEyebrow && (
          <p className="px-4 pt-3 font-ui text-xs uppercase tracking-[0.24em] text-soft/70">{posterEyebrow}</p>
        )}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video controls className="aspect-video w-full" preload="metadata">
          <source src={url} />
        </video>
      </div>
    );
  }

  const embedUrl = getEmbedUrl(url, provider);
  if (embedUrl) {
    return (
      <div className="bg-charcoal">
        {posterEyebrow && (
          <p className="px-4 pt-3 font-ui text-xs uppercase tracking-[0.24em] text-soft/70">{posterEyebrow}</p>
        )}
        <div className="relative aspect-video w-full">
          <iframe
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 bg-charcoal/5 px-6 py-10 text-center">
      <p className="font-body text-sm text-charcoal/60">
        Couldn't read this video link.{" "}
        <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-burgundy underline">
          Open it directly
        </a>
        .
      </p>
    </div>
  );
}
