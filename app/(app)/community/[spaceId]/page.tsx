import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill } from "@/components/ui";
import NewPostForm from "@/components/NewPostForm";

export default async function CommunitySpacePage({ params }: { params: { spaceId: string } }) {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: space } = await supabase
    .from("dp_community_spaces")
    .select("id,name,description,requires_approval")
    .eq("id", params.spaceId)
    .maybeSingle();

  if (!space) {
    return <EmptyState title="Not available" body="This space doesn't exist or isn't active." />;
  }

  const { data: posts } = await supabase
    .from("dp_community_posts")
    .select("id,body,status,created_at,author_id")
    .eq("space_id", space.id)
    .order("created_at", { ascending: false });

  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.author_id)));
  const { data: profiles } = authorIds.length ? await supabase.from("profiles").select("id,full_name,email").in("id", authorIds) : { data: [] };
  const nameFor = (id: string) => profiles?.find((p) => p.id === id)?.full_name || profiles?.find((p) => p.id === id)?.email || "Someone";

  const { data: commentCounts } = posts && posts.length
    ? await supabase.from("dp_community_comments").select("post_id").in("post_id", posts.map((p) => p.id)).eq("status", "published")
    : { data: [] };
  const countFor = (postId: string) => (commentCounts ?? []).filter((c) => c.post_id === postId).length;

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <Link href="/community" className="font-ui text-sm text-charcoal/60 underline">
          ← Community
        </Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">{space.name}</h1>
        {space.description && <p className="mt-1 font-body text-charcoal/70">{space.description}</p>}
      </div>

      <NewPostForm spaceId={space.id} authorId={user!.id} requiresApproval={space.requires_approval} />

      <div className="space-y-3">
        {(posts ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/community/${space.id}/posts/${p.id}`}
            className="card block p-5 hover:border-burgundy/40"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-ui text-xs font-semibold text-charcoal/50">{nameFor(p.author_id)}</p>
              <div className="flex items-center gap-2">
                {p.status === "pending" && <Pill tone="sunrise">pending approval</Pill>}
                <span className="font-ui text-xs text-charcoal/40">{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <p className="mt-2 font-body text-sm text-charcoal/90">{p.body}</p>
            <p className="mt-2 font-ui text-xs text-charcoal/40">{countFor(p.id)} comment{countFor(p.id) === 1 ? "" : "s"}</p>
          </Link>
        ))}
        {(!posts || posts.length === 0) && <EmptyState title="Nothing posted yet" body="Be the first to post in this space." />}
      </div>
    </div>
  );
}
