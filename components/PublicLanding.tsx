import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Footprints,
  Layers3,
  PenLine,
  type LucideIcon
} from "lucide-react";
import { IconBadge, Pill } from "@/components/ui";
import { isPrimaryPathwayCode, PATHWAY_ICONS, PATHWAY_STYLES, ROOTED_TRACK } from "@/lib/pathways";
import type { Pathway, PathwayCode } from "@/lib/types";

type PublicPathway = Pick<Pathway, "id" | "code" | "name" | "subtitle" | "description" | "order_index">;

const fallbackPathways: PublicPathway[] = [
  {
    id: "draw-near",
    code: "draw_near",
    name: "Draw Near",
    subtitle: "Foundations for Life With God",
    description:
      "Build a steady life with God through Scripture, prayer, surrender, worship, Christian community, and spiritual formation.",
    order_index: 1
  },
  {
    id: "hear-god",
    code: "hear_god",
    name: "Hear God",
    subtitle: "Recognizing and Discerning His Voice",
    description:
      "Learn how to recognize, test, understand, and steward what God speaks through Scripture and the Holy Spirit.",
    order_index: 2
  },
  {
    id: "kingdom-mandate",
    code: "kingdom_mandate",
    name: "Kingdom Mandate",
    subtitle: "From Revelation to Execution",
    description:
      "Discern what God has assigned to your hands and move from inspiration into faithful, practical obedience.",
    order_index: 3
  }
];

const pathwayDescriptions: Record<PathwayCode, string> = {
  draw_near: fallbackPathways[0].description ?? "",
  hear_god: fallbackPathways[1].description ?? "",
  rooted: ROOTED_TRACK.description,
  kingdom_mandate: fallbackPathways[2].description ?? ""
};

const journeyStages = [
  {
    name: "Revelation",
    action: "Receive",
    detail: "What God is highlighting",
    tone: "bg-pale-pink text-burgundy border-pale-pink",
    marker: "bg-burgundy"
  },
  {
    name: "Understanding",
    action: "Discern",
    detail: "Wisdom, Scripture, and discernment",
    tone: "bg-[#fff2d5] text-[#70480a] border-gold/45",
    marker: "bg-gold"
  },
  {
    name: "Application",
    action: "Practice",
    detail: "Practice that forms obedience",
    tone: "bg-[#fff0ed] text-coral-dark border-coral/30",
    marker: "bg-coral"
  },
  {
    name: "Execution",
    action: "Complete",
    detail: "Faithful work completed",
    tone: "bg-[#fff6e8] text-sunrise-dark border-sunrise/30",
    marker: "bg-sunrise"
  }
];

const formationMarks: { label: string; icon: LucideIcon }[] = [
  { label: "Scripture-rooted formation", icon: CircleDot },
  { label: "Guided practice", icon: PenLine },
  { label: "Faithful execution", icon: Layers3 }
];

const processSteps: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: "Apply",
    body: "Tell us where you are in your walk and what kind of guidance you need.",
    icon: ClipboardCheck
  },
  {
    title: "Begin your pathway",
    body: "Start with the formation pathway that best supports your current season.",
    icon: BookOpenCheck
  },
  {
    title: "Learn and practice",
    body: "Move through teaching, reflection, activation, and mentor-supported growth.",
    icon: CheckCircle2
  },
  {
    title: "Walk it out",
    body: "Turn what God is forming in you into steady obedience and completed assignments.",
    icon: Footprints
  }
];

