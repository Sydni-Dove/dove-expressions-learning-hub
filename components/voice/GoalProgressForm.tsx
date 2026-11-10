"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function GoalProgressForm({ goalId, authorId, label = "How is this going?" }: { goalId: string; authorId: string; label?: string }) {
  const router = useRouter();
  const [note, setNote] = useState(""); const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(""); setDone("");
    if (!note.trim() && rating == null) { setError("Add a note or choose a rating."); return; }
    setBusy(true);
    const { error: err } = await createClient().from("dp_voice_goal_updates").insert({ goal_id: goalId, author_id: authorId, note: note.trim() || null, rating });
    setBusy(false);
    if (err) { setError("Your update could not be saved. Please try again."); return; }
    setNote(""); setRating(null); setDone("Progress saved."); router.refresh();
  }
  return <form onSubmit={save} className="mt-3 space-y-2">
    <label className="block font-ui text-sm font-semibold">{label}<textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={2000} className="input mt-1 w-full" /></label>
    <fieldset className="font-ui text-sm"><legend className="font-semibold">Rate your progress (1 = just starting, 5 = very confident)</legend>
      <div className="mt-1 flex gap-2">{[1, 2, 3, 4, 5].map(n => <label key={n} className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border ${rating === n ? "border-burgundy bg-burgundy text-white" : "border-burgundy/30"}`}>
        <input type="radio" name={`rating-${goalId}`} className="sr-only" checked={rating === n} onChange={() => setRating(n)} /><span aria-hidden="true">{n}</span><span className="sr-only">Rating {n}</span></label>)}</div></fieldset>
    {error && <p role="alert" className="font-ui text-sm text-[#7a2c1c]">{error}</p>}{done && <p role="status" className="font-ui text-sm">{done}</p>}
    <button disabled={busy} className="btn-secondary">{busy ? "Saving…" : "Save progress"}</button>
  </form>;
}
