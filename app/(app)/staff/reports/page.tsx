import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import ReportStatusControl from "@/components/ReportStatusControl";

export default async function StaffReportsPage() {
  const supabase = createClient();

  const { data: reports } = await supabase
    .from("dp_reports")
    .select("id,reporter_id,reported_user_id,content_type,reason,status,created_at")
    .order("created_at", { ascending: false });

  const reporterIds = Array.from(new Set((reports ?? []).map((r) => r.reporter_id).filter(Boolean)));
  const { data: profiles } = reporterIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", reporterIds)
    : { data: [] };
  const nameFor = (id: string | null) =>
    (id && (profiles?.find((p) => p.id === id)?.full_name || profiles?.find((p) => p.id === id)?.email)) || "Unknown";

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">Reports</h1>
        <p className="mt-1 font-body text-charcoal/70">
          Reports are never visible to the person being reported on. The reporter can see their own report's
          status, but not these resolution notes.
        </p>
      </div>

      <div className="space-y-4">
        {(reports ?? []).map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">
                {r.content_type ? r.content_type.replace(/_/g, " ") : "General concern"} · from {nameFor(r.reporter_id)}
              </p>
              <span className="font-ui text-xs text-charcoal/50">{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            <p className="mt-2 font-body text-sm text-charcoal/80">{r.reason}</p>
            <div className="mt-3">
              <ReportStatusControl reportId={r.id} currentStatus={r.status} />
            </div>
          </div>
        ))}
        {(!reports || reports.length === 0) && (
          <EmptyState title="No reports" body="Reports students or staff submit will appear here for review." />
        )}
      </div>
    </div>
  );
}
