import { createClient } from "@/lib/supabase/server";
import { EmptyState, Pill } from "@/components/ui";

const PROVIDER_LABEL: Record<string, string> = {
  zoom: "Zoom",
  meet: "Google Meet",
  youtube: "YouTube Live",
  vimeo: "Vimeo",
  other: "External link"
};

export default async function LiveSessionsPage() {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data: upcoming } = await supabase
    .from("dp_live_sessions")
    .select("id,title,provider,join_url,starts_at,ends_at,description,prep_instructions,replay_url")
    .gte("starts_at", now)
    .order("starts_at");

  const { data: past } = await supabase
    .from("dp_live_sessions")
    .select("id,title,provider,starts_at,replay_url")
    .lt("starts_at", now)
    .order("starts_at", { ascending: false })
    .limit(5);

  return (
    <div className="max-w-3xl space-y-10 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">Live Sessions</h1>
        <p className="mt-1 font-body text-charcoal/70">
          Live classes and gatherings are hosted on Zoom, Google Meet, YouTube, or Vimeo — this page links out
          or embeds; it doesn't claim to host the call itself.
        </p>
      </div>

      <div className="space-y-4">
        {(upcoming ?? []).map((s) => {
          const startsAt = new Date(s.starts_at as string);
          const daysAway = Math.ceil((startsAt.getTime() - Date.now()) / 86400000);
          return (
            <div key={s.id} className="card p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="sunrise">{PROVIDER_LABEL[s.provider] || s.provider}</Pill>
                <Pill tone="neutral">{daysAway <= 0 ? "Today" : `In ${daysAway} day${daysAway === 1 ? "" : "s"}`}</Pill>
              </div>
              <h2 className="mt-3 font-display text-xl text-burgundy">{s.title}</h2>
              <p className="mt-1 font-ui text-sm text-charcoal/60">
                {startsAt.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
              </p>
              {s.description && <p className="mt-3 font-body text-charcoal/80">{s.description}</p>}
              {s.prep_instructions && (
                <p className="mt-2 font-body text-sm italic text-charcoal/60">Prepare: {s.prep_instructions}</p>
              )}
              {s.join_url && (
                <a href={s.join_url} target="_blank" rel="noreferrer" className="btn-primary mt-4 inline-flex">
                  Join on {PROVIDER_LABEL[s.provider] || "external site"} ↗
                </a>
              )}
            </div>
          );
        })}
        {(!upcoming || upcoming.length === 0) && <EmptyState title="Nothing scheduled" body="Check back soon for upcoming live sessions." />}
      </div>

      {past && past.length > 0 && (
        <div>
          <h2 className="font-display text-xl text-burgundy">Replays</h2>
          <ul className="mt-3 divide-y divide-charcoal/10">
            {past.map((s) => (
              <li key={s.id} className="py-3 font-body text-charcoal/80">
                {s.title}{" "}
                {s.replay_url ? (
                  <a href={s.replay_url} className="font-ui text-sm font-semibold text-burgundy underline">
                    Watch replay
                  </a>
                ) : (
                  <span className="font-ui text-xs text-charcoal/40">Replay not yet available</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