export function PublicLanding({ pathways }: { pathways: PublicPathway[] | null }) {
  const publicPathways = (pathways?.length ? pathways : fallbackPathways).filter((pathway) =>
    isPrimaryPathwayCode(pathway.code)
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbfaf9] text-charcoal">
      <header className="sticky top-0 z-30 border-b border-charcoal/10 bg-[#fbfaf9]/95 px-5 backdrop-blur sm:px-8 lg:px-10">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-3">
          <Link href="/" className="whitespace-nowrap font-display text-xl font-semibold text-burgundy sm:text-2xl">
            Dove Expressions
          </Link>
          <nav aria-label="Public navigation" className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-pill px-3 font-ui text-sm font-semibold text-charcoal/75 transition hover:bg-charcoal/5 hover:text-burgundy"
            >
              Log in
            </Link>
            <Link href="/signup" className="btn-primary px-4 sm:px-6">
              <span className="hidden sm:inline">Apply / Create account</span>
              <span className="sm:hidden">Apply</span>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-charcoal/10 bg-[linear-gradient(115deg,#fbfaf9_0%,#fbfaf9_54%,#f6e5de_54%,#fff4df_100%)] px-5 pb-14 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:px-10 lg:pb-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(430px,0.9fr)] lg:gap-16">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="h-px w-12 bg-gold" aria-hidden="true" />
                <p className="font-ui text-xs font-extrabold uppercase tracking-[0.22em] text-sunrise-dark">
                  Ephesians 4:12
                </p>
              </div>
              <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.98] text-burgundy sm:text-6xl lg:text-7xl">
                Draw near to God. Hear His voice. Fulfill your Kingdom mandate.
              </h1>
              <p className="mt-6 max-w-2xl font-body text-lg leading-8 text-charcoal/78 sm:text-xl">
                A structured discipleship and learning hub for believers who want to receive with discernment,
                mature with intention, and carry revelation into faithful execution.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/signup" className="btn-primary w-full sm:w-auto">
                  Begin your application
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/login" className="btn-secondary w-full bg-white sm:w-auto">
                  I already have an account
                </Link>
              </div>
              <div className="mt-8 grid gap-2 sm:grid-cols-3">
                {formationMarks.map((mark) => (
                  <div
                    key={mark.label}
                    className="flex min-h-[64px] items-center gap-3 border-l-2 border-gold/70 bg-white/70 px-4 py-3 shadow-soft"
                  >
                    <mark.icon className="h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                    <span className="font-ui text-xs font-extrabold uppercase leading-4 tracking-[0.12em] text-charcoal/70">
                      {mark.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <RevelationJourneyGraphic />
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="font-ui text-xs font-extrabold uppercase tracking-[0.22em] text-charcoal/45">
                  The Three Pathways
                </p>
                <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight text-burgundy sm:text-4xl">
                  One formation system for drawing near, discerning clearly, and obeying faithfully.
                </h2>
              </div>
              <p className="max-w-md font-body text-sm leading-6 text-charcoal/65">
                Each pathway is distinct, but together they create a progression from spiritual encounter to
                mature action.
              </p>
            </div>

            <div className="relative mt-8 grid gap-4 sm:grid-cols-3">
              <div className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-burgundy via-gold to-sunrise lg:block" aria-hidden="true" />
              {publicPathways.map((pathway, index) => (
                <PathwayCard key={pathway.id} pathway={pathway} index={index} />
              ))}
            </div>

            <div className="mt-6 grid gap-5 rounded-card-lg border border-gold/30 bg-white p-5 shadow-soft lg:grid-cols-[0.8fr_1.2fr] lg:p-6">
              <div>
                <p className="font-ui text-xs font-extrabold uppercase tracking-[0.18em] text-sunrise-dark">
                  Nested under Draw Near
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-burgundy">{ROOTED_TRACK.title}</h3>
                <p className="mt-2 font-body text-sm leading-6 text-charcoal/72">{ROOTED_TRACK.description}</p>
              </div>
              <div className="rounded-card border-l-4 border-l-gold bg-pale-pink/35 p-5">
                <Pill tone="gold">Featured series</Pill>
                <h4 className="mt-3 font-display text-xl text-burgundy">{ROOTED_TRACK.seriesTitle}</h4>
                <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/45">
                  {ROOTED_TRACK.seriesSubtitle}
                </p>
                <p className="mt-3 font-body text-sm text-charcoal/70">Coming soon or in development as lessons are prepared.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-charcoal/10 bg-[linear-gradient(180deg,#f8efec_0%,#fff9f1_100%)] px-5 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.74fr_1.26fr] lg:items-start">
            <div>
              <p className="font-ui text-xs font-extrabold uppercase tracking-[0.22em] text-sunrise-dark">
                How it works
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-burgundy sm:text-4xl">
                A concise path from application to embodied practice.
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {processSteps.map((step, index) => (
                <ProcessStep key={step.title} step={step} index={index} />
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="relative overflow-hidden rounded-card-lg border border-burgundy/10 bg-burgundy px-7 py-8 text-soft shadow-card sm:p-10">
              <div className="absolute bottom-0 left-0 h-2 w-full bg-gradient-to-r from-gold via-coral to-sunrise" aria-hidden="true" />
              <p className="font-ui text-xs font-extrabold uppercase tracking-[0.22em] text-gold">
                Revelation to execution
              </p>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-soft sm:text-4xl">
                Formation that keeps revelation connected to responsibility.
              </h2>
            </div>
            <div className="max-w-2xl">
              <p className="font-body text-xl leading-9 text-charcoal/80">
                Dove Expressions helps believers slow down enough to discern what God is forming, study it
                with biblical clarity, practice it with support, and complete the work with integrity. The aim
                is not more inspiration without movement; it is a faithful life that can carry what it receives.
              </p>
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-card-lg border border-gold/30 bg-[linear-gradient(135deg,#fff9f5_0%,#f2dfd8_55%,#fff3db_100%)] px-6 py-10 text-center shadow-card sm:px-10 sm:py-12">
            <div className="mx-auto mb-7 h-1.5 w-28 rounded-pill bg-gradient-to-r from-burgundy via-coral to-gold" aria-hidden="true" />
            <p className="font-ui text-xs font-extrabold uppercase tracking-[0.22em] text-sunrise-dark">
              Begin with intention
            </p>
            <h2 className="mx-auto mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight text-burgundy sm:text-5xl">
              Take the next step in your discipleship journey.
            </h2>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn-primary w-full sm:w-auto">
                Begin your application
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="btn-secondary w-full bg-white sm:w-auto">
                I already have an account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-charcoal/10 px-5 py-8 text-center font-ui text-xs text-charcoal/55 sm:px-8 lg:px-10">
        © {new Date().getFullYear()} Dove Expressions. Build, equip, empower, and inspire believers to draw near
        to God and fulfill their Kingdom mandate.
      </footer>
    </div>
  );
}

function RevelationJourneyGraphic() {
  return (
    <div
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-card-lg bg-burgundy p-5 text-soft shadow-card sm:p-6 lg:max-w-none"
      aria-label="Revelation to Understanding to Application to Execution"
    >
      <div className="mb-5 flex items-start justify-between gap-6 border-b border-white/15 pb-5">
        <div>
          <p className="font-ui text-xs font-extrabold uppercase tracking-[0.2em] text-gold">Formation map</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-soft">From hearing to finishing.</h2>
        </div>
        <span className="hidden rounded-pill border border-gold/35 px-3 py-1.5 font-ui text-xs font-extrabold uppercase tracking-[0.14em] text-gold sm:inline-flex">
          Eph. 4:12
        </span>
      </div>

      <div className="relative grid gap-3">
        <div className="absolute bottom-8 left-6 top-8 w-px bg-gradient-to-b from-gold via-coral to-sunrise" aria-hidden="true" />
        {journeyStages.map((stage, index) => (
          <div key={stage.name} className="relative">
            <div className="relative grid min-h-[104px] grid-cols-[3rem_1fr] items-stretch">
              <div className="relative flex items-center justify-center">
                <span className={`z-10 h-4 w-4 rounded-full border-2 border-soft ${stage.marker}`} aria-hidden="true" />
              </div>
              <div className={`rounded-card border px-4 py-4 ${stage.tone}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-ui text-xs font-extrabold uppercase tracking-[0.16em] opacity-70">
                    0{index + 1} / {stage.action}
                  </span>
                  <ArrowRight className="h-4 w-4 opacity-60" aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-display text-2xl font-semibold leading-none text-current">{stage.name}</h3>
                <p className="mt-3 font-ui text-xs font-semibold leading-5 text-charcoal/62">{stage.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-l-2 border-gold bg-white/[0.08] px-5 py-4">
        <p className="font-body text-sm leading-6 text-soft/78">
          The platform holds spiritual insight and practical obedience together, so growth has a path after the
          moment of revelation.
        </p>
      </div>
    </div>
  );
}

function PathwayCard({ pathway, index }: { pathway: PublicPathway; index: number }) {
  const code = pathway.code as PathwayCode;
  const style = PATHWAY_STYLES[code];
  const Icon = PATHWAY_ICONS[code];
  const summary = pathwayDescriptions[code] ?? pathway.description ?? "";

  return (
    <article className={`card card-hover ${style.band} relative flex min-h-[280px] flex-col overflow-hidden p-6`}>
      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-pale-pink/45 to-transparent" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <IconBadge icon={Icon} className={style.badge} />
        <span className="font-ui text-xs font-extrabold uppercase tracking-[0.16em] text-charcoal/35">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-5 font-display text-2xl font-semibold leading-tight text-burgundy">{pathway.name}</h3>
      <p className="mt-1 font-ui text-sm font-semibold leading-5 text-charcoal/58">{pathway.subtitle}</p>
      <p className="mt-4 font-body text-sm leading-6 text-charcoal/72">{summary}</p>
    </article>
  );
}

function ProcessStep({ step, index }: { step: { title: string; body: string; icon: LucideIcon }; index: number }) {
  return (
    <article className="card flex min-h-[172px] gap-4 border-l-4 border-l-burgundy p-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-pale-pink/55 text-burgundy shadow-soft">
        <step.icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <span className="font-ui text-xs font-extrabold uppercase tracking-[0.16em] text-charcoal/35">
          Step {index + 1}
        </span>
        <h3 className="mt-2 font-display text-xl font-semibold leading-tight text-burgundy">{step.title}</h3>
        <p className="mt-2 font-body text-sm leading-6 text-charcoal/70">{step.body}</p>
      </div>
    </article>
  );
}
