import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill, IconBadge } from "@/components/ui";
import AnnouncementForm from "@/components/AnnouncementForm";
import { Megaphone } from "lucide-react";

export default async function StaffAnnouncementsPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: announcements } = await supabase
    .from("dp_announcements")
    .select("id,title,body,is_pinned,publish_at,target_type")
    .order("is_pinned", { ascending: false })
    .order("publish_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <IconBadge icon={Megaphone} className="bg-gold/15 text-gold-dark" />
        <div>
          <h1 className="font-display text-3xl text-burgundy">Announcements</h1>
          <p className="mt-1 font-body text-charcoal/70">Create and manage platform announcements.</p>
        </div>
      </div>

      <AnnouncementForm createdBy={user!.id} />

      <div className="space-y-4">
        {(announcements ?? []).map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              {a.is_pinned && <Pill tone="sunrise">Pinned</Pill>}
              <Pill tone="neutral">{a.target_type}</Pill>
              <span className="font-ui text-xs text-charcoal/40">{new Date(a.publish_at).toLocaleDateString()}</span>
            </div>
            <h2 className="mt-2 font-display text-lg text-burgundy">{a.title}</h2>
            {a.body && <p className="mt-1 font-body text-sm text-charcoal/80">{a.body}</p>}
          </div>
        ))}
        {(!announcements || announcements.length === 0) && (
          <EmptyState icon={Megaphone} title="No announcements yet" body="Post your first one above." />
        )}
      </div>
    </div>
  );
}
