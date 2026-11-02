import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { TEACHING_MODULES } from "../../scripts/teaching-import";
import { toPayload } from "../../scripts/teaching-import/convert";
import { buildTeachingSeedSql, SEED_FILE } from "../../scripts/teaching-import/generate-seed";
import { CORE_TEXT } from "./teaching-fixtures";
import { docText, embedFor, emptyStudentSections, listItems, safeHref, safeHttps, sanitizeContent, sanitizeDoc, wordCount, type Content, type Doc } from "../../lib/voice-teaching/doc";
import { TEMPLATES, payloadFromTemplate } from "../../lib/voice-teaching/templates";
import { DocView, MediaView, SectionsView, StudentLesson } from "../../components/voice/teaching/DocView";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
function strings(v: unknown, out: string[] = []): string[] { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach((x) => strings(x, out)); else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out)); return out; }
const contentText = (c: Content) => norm(c.sections.map((s) => `${s.title}\n${docText(s.doc)}`).join("\n"));

describe("the original manuscripts are preserved in the editable content", () => {
  for (const m of TEACHING_MODULES) {
    it(`${m.key}: every sentence of the student lesson and instructor notes survives the import`, () => {
      const pl = toPayload(m);
      const studentText = norm(contentText(pl.student) + " " + pl.objectives.join(" ") + " " + pl.title + " " + pl.description);
      const instructorText = contentText(pl.instructor);
      const studentStrings = strings({ scriptures: m.scriptures, student: m.student, objectives: m.objectives }).filter((s) => s.trim().length > 3 && !/^[a-z0-9-]+$/.test(s));
      const instructorStrings = strings(m.instructor).filter((s) => s.trim().length > 3);
      const missingS = studentStrings.filter((s) => !studentText.includes(norm(s.replace(/^\d+\.\s*/, ""))));
      const missingI = instructorStrings.filter((s) => !instructorText.includes(norm(s.replace(/^\d+\.\s*/, ""))));
      expect(missingS).toEqual([]); expect(missingI).toEqual([]);
      expect(instructorText).toContain(norm(m.mainMessage));
    });
    it(`${m.key}: instructor notes never leak into the student content (and vice versa)`, () => {
      const pl = toPayload(m);
      const st = contentText(pl.student);
      for (const n of [...m.instructor.notes, ...(m.instructor.featuredNotes ?? [])]) expect(st).not.toContain(norm(n.body[0]));
      expect(st).not.toMatch(/Facilitation tips/);
    });
    it(`${m.key}: converts to valid, substantial documents`, () => {
      const pl = toPayload(m);
      expect(wordCount(pl.student)).toBeGreaterThan(1500); expect(wordCount(pl.instructor)).toBeGreaterThan(600);
      expect(JSON.stringify(sanitizeContent(pl.student))).toBe(JSON.stringify(pl.student)); // already clean: sanitizing changes nothing
      expect(JSON.stringify(sanitizeContent(pl.instructor))).toBe(JSON.stringify(pl.instructor));
      expect(new Set(pl.student.sections.map((s) => s.id)).size).toBe(pl.student.sections.length);
      expect(emptyStudentSections(pl.student)).toEqual([]);
    });
  }
  it("Module 3 keeps its featured subsection, verbatim core statement and leaders' section", () => {
    const pl = toPayload(TEACHING_MODULES[2]); const t = contentText(pl.student);
    expect(t).toContain(norm(CORE_TEXT));
    expect(t).toContain("Gifted but Still Growing: When the Platform Comes Before Spiritual Maturity");
    expect(t).toContain("How to Protect and Develop Spiritually Young Worshipers");
    expect(contentText(pl.instructor)).toMatch(/988/);
    expect(pl.student.sections.find((s) => s.doc.content[0]?.type === "blockquote")?.title).toMatch(/^Gifted but Still Growing/);
  });
  it("the seed migration matches the import (no drift) and imports as ready for review, never published", () => {
    const sql = fs.readFileSync(SEED_FILE, "utf8");
    expect(sql).toBe(buildTeachingSeedSql());
    expect(sql).toContain("'ready_for_review'"); expect(sql).not.toMatch(/'published'/); expect(sql).not.toMatch(/insert into dp_voice_teaching_versions|insert into dp_assignments/);
  });
});

