import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadPublicTestimonials } from "@/lib/public-testimonials";

// Built to sit inside an iframe on the Dove Expressions website. It reads the live list on every request, so a withdrawn or
// unpublished testimonial disappears from the website the next time the frame loads. Never copy this content into a WordPress
// page or post: a copy cannot be withdrawn. Only the website's own address may frame it (see next.config.js).
export const metadata: Metadata = { title: "Student voices", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EmbedPage() {
  const items = await loadPublicTestimonials(createClient());
  return <main className="bg-transparent p-4 text-[#1B1717]">
    {items.length ? <ul className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">{items.map(t => <li key={t.id} className="rounded-3xl border border-[#630000]/10 bg-white p-5">
      {t.videoUrl && <video controls preload="metadata" playsInline src={t.videoUrl} className="mb-3 w-full rounded-2xl bg-[#1B1717]" />}
      {t.text && <blockquote className="whitespace-pre-wrap font-body text-base leading-relaxed">“{t.text}”</blockquote>}
      <p className="mt-2 font-ui text-sm font-semibold text-[#630000]">{t.name}</p></li>)}</ul>
      : <p className="mx-auto max-w-xl rounded-2xl bg-[#F2DFD8]/50 p-5 text-center font-body text-sm">Student stories will appear here.</p>}
  </main>;
}
