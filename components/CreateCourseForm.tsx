"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const PATHWAY_OPTIONS = [
  { code: "draw_near", label: "Draw Near" },
  { code: "hear_god", label: "Hear God" },
  { code: "kingdom_mandate", label: "Kingdom Mandate" }
];

const DIFFICULTY_OPTIONS = [
  { value: "", label: "—" },
  { value: "foundational", label: "Foundational" },
  { value: "growing", label: "Growing" },
  { value: "deepening", label: "Deepening" }
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "published", label: "Published" }
];

/**
 * Top-level "Create New Course" flow. Unlike the older per-program CourseForm,
 * this creates a course directly under the Discipleship Hub learning area and
 * assigns it to a pathway (which is how the pathway pages discover courses).
 * On success it routes straight into the existing course builder so the
 * instructor can add modules, lessons, and content with no code.
 */
export default function CreateCourseForm({ areaId }: { areaId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [pathway, setPathway] = useState<string>("hear_god");
  const [difficulty, setDifficulty] = useState("");
  const [duration, setDuration] = useState("");
  const [status, setStatus] = useState("draft");
  const [standalone, setStandalone] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) {
      setError("Give the course a title.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("dp_courses")
      .insert({
        area_id: areaId,
        title: title.trim(),
        slug: slugify(title),
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        pathways: [pathway],
        content_format: "course",
        difficulty_level: difficulty || null,
        estimated_duration: duration.trim() || null,
        content_status: status,
        is_published: status === "published",
        is_standalone: standalone
      })
      .select("id")
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) router.push(`/staff/courses/${data.id}/builder`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Create New Course
      </button>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-display text-lg text-burgundy">Create a new course</h2>

      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Course title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full input" placeholder="e.g. Dreams &amp; Visions" />
      </div>

      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Subtitle</label>
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full input" placeholder="A short line under the title (optional)" />
      </div>

      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full input" placeholder="What this course is about (optional)" />
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Pathway</label>
          <select value={pathway} onChange={(e) => setPathway(e.target.value)} className="input">
            {PATHWAY_OPTIONS.map((p) => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Difficulty</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input">
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Estimated duration</label>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} className="w-40 input" placeholder="e.g. 8 weeks" />
        </div>
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
        <input type="checkbox" checked={standalone} onChange={(e) => setStandalone(e.target.checked)} />
        Allow this course to be taken standalone (without enrolling in a full program)
      </label>

      <p className="font-ui text-xs text-charcoal/50">
        You can refine every field — pathway, status, cover image, and more — from the course builder after it&apos;s created.
      </p>

      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}

      <div className="flex gap-2">
        <button onClick={create} disabled={saving} className="btn-primary">
          {saving ? "Creating…" : "Create course"}
        </button>
        <button onClick={() => setOpen(false)} className="font-ui text-sm text-charcoal/50">
          Cancel
        </button>
      </div>
    </div>
  );
}
