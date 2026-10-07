"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PUBLIC_BUCKET, PRIVATE_BUCKET, makeStorageRef } from "@/lib/storage";

export interface UploadedMeta {
  path: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Reusable upload control. Uploads a single file to the `course-media` Supabase
 * Storage bucket (created in migration 0026) and returns the public URL plus
 * basic metadata via `onUploaded`. Writes are gated by RLS to staff only, so
 * this component only ever renders for admin/instructor builder surfaces.
 *
 * It does not itself persist anything to the database — the caller decides where
 * the returned URL is stored (a lesson block's content, a course cover image,
 * etc.), so the same control works everywhere an upload is needed.
 */
export default function FileUpload({
  pathPrefix,
  accept,
  label = "Upload file",
  hint,
  maxMB = 200,
  visibility = "private",
  onUploaded
}: {
  pathPrefix: string;
  accept?: string;
  label?: string;
  hint?: string;
  maxMB?: number;
  /**
   * "public"  → cover images/thumbnails; stored in the public bucket, returns a
   *             permanent public URL.
   * "private" → protected lesson media; stored in the private bucket, returns a
   *             `storage://…` reference (NOT a URL). The lesson page mints a
   *             short-lived signed URL from it at render time. Default.
   */
  visibility?: "public" | "private";
  onUploaded: (value: string, meta: UploadedMeta) => void;
}) {
  const bucket = visibility === "public" ? PUBLIC_BUCKET : PRIVATE_BUCKET;
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setDone(null);

    if (file.size > maxMB * 1024 * 1024) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit here is ${maxMB} MB.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${pathPrefix.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (upErr) {
      setBusy(false);
      setError(upErr.message);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // Public assets store a permanent public URL. Private assets store a
    // storage:// reference — never a URL — so nothing protected leaks.
    const value =
      visibility === "public"
        ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
        : makeStorageRef(bucket, path);

    setBusy(false);
    setDone(file.name);
    if (inputRef.current) inputRef.current.value = "";
    onUploaded(value, { path, name: file.name, size: file.size, type: file.type });
  }

  return (
    <div className="rounded-lg border border-dashed border-charcoal/25 bg-white/50 p-3">
      <label className="flex cursor-pointer flex-wrap items-center gap-3">
        <span className="btn-secondary shrink-0">{busy ? "Uploading…" : label}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          disabled={busy}
          className="sr-only"
        />
        <span className="font-ui text-xs text-charcoal/50">
          {hint ? `${hint} · ` : ""}Max {maxMB} MB
        </span>
      </label>
      {done && <p className="mt-2 font-ui text-xs text-green-700">Uploaded “{done}”. Saved below.</p>}
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-coral/10 px-3 py-2 font-ui text-xs text-[#7a2c1c]">
          {error}
        </p>
      )}
    </div>
  );
}
