"use client";

import { useState } from "react";
import VideoPlayer from "@/components/lesson/VideoPlayer";
import AudioPlayer from "@/components/lesson/AudioPlayer";
import TranscriptPanel from "@/components/lesson/TranscriptPanel";
import type { LessonMediaContent } from "@/lib/types";

type Tab = "video" | "audio" | "transcript";

export default function LessonMedia({ content, lessonTitle }: { content: LessonMediaContent; lessonTitle: string }) {
  const [tab, setTab] = useState<Tab>("video");
  const tabs: { id: Tab; label: string }[] = [
    { id: "video", label: "Video" },
    { id: "audio", label: "Audio Only" },
    { id: "transcript", label: "Transcript" }
  ];

  function onTabKeyDown(e: React.KeyboardEvent, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    setTab(tabs[next].id);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }

  return (
    <section aria-label="Lesson media" className="card overflow-hidden">
      <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
        <VideoPlayer url={content.video_url} provider={content.video_provider} posterEyebrow={content.poster_eyebrow} title={lessonTitle} />

        <div className="border-t border-charcoal/10 lg:border-l lg:border-t-0">
          <div role="tablist" aria-label="Lesson media formats" className="grid grid-cols-3 border-b border-charcoal/10">
            {tabs.map((t, i) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className={`min-h-[52px] border-r border-charcoal/10 font-ui text-xs font-bold uppercase tracking-wide transition last:border-r-0 ${
                  tab === t.id ? "bg-pale-pink/40 text-burgundy shadow-[inset_0_-3px_0_theme(colors.gold.DEFAULT)]" : "text-charcoal/50 hover:text-burgundy"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "video" && (
            <div id="panel-video" role="tabpanel" aria-labelledby="tab-video" className="p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-lg text-burgundy">{content.overview_heading || "Teaching Overview"}</h3>
                {content.overview_duration_label && <span className="font-ui text-xs text-charcoal/50">{content.overview_duration_label}</span>}
              </div>
              {content.overview_summary && <p className="font-body leading-relaxed text-charcoal/85">{content.overview_summary}</p>}
              {content.overview_points && content.overview_points.length > 0 && (
                <ul className="mt-4 space-y-2.5">
                  {content.overview_points.map((point, i) => (
                    <li key={i} className="grid grid-cols-[28px_1fr] items-start gap-3">
                      <b className="flex h-7 w-7 items-center justify-center rounded-control border border-gold/50 font-display text-sm text-burgundy">{i + 1}</b>
                      <span className="font-body text-sm leading-relaxed text-charcoal/80">{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "audio" && (
            <div id="panel-audio" role="tabpanel" aria-labelledby="tab-audio" tabIndex={0} className="p-5">
              <AudioPlayer url={content.audio_url} />
              <p className="mt-3 font-ui text-xs text-charcoal/50">Use audio when you want to listen while reviewing the lesson notes.</p>
            </div>
          )}

          {tab === "transcript" && (
            <div id="panel-transcript" role="tabpanel" aria-labelledby="tab-transcript" tabIndex={0} className="p-5">
              <TranscriptPanel transcript={content.transcript ?? []} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
