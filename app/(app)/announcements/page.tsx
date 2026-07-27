import { createClient } from "@/lib/supabase/server";
import { EmptyState, Pill } from "@/components/ui";

export default async function AnnouncementsPage() {
  const supabase = createClient();
  const { data: announcements } = await supabase
    .from("dp_announcements")
    .select("id,title,body,is_pinned,publish_at,target_type")
    .lte("publish_at", new Date().toISOString())
    .order("is_pinned", { ascending: false })
    .order("publish_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-4 pb-16">
      <h1 className="font-display text-3xl text-burgundy">Announcements</h1>
      {(!announcements || announcements.length === 0) && (
        <EmptyState title="No announcements yet" body="Platform and program announcements will appear here." />
      )}
      {(announcements ?? []).map((a) => (
        <div key={a.id} className="card p-5">
          <div className="flex items-center gap-2">
            {a.is_pinned && <Pill tone="sunrise">Pinned</Pill>}
            <span className="font-ui text-xs text-charcoal/40">{new Date(a.publish_at).toLocaleDateString()}</span>
          </div>
          <h2 className="mt-2 font-display text-lg text-burgundy">{a.title}</h2>
          {a.body && <p className="mt-1 font-body text-sm text-charcoal/80">{a.body}</p>}
        </div>
      ))}
    </div>
  );
}
