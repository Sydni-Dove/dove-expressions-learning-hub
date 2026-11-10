/** Rich-text document model for Worship Development teachings.
 *  Content is stored as structured JSON (never HTML), restricted to the node and mark types below. The same whitelist is enforced in the
 *  database (dp_private.teaching_doc_ok) and again whenever content is rendered, so unsafe markup or script can never reach a page. */
export type MarkType = "bold" | "italic" | "underline" | "strike" | "link";
export interface Mark { type: MarkType; attrs?: { href?: string } }
export interface DocNode { type: string; attrs?: Record<string, unknown>; content?: DocNode[]; text?: string; marks?: Mark[] }
export interface Doc { type: "doc"; content: DocNode[] }
export type SectionType = "text" | "scripture" | "activity" | "discussion" | "reflection" | "homework" | "media" | "part" | "script" | "timing" | "example" | "facilitation" | "reminder";
export type MediaKind = "video" | "audio" | "file" | "link";
export interface MediaItem { id: string; kind: MediaKind; url: string; title: string }
export interface Section { id: string; type: SectionType; title: string; doc: Doc; media?: MediaItem[] }
export interface Content { sections: Section[] }
export interface Payload { title: string; description: string; estimated_minutes: number | null; objectives: string[]; student: Content; instructor: Content }

export const SECTION_TYPES: SectionType[] = ["text", "scripture", "activity", "discussion", "reflection", "homework", "media", "part", "script", "timing", "example", "facilitation", "reminder"];
export const NODE_TYPES = ["doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "hardBreak", "text"];
export const MARK_TYPES: MarkType[] = ["bold", "italic", "underline", "strike", "link"];
export const SECTION_LABEL: Record<SectionType, string> = {
  text: "Teaching", scripture: "Scripture reading", activity: "Activity", discussion: "Discussion questions", reflection: "Reflection", homework: "Homework / practice",
  media: "Media", part: "Part heading", script: "Teaching script", timing: "Timing", example: "Example / illustration", facilitation: "Facilitation notes", reminder: "Reminder"
};
export const STUDENT_TYPES: SectionType[] = ["text", "scripture", "activity", "discussion", "reflection", "homework", "media", "part"];
export const INSTRUCTOR_TYPES: SectionType[] = ["script", "text", "scripture", "timing", "example", "facilitation", "reminder", "media", "part"];

export const emptyDoc = (): Doc => ({ type: "doc", content: [{ type: "paragraph" }] });
export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "").slice(0, 16) : Math.random().toString(36).slice(2, 18));
export const newSection = (type: SectionType = "text", title = ""): Section => ({ id: newId(), type, title, doc: emptyDoc() });

// ---------- safe links and media ----------
export function safeHref(u: unknown): string | null {
  if (typeof u !== "string" || u.length > 1000 || /\s/.test(u)) return null;
  try { const x = new URL(u); return ["https:", "http:", "mailto:"].includes(x.protocol) ? x.toString() : null; } catch { return null; }
}
export function safeHttps(u: unknown): string | null { const s = safeHref(u); return s && s.startsWith("https://") ? s : null; }
export type Embed = { mode: "iframe"; src: string } | { mode: "video" | "audio"; src: string } | { mode: "link"; src: string };
/** How a media URL is shown. Only YouTube and Vimeo are framed; direct audio/video files use the browser's own player; everything else is a plain link. */
export function embedFor(item: Pick<MediaItem, "kind" | "url">): Embed | null {
  const src = safeHttps(item.url); if (!src) return null;
  const u = new URL(src); const host = u.hostname.replace(/^www\./, "");
  if (item.kind === "video") {
    let id = "";
    if (host === "youtube.com" || host === "m.youtube.com") id = u.searchParams.get("v") ?? (u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,20})/)?.[1] ?? "");
    else if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    if (/^[\w-]{6,20}$/.test(id)) return { mode: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` };
    if (host === "vimeo.com" || host === "player.vimeo.com") { const v = u.pathname.match(/(\d{5,12})/)?.[1]; if (v) return { mode: "iframe", src: `https://player.vimeo.com/video/${v}` }; }
    if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { mode: "video", src };
  }
  if (item.kind === "audio" && /\.(mp3|m4a|wav|ogg|aac)$/i.test(u.pathname)) return { mode: "audio", src };
  return { mode: "link", src };
}

