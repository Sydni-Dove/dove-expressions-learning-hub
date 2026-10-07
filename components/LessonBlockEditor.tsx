"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pill } from "@/components/ui";
import FileUpload from "@/components/FileUpload";

interface Block {
  id: string;
  block_type: string;
  order_index: number;
  content: Record<string, any>;
}

const TYPE_LABEL: Record<string, string> = {
  teaching_section: "Teaching section",
  lesson_media: "Lesson media (video/audio/transcript)",
  written: "Lesson content / written",
  learning_objectives: "Learning objectives",
  key_scriptures: "Key scriptures",
  scripture: "Scripture quote",
  reflection_question: "Reflection question",
  takeaways: "Key takeaways",
  workbook_download: "Workbook / download",
  assignment_placeholder: "Assignment",
  quiz_placeholder: "Quiz",
  prayer_activation: "Prayer / activation",
  resources: "Resources",
  do_this_now: "Do This Now (practical action)",
  prompt_card: "Copyable prompt",
  video: "Video (link only)"
};

// Order the picker so the most-used, richest types are first.
const TYPE_ORDER = [
  "teaching_section",
  "lesson_media",
  "written",
  "learning_objectives",
  "key_scriptures",
  "reflection_question",
  "takeaways",
  "workbook_download",
  "assignment_placeholder",
  "quiz_placeholder",
  "prayer_activation",
  "resources",
  "do_this_now",
  "prompt_card",
  "scripture",
  "video"
];

function detectProvider(url: string): string {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  return "video";
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "section";
}

/** Parses "a | b | c" lines into arrays of trimmed parts. Blank lines are skipped. */
function parsePipeLines(raw: string): string[][] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((part) => part.trim()));
}

