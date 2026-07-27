import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IconBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PATHWAY_ICONS, PATHWAY_STYLES } from "@/lib/pathways";
import type { PathwayCode } from "@/lib/types";

export default async function LandingPage() {
  const supabase = createClient();
  const { data: pathways } = await supabase.from("dp_pathways").select("*").order("order_index");

  return (
    <div className="min-h-screen bg-soft">
      <header className="flex items-center justify-between px-6 py-6 sm:px-10">
        <span className="font-display text-2xl text-burgundy">Dove Expressions</span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="font-ui text-sm font-semibold text-charcoal hover:text-burgundy">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Apply / Create account
          </Link>
        </nav>
      </header>

      {/* Hero — two column on desktop */}
      <section className="px-6 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="font-ui text-sm font-semibold uppercase tracking-widest text-sunrise-dark">
              Ephesians 4:12
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight text-burgundy sm:text-5xl">
              Draw near to God. Hear His voice. Fulfill your Kingdom mandate.
            </h1>
            <p className="mt-6 font-body text-lg text-charcoal/80">
              Dove Expressions builds, empowers, equips, and inspires believers to draw near to God and
              fulfill their Kingdom mandate through prophetic and practical teaching and resources.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/signup" className="btn-primary">
                Begin your application
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="btn-secondary">
                I already have an account
              </Link>
            </div>
          </div>

          {/* Right panel — layered color-block visual */}
          <div className="relative hidden aspect-square rounded-card-lg bg-burgundy-gradient p-8 shadow-card lg:block">
            <div className="absolute -left-6 top-10 h-28 w-28 rounded-3xl bg-pale-pink shadow-card" />
            <div className="absolute -right-4 top-1/3 h-24 w-24 rounded-full bg-gold shadow-card" />
            <div className="absolute bottom-10 left-1/3 h-32 w-32 rounded-card bg-coral/90 shadow-card" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
              <span className="font-display text-3xl text-soft">Revelation</span>
              <ArrowRight className="h-6 w-6 rotate-90 text-gold" aria-hidden="true" />
              <span className="font-display text-3xl text-gold">Execution</span>
            </div>
          </div>
        </div>
      </section>

      {/* The Four Pathways — official order preserved; progression note shown separately */}
      <section className="px-6 pb-16 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-ui text-xs font-semibold uppercase tracking-widest text-charcoal/40">
            The Four Pathways
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(pathways ?? []).map((p, i) => {
              const style = PATHWAY_STYLES[p.code as PathwayCode];
              const Icon = PATHWAY_ICONS[p.code as PathwayCode];
              return (
                <div key={p.id} className={`card card-hover ${style.band} p-6`}>
                  <IconBadge icon={Icon} className={style.badge} />
                  <span className="mt-4 block font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">
                    Pathway {i + 1}
                  </span>
                  <h3 className="mt-1 font-display text-lg text-burgundy">{p.name}</h3>
                  <p className="font-ui text-xs text-charcoal/50">{p.subtitle}</p>
                  <p className="mt-2 font-body text-sm text-charcoal/70">{p.description}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center font-body text-sm italic text-charcoal/50">
            The journey isn't rigid, but it generally moves: Draw Near → Rooted → Hear God → Kingdom Mandate.
          </p>
        </div>
      </section>

      {/* Discipleship Hub vs Creative Studio */}
      <section className="px-6 pb-20 sm:px-10">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
          <div className="card card-band-burgundy overflow-hidden bg-pink-wash">
            <div className="p-8">
              <h2 className="font-display text-2xl text-burgundy">Discipleship Hub</h2>
              <p className="mt-3 font-body text-charcoal/80">
                The primary spiritual formation and mentorship environment, organized around the Four
                Pathways: Draw Near, Hear God, Rooted, and Kingdom Mandate — guided Scripture study,
                spiritual wiring, one-on-one mentoring, group discussion, prayer, and journaling.
              </p>
              <ul className="mt-4 space-y-1.5 font-ui text-sm text-charcoal/70">
                <li>· 25-week Guided Discipleship Journey</li>
                <li>· Spiritual Wiring Assessment &amp; mentor sessions</li>
                <li>· Personalized discipleship plan</li>
              </ul>
            </div>
          </div>
          <div className="card card-band-sunrise overflow-hidden">
            <div className="p-8">
              <h2 className="font-display text-2xl text-burgundy">Creative Studio</h2>
              <p className="mt-3 font-body text-charcoal/80">
                A practical training academy for believers called to create journals, devotionals, study
                guides, planners, and stationery products. Its own process: Receive the Vision, Define It,
                Design It, Produce It, Launch It — one possible way to fulfill a Kingdom mandate, not the
                expected path for every disciple.
              </p>
              <ul className="mt-4 space-y-1.5 font-ui text-sm text-charcoal/70">
                <li>· 8-course Stationery Product Creation Roadmap</li>
                <li>· A workspace for every product you're developing</li>
                <li>· Take one workshop, or the full roadmap</li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center font-body text-sm italic text-charcoal/60">
          You may enroll in Discipleship only, Creative Studio only, both, or a single workshop — the
          choice is yours, and your mentor can help you discern where to begin.
        </p>
      </section>

      <footer className="border-t border-charcoal/10 px-6 py-8 text-center font-ui text-xs text-charcoal/50 sm:px-10">
        © {new Date().getFullYear()} Dove Expressions. Build, equip, empower, and inspire believers to draw
        near to God and fulfill their Kingdom mandate.
      </footer>
    </div>
  );
}
