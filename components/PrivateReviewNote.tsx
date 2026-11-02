"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PrivateReviewNote({ submissionId, authorId }: { submissionId: string; authorId: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function save() {
    if (!note.trim()) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await createClient().from("dp_feedback").insert({ submission_id: submissionId, author_id: authorId, content: note.trim(), is_private: true });
      if (error) throw error;
      setNote(""); setMessage("Private note saved. This has not been shared with the student."); router.refresh();
    } catch (e) { setMessage((e as {message?:string}).message ?? "Could not save note."); }
    finally { setBusy(false); }
  }
  return <section className="card space-y-3 border border-burgundy/20 p-5"><h2 className="font-display text-lg text-burgundy">Instructor-private review</h2><label className="block font-ui text-sm">Private note<textarea value={note} onChange={e => setNote(e.target.value)} rows={4} className="input mt-1 w-full"/></label><p className="font-body text-xs">Saved separately from student feedback. Saving a private note does not change the student’s review status.</p><p role="status" className="text-sm">{message}</p><button disabled={busy || !note.trim()} onClick={save} className="btn-secondary">{busy ? "Saving…" : "Save private note"}</button></section>;
}