function linesToItems(raw: string): string[] {
  return raw.split("\n").map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Default (empty) content for each block type. Used when adding a fresh block.
// ---------------------------------------------------------------------------
function defaultContent(type: string): Record<string, any> {
  switch (type) {
    case "written":
      return { heading: "", body: "" };
    case "scripture":
      return { text: "", reference: "" };
    case "reflection_question":
      return { prompt: "" };
    case "video":
      return { url: "" };
    case "lesson_media":
      return { overview_heading: "Teaching Overview", overview_points: [], transcript: [] };
    case "teaching_section":
      return { section_number: "", heading: "", paragraphs: [], scripture_refs: [] };
    case "takeaways":
      return { items: [] };
    case "learning_objectives":
      return { items: [] };
    case "key_scriptures":
      return { refs: [] };
    case "workbook_download":
      return { label: "Lesson Workbook", url: null };
    case "assignment_placeholder":
      return { title: "Assignment", instructions: "" };
    case "quiz_placeholder":
      return { title: "Quiz", note: "" };
    case "prayer_activation":
      return { heading: "Prayer & Activation", body: "" };
    case "resources":
      return { items: [] };
    case "do_this_now":
      return { title: "Do this now", instruction: "", items: [] };
    case "prompt_card":
      return { label: "", prompt: "" };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Short summary line shown on each collapsed block row.
// ---------------------------------------------------------------------------
function BlockSummary({ block }: { block: Block }) {
  const c = block.content || {};
  const muted = (s: string) => <span className="text-charcoal/40">{s}</span>;
  switch (block.block_type) {
    case "written":
      return <p className="font-body text-sm text-charcoal/80">{c.heading ? `${c.heading} — ` : ""}{c.body ? c.body : muted("No teaching text yet")}</p>;
    case "scripture":
      return <p className="font-body text-sm italic text-charcoal/80">&ldquo;{c.text}&rdquo; — {c.reference}</p>;
    case "reflection_question":
      return <p className="font-body text-sm text-charcoal/80">{c.prompt || muted("No prompt yet")}</p>;
    case "video":
      return <p className="font-body text-sm text-charcoal/80">{c.url ? c.url : muted("No link yet")}</p>;
    case "lesson_media": {
      const points = c.overview_points?.length ?? 0;
      const transcriptRows = c.transcript?.length ?? 0;
      return <p className="font-body text-sm text-charcoal/80">{c.overview_heading || "Lesson media"} — {c.video_url ? "video linked" : muted("no video yet")}, {points} point(s), {transcriptRows} transcript row(s)</p>;
    }
    case "teaching_section":
      return <p className="font-body text-sm text-charcoal/80">{c.heading || muted("Untitled section")} — {c.paragraphs?.length ?? 0} paragraph(s)</p>;
    case "takeaways":
      return <p className="font-body text-sm text-charcoal/80">{c.items?.length ?? 0} takeaway card(s)</p>;
    case "learning_objectives":
      return <p className="font-body text-sm text-charcoal/80">{(c.items?.length ?? 0) ? `${c.items.length} objective(s)` : muted("No objectives yet")}</p>;
    case "key_scriptures":
      return <p className="font-body text-sm text-charcoal/80">{(c.refs?.length ?? 0) ? `${c.refs.length} scripture(s)` : muted("No scriptures yet")}</p>;
    case "workbook_download":
      return <p className="font-body text-sm text-charcoal/80">{c.label || "Workbook"} — {c.url ? "file attached" : muted("no file yet")}</p>;
    case "assignment_placeholder":
      return <p className="font-body text-sm text-charcoal/80">{c.title || "Assignment"} — {c.instructions ? "instructions set" : muted("no instructions yet")}</p>;
    case "quiz_placeholder":
      return <p className="font-body text-sm text-charcoal/80">{c.title || "Quiz"} — {muted("placeholder")}</p>;
    case "prayer_activation":
      return <p className="font-body text-sm text-charcoal/80">{c.heading || "Prayer"} — {c.body ? "written" : muted("no prayer yet")}</p>;
    case "resources":
      return <p className="font-body text-sm text-charcoal/80">{(c.items?.length ?? 0) ? `${c.items.length} resource(s)` : muted("No resources yet")}</p>;
    case "do_this_now":
      return <p className="font-body text-sm text-charcoal/80">{c.title || "Do this now"} — {c.instruction ? c.instruction : muted("no instruction yet")}</p>;
    case "prompt_card":
      return <p className="font-body text-sm text-charcoal/80">{c.label ? `${c.label} — ` : ""}{c.prompt ? String(c.prompt).slice(0, 120) : muted("No prompt yet")}</p>;
    default:
      return <p className="font-body text-sm text-charcoal/50">{JSON.stringify(c)}</p>;
  }
}

// ---------------------------------------------------------------------------
// One shared form, used both for "add new" and "edit existing". It receives the
// working content object and reports changes up. Multiline/array inputs keep a
// local raw-text mirror (via defaultValue) so typing stays smooth, converting
// to the stored shape on change.
// ---------------------------------------------------------------------------
function BlockForm({
  type,
  value,
  onChange,
  lessonId
}: {
  type: string;
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  lessonId: string;
}) {
  const set = (patch: Record<string, any>) => onChange({ ...value, ...patch });

  if (type === "written") {
    return (
      <>
        <input value={value.heading || ""} onChange={(e) => set({ heading: e.target.value })} placeholder="Heading (optional)" className="w-full input" />
        <textarea value={value.body || ""} onChange={(e) => set({ body: e.target.value })} placeholder="Teaching text" rows={4} className="w-full input" />
      </>
    );
  }

  if (type === "scripture") {
    return (
      <>
        <textarea value={value.text || ""} onChange={(e) => set({ text: e.target.value })} placeholder="Scripture text" rows={3} className="w-full input" />
        <input value={value.reference || ""} onChange={(e) => set({ reference: e.target.value })} placeholder="Reference (e.g. John 14:26)" className="w-full input" />
      </>
    );
  }

  if (type === "reflection_question") {
    return <textarea value={value.prompt || ""} onChange={(e) => set({ prompt: e.target.value })} placeholder="Reflection prompt" rows={3} className="w-full input" />;
  }

  if (type === "video") {
    return (
      <>
        <input value={value.url || ""} onChange={(e) => set({ url: e.target.value })} placeholder="Paste a YouTube or Vimeo link" className="w-full input" />
        <p className="font-ui text-xs text-charcoal/50">Works with a standard YouTube or Vimeo link.</p>
      </>
    );
  }

  if (type === "learning_objectives") {
    return (
      <div>
        <label className="field-label">One objective per line</label>
        <textarea
          defaultValue={(value.items || []).join("\n")}
          onChange={(e) => set({ items: linesToItems(e.target.value) })}
          rows={4}
          className="w-full input"
          placeholder={"Understand why God speaks through dreams.\nDistinguish dreams from visions."}
        />
      </div>
    );
  }

  if (type === "key_scriptures") {
    return (
      <div>
        <label className="field-label">One per line, as &quot;Reference | Text (optional)&quot;</label>
        <textarea
          defaultValue={(value.refs || []).map((r: any) => [r.reference, r.text].filter(Boolean).join(" | ")).join("\n")}
          onChange={(e) => set({ refs: parsePipeLines(e.target.value).map(([reference, text]) => ({ reference: reference || "", text: text || "" })).filter((r) => r.reference) })}
          rows={4}
          className="w-full input"
          placeholder={"Job 33:14-16 | For God speaks once, yes twice...\nJoel 2:28"}
        />
      </div>
    );
  }

  if (type === "workbook_download") {
    return (
      <>
        <input value={value.label || ""} onChange={(e) => set({ label: e.target.value })} placeholder="Label (e.g. Lesson 1 Workbook)" className="w-full input" />
        <input value={value.url || ""} onChange={(e) => set({ url: e.target.value || null })} placeholder="File URL (or upload a protected file below)" className="w-full input" />
        <FileUpload
          pathPrefix={`lessons/${lessonId}/workbooks`}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.key,.pages,.epub"
          label="Upload workbook"
          hint="PDF/DOCX · protected, students only"
          visibility="private"
          onUploaded={(ref) => set({ url: ref })}
        />
      </>
    );
  }

  if (type === "assignment_placeholder") {
    return (
      <>
        <input value={value.title || ""} onChange={(e) => set({ title: e.target.value })} placeholder="Assignment title" className="w-full input" />
        <textarea value={value.instructions || ""} onChange={(e) => set({ instructions: e.target.value })} placeholder="Assignment instructions (optional for now)" rows={3} className="w-full input" />
      </>
    );
  }

  if (type === "quiz_placeholder") {
    return (
      <>
        <input value={value.title || ""} onChange={(e) => set({ title: e.target.value })} placeholder="Quiz title" className="w-full input" />
        <textarea value={value.note || ""} onChange={(e) => set({ note: e.target.value })} placeholder="Note about this quiz (optional)" rows={2} className="w-full input" />
        <p className="font-ui text-xs text-charcoal/50">This is a placeholder. Interactive quizzes are a later phase — for now it marks where the quiz will live.</p>
      </>
    );
  }

  if (type === "prayer_activation") {
    return (
      <>
        <input value={value.heading || ""} onChange={(e) => set({ heading: e.target.value })} placeholder="Heading (e.g. Prayer & Activation)" className="w-full input" />
        <textarea value={value.body || ""} onChange={(e) => set({ body: e.target.value })} placeholder="Prayer or activation text" rows={4} className="w-full input" />
      </>
    );
  }

  if (type === "do_this_now") {
    return (
      <>
        <input value={value.title || ""} onChange={(e) => set({ title: e.target.value })} placeholder="Label (default: Do this now)" className="w-full input" />
        <textarea value={value.instruction || ""} onChange={(e) => set({ instruction: e.target.value })} placeholder="What should the student do right now?" rows={3} className="w-full input" />
        <div>
          <label className="field-label">Checklist items — one per line (optional)</label>
          <textarea defaultValue={(value.items || []).join("\n")} onChange={(e) => set({ items: linesToItems(e.target.value) })} rows={4} className="w-full input" />
        </div>
      </>
    );
  }

  if (type === "prompt_card") {
    return (
      <>
        <input value={value.label || ""} onChange={(e) => set({ label: e.target.value })} placeholder="Label (optional, e.g. Strategist prompt)" className="w-full input" />
        <textarea value={value.prompt || ""} onChange={(e) => set({ prompt: e.target.value })} placeholder="Paste the prompt exactly as students should copy it" rows={8} className="w-full input font-mono text-sm" />
        <p className="font-ui text-xs text-charcoal/50">Line breaks and spacing are kept exactly as typed.</p>
      </>
    );
  }

  if (type === "resources") {
    return (
      <div className="space-y-2">
        <label className="field-label">One per line, as &quot;Label | URL&quot;</label>
        <ResourcesTextarea value={value} onChange={onChange} />
        <FileUpload
          pathPrefix={`lessons/${lessonId}/resources`}
          label="Upload a resource file"
          hint="Protected · adds a line below"
          visibility="private"
          onUploaded={(ref, meta) => {
            const items = [...(value.items || []), { label: meta.name, url: ref, downloadable: true }];
            onChange({ ...value, items });
          }}
        />
      </div>
    );
  }

  if (type === "lesson_media") {
    return (
      <>
        <input value={value.video_url || ""} onChange={(e) => set({ video_url: e.target.value || undefined, video_provider: e.target.value ? detectProvider(e.target.value) : undefined })} placeholder="Video link (YouTube, Vimeo) or upload a protected file below — optional" className="w-full input" />
        <FileUpload pathPrefix={`lessons/${lessonId}/video`} accept="video/*" label="Upload video file" hint="MP4/MOV · protected, students only" visibility="private" onUploaded={(ref) => set({ video_url: ref, video_provider: "video" })} />
        <input value={value.audio_url || ""} onChange={(e) => set({ audio_url: e.target.value || undefined })} placeholder="Audio link — or upload a protected file below — optional" className="w-full input" />
        <FileUpload pathPrefix={`lessons/${lessonId}/audio`} accept="audio/*" label="Upload audio file" hint="MP3/M4A · protected, students only" visibility="private" onUploaded={(ref) => set({ audio_url: ref })} />
        <input value={value.poster_eyebrow || ""} onChange={(e) => set({ poster_eyebrow: e.target.value || undefined })} placeholder="Poster line over the video (optional)" className="w-full input" />
        <input value={value.overview_heading || ""} onChange={(e) => set({ overview_heading: e.target.value || undefined })} placeholder="Overview heading" className="w-full input" />
        <input value={value.overview_duration_label || ""} onChange={(e) => set({ overview_duration_label: e.target.value || undefined })} placeholder="Duration label, e.g. “18 minutes”" className="w-full input" />
        <textarea value={value.overview_summary || ""} onChange={(e) => set({ overview_summary: e.target.value || undefined })} placeholder="Overview summary paragraph" rows={3} className="w-full input" />
        <div>
          <label className="field-label">Overview points (one per line)</label>
          <textarea defaultValue={(value.overview_points || []).join("\n")} onChange={(e) => set({ overview_points: linesToItems(e.target.value) })} rows={3} className="w-full input" />
        </div>
        <div>
          <label className="field-label">Transcript rows — one per line, as &quot;MM:SS | text&quot;</label>
          <textarea
            defaultValue={(value.transcript || []).map((r: any) => `${r.time} | ${r.text}`).join("\n")}
            onChange={(e) => set({ transcript: parsePipeLines(e.target.value).map(([time, text]) => ({ time: time || "00:00", text: text || "" })).filter((r) => r.text) })}
            rows={4}
            className="w-full input"
          />
        </div>
      </>
    );
  }

  if (type === "teaching_section") {
    return (
      <>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <input value={value.section_number || ""} onChange={(e) => set({ section_number: e.target.value })} placeholder="No. (01)" className="input" />
          <input value={value.heading || ""} onChange={(e) => set({ heading: e.target.value, anchor: slugify(e.target.value) })} placeholder="Section heading" className="input" />
        </div>
        <div>
          <label className="field-label">Paragraphs — separate with a blank line</label>
          <textarea defaultValue={(value.paragraphs || []).join("\n\n")} onChange={(e) => set({ paragraphs: e.target.value.split("\n\n").map((p) => p.trim()).filter(Boolean) })} rows={6} className="w-full input" />
        </div>
        <div>
          <label className="field-label">Scripture references — one per line, as &quot;Reference | Text | Note (optional)&quot;</label>
          <textarea
            defaultValue={(value.scripture_refs || []).map((r: any) => [r.reference, r.text, r.note].filter(Boolean).join(" | ")).join("\n")}
            onChange={(e) => set({ scripture_refs: parsePipeLines(e.target.value).map(([reference, text, note]) => ({ key: slugify(reference || ""), reference: reference || "", text: text || "", note: note || undefined })).filter((r) => r.reference && r.text) })}
            rows={3}
            className="w-full input"
          />
        </div>
        <input value={value.quote || ""} onChange={(e) => set({ quote: e.target.value || undefined })} placeholder="Pull-quote (optional)" className="w-full input" />
        <input value={value.takeaway || ""} onChange={(e) => set({ takeaway: e.target.value || undefined })} placeholder="Teaching takeaway (optional)" className="w-full input" />
      </>
    );
  }

  if (type === "takeaways") {
    return (
      <div>
        <label className="field-label">One takeaway per line, as &quot;Heading | Body&quot;</label>
        <textarea
          defaultValue={(value.items || []).map((i: any) => [i.heading, i.body].filter(Boolean).join(" | ")).join("\n")}
          onChange={(e) => set({ items: parsePipeLines(e.target.value).map(([heading, body]) => ({ heading: heading || "", body: body || "" })).filter((i) => i.heading) })}
          rows={4}
          className="w-full input"
        />
      </div>
    );
  }

  return null;
}

function ResourcesTextarea({ value, onChange }: { value: Record<string, any>; onChange: (next: Record<string, any>) => void }) {
  return (
    <textarea
      value={(value.items || []).map((i: any) => [i.label, i.url].filter(Boolean).join(" | ")).join("\n")}
      onChange={(e) => onChange({ ...value, items: parsePipeLines(e.target.value).map(([label, url]) => ({ label: label || "", url: url || "", downloadable: true })).filter((i) => i.label) })}
      rows={4}
      className="w-full input"
      placeholder={"Study guide | https://…\nScripture sheet | https://…"}
    />
  );
}

/** Final validation before writing to the DB. Returns an error string, or null
 *  when the content is acceptable. Placeholders are allowed to be empty. */
function validate(type: string, content: Record<string, any>): string | null {
  if (type === "written" && !(content.body || "").trim() && !(content.heading || "").trim()) return "Add a heading or body.";
  if (type === "scripture" && (!(content.text || "").trim() || !(content.reference || "").trim())) return "Add both the Scripture text and its reference.";
  if (type === "reflection_question" && !(content.prompt || "").trim()) return "Add the reflection prompt.";
  if (type === "do_this_now" && !(content.instruction || "").trim() && (content.items || []).length === 0) return "Add an instruction or at least one checklist item.";
  if (type === "prompt_card" && !(content.prompt || "").trim()) return "Add the prompt text.";
  if (type === "video" && !(content.url || "").trim()) return "Add the video link.";
  if (type === "teaching_section" && (!(content.heading || "").trim() || (content.paragraphs || []).length === 0)) return "Add a heading and at least one paragraph.";
  return null;
}

function normalize(type: string, content: Record<string, any>): Record<string, any> {
  if (type === "video") return { url: (content.url || "").trim(), provider: detectProvider((content.url || "").trim()) };
  return content;
}

export default function LessonBlockEditor({ lessonId, blocks }: { lessonId: string; blocks: Block[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [newType, setNewType] = useState("teaching_section");
  const [addDraft, setAddDraft] = useState<Record<string, any>>(() => defaultContent("teaching_section"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, any>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function changeNewType(t: string) {
    setNewType(t);
    setAddDraft(defaultContent(t));
    setError(null);
  }

  async function addBlock() {
    const err = validate(newType, addDraft);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("dp_lesson_blocks").insert({
      lesson_id: lessonId,
      block_type: newType,
      order_index: blocks.length,
      content: normalize(newType, addDraft)
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setAddDraft(defaultContent(newType));
    router.refresh();
  }

  function startEdit(b: Block) {
    setEditingId(b.id);
    setEditDraft({ ...b.content });
    setEditError(null);
  }

  async function saveEdit(b: Block) {
    const err = validate(b.block_type, editDraft);
    if (err) {
      setEditError(err);
      return;
    }
    setBusyId(b.id);
    const { error: updateError } = await supabase
      .from("dp_lesson_blocks")
      .update({ content: normalize(b.block_type, editDraft) })
      .eq("id", b.id);
    setBusyId(null);
    if (updateError) {
      setEditError(updateError.message);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function removeBlock(id: string) {
    if (!confirm("Remove this section? This can't be undone.")) return;
    setBusyId(id);
    await supabase.from("dp_lesson_blocks").delete().eq("id", id);
    setBusyId(null);
    router.refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const a = blocks[index];
    const b = blocks[target];
    setBusyId(a.id);
    await Promise.all([
      supabase.from("dp_lesson_blocks").update({ order_index: b.order_index }).eq("id", a.id),
      supabase.from("dp_lesson_blocks").update({ order_index: a.order_index }).eq("id", b.id)
    ]);
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {blocks.map((b, i) => (
          <div key={b.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Pill tone="neutral">{TYPE_LABEL[b.block_type] || b.block_type}</Pill>
                <div className="mt-2">
                  <BlockSummary block={b} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 font-ui text-xs">
                <button onClick={() => move(i, -1)} disabled={i === 0 || busyId === b.id} className="text-charcoal/40 enabled:hover:text-burgundy disabled:opacity-30" aria-label="Move up">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1 || busyId === b.id} className="text-charcoal/40 enabled:hover:text-burgundy disabled:opacity-30" aria-label="Move down">↓</button>
                <button onClick={() => (editingId === b.id ? setEditingId(null) : startEdit(b))} className="text-charcoal/60 hover:text-burgundy">
                  {editingId === b.id ? "Close" : "Edit"}
                </button>
                <button onClick={() => removeBlock(b.id)} className="text-charcoal/40 hover:text-coral">Remove</button>
              </div>
            </div>

            {editingId === b.id && (
              <div className="mt-4 space-y-3 border-t border-charcoal/10 pt-4">
                <BlockForm type={b.block_type} value={editDraft} onChange={setEditDraft} lessonId={lessonId} />
                {editError && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{editError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(b)} disabled={busyId === b.id} className="btn-primary">{busyId === b.id ? "Saving…" : "Save changes"}</button>
                  <button onClick={() => setEditingId(null)} className="font-ui text-sm text-charcoal/50">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {blocks.length === 0 && <p className="font-ui text-sm text-charcoal/50">No content sections yet — add one below.</p>}
      </div>

      <div className="card space-y-3 p-5">
        <p className="font-ui text-sm font-semibold text-charcoal">Add a content section</p>
        <p className="font-ui text-xs text-charcoal/50">
          Every section can be edited, reordered (↑ ↓), and removed. Upload video, audio, workbooks, and other files
          directly, or paste an external link (e.g. a YouTube URL).
        </p>
        <select value={newType} onChange={(e) => changeNewType(e.target.value)} className="w-full input">
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>

        <BlockForm type={newType} value={addDraft} onChange={setAddDraft} lessonId={lessonId} />

        {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}

        <button onClick={addBlock} disabled={saving} className="btn-primary">
          {saving ? "Adding…" : "+ Add section"}
        </button>
      </div>
    </div>
  );
}
