import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  Hourglass,
  Lock,
  Users,
  Sparkles,
  type LucideIcon
} from "lucide-react";

export function ProgressBar({ percent, label, tone = "burgundy" }: { percent: number; label?: string; tone?: "burgundy" | "gold" }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const barColor = tone === "gold" ? "bg-gold-gradient" : "bg-burgundy-gradient";
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between font-ui text-xs font-semibold text-charcoal/70">
          <span>{label}</span>
          <span className="text-burgundy">{clamped}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className="h-3 w-full overflow-hidden rounded-pill bg-pale-pink/60"
      >
        <div className={`h-full rounded-pill ${barColor} transition-all duration-500`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

/** Circular progress ring — used for headline dashboard metrics. Percent text is always
    rendered as real text in the center, never conveyed by color/fill alone. */
export function ProgressRing({ percent, label, size = 96 }: { percent: number; label?: string; size?: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F2DFD8" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E6A742"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-xl text-burgundy">{clamped}%</span>
        </div>
      </div>
      {label && <span className="font-ui text-xs font-semibold text-charcoal/60">{label}</span>}
    </div>
  );
}

export function Pill({
  children,
  tone = "burgundy",
  icon: Icon
}: {
  children: React.ReactNode;
  tone?: "burgundy" | "sunrise" | "coral" | "gold" | "neutral" | "success";
  icon?: LucideIcon;
}) {
  const tones: Record<string, string> = {
    burgundy: "bg-burgundy/10 text-burgundy",
    sunrise: "bg-sunrise/15 text-sunrise-dark",
    coral: "bg-coral/15 text-coral-dark",
    gold: "bg-gold/15 text-gold-dark",
    neutral: "bg-charcoal/8 text-charcoal/70",
    success: "bg-green-100 text-green-800"
  };
  return (
    <span className={`pill ${tones[tone]}`}>
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Status indicator: always icon + color + text together — never color alone.
    Covers the six statuses used across the platform (progress, sharing/visibility). */
type StatusKind = "completed" | "in_progress" | "needs_attention" | "upcoming" | "waiting_feedback" | "private" | "shared";

const STATUS_MAP: Record<StatusKind, { label: string; tone: "burgundy" | "sunrise" | "coral" | "gold" | "neutral" | "success"; icon: LucideIcon }> = {
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
  in_progress: { label: "In Progress", tone: "gold", icon: Circle },
  needs_attention: { label: "Needs Attention", tone: "coral", icon: AlertTriangle },
  upcoming: { label: "Upcoming", tone: "neutral", icon: Clock },
  waiting_feedback: { label: "Waiting for Feedback", tone: "sunrise", icon: Hourglass },
  private: { label: "Private", tone: "neutral", icon: Lock },
  shared: { label: "Shared", tone: "burgundy", icon: Users }
};

export function StatusPill({ status, label }: { status: StatusKind; label?: string }) {
  const s = STATUS_MAP[status];
  return <Pill tone={s.tone} icon={s.icon}>{label ?? s.label}</Pill>;
}

export function SaveStatus({ status }: { status: "saving" | "saved" | "failed" | "offline" }) {
  const copy: Record<string, { text: string; dot: string }> = {
    saving: { text: "Saving…", dot: "bg-gold animate-pulse" },
    saved: { text: "Saved", dot: "bg-green-600" },
    failed: { text: "Failed to save — retrying", dot: "bg-coral" },
    offline: { text: "Offline copy saved on this device", dot: "bg-charcoal/50" }
  };
  const c = copy[status];
  return (
    <span className="save-status-dot text-charcoal/60" role="status">
      <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden="true" />
      {c.text}
    </span>
  );
}

export function PrototypePreviewBadge() {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-card border border-gold/40 bg-gold/10 px-4 py-3.5 font-ui text-sm text-[#5c3d00]">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <strong>Prototype preview.</strong> This page is shown with realistic sample content so you can evaluate the
        design and flow. It is not yet connected to live data — see the Phased Implementation Plan for when this
        becomes fully functional.
      </p>
    </div>
  );
}

export function EmptyState({ title, body, icon: Icon }: { title: string; body: string; icon?: LucideIcon }) {
  return (
    <div className="card p-10 text-center">
      {Icon && (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pale-pink/60 text-burgundy">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <h3 className="font-display text-lg text-burgundy">{title}</h3>
      <p className="mt-2 font-body text-sm text-charcoal/70">{body}</p>
    </div>
  );
}

export function DiscernmentNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border-l-4 border-gold bg-pale-pink/30 px-4 py-3.5 font-body text-sm italic text-charcoal/80">
      {children}
    </div>
  );
}

/** Rounded icon container for pillar cards / feature highlights — accepts any accent bg/text pair. */
export function IconBadge({ icon: Icon, className = "" }: { icon: LucideIcon; className?: string }) {
  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${className}`}>
      <Icon className="h-6 w-6" aria-hidden="true" />
    </div>
  );
}
