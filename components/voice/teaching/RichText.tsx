"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { safeHref, sanitizeDoc, type Doc } from "@/lib/voice-teaching/doc";

const tb = "inline-flex h-10 min-w-[40px] items-center justify-center rounded-lg px-2 font-ui text-sm font-semibold text-[#1B1717] hover:bg-[#F2DFD8] disabled:opacity-40";
const on = "bg-[#630000] text-white hover:bg-[#630000]";
function Btn({ ed, label, active, run, children, disabled }: { ed: Editor; label: string; active?: boolean; run: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={run} className={`${tb} ${active ? on : ""}`}>{children}</button>;
}
/** A familiar word-processor style editor (no Markdown, no code). Output is a restricted document, sanitized on every change. */
export default function RichText({ value, onChange, placeholder, label, editable = true }: { value: Doc; onChange: (d: Doc) => void; placeholder?: string; label: string; editable?: boolean }) {
  const cb = useRef(onChange); cb.current = onChange; // always call the newest handler, never a stale one
  const last = useRef(JSON.stringify(sanitizeDoc(value))); // only genuine edits are reported; the editor re-normalising its own content on load is not an edit
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, horizontalRule: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: false, linkOnPaste: true, protocols: ["http", "https", "mailto"], validate: (h) => !!safeHref(h), HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" })
    ],
    content: value,
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-label": label, class: "tt-prose px-3 py-3" } },
    onUpdate: ({ editor: e }) => { const next = sanitizeDoc(e.getJSON()); const j = JSON.stringify(next); if (j === last.current) return; last.current = j; cb.current(next); }
  });
  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);
  if (!editor) return <div className="min-h-[9rem] rounded-xl border border-[#630000]/20 bg-white" aria-busy="true" />;
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (https://…)", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    const ok = safeHref(url.trim()); if (!ok) { window.alert("Please enter a valid web address starting with https://"); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: ok }).run();
  };
  return (
    <div className="overflow-hidden rounded-xl border border-[#630000]/25 bg-white focus-within:ring-2 focus-within:ring-[#630000]/40">
      {editable && (
        <div role="toolbar" aria-label={`${label} formatting`} className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-[#630000]/15 bg-[#FBF4F1] p-1">
          <Btn ed={editor} label="Bold" active={editor.isActive("bold")} run={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
          <Btn ed={editor} label="Italic" active={editor.isActive("italic")} run={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
          <Btn ed={editor} label="Underline" active={editor.isActive("underline")} run={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
          <span className="mx-1 h-6 w-px bg-[#630000]/20" aria-hidden="true" />
          <Btn ed={editor} label="Heading" active={editor.isActive("heading", { level: 2 })} run={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H1</Btn>
          <Btn ed={editor} label="Subheading" active={editor.isActive("heading", { level: 3 })} run={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H2</Btn>
          <span className="mx-1 h-6 w-px bg-[#630000]/20" aria-hidden="true" />
          <Btn ed={editor} label="Bulleted list" active={editor.isActive("bulletList")} run={() => editor.chain().focus().toggleBulletList().run()}>• List</Btn>
          <Btn ed={editor} label="Numbered list" active={editor.isActive("orderedList")} run={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>
          <Btn ed={editor} label="Quote or key statement" active={editor.isActive("blockquote")} run={() => editor.chain().focus().toggleBlockquote().run()}>“ Quote</Btn>
          <Btn ed={editor} label="Link" active={editor.isActive("link")} run={setLink}>Link</Btn>
          <span className="mx-1 h-6 w-px bg-[#630000]/20" aria-hidden="true" />
          <Btn ed={editor} label="Undo" run={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↶</Btn>
          <Btn ed={editor} label="Redo" run={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↷</Btn>
        </div>)}
      <EditorContent editor={editor} />
    </div>
  );
}
