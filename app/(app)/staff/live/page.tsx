import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill, IconBadge } from "@/components/ui";
import LiveSessionForm from "@/components/LiveSessionForm";
import { Radio } from "lucide-react";

export default async function StaffLivePage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: sessions } = await supabase
    .from("dp_live_sessions")
    .select("id,title,provider,join_url,starts_at,replay_url")
    .order("starts_at", { ascending: false });

  const now = new Date();

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <IconBadge icon={Radio} className="bg-coral/15 text-coral-dark" />
        <div>
          <h1 className="font-display text-3xl text-burgundy">Live Sessions</h1>
          <p className="mt-1 font-body text-charcoal/70">
            Schedule live sessions with a join link. Actual video hosting is external (Zoom, Meet, YouTube, or
            Vimeo) — this only stores and shares the link and prep details.
          </p>
        </div>
      </div>

      <LiveSessionForm teacherId={user!.id} />

      <div className="space-y-4">
        {(sessions ?? []).map((s) => {
          const upcoming = s.starts_at && new Date(s.starts_at) > now;
          return (
            <div key={s.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={upcoming ? "gold" : "neutral"}>{upcoming ? "Upcoming" : "Past"}</Pill>
                <Pill tone="burgundy">{s.provider}</Pill>
              </div>
              <h2 className="mt-2 font-display text-lg text-burgundy">{s.title}</h2>
              {s.starts_at && (
                <p className="font-ui text-xs text-charcoal/50">
                  {new Date(s.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              )}
              {s.join_url && (
                <a href={s.join_url} target="_blank" rel="noreferrer" className="mt-2 inline-block font-ui text-sm font-semibold text-burgundy underline">
                  Join link →
                </a>
              )}
              {s.replay_url && (
                <a href={s.replay_url} target="_blank" rel="noreferrer" className="mt-1 block font-ui text-sm font-semibold text-burgundy underline">
                  Replay →
                </a>
              )}
            </div>
          );
        })}
        {(!sessions || sessions.length === 0) && (
          <EmptyState icon={Radio} title="No live sessions yet" body="Schedule your first one above." />
        )}
      </div>
    </div>
  );
}