describe("sanitizing and safe rendering", () => {
  const evil: Doc = { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Hello", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "bold" }] }] },
    { type: "script", content: [{ type: "text", text: "alert(1)" }] } as never,
    { type: "html", text: "<img src=x onerror=alert(1)>" } as never,
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Big" }] },
    { type: "paragraph", content: [{ type: "text", text: "ok", marks: [{ type: "link", attrs: { href: "https://example.org/a" } }, { type: "style" as never }] }] }
  ] };
  it("drops unknown nodes, unsafe links and unknown marks, and normalises headings", () => {
    const d = sanitizeDoc(evil); const j = JSON.stringify(d);
    expect(j).not.toMatch(/script|onerror|javascript|html|style/i);
    expect(d.content.map((n) => n.type)).toEqual(["paragraph", "heading", "paragraph"]);
    expect(d.content[1].attrs).toEqual({ level: 3 });
    expect(sanitizeDoc(null).content).toHaveLength(1); expect(sanitizeDoc("x")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
  it("what reaches the page contains no script, event handler or javascript link, even from hostile stored data", () => {
    const hostile = { sections: [{ id: "a", type: "iframe", title: "<script>alert(1)</script>", doc: evil, media: [{ id: "m", kind: "video", url: "javascript:alert(1)", title: "x" }, { id: "n", kind: "link", url: "http://insecure.example/x", title: "y" }, { id: "o", kind: "link", url: "https://ok.example/doc.pdf", title: "Doc" }] }] };
    const html = renderToStaticMarkup(createElement(StudentLesson, { title: "T<script>x</script>", content: hostile, objectives: ["<img src=x onerror=1>"] }));
    expect(html).not.toMatch(/<(script|img|iframe|object|embed)\b/i); expect(html).not.toMatch(/<[^>]+\s(on\w+|style)=/i); expect(html).not.toMatch(/(href|src)="(javascript|data|http):/i);
    expect(html).toContain("&lt;script&gt;"); // shown as harmless text
    expect(html).toContain('href="https://ok.example/doc.pdf"'); expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(renderToStaticMarkup(createElement(DocView, { doc: evil }))).not.toMatch(/(href|src)="javascript:/);
    expect(renderToStaticMarkup(createElement(SectionsView, { content: hostile, audience: "student" }))).not.toMatch(/<script/i);
  });
  it("links and media addresses are limited to safe schemes", () => {
    expect(safeHref("https://a.org")).toBeTruthy(); expect(safeHref("mailto:a@b.org")).toBeTruthy();
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "vbscript:x", "//evil.com", "https://a b", "", null, 5]) expect(safeHref(bad as never), String(bad)).toBeNull();
    expect(safeHttps("http://a.org")).toBeNull(); expect(safeHttps("https://a.org/x")).toBeTruthy();
  });
  it("embeds only YouTube and Vimeo in frames; files use the browser player; everything else is a plain link", () => {
    expect(embedFor({ kind: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })).toEqual({ mode: "iframe", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
    expect(embedFor({ kind: "video", url: "https://youtu.be/dQw4w9WgXcQ" })).toMatchObject({ mode: "iframe" });
    expect(embedFor({ kind: "video", url: "https://vimeo.com/123456789" })).toEqual({ mode: "iframe", src: "https://player.vimeo.com/video/123456789" });
    expect(embedFor({ kind: "video", url: "https://cdn.example/a.mp4" })).toEqual({ mode: "video", src: "https://cdn.example/a.mp4" });
    expect(embedFor({ kind: "audio", url: "https://cdn.example/a.mp3" })).toEqual({ mode: "audio", src: "https://cdn.example/a.mp3" });
    expect(embedFor({ kind: "video", url: "https://evil.example/embed/x" })).toEqual({ mode: "link", src: "https://evil.example/embed/x" });
    expect(embedFor({ kind: "video", url: "http://youtu.be/dQw4w9WgXcQ" })).toBeNull();
    expect(renderToStaticMarkup(createElement(MediaView, { items: [{ id: "1", kind: "video", url: "https://youtu.be/dQw4w9WgXcQ", title: "Demo" }] }))).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
  it("list helpers support prefilled assignments and publish checks", () => {
    const d: Doc = { type: "doc", content: [{ type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Sing it twice" }] }] }, { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Journal" }] }] }] }] };
    expect(listItems(d)).toEqual(["Sing it twice", "Journal"]);
    expect(emptyStudentSections({ sections: [{ id: "a", type: "text", title: "Empty", doc: { type: "doc", content: [{ type: "paragraph" }] } }, { id: "b", type: "part", title: "Part", doc: { type: "doc", content: [{ type: "paragraph" }] } }] }).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("templates", () => {
  it("offers the five templates, each fully editable and producing valid content", () => {
    expect(TEMPLATES.map((t) => t.key)).toEqual(["bible-teaching", "vocal-exercise", "worship-leadership", "practical-coaching", "scripture-to-song"]);
    for (const t of TEMPLATES) {
      const p = payloadFromTemplate("T", t);
      expect(p.student.sections.length).toBeGreaterThan(3); expect(p.instructor.sections.length).toBeGreaterThan(2);
      expect(new Set([...p.student.sections, ...p.instructor.sections].map((s) => s.id)).size).toBe(p.student.sections.length + p.instructor.sections.length);
      expect(JSON.stringify(sanitizeContent(p.student))).toBe(JSON.stringify(p.student));
    }
    const blank = payloadFromTemplate("Mine", undefined); expect(blank.student.sections).toHaveLength(1); expect(blank.instructor.sections).toHaveLength(1);
  });
});
