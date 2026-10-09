"use client";

import { useMemo, useState } from "react";
import LessonHeader from "@/components/lesson/LessonHeader";
import LessonIntro from "@/components/lesson/LessonIntro";
import LessonMedia from "@/components/lesson/LessonMedia";
import LessonOutline, { type OutlineItem } from "@/components/lesson/LessonOutline";
import TeachingSection from "@/components/lesson/TeachingSection";
import ReflectionPrompt from "@/components/lesson/ReflectionPrompt";
import LessonTakeaways from "@/components/lesson/LessonTakeaways";
import LessonToolbox from "@/components/lesson/LessonToolbox";
import LessonCompletion from "@/components/lesson/LessonCompletion";
import ScriptureDrawer from "@/components/lesson/ScriptureDrawer";
import LessonNotesDrawer from "@/components/lesson/LessonNotesDrawer";
import VideoPlayer from "@/components/lesson/VideoPlayer";
import DoThisNow from "@/components/lesson/DoThisNow";
import PromptCard from "@/components/lesson/PromptCard";
import LessonNav from "@/components/lesson/LessonNav";
import { MEDIA_UNAVAILABLE } from "@/lib/storage";
import type { LessonBlock, LessonMediaContent, ScriptureRef, TeachingSectionContent, TakeawaysContent } from "@/lib/types";

