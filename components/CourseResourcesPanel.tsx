"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Resource { id: string; kind: string; title: string; file_name: string | null; version: string | null; is_active: boolean }

const KIND_LABEL: Record<string, string> = { workbook: "Workbook", reading_edition: "Readable edition", other: "Other" };

/** Staff: private course downloads (workbook PDFs) and a link to the guided-course import. */
export default function CourseResourcesPanel({ courseId, resources }: { courseId: string; resources: Resource[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("workbook");
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function upload() {
    if (!file || !title.trim()) {
      setError("Choose a PDF and give it a title.");
      return;
    }
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("courseId", courseId);
    form.append("title", title.trim());
    form.append("kind", kind);
    form.append("version", version.trim());
    form.append("file", file);
    const res = await fetch("/api/staff/course-resources", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "The upload failed.");
      return;
    }
    setTitle(""); setVersion(""); setFile(null);
    router.refresh();
  }

  async function toggle(r: Resource) {
    setBusyId(r.id);
    const { error: e } = await supabase.from("dp_course_resources").update({ is_active: !r.is_active }).eq("id", r.id);
    setBusyId(null);
    if (e) setError(e.message);
    else router.refresh();
  }

  return (
    <section className="card space-y-4 p-5" aria-labelledby="resources-heading" data-testid="course-resources-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="resources-heading" className="font-display text-xl text-burgundy">Course downloads &amp; guided content</h2>
        <Link href={`/staff/courses/${courseId}/import`} className="btn-secondary">Import a guided course →</Link>
      </div>
      <p className="font-ui text-xs text-charcoal/60">Files are private: students get a short-lived link only if they&rsquo;re enrolled in this course. Typed answers in a downloaded PDF stay on the student&rsquo;s device.</p>

      <ul className="divide-y divide-charcoal/10">
        {resources.length === 0 && <li className="py-2 font-ui text-sm text-charcoal/50">No downloads yet.</li>}
        {resources.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="font-body text-sm">
              <strong>{r.title}</strong> <span className="font-ui text-xs text-charcoal/55">· {KIND_LABEL[r.kind] ?? r.kind}{r.version ? ` · ${r.version}` : ""}{r.file_name ? ` · ${r.file_name}` : ""}</span>
            </span>
            <span className="flex items-center gap-3 font-ui text-xs">
              <a href={`/courses/${courseId}/resources/${r.id}`} className="text-burgundy underline">Download</a>
              <button type="button" onClick={() => toggle(r)} disabled={busyId === r.id} className="underline">{r.is_active ? "Hide from students" : "Show to students"}</button>
              <span className={r.is_active ? "text-green-700" : "text-charcoal/50"}>{r.is_active ? "Available" : "Hidden"}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-2 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title shown to students" className="input" maxLength={120} />
        <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version label (optional)" className="input" maxLength={40} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="input">
          {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="font-ui text-sm" data-testid="resource-file" />
      </div>
      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
      <button type="button" onClick={upload} disabled={busy} className="btn-primary" data-testid="resource-upload">{busy ? "Uploading…" : "Upload PDF"}</button>
    </section>
  );
}
