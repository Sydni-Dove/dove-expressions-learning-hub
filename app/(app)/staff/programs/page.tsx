import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pill, EmptyState } from "@/components/ui";
import ProgramForm from "@/components/ProgramForm";

export default async function StaffProgramsPage() {
  const supabase = createClient();

  const [{ data: programs }, { data: areas }] = await Promise.all([
    supabase.from("dp_programs").select("id,name,slug,area_id,is_template,version,archived_at").order("created_at", { ascending: false }),
    supabase.from("dp_learning_areas").select("id,name").order("order_index")
  ]);

  const areaName = (id: string | null) => areas?.find((a) => a.id === id)?.name || "—";

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-burgundy">Programs</h1>
          <p className="mt-1 font-body text-charcoal/70">
            The top level of the learning hierarchy — a program groups tracks, cohorts, and courses.
          </p>
        </div>
      </div>

      <ProgramForm areas={areas ?? []} />

      <div className="space-y-3">
        {(programs ?? []).map((p) => (
          <Link key={p.id} href={`/staff/programs/${p.id}/builder`} className="card block p-5 hover:border-burgundy/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-lg text-burgundy">{p.name}</p>
              <div className="flex gap-2">
                <Pill tone="neutral">{areaName(p.area_id)}</Pill>
                {p.archived_at && <Pill tone="coral">archived</Pill>}
              </div>
            </div>
            <p className="mt-1 font-ui text-xs text-charcoal/50">v{p.version} · /{p.slug}</p>
          </Link>
        ))}
        {(!programs || programs.length === 0) && (
          <EmptyState title="No programs yet" body="Create your first program above to start building out a curriculum." />
        )}
      </div>
    </div>
  );
}