// ---------- sanitizing ----------
const BLOCKS = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote"]);
function cleanNode(n: unknown, depth: number): DocNode | null {
  if (!n || typeof n !== "object" || depth > 10) return null;
  const o = n as DocNode; const t = o.type;
  if (t === "hardBreak") return { type: "hardBreak" };
  if (t === "text") {
    if (typeof o.text !== "string" || !o.text) return null;
    const marks: Mark[] = [];
    for (const m of Array.isArray(o.marks) ? o.marks : []) {
      if (!m || !MARK_TYPES.includes(m.type)) continue;
      if (m.type === "link") { const href = safeHref(m.attrs?.href); if (href) marks.push({ type: "link", attrs: { href } }); } else marks.push({ type: m.type });
    }
    return marks.length ? { type: "text", text: o.text, marks } : { type: "text", text: o.text };
  }
  if (!BLOCKS.has(t)) return null;
  const out: DocNode = { type: t };
  if (t === "heading") { const l = Number((o.attrs as { level?: number } | undefined)?.level); out.attrs = { level: l >= 2 && l <= 4 ? l : 3 }; }
  const kids = (Array.isArray(o.content) ? o.content : []).map((c) => cleanNode(c, depth + 1)).filter(Boolean) as DocNode[];
  if (kids.length) out.content = kids;
  return out;
}
export function sanitizeDoc(d: unknown): Doc {
  const content = d && typeof d === "object" && Array.isArray((d as Doc).content) ? (d as Doc).content : [];
  const kids = content.map((c) => cleanNode(c, 1)).filter(Boolean) as DocNode[];
  return { type: "doc", content: kids.length ? kids : [{ type: "paragraph" }] };
}
export function sanitizeContent(c: unknown): Content {
  const arr = c && typeof c === "object" && Array.isArray((c as Content).sections) ? (c as Content).sections : [];
  return { sections: arr.filter((s) => s && typeof s === "object").map((s) => {
    const sec: Section = { id: String(s.id || newId()).slice(0, 64), type: SECTION_TYPES.includes(s.type) ? s.type : "text", title: String(s.title ?? "").slice(0, 300), doc: sanitizeDoc(s.doc) };
    const media = (Array.isArray(s.media) ? s.media : []).flatMap((m) => { const url = safeHttps(m?.url); return url ? [{ id: String(m.id || newId()).slice(0, 64), kind: (["video", "audio", "file", "link"] as MediaKind[]).includes(m.kind) ? m.kind : "link", url, title: String(m.title ?? "").slice(0, 200) }] : []; });
    if (media.length) sec.media = media;
    return sec;
  }) };
}

// ---------- text helpers ----------
export function nodeText(n: DocNode): string { return n.type === "text" ? n.text ?? "" : n.type === "hardBreak" ? "\n" : (n.content ?? []).map(nodeText).join(n.type === "bulletList" || n.type === "orderedList" ? "\n" : ""); }
export const docText = (d: Doc): string => (d.content ?? []).map(nodeText).join("\n").replace(/\n{2,}/g, "\n").trim();
export const docIsEmpty = (d: Doc) => docText(d) === "";
/** The text of each list item in a doc (used to prefill assignment homework and reflection questions). */
export function listItems(d: Doc): string[] {
  const out: string[] = [];
  const walk = (n: DocNode) => { if (n.type === "listItem") out.push(nodeText(n).replace(/\s+/g, " ").trim()); else (n.content ?? []).forEach(walk); };
  (d.content ?? []).forEach(walk); return out.filter(Boolean);
}
export const sectionsOfType = (c: Content, ...types: SectionType[]) => c.sections.filter((s) => types.includes(s.type));
/** Student sections that would publish with nothing in them (parts may be heading-only). */
export function emptyStudentSections(c: Content): Section[] { return c.sections.filter((s) => s.type !== "part" && docIsEmpty(s.doc) && !(s.media?.length)); }
export const wordCount = (c: Content | Doc) => ("sections" in c ? c.sections.map((s) => s.title + " " + docText(s.doc)).join(" ") : docText(c)).split(/\s+/).filter(Boolean).length;
