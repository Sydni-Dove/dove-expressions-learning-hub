"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pill } from "@/components/ui";

interface Block {
  id: string;
  block_type: string;
  order_index: number;
  content: Record<string, any>;
}

const TYPE_LABEL: Record<string, string> = {
  written: "Written",
  scripture: "Scripture",
  reflection_question: "Reflection question",
  video: "Video",
  lesson_media: "Lesson media (video/audio/transcript)",
  teaching_section: "Teaching section",
  takeaways: "Key takeaways"
};

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

function BlockSummary({ block }: { block: Block }) {
  if (block.block_type === "written") return <p className="font-body text-sm text-charcoal/80">{block.content.heading ? `${block.content.heading} — ` : ""}{block.content.body}</p>;
  if (block.block_type === "scripture") return <p className="font-body text-sm italic text-charcoal/80">"{block.content.text}" — {block.content.reference}</p>;
  if (block.block_type === "reflection_question") return <p className="font-body text-sm text-charcoal/80">{block.content.prompt}</p>;
  if (block.block_type === "video") return <p className="font-body text-sm text-charcoal/80">{block.content.provider === "youtube" ? "YouTube" : block.content.provider === "vimeo" ? "Vimeo" : "Video"} — {block.content.url}</p>;
  if (block.block_type === "lesson_media") {
    const points = block.content.overview_points?.length ?? 0;
    const transcriptRows = block.content.transcript?.length ?? 0;
    return <p className="font-body text-sm text-charcoal/80">{block.content.overview_heading || "Lesson media"} — {points} overview point{points === 1 ? "" : "s"}, {transcriptRows} transcript row{transcriptRows === 1 ? "" : "s"}{block.content.video_url ? ", video linked" : ", no video yet"}</p>;
  }
  if (block.block_type === "teaching_section") {
    const refs = block.content.scripture_refs?.length ?? 0;
    return <p className="font-body text-sm text-charcoal/80">{block.content.heading} — {block.content.paragraphs?.length ?? 0} paragraph(s), {refs} Scripture ref{refs === 1 ? "" : "s"}</p>;
  }
  if (block.block_type === "takeaways") {
    return <p className="font-body text-sm text-charcoal/80">{block.content.items?.length ?? 0} takeaway card(s)</p>;
  }
  return <p className="font-body text-sm text-charcoal/50">{JSON.stringify(block.content)}</p>;
}

