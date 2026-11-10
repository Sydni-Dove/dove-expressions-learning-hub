"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/voice-rpc";
import { TRACK_META, TRACK_KEYS, type TrackKey } from "@/lib/voice-curriculum";

/** Optional Creative Worship Expression. Choosing none is a complete, normal choice. Prophetic material appears only if this box is ticked. */
export default function TrackChoice({ selected, approved, tongues }: { selected: TrackKey[]; approved: TrackKey[]; tongues: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState<TrackKey[]>(selected);
  const [t, setT] = useState(tongues);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const toggle = (k: TrackKey) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  async function save() {
    setBusy(true);
    const r = await callRpc("dp_voice_set_my_tracks", { tracks: sel, tongues: t && sel.includes("prophetic_worship") });
    setBusy(false); setMsg(r.ok ? "Saved. Your instructor will confirm what fits." : r.error); if (r.ok) router.refresh();
  }
  return (
    <section aria-labelledby="tracks-h" className="rounded-2xl border border-[#630000]/15 bg-white p-4 sm:p-6">
      <h2 id="tracks-h" className="font-display text-2xl text-[#630000]">Creative Worship Expression (optional)</h2>
      <p className="mt-1 font-body text-sm text-[#4a3a3a]">Choose one, several, or none. Your core vocal coaching is the same either way, and you can change your mind at any time.</p>
      <div className="mt-3 space-y-2">
        {TRACK_KEYS.map((k) => (
          <label key={k} className="flex min-h-[44px] items-start gap-3 rounded-xl border border-[#630000]/20 p-3">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={sel.includes(k)} onChange={() => toggle(k)} />
            <span><span className="block font-ui font-semibold text-[#630000]">{TRACK_META[k].title}{approved.includes(k) ? " · confirmed by your instructor" : sel.includes(k) && selected.includes(k) ? " · waiting for your instructor" : ""}</span>
              <span className="block font-body text-sm text-[#4a3a3a]">{TRACK_META[k].blurb}</span></span>
          </label>))}
      </div>
      {sel.includes("prophetic_worship") && (
        <label className="mt-3 flex min-h-[44px] items-start gap-3 rounded-xl bg-[#FBF4F1] p-3">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={t} onChange={(e) => setT(e.target.checked)} />
          <span className="font-body text-sm text-[#201414]">I would like my coach to include singing in tongues in my worship coaching. (Only if this fits your own beliefs and church tradition. Leave it unticked otherwise; nothing is lost.)</span>
        </label>)}
      <button type="button" onClick={save} disabled={busy} className="mt-4 min-h-[44px] rounded-full bg-[#630000] px-6 font-ui text-sm font-bold text-white">Save my choices</button>
      {msg && <p role="status" className="mt-2 font-ui text-sm text-[#630000]">{msg}</p>}
    </section>
  );
}
