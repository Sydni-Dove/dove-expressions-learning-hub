import { getCurrentUserAndRoles } from "@/lib/roles";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportForm from "@/components/ReportForm";
import { EmptyState } from "@/components/ui";

export default async function ReportPage() {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  const supabase = createClient();

  const { data: myReports } = await supabase
    .from("dp_reports")
    .select("id,content_type,reason,status,created_at")
    .eq("reporter_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-8 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">Report a concern</h1>
        <p className="mt-1 font-body text-charcoal/70">
          Something about another user, a piece of content, or how you were treated — tell us what happened.
          Reports are reviewed by faculty and administrators and are never visible to the person you're reporting.
        </p>
      </div>

      <div className="rounded-card border border-coral/30 bg-coral/10 p-4 font-body text-sm text-[#7a2c1c]">
        <strong>This is not a crisis service.</strong> If you're in danger or experiencing a mental health
        emergency, please contact local emergency services or a crisis line now rather than waiting for a
        response here.
      </div>

      <ReportForm reporterId={user!.id} />

      <div>
        <h2 className="font-display text-lg text-burgundy">Your reports</h2>
        <div className="mt-3 space-y-3">
          {(myReports ?? []).map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-ui text-xs font-semibold uppercase tracking-wide text-charcoal/40">
                  {r.content_type ? r.content_type.replace(/_/g, " ") : "General concern"}
                </p>
                <span className="font-ui text-xs text-charcoal/50">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <p className="mt-2 font-body text-sm text-charcoal/80">{r.reason}</p>
              <p className="mt-2 font-ui text-xs font-semibold uppercase tracking-wide text-burgundy">
                Status: {r.status.replace(/_/g, " ")}
              </p>
            </div>
          ))}
          {(!myReports || myReports.length === 0) && (
            <EmptyState title="No reports filed" body="Reports you submit will appear here along with their status." />
          )}
        </div>
      </div>
    </div>
  );
}
