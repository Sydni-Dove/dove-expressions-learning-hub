"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TESTIMONIAL_BUCKET } from "@/lib/recordings";

export type MyTestimonial = { id: string; review_text: string | null; video_path: string | null; allow_public_use: boolean; status: string; published_at: string | null; consent_withdrawn_at: string | null; created_at: string };

export function testimonialState(t: Pick<MyTestimonial, "status" | "published_at" | "allow_public_use" | "consent_withdrawn_at">) {
  if (t.consent_withdrawn_at) return "You withdrew permission. It is not shown publicly.";
  if (t.published_at) return "Published on the public page.";
  if (t.status === "declined") return "Not approved. It stays private.";
  if (t.status === "approved") return t.allow_public_use ? "Approved. Waiting for your instructor to publish it." : "Approved for private use only.";
  return t.allow_public_use ? "Submitted. Waiting for review. Nothing is public until it is approved." : "Submitted privately.";
}

export default function MyTestimonials({ items }: { items: MyTestimonial[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState(""); const [note, setNote] = useState("");
  async function act(id: string, kind: "withdraw" | "delete") {
    if (kind === "delete" && !window.confirm("Delete this testimonial and its video permanently?")) return;
    setBusy(id); setError(""); setNote("");
    const supabase = createClient();
    try {
      if (kind === "withdraw") {
        const { error: e } = await supabase.rpc("dp_withdraw_testimonial_consent", { target_id: id }); if (e) throw e;
        setNote("Permission withdrawn. Your testimonial is no longer shown publicly.");
      } else {
        const { data, error: e } = await supabase.rpc("dp_delete_my_testimonial", { target_id: id }); if (e) throw e;
        if (data) await supabase.storage.from(TESTIMONIAL_BUCKET).remove([data as string]);
        setNote("Testimonial deleted.");
      }
      router.refresh();
    } catch { setError("That did not work. Please try again or message your instructor."); } finally { setBusy(null); }
  }
  if (!items.length) return null;
  return <section aria-labelledby="mine-h" className="mt-8"><h3 id="mine-h" className="font-display text-xl text-[#630000]">Your testimonials</h3>
    <ul className="mt-3 space-y-3">{items.map(t => <li key={t.id} className="rounded-2xl border border-[#630000]/10 p-4">
      <p className="font-ui text-xs text-[#1B1717]/60">Submitted {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}{t.video_path ? " · includes video" : ""}</p>
      {t.review_text && <p className="mt-1 line-clamp-3 whitespace-pre-wrap font-body text-sm">{t.review_text}</p>}
      <p className="mt-2 font-ui text-sm font-semibold">{testimonialState(t)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {t.allow_public_use && <button disabled={busy === t.id} onClick={() => act(t.id, "withdraw")} className="btn-secondary">Withdraw public permission</button>}
        <button disabled={busy === t.id} onClick={() => act(t.id, "delete")} className="link-action font-ui text-sm">Delete</button>
      </div></li>)}</ul>
    {error && <p role="alert" className="mt-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}{note && <p role="status" className="mt-2 font-ui text-sm">{note}</p>}
  </section>;
}
