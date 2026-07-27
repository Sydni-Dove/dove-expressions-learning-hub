const STAGES = ["Teaching", "Reflection", "Practice", "Follow-Up"] as const;

export default function LessonIntro({
  eyebrow,
  title,
  subtitle,
  courseTitle,
  instructorName,
  durationLabel,
  statusLabel,
  moduleIndex,
  activeStage
}: {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  courseTitle: string;
  instructorName?: string | null;
  durationLabel?: string | null;
  statusLabel: string;
  moduleIndex: string;
  activeStage: (typeof STAGES)[number];
}) {
  return (
    <section aria-labelledby="lesson-title" className="grid gap-4 lg:grid-cols-[1.1fr_280px]">
      <div className="card p-6 sm:p-8">
        <p className="mb-2 font-ui text-xs font-bold uppercase tracking-[0.26em] text-sunrise">{eyebrow}</p>
        <h1 id="lesson-title" className="font-display text-3xl leading-tight text-burgundy sm:text-4xl lg:text-[2.75rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-2 font-body text-lg italic text-burgundy/80 sm:text-xl">{subtitle}</p>}

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-charcoal/10 pt-4 sm:grid-cols-4">
          <div>
            <span className="block font-ui text-[0.64rem] uppercase tracking-wide text-charcoal/40">Course</span>
            <strong className="font-ui text-sm text-charcoal/85">{courseTitle}</strong>
          </div>
          <div>
            <span className="block font-ui text-[0.64rem] uppercase tracking-wide text-charcoal/40">Instructor</span>
            <strong className="font-ui text-sm text-charcoal/85">{instructorName || "Dove Expressions Faculty"}</strong>
          </div>
          <div>
            <span className="block font-ui text-[0.64rem] uppercase tracking-wide text-charcoal/40">Duration</span>
            <strong className="font-ui text-sm text-charcoal/85">{durationLabel || "Self-paced"}</strong>
          </div>
          <div>
            <span className="block font-ui text-[0.64rem] uppercase tracking-wide text-charcoal/40">Status</span>
            <strong className="font-ui text-sm text-charcoal/85">{statusLabel}</strong>
          </div>
        </div>
      </div>

      <aside aria-label="Series progress" className="card card-band-gold flex flex-col justify-between p-5">
        <div className="flex h-[110px] items-center justify-center rounded-control bg-burgundy-gradient font-display text-4xl text-soft">
          {moduleIndex}
        </div>
        <div className="mt-4 grid gap-2" aria-label="Lesson stages">
          {STAGES.map((stage) => (
            <div
              key={stage}
              className={`grid grid-cols-[40px_1fr] items-center gap-2 font-ui text-[0.66rem] uppercase tracking-wide ${
                stage === activeStage ? "font-bold text-burgundy" : "text-charcoal/40"
              }`}
            >
              <span className={`h-1 rounded-pill ${stage === activeStage ? "bg-gradient-to-r from-burgundy to-coral" : "bg-charcoal/10"}`} />
              {stage}
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}
