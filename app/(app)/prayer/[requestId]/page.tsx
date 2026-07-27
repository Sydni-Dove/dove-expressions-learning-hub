import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill } from "@/components/ui";
import PrayerResponseThread from "@/components/PrayerResponseThread";
import MarkAnsweredControl from "@/components/MarkAnsweredControl";

export default async function PrayerRequestPage({ params }: { params: { requestId: string } }) {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: request } = await supabase
    .from("dp_prayer_requests")
    .select("id,title,body,visibility,is_anonymous,status,answered_note,author_id,created_at")
    .eq("id", params.requestId)
    .maybeSingle();

  if (!request) {
    return <EmptyState title="Not available" body="This prayer request doesn't exist, or isn't shared with you." />;
  }

  const { data: responses } = await supabase
    .from("dp_prayer_responses")
    .select("id,responder_id,body,created_at")
    .eq("request_id", request.id)
    .order("created_at");

  const peopleIds = Array.from(new Set([request.author_id, ...(responses ?? []).map((r) => r.responder_id)]));
  const { data: profiles } = peopleIds.length ? await supabase.from("profiles").select("id,full_name,email").in("id", peopleIds) : { data: [] };
  const nameFor = (id: string) => profiles?.find((p) => p.id === id)?.full_name || profiles?.find((p) => p.id === id)?.email || "Someone";

  const showName = !(request.is_anonymous && request.author_id !== user!.id);
  const isAuthor = request.author_id === user!.id;

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <Link href="/prayer" className="font-ui text-sm text-charcoal/60 underline">
          ← Prayer
        </Link>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl text-burgundy">{request.title}</h1>
          <div className="flex gap-2">
            {request.status === "answered" && <Pill tone="success">answered</Pill>}
            <Pill tone="neutral">{request.visibility}</Pill>
          </div>
        </div>
        <p className="mt-1 font-ui text-xs text-charcoal/50">
          {showName ? nameFor(request.author_id) : "Anonymous"} · {new Date(request.created_at).toLocaleDateString()}
        </p>
        {request.body && <p className="mt-3 font-body text-charcoal/90">{request.body}</p>}
        {request.status === "answered" && request.answered_note && (
          <div className="mt-4 rounded-card border border-green-200 bg-green-50 p-3">
            <p className="font-ui text-xs font-semibold uppercase tracking-wide text-green-800">Testimony</p>
            <p className="mt-1 font-body text-sm text-green-900">{request.answered_note}</p>
          </div>
        )}
      </div>

      {isAuthor && (
        <div>
          <MarkAnsweredControl requestId={request.id} currentStatus={request.status} />
        </div>
      )}

      <div>
        <h2 className="font-display text-lg text-burgundy">Praying with you</h2>
        <div className="mt-3">
          <PrayerResponseThread requestId={request.id} userId={user!.id} responses={responses ?? []} nameFor={nameFor} />
        </div>
      </div>
    </div>
  );
}
