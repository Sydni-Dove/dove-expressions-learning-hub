import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill } from "@/components/ui";
import NewPrayerRequestForm from "@/components/NewPrayerRequestForm";

export default async function PrayerPage() {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: requests } = await supabase
    .from("dp_prayer_requests")
    .select("id,title,visibility,is_anonymous,status,author_id,created_at")
    .order("created_at", { ascending: false });

  const authorIds = Array.from(new Set((requests ?? []).map((r) => r.author_id)));
  const { data: profiles } = authorIds.length ? await supabase.from("profiles").select("id,full_name,email").in("id", authorIds) : { data: [] };
  const nameFor = (id: string) => profiles?.find((p) => p.id === id)?.full_name || profiles?.find((p) => p.id === id)?.email || "Someone";

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">Prayer</h1>
        <p className="mt-1 font-body text-charcoal/70">Your requests, and requests shared with you.</p>
      </div>

      <NewPrayerRequestForm authorId={user!.id} />

      <div className="space-y-3">
        {(requests ?? []).map((r) => (
          <Link key={r.id} href={`/prayer/${r.id}`} className="card block p-5 hover:border-burgundy/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg text-burgundy">{r.title}</h2>
              <div className="flex gap-2">
                {r.status === "answered" && <Pill tone="success">answered</Pill>}
                <Pill tone="neutral">{r.visibility}</Pill>
              </div>
            </div>
            <p className="mt-1 font-ui text-xs text-charcoal/50">
              {r.is_anonymous && r.author_id !== user!.id ? "Anonymous" : nameFor(r.author_id)} · {new Date(r.created_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
        {(!requests || requests.length === 0) && <EmptyState title="No prayer requests yet" body="Post one above." />}
      </div>
    </div>
  );
}
