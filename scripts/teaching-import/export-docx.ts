/** Exports each imported teaching as a Word document (student lesson, then private instructor notes). Run: npx vite-node scripts/teaching-import/export-docx.ts */
import fs from "node:fs";
import { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun, BorderStyle, PageBreak } from "docx";
import { TEACHING_MODULES } from "./index";
import { toPayload } from "./convert";
import { SECTION_LABEL, type DocNode, type Section } from "../../lib/voice-teaching/doc";

const BURGUNDY = "630000", CHARCOAL = "1B1717";
let listSeq = 0; const orderedRefs: string[] = [];
function runs(n: DocNode): TextRun[] {
  if (n.type === "hardBreak") return [new TextRun({ break: 1 })];
  if (n.type === "text") { const m = (n.marks ?? []).map((x) => x.type); return [new TextRun({ text: n.text ?? "", bold: m.includes("bold"), italics: m.includes("italic"), underline: m.includes("underline") ? {} : undefined, strike: m.includes("strike") })]; }
  return (n.content ?? []).flatMap(runs);
}
function blocks(n: DocNode, ctx: { ref?: string; level: number; quote?: boolean } = { level: 0 }): Paragraph[] {
  const kids = n.content ?? [];
  switch (n.type) {
    case "paragraph": return [new Paragraph({ children: runs(n), spacing: { after: 120 }, ...(ctx.ref ? { numbering: { reference: ctx.ref, level: ctx.level } } : {}), ...(ctx.quote ? { indent: { left: 540 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: BURGUNDY, space: 8 } } } : {}) })];
    case "heading": return [new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs(n) })];
    case "blockquote": return kids.flatMap((k) => blocks(k, { ...ctx, quote: true }).map((p) => p));
    case "bulletList": return kids.flatMap((li) => (li.content ?? []).flatMap((c) => blocks(c, { ref: "bullets", level: 0 })));
    case "orderedList": { const ref = `ol${++listSeq}`; orderedRefs.push(ref); return kids.flatMap((li) => (li.content ?? []).flatMap((c) => blocks(c, { ref, level: 0 }))); }
    default: return [];
  }
}
const sectionParas = (s: Section, showType: boolean): Paragraph[] => s.type === "part"
  ? [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(s.title)], border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BURGUNDY, space: 2 } } }), ...s.doc.content.flatMap((n) => blocks(n))]
  : [new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(s.title || "(Untitled)"), ...(showType ? [new TextRun({ text: `   ${SECTION_LABEL[s.type]}`, size: 18, color: "7a5a00", bold: false })] : [])] }), ...s.doc.content.flatMap((n) => blocks(n))];

for (const m of TEACHING_MODULES) {
  const pl = toPayload(m); listSeq = 0; orderedRefs.length = 0;
  const body: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(pl.title)] }),
    new Paragraph({ children: [new TextRun({ text: pl.description, italics: true })], spacing: { after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: `Teaching ${m.number} · about ${pl.estimated_minutes} minutes · Worship Development · Dove Expressions`, size: 20, color: "4a3a3a" })], spacing: { after: 240 } }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("PART ONE: Student lesson")] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("What you will learn")] }),
    ...pl.objectives.map((o) => new Paragraph({ children: [new TextRun(o)], numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 } })),
    ...pl.student.sections.flatMap((s) => sectionParas(s, false)),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("PART TWO: Instructor notes (private)")] }),
    new Paragraph({ children: [new TextRun({ text: "For the instructor only. These notes are never published or shown to students.", bold: true, color: "7a5a00" })], spacing: { after: 200 } }),
    ...pl.instructor.sections.flatMap((s) => sectionParas(s, true))
  ];
  // body is built first so every ordered list's numbering reference exists below
  const doc = new Document({
    creator: "Dove Expressions", title: pl.title,
    styles: { default: { document: { run: { font: "Calibri", size: 23, color: CHARCOAL } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: "Georgia", size: 44, bold: true, color: BURGUNDY }, paragraph: { spacing: { after: 120 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Georgia", size: 32, bold: true, color: BURGUNDY }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Georgia", size: 26, bold: true, color: BURGUNDY }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Georgia", size: 24, bold: true, color: BURGUNDY }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } }] },
    numbering: { config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ...orderedRefs.map((reference) => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }))] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, right: 1300, bottom: 1300, left: 1300 } } }, children: body }]
  });
  Packer.toBuffer(doc).then((b) => { fs.mkdirSync("docs/teachings", { recursive: true }); fs.writeFileSync(`docs/teachings/${m.number}-${m.key}.docx`, b); console.log("wrote", m.key); });
}
