"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";
import FileUpload from "@/components/FileUpload";

const PATHWAY_OPTIONS = [
  { code: "draw_near", label: "Draw Near" },
  { code: "hear_god", label: "Hear God" },
  { code: "kingdom_mandate", label: "Kingdom Mandate" }
];

const CONTENT_STATUS_OPTIONS = ["draft", "published", "scheduled", "archived", "coming_soon"];

export default function CourseEditFields({
  courseId,
  initialTitle,
  initialSubtitle,
  initialDescription,
  initialPublished,
  initialStandalone,
  initialPathways,
  initialContentStatus,
  initialContentFormat,
  initialDifficultyLevel,
  initialEstimatedDuration,
  initialTrackKey,
  initialSeriesKey,
  initialCoverImageUrl,
  initialAccessMode,
  initialLessonStyle,
  settingsAvailable = false
}: {
  courseId: string;
  initialTitle: string;
  initialSubtitle?: string;
  initialDescription: string;
  initialPublished: boolean;
  initialStandalone: boolean;
  initialPathways?: string[];
  initialContentStatus?: string;
  initialContentFormat?: string;
  initialDifficultyLevel?: string;
  initialEstimatedDuration?: string;
  initialTrackKey?: string;
  initialSeriesKey?: string;
  initialCoverImageUrl?: string | null;
  initialAccessMode?: string;
  initialLessonStyle?: string;
  /** false until migration 0027 is applied; hides the controls so saves can't fail on a missing column. */
  settingsAvailable?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle || "");
  const [description, setDescription] = useState(initialDescription);
  const [published, setPublished] = useState(initialPublished);
  const [standalone, setStandalone] = useState(initialStandalone);
  const inferredTrackKey = initialTrackKey || (initialPathways?.includes("rooted") ? "rooted" : "");
  const initialNormalizedPathways = initialPathways?.includes("rooted")
    ? Array.from(new Set([...(initialPathways || []), "draw_near"]))
    : initialPathways || [];
  const [pathways, setPathways] = useState<string[]>(initialNormalizedPathways);
  const [contentStatus, setContentStatus] = useState(initialContentStatus || "draft");
  const [contentFormat, setContentFormat] = useState(initialContentFormat || "course");
  const [difficultyLevel, setDifficultyLevel] = useState(initialDifficultyLevel || "");
  const [estimatedDuration, setEstimatedDuration] = useState(initialEstimatedDuration || "");
  const [trackKey, setTrackKey] = useState(inferredTrackKey);
  const [seriesKey, setSeriesKey] = useState(initialSeriesKey || (inferredTrackKey === "rooted" ? "mind_of_christ" : ""));
  const [accessMode, setAccessMode] = useState(initialAccessMode || "open");
  const [lessonStyle, setLessonStyle] = useState(initialLessonStyle || "reflective");
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl || "");
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");

  async function save(fields: Record<string, unknown>) {
    setStatus("saving");
    const { error } = await supabase.from("dp_courses").update(fields).eq("id", courseId);
    setStatus(error ? "failed" : "saved");
    router.refresh();
  }

  function normalizePathways(nextPathways: string[], nextTrackKey = trackKey) {
    const unique = new Set(nextPathways.filter((code) => code !== "rooted"));
    if (nextTrackKey === "rooted") unique.add("draw_near");
    if (nextTrackKey === "rooted") unique.add("rooted");
    return [...unique];
  }

  function togglePathway(code: string) {
    const next = normalizePathways(pathways.includes(code) ? pathways.filter((p) => p !== code) : [...pathways, code]);
    setPathways(next);
    save({ pathways: next });
  }

  function updateTrack(nextTrackKey: string) {
    const nextSeriesKey = nextTrackKey === "rooted" ? seriesKey || "mind_of_christ" : "";
    const nextPathways = normalizePathways(pathways, nextTrackKey);
    setTrackKey(nextTrackKey);
    setSeriesKey(nextSeriesKey);
    setPathways(nextPathways);
    save({ pathways: nextPathways, track_key: nextTrackKey || null, series_key: nextSeriesKey || null });
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-burgundy">Course details</h2>
        <SaveStatus status={status} />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => save({ title })} className="w-full input" />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Subtitle</label>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          onBlur={() => save({ subtitle })}
          placeholder="e.g. Learning to Think, Discern, and Respond From Christ's Perspective"
          className="w-full input"
        />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => save({ description })}
          rows={3}
          className="w-full input"
        />
      </div>

      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Cover image</label>
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt="Course cover" className="mb-2 h-32 w-full rounded-card object-cover" />
        ) : (
          <p className="mb-2 font-ui text-xs text-charcoal/40">No cover image yet.</p>
        )}
        <FileUpload
          pathPrefix={`courses/${courseId}/cover`}
          accept="image/*"
          label="Upload cover image"
          hint="JPG/PNG · shown publicly on browse pages"
          maxMB={10}
          visibility="public"
          onUploaded={(url) => {
            setCoverImageUrl(url);
            save({ cover_image_url: url });
          }}
        />
        {coverImageUrl && (
          <button
            type="button"
            onClick={() => {
              setCoverImageUrl("");
              save({ cover_image_url: null });
            }}
            className="mt-2 font-ui text-xs text-charcoal/40 hover:text-coral"
          >
            Remove cover image
          </button>
        )}
      </div>

      <div>
        <label className="mb-1.5 block font-ui text-sm font-semibold text-charcoal">Top-level pathway</label>
        <div className="flex flex-wrap gap-3">
          {PATHWAY_OPTIONS.map((p) => (
            <label key={p.code} className="checkbox-row">
              <input type="checkbox" checked={pathways.includes(p.code)} onChange={() => togglePathway(p.code)} />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {pathways.includes("draw_near") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Track or collection</label>
            <select value={trackKey} onChange={(e) => updateTrack(e.target.value)} className="w-full input">
              <option value="">None</option>
              <option value="rooted">Rooted</option>
            </select>
            <p className="field-hint">Rooted is a formation track within Draw Near, not a fourth pathway.</p>
          </div>
          <div>
            <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Series</label>
            <select
              value={seriesKey}
              onChange={(e) => {
                setSeriesKey(e.target.value);
                save({ series_key: e.target.value || null });
              }}
              className="w-full input"
              disabled={trackKey !== "rooted"}
            >
              <option value="">None</option>
              <option value="mind_of_christ">The Mind of Christ</option>
            </select>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Content status</label>
          <select
            value={contentStatus}
            onChange={(e) => {
              setContentStatus(e.target.value);
              save({ content_status: e.target.value });
            }}
            className="w-full input"
          >
            {CONTENT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Format</label>
          <select
            value={contentFormat}
            onChange={(e) => {
              setContentFormat(e.target.value);
              save({ content_format: e.target.value });
            }}
            className="w-full input"
          >
            <option value="course">Course</option>
            <option value="series">Teaching series</option>
          </select>
        </div>
        {settingsAvailable && (
          <>
            <div>
              <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Who can open lessons</label>
              <select
                value={accessMode}
                onChange={(e) => {
                  setAccessMode(e.target.value);
                  save({ access_mode: e.target.value });
                }}
                className="w-full input"
                data-testid="access-mode"
              >
                <option value="open">Open — any signed-in student</option>
                <option value="enrolled">Enrolled students only</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Lesson style</label>
              <select
                value={lessonStyle}
                onChange={(e) => {
                  setLessonStyle(e.target.value);
                  save({ lesson_style: e.target.value });
                }}
                className="w-full input"
                data-testid="lesson-style"
              >
                <option value="reflective">Reflective (reflection &amp; prayer)</option>
                <option value="practical">Practical (build along, My Build)</option>
              </select>
            </div>
          </>
        )}
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Maturity level</label>
          <select
            value={difficultyLevel}
            onChange={(e) => {
              setDifficultyLevel(e.target.value);
              save({ difficulty_level: e.target.value || null });
            }}
            className="w-full input"
          >
            <option value="">Not set</option>
            <option value="foundational">Foundational</option>
            <option value="growing">Growing</option>
            <option value="deepening">Deepening</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Estimated duration</label>
          <input
            value={estimatedDuration}
            onChange={(e) => setEstimatedDuration(e.target.value)}
            onBlur={() => save({ estimated_duration: estimatedDuration })}
            placeholder="e.g. 6 weeks"
            className="w-full input"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => {
              setPublished(e.target.checked);
              save({ is_published: e.target.checked });
            }}
          />
          Published (visible to enrolled students)
        </label>
        <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
          <input
            type="checkbox"
            checked={standalone}
            onChange={(e) => {
              setStandalone(e.target.checked);
              save({ is_standalone: e.target.checked });
            }}
          />
          Standalone-enrollable
        </label>
      </div>
    </div>
  );
}
