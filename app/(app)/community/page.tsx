import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Pill } from "@/components/ui";

export default async function CommunityPage() {
  const supabase = createClient();

  const { data: spaces } = await supabase
    .from("dp_community_spaces")
    .select("id,name,description,space_type,requires_approval")
    .eq("is_active", true)
    .order("created_at");

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">Community</h1>
        <p className="mt-1 font-body text-charcoal/70">Spaces for discussion, testimonies, and shared experience.</p>
      </div>

      <div className="space-y-3">
        {(spaces ?? []).map((s) => (
          <Link key={s.id} href={`/community/${s.id}`} className="card block p-5 hover:border-burgundy/40">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg text-burgundy">{s.name}</h2>
              {s.requires_approval && <Pill tone="sunrise">moderated</Pill>}
            </div>
            {s.description && <p className="mt-1 font-body text-sm text-charcoal/70">{s.description}</p>}
          </Link>
        ))}
        {(!spaces || spaces.length === 0) && <EmptyState title="No spaces yet" body="Community spaces will appear here once created." />}
      </div>
    </div>
  );
}