export default function LessonBlockEditor({ lessonId, blocks }: { lessonId: string; blocks: Block[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [newType, setNewType] = useState("written");
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [text, setText] = useState("");
  const [reference, setReference] = useState("");
  const [prompt, setPrompt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // lesson_media fields
  const [mediaVideoUrl, setMediaVideoUrl] = useState("");
  const [mediaAudioUrl, setMediaAudioUrl] = useState("");
  const [posterEyebrow, setPosterEyebrow] = useState("");
  const [overviewHeading, setOverviewHeading] = useState("Teaching Overview");
  const [overviewDuration, setOverviewDuration] = useState("");
  const [overviewSummary, setOverviewSummary] = useState("");
  const [overviewPoints, setOverviewPoints] = useState("");
  const [transcriptRaw, setTranscriptRaw] = useState("");

  // teaching_section fields
  const [sectionNumber, setSectionNumber] = useState("");
  const [sectionHeading, setSectionHeading] = useState("");
  const [sectionParagraphs, setSectionParagraphs] = useState("");
  const [sectionQuote, setSectionQuote] = useState("");
  const [sectionTakeaway, setSectionTakeaway] = useState("");
  const [sectionScriptureRaw, setSectionScriptureRaw] = useState("");

  // takeaways fields
  const [takeawaysRaw, setTakeawaysRaw] = useState("");

  async function addBlock() {
    setError(null);
    let content: Record<string, any> = {};
    if (newType === "written") {
      if (!body.trim()) {
        setError("Add body text for this written block.");
        return;
      }
      content = { heading: heading || undefined, body };
    } else if (newType === "scripture") {
      if (!text.trim() || !reference.trim()) {
        setError("Add both the Scripture text and its reference.");
        return;
      }
      content = { text, reference };
    } else if (newType === "reflection_question") {
      if (!prompt.trim()) {
        setError("Add the reflection prompt.");
        return;
      }
      content = { prompt };
    } else if (newType === "video") {
      if (!videoUrl.trim()) {
        setError("Add the video link (YouTube or Vimeo URL).");
        return;
      }
      content = { url: videoUrl.trim(), provider: detectProvider(videoUrl.trim()) };
    } else if (newType === "lesson_media") {
      const transcript = parsePipeLines(transcriptRaw).map(([time, text]) => ({ time: time || "00:00", text: text || "" })).filter((row) => row.text);
      content = {
        video_url: mediaVideoUrl.trim() || undefined,
        video_provider: mediaVideoUrl.trim() ? detectProvider(mediaVideoUrl.trim()) : undefined,
        audio_url: mediaAudioUrl.trim() || undefined,
        poster_eyebrow: posterEyebrow.trim() || undefined,
        overview_heading: overviewHeading.trim() || undefined,
        overview_duration_label: overviewDuration.trim() || undefined,
        overview_summary: overviewSummary.trim() || undefined,
        overview_points: overviewPoints.split("\n").map((p) => p.trim()).filter(Boolean),
        transcript
      };
    } else if (newType === "teaching_section") {
      if (!sectionHeading.trim() || !sectionParagraphs.trim()) {
        setError("Add a heading and at least one paragraph.");
        return;
      }
      const scriptureRefs = parsePipeLines(sectionScriptureRaw).map(([reference, text, note]) => ({
        key: slugify(reference || ""),
        reference: reference || "",
        text: text || "",
        note: note || undefined
      })).filter((ref) => ref.reference && ref.text);
      content = {
        anchor: slugify(sectionHeading),
        section_number: sectionNumber.trim() || undefined,
        heading: sectionHeading.trim(),
        paragraphs: sectionParagraphs.split("\n\n").map((p) => p.trim()).filter(Boolean),
        scripture_refs: scriptureRefs.length ? scriptureRefs : undefined,
        quote: sectionQuote.trim() || undefined,
        takeaway: sectionTakeaway.trim() || undefined
      };
    } else if (newType === "takeaways") {
      const items = parsePipeLines(takeawaysRaw).map(([heading, body]) => ({ heading: heading || "", body: body || "" })).filter((item) => item.heading);
      if (items.length === 0) {
        setError("Add at least one takeaway as \"Heading | Body\".");
        return;
      }
      content = { items };
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("dp_lesson_blocks").insert({
      lesson_id: lessonId,
      block_type: newType,
      order_index: blocks.length,
      content
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setHeading("");
    setBody("");
    setText("");
    setReference("");
    setPrompt("");
    setVideoUrl("");
    setMediaVideoUrl("");
    setMediaAudioUrl("");
    setPosterEyebrow("");
    setOverviewHeading("Teaching Overview");
    setOverviewDuration("");
    setOverviewSummary("");
    setOverviewPoints("");
    setTranscriptRaw("");
    setSectionNumber("");
    setSectionHeading("");
    setSectionParagraphs("");
    setSectionQuote("");
    setSectionTakeaway("");
    setSectionScriptureRaw("");
    setTakeawaysRaw("");
    router.refresh();
  }

  async function removeBlock(id: string) {
    await supabase.from("dp_lesson_blocks").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {blocks.map((b) => (
          <div key={b.id} className="card flex items-start justify-between gap-3 p-4">
            <div>
              <Pill tone="neutral">{TYPE_LABEL[b.block_type] || b.block_type}</Pill>
              <div className="mt-2">
                <BlockSummary block={b} />
              </div>
            </div>
            <button onClick={() => removeBlock(b.id)} className="font-ui text-xs text-charcoal/40 hover:text-coral">
              Remove
            </button>
          </div>
        ))}
        {blocks.length === 0 && <p className="font-ui text-sm text-charcoal/50">No content blocks yet — add one below.</p>}
      </div>

      <div className="card space-y-3 p-5">
        <p className="font-ui text-sm font-semibold text-charcoal">Add a content block</p>
        <p className="font-ui text-xs text-charcoal/50">
          Use Teaching section for the main flow of a rich lesson (like a "Draw Near" video episode), Lesson media
          for the video/audio/transcript card at the top, and Key takeaways for the closing recap. Written,
          Scripture, Reflection question, and Video remain available for simpler lessons.
        </p>
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="w-full input"
        >
          <option value="teaching_section">Teaching section</option>
          <option value="lesson_media">Lesson media (video/audio/transcript)</option>
          <option value="takeaways">Key takeaways</option>
          <option value="reflection_question">Reflection question</option>
          <option value="written">Written</option>
          <option value="scripture">Scripture</option>
          <option value="video">Video</option>
        </select>

        {newType === "written" && (
          <>
            <input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="Heading (optional)"
              className="w-full input"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Body text"
              rows={4}
              className="w-full input"
            />
          </>
        )}

        {newType === "scripture" && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Scripture text"
              rows={3}
              className="w-full input"
            />
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Reference (e.g. John 14:26)"
              className="w-full input"
            />
          </>
        )}

        {newType === "reflection_question" && (
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Reflection prompt"
            rows={3}
            className="w-full input"
          />
        )}

        {newType === "video" && (
          <>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Paste a YouTube or Vimeo link"
              className="w-full input"
            />
            <p className="font-ui text-xs text-charcoal/50">
              Works with a standard YouTube (youtube.com/watch?v=... or youtu.be/...) or Vimeo (vimeo.com/...) link.
            </p>
          </>
        )}

        {newType === "lesson_media" && (
          <>
            <input value={mediaVideoUrl} onChange={(e) => setMediaVideoUrl(e.target.value)} placeholder="Video link (YouTube, Vimeo, or a direct .mp4 file) — optional" className="w-full input" />
            <input value={mediaAudioUrl} onChange={(e) => setMediaAudioUrl(e.target.value)} placeholder="Audio file link — optional" className="w-full input" />
            <input value={posterEyebrow} onChange={(e) => setPosterEyebrow(e.target.value)} placeholder="Poster line shown over the video, e.g. “Draw Near. Commit. Build.”" className="w-full input" />
            <input value={overviewHeading} onChange={(e) => setOverviewHeading(e.target.value)} placeholder="Overview heading" className="w-full input" />
            <input value={overviewDuration} onChange={(e) => setOverviewDuration(e.target.value)} placeholder="Duration label, e.g. “18 minutes”" className="w-full input" />
            <textarea value={overviewSummary} onChange={(e) => setOverviewSummary(e.target.value)} placeholder="Overview summary paragraph" rows={3} className="w-full input" />
            <div>
              <label className="field-label">Overview points (one per line)</label>
              <textarea value={overviewPoints} onChange={(e) => setOverviewPoints(e.target.value)} rows={3} className="w-full input" placeholder={"God forms Moses in encounter before He sends him.\nMoses' objections reveal identity, credibility, and capability fears."} />
            </div>
            <div>
              <label className="field-label">Transcript rows — one per line, as "MM:SS | text"</label>
              <textarea value={transcriptRaw} onChange={(e) => setTranscriptRaw(e.target.value)} rows={5} className="w-full input" placeholder={"00:00 | You have been feeling a pull toward something for a while now.\n06:42 | Come, I will send you."} />
            </div>
          </>
        )}

        {newType === "teaching_section" && (
          <>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <input value={sectionNumber} onChange={(e) => setSectionNumber(e.target.value)} placeholder="No. (e.g. 01)" className="input" />
              <input value={sectionHeading} onChange={(e) => setSectionHeading(e.target.value)} placeholder="Section heading" className="input" />
            </div>
            <div>
              <label className="field-label">Paragraphs — separate paragraphs with a blank line</label>
              <textarea value={sectionParagraphs} onChange={(e) => setSectionParagraphs(e.target.value)} rows={6} className="w-full input" placeholder={"First paragraph of teaching content.\n\nSecond paragraph."} />
            </div>
            <div>
              <label className="field-label">Scripture references — one per line, as "Reference | Text | Note (optional)"</label>
              <textarea value={sectionScriptureRaw} onChange={(e) => setSectionScriptureRaw(e.target.value)} rows={3} className="w-full input" placeholder={'Exodus 3:14 | "I AM WHO I AM..." | The assignment is anchored in God\'s self-sufficient identity.'} />
            </div>
            <input value={sectionQuote} onChange={(e) => setSectionQuote(e.target.value)} placeholder="Pull-quote (optional)" className="w-full input" />
            <input value={sectionTakeaway} onChange={(e) => setSectionTakeaway(e.target.value)} placeholder="Teaching takeaway (optional)" className="w-full input" />
          </>
        )}

        {newType === "takeaways" && (
          <div>
            <label className="field-label">One takeaway per line, as "Heading | Body"</label>
            <textarea value={takeawaysRaw} onChange={(e) => setTakeawaysRaw(e.target.value)} rows={4} className="w-full input" placeholder={"Presence Forms | God forms us in His presence before He sends us.\nI AM Is Sufficient | The assignment rests on who God is, not on our sufficiency."} />
          </div>
        )}

        {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}

        <button onClick={addBlock} disabled={saving} className="btn-primary">
          {saving ? "Adding…" : "+ Add block"}
        </button>
      </div>
    </div>
  );
}
