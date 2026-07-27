import { createClient } from "@/lib/supabase/server";
import { EmptyState, Pill } from "@/components/ui";

export default async function CalendarPage() {
  const supabase = createClient();
  const now = new Date().toISOString();

  const [{ data: events }, { data: sessions }] = await Promise.all([
    supabase.from("dp_calendar_events").select("id,title,event_type,starts_at").gte("starts_at", now).order("starts_at"),
    supabase.from("dp_live_sessions").select("id,title,starts_at").gte("starts_at", now).order("starts_at")
  ]);

  const combined = [
    ...(events ?? []).map((e) => ({ id: `event-${e.id}`, title: e.title, type: e.event_type || "event", starts_at: e.starts_at })),
    ...(sessions ?? []).map((s) => ({ id: `live-${s.id}`, title: s.title, type: "live session", starts_at: s.starts_at }))
  ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return (
    <div className="max-w-2xl space-y-4 pb-16">
      <h1 className="font-display text-3xl text-burgundy">Calendar</h1>
      <p className="font-body text-sm text-charcoal/70">Live classes, mentor sessions, deadlines, and events — one place to see what's ahead.</p>

      {combined.length === 0 && <EmptyState title="Nothing upcoming" body="Your calendar will fill in as sessions and events are scheduled." />}

      <ul className="divide-y divide-charcoal/10 card">
        {combined.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-body text-charcoal">{item.title}</p>
              <p className="font-ui text-xs text-charcoal/50">
                {new Date(item.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <Pill tone="neutral">{item.type.replace(/_/g, " ")}</Pill>
          </li>
        ))}
      </ul>
    </div>
  );
}