export default function LessonExperience({
  lessonId,
  lessonTitle,
  lessonSubtitle,
  eyebrow,
  courseId,
  courseTitle,
  instructorName,
  durationLabel,
  statusLabel,
  moduleIndexLabel,
  courseProgressPercent,
  blocks,
  userId,
  isComplete,
  initiallyBookmarked,
  reflectionStarted,
  markCompleteButton,
  reflectionForm,
  lessonStyle = "reflective",
  nav,
  myBuildHref
}: {
  lessonId: string;
  lessonTitle: string;
  lessonSubtitle?: string | null;
  eyebrow: string;
  courseId: string;
  courseTitle: string;
  instructorName?: string | null;
  durationLabel?: string | null;
  statusLabel: string;
  moduleIndexLabel: string;
  courseProgressPercent: number;
  blocks: LessonBlock[];
  userId: string;
  isComplete: boolean;
  initiallyBookmarked: boolean;
  reflectionStarted: boolean;
  markCompleteButton: React.ReactNode;
  reflectionForm: React.ReactNode;
  /** "practical" courses skip the spiritual Reflection form/wording. Defaults to the existing behavior. */
  lessonStyle?: "reflective" | "practical";
  nav?: { previousId: string | null; nextId: string | null; isLast: boolean };
  myBuildHref?: string;
}) {
  const practical = lessonStyle === "practical";
  const [notesOpen, setNotesOpen] = useState(false);
  const [scriptureOpen, setScriptureOpen] = useState(false);
  const [activeScripture, setActiveScripture] = useState<ScriptureRef | null>(null);

  const mediaBlock = blocks.find((b) => b.block_type === "lesson_media");
  const flowBlocks = blocks.filter((b) => b.block_type !== "lesson_media");
  const teachingSections = flowBlocks.filter((b) => b.block_type === "teaching_section");

  const outlineItems: OutlineItem[] = useMemo(() => {
    const items = teachingSections.map((b) => {
      const c = b.content as unknown as TeachingSectionContent;
      return { anchor: c.anchor, label: c.heading };
    });
    return [...items, { anchor: "completion", label: practical ? "Finish this lesson" : "Continue to Reflection" }];
  }, [teachingSections, practical]);

  const allScriptureRefs: ScriptureRef[] = useMemo(() => {
    const seen = new Map<string, ScriptureRef>();
    teachingSections.forEach((b) => {
      const c = b.content as unknown as TeachingSectionContent;
      (c.scripture_refs ?? []).forEach((ref) => {
        if (!seen.has(ref.key)) seen.set(ref.key, ref);
      });
    });
    return [...seen.values()];
  }, [teachingSections]);

  const lessonNotesText = useMemo(() => {
    if (teachingSections.length === 0) return "";
    const parts = teachingSections.map((b) => {
      const c = b.content as unknown as TeachingSectionContent;
      const lines = [c.heading, ...(c.paragraphs ?? [])];
      if (c.takeaway) lines.push(`Takeaway: ${c.takeaway}`);
      return lines.join("\n\n");
    });
    return `${lessonTitle}\n${"=".repeat(lessonTitle.length)}\n\n${parts.join("\n\n---\n\n")}`;
  }, [teachingSections, lessonTitle]);

  const mediaContent = (mediaBlock?.content ?? {}) as unknown as LessonMediaContent;
  const transcriptText = useMemo(() => {
    const transcript = mediaContent.transcript ?? [];
    if (transcript.length === 0) return "";
    return transcript.map((row) => `${row.time}  ${row.text}`).join("\n");
  }, [mediaContent.transcript]);

  function openScripture(ref: ScriptureRef) {
    setActiveScripture(ref);
    setScriptureOpen(true);
  }
  function openScriptureList() {
    setActiveScripture(null);
    setScriptureOpen(true);
  }

  return (
    <div className="scroll-smooth">
      <LessonHeader
        courseTitle={courseTitle}
        courseId={courseId}
        lessonTitle={lessonTitle}
        progressPercent={courseProgressPercent}
        onOpenNotes={() => setNotesOpen(true)}
        myBuildHref={myBuildHref}
      />

      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-16 sm:px-6 lg:px-10 lg:py-8">
        <div className="space-y-6">
          <LessonIntro
            eyebrow={eyebrow}
            title={lessonTitle}
            subtitle={lessonSubtitle}
            courseTitle={courseTitle}
            instructorName={instructorName}
            durationLabel={durationLabel}
            statusLabel={statusLabel}
            moduleIndex={moduleIndexLabel}
            activeStage={reflectionStarted ? "Reflection" : "Teaching"}
            stages={practical ? [] : undefined}
          />

          {mediaBlock && <LessonMedia content={mediaContent} lessonTitle={lessonTitle} />}

          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_260px] lg:items-start">
            <LessonOutline items={outlineItems} />

            <div className="min-w-0">
              {flowBlocks.map((block) => {
                const c = block.content as Record<string, any>;
                switch (block.block_type) {
                  case "teaching_section": {
                    const tc = c as unknown as TeachingSectionContent;
                    return (
                      <TeachingSection
                        key={block.id}
                        anchor={tc.anchor}
                        sectionNumber={tc.section_number}
                        heading={tc.heading}
                        paragraphs={tc.paragraphs ?? []}
                        scriptureRefs={tc.scripture_refs}
                        quote={tc.quote}
                        takeaway={tc.takeaway}
                        onOpenScripture={openScripture}
                      />
                    );
                  }
                  case "reflection_question":
                    return <ReflectionPrompt key={block.id} blockId={block.id} userId={userId} prompt={c.prompt} />;
                  case "takeaways": {
                    const tk = c as unknown as TakeawaysContent;
                    return (
                      <section key={block.id} id="takeaways" aria-labelledby="takeaways-heading" className="scroll-mt-24 border-b border-charcoal/10 py-8">
                        <span className="mb-2 block font-display text-2xl text-gold">04</span>
                        <h2 id="takeaways-heading" className="mb-3 font-display text-2xl text-burgundy sm:text-3xl">
                          Key Takeaways
                        </h2>
                        <LessonTakeaways items={tk.items ?? []} />
                      </section>
                    );
                  }
                  case "written":
                    return (
                      <div key={block.id} className="border-b border-charcoal/10 py-6 first:pt-0">
                        {c.heading && <h3 className="mb-2 font-display text-lg text-burgundy">{c.heading}</h3>}
                        {c.body ? (
                          <p className="whitespace-pre-line font-body leading-relaxed text-charcoal/85">{c.body}</p>
                        ) : (
                          <p className="font-ui text-sm text-charcoal/40">Teaching content coming soon.</p>
                        )}
                      </div>
                    );
                  case "scripture":
                    return (
                      <blockquote key={block.id} className="my-4 rounded-card border-l-4 border-gold bg-pale-pink/30 px-4 py-3 font-body italic text-charcoal/90">
                        &ldquo;{c.text}&rdquo; <span className="not-italic font-ui text-sm text-charcoal/60">— {c.reference}</span>
                      </blockquote>
                    );
                  case "video":
                    return (
                      <div key={block.id} className="my-4 overflow-hidden rounded-card border border-charcoal/10">
                        <VideoPlayer url={c.url} provider={c.provider} title={lessonTitle} />
                      </div>
                    );
                  case "embed":
                    return (
                      <div key={block.id} className="my-4 rounded-card border border-charcoal/10 bg-charcoal/5 p-6 text-center font-ui text-sm text-charcoal/60">
                        Embed placeholder — connects to {c.provider || "the provider"} when a link is added.
                      </div>
                    );
                  case "learning_objectives": {
                    const items: string[] = c.items ?? [];
                    return (
                      <section key={block.id} className="border-b border-charcoal/10 py-6 first:pt-0">
                        <h3 className="mb-2 font-display text-lg text-burgundy">Learning Objectives</h3>
                        {items.length ? (
                          <ul className="list-disc space-y-1 pl-5 font-body text-charcoal/85">
                            {items.map((it, idx) => <li key={idx}>{it}</li>)}
                          </ul>
                        ) : (
                          <p className="font-ui text-sm text-charcoal/40">Learning objectives coming soon.</p>
                        )}
                      </section>
                    );
                  }
                  case "key_scriptures": {
                    const refs: { reference: string; text?: string }[] = c.refs ?? [];
                    return (
                      <section key={block.id} className="border-b border-charcoal/10 py-6 first:pt-0">
                        <h3 className="mb-2 font-display text-lg text-burgundy">Key Scriptures</h3>
                        {refs.length ? (
                          <ul className="space-y-2 font-body text-charcoal/85">
                            {refs.map((r, idx) => (
                              <li key={idx}>
                                <span className="font-semibold text-burgundy">{r.reference}</span>
                                {r.text ? <span className="italic text-charcoal/70"> — &ldquo;{r.text}&rdquo;</span> : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="font-ui text-sm text-charcoal/40">Key scriptures coming soon.</p>
                        )}
                      </section>
                    );
                  }
                  case "workbook_download":
                    return (
                      <section key={block.id} className="border-b border-charcoal/10 py-6 first:pt-0">
                        <h3 className="mb-2 font-display text-lg text-burgundy">{c.label || "Workbook"}</h3>
                        {c.url === MEDIA_UNAVAILABLE ? (
                          <p className="font-ui text-sm text-charcoal/60">This workbook is unavailable or you don&rsquo;t have access to it.</p>
                        ) : c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer" className="btn-secondary inline-flex">Download workbook ↓</a>
                        ) : (
                          <p className="font-ui text-sm text-charcoal/40">Workbook coming soon.</p>
                        )}
                      </section>
                    );
                  case "assignment_placeholder":
                    return (
                      <section key={block.id} className="border-b border-charcoal/10 py-6 first:pt-0">
                        <h3 className="mb-2 font-display text-lg text-burgundy">{c.title || "Assignment"}</h3>
                        {c.instructions ? (
                          <p className="whitespace-pre-line font-body text-charcoal/85">{c.instructions}</p>
                        ) : (
                          <p className="font-ui text-sm text-charcoal/40">Assignment details coming soon.</p>
                        )}
                      </section>
                    );
                  case "quiz_placeholder":
                    return (
                      <section key={block.id} className="border-b border-charcoal/10 py-6 first:pt-0">
                        <h3 className="mb-2 font-display text-lg text-burgundy">{c.title || "Quiz"}</h3>
                        <p className="font-ui text-sm text-charcoal/40">{c.note ? c.note : "Quiz coming soon."}</p>
                      </section>
                    );
                  case "prayer_activation":
                    return (
                      <section key={block.id} className="border-b border-charcoal/10 py-6 first:pt-0">
                        <h3 className="mb-2 font-display text-lg text-burgundy">{c.heading || "Prayer & Activation"}</h3>
                        {c.body ? (
                          <blockquote className="rounded-card border-l-4 border-gold bg-pale-pink/30 px-4 py-3 font-body italic text-charcoal/90">{c.body}</blockquote>
                        ) : (
                          <p className="font-ui text-sm text-charcoal/40">Prayer &amp; activation coming soon.</p>
                        )}
                      </section>
                    );
                  case "do_this_now":
                    return <DoThisNow key={block.id} title={c.title} instruction={c.instruction} items={c.items} />;
                  case "prompt_card":
                    return c.prompt ? <PromptCard key={block.id} label={c.label} prompt={c.prompt} /> : null;
                  case "resources": {
                    const items: { label: string; url?: string; downloadable?: boolean }[] = c.items ?? [];
                    return (
                      <section key={block.id} className="border-b border-charcoal/10 py-6 first:pt-0">
                        <h3 className="mb-2 font-display text-lg text-burgundy">Resources</h3>
                        {items.length ? (
                          <ul className="space-y-1 font-body text-charcoal/85">
                            {items.map((r, idx) => (
                              <li key={idx}>
                                {r.url === MEDIA_UNAVAILABLE ? (
                                  <span className="text-charcoal/60">{r.label} <span className="font-ui text-xs">(unavailable or access-restricted)</span></span>
                                ) : r.url ? (
                                  <a href={r.url} target="_blank" rel="noreferrer" className="text-burgundy underline">{r.label}</a>
                                ) : (
                                  r.label
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="font-ui text-sm text-charcoal/40">Resources coming soon.</p>
                        )}
                      </section>
                    );
                  }
                  default:
                    return null;
                }
              })}

              {flowBlocks.length === 0 && !mediaBlock && (
                <p className="py-8 font-body text-charcoal/60">This lesson&rsquo;s content is still being built.</p>
              )}

              <LessonCompletion courseId={courseId} isComplete={isComplete} markCompleteButton={markCompleteButton} practical={practical} myBuildHref={myBuildHref} />

              {nav && <LessonNav courseId={courseId} previousId={nav.previousId} nextId={nav.nextId} isLast={nav.isLast} />}

              {!practical && (
                <section id="reflection" className="scroll-mt-24 pt-2">
                  {reflectionForm}
                </section>
              )}
            </div>

            <LessonToolbox
              lessonId={lessonId}
              userId={userId}
              lessonTitle={lessonTitle}
              lessonNotesText={lessonNotesText}
              transcriptText={transcriptText}
              initiallyBookmarked={initiallyBookmarked}
              onOpenNotes={() => setNotesOpen(true)}
              onOpenScriptureList={openScriptureList}
              hasScriptures={allScriptureRefs.length > 0}
              hideRelatedResources={practical}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-charcoal/10 py-8 text-center font-ui text-xs uppercase tracking-[0.18em] text-charcoal/40">
        Dove Expressions Discipleship LMS
      </footer>

      <ScriptureDrawer
        open={scriptureOpen}
        onClose={() => setScriptureOpen(false)}
        activeRef={activeScripture}
        allRefs={allScriptureRefs}
        onSelectRef={(ref) => setActiveScripture(ref)}
      />
      <LessonNotesDrawer open={notesOpen} onClose={() => setNotesOpen(false)} lessonId={lessonId} userId={userId} />
    </div>
  );
}
