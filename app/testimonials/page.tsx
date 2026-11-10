import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadPublicTestimonials } from "@/lib/public-testimonials";

// Public page: shows only testimonials the student consented to and the instructor approved and published.
// It is not linked from the app; share or embed the link when you are ready. Search engines are told not to index it yet.
export const metadata: Metadata = { title: "Student voices | Dove Expressions", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PublicTestimonialsPage() {
  const items = await loadPublicTestimonials(createClient());
  return <main className="min-h-screen bg-[#FDFDFD] px-4 py-12 text-[#1B1717]">
    <div className="mx-auto max-w-3xl">
      <p className="font-ui text-xs font-semibold uppercase tracking-[0.18em] text-[#630000]">Dove Expressions · Voice Studio</p>
      <h1 className="mt-3 font-display text-4xl text-[#630000]">Student voices</h1>
      <p className="mt-3 font-body text-base text-[#1B1717]/75">In their own words. Each story is shared with the student’s permission.</p>
      {items.length ? <ul className="mt-10 space-y-8">{items.map(t => <li key={t.id} className="rounded-3xl border border-[#630000]/10 bg-white p-6 shadow-sm">
        {t.videoUrl && <video controls preload="metadata" playsInline src={t.videoUrl} className="mb-4 w-full rounded-2xl bg-[#1B1717]" />}
        {t.text && <blockquote className="whitespace-pre-wrap font-body text-lg leading-relaxed">“{t.text}”</blockquote>}
        <p className="mt-3 font-ui text-sm font-semibold text-[#630000]">{t.name}</p>
      </li>)}</ul>
        : <p className="mt-10 rounded-2xl bg-[#F2DFD8]/50 p-6 font-body text-sm">No student stories have been shared yet.</p>}
    </div>
  </main>;
}
