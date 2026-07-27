import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState, Pill } from "@/components/ui";
import CommentThread from "@/components/CommentThread";

export default async function PostPage({ params }: { params: { spaceId: string; postId: string } }) {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: post } = await supabase
    .from("dp_community_posts")
    .select("id,body,status,created_at,author_id,space_id")
    .eq("id", params.postId)
    .maybeSingle();

  if (!post) {
    return <EmptyState title="Not available" body="This post doesn't exist, isn't approved yet, or was removed." />;
  }

  const { data: comments } = await supabase
    .from("dp_community_comments")
    .select("id,author_id,body,created_at")
    .eq("post_id", post.id)
    .order("created_at");

  const authorIds = Array.from(new Set([post.author_id, ...(comments ?? []).map((c) => c.author_id)]));
  const { data: profiles } = authorIds.length ? await supabase.from("profiles").select("id,full_name,email").in("id", authorIds) : { data: [] };
  const nameFor = (id: string) => profiles?.find((p) => p.id === id)?.full_name || profiles?.find((p) => p.id === id)?.email || "Someone";

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <Link href={`/community/${params.spaceId}`} className="font-ui text-sm text-charcoal/60 underline">
          ← Back
        </Link>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-ui text-sm font-semibold text-charcoal/60">{nameFor(post.author_id)}</p>
          <div className="flex items-center gap-2">
            {post.status === "pending" && <Pill tone="sunrise">pending approval</Pill>}
            <span className="font-ui text-xs text-charcoal/40">{new Date(post.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <p className="mt-3 font-body text-charcoal/90">{post.body}</p>
      </div>

      <div>
        <h2 className="font-display text-lg text-burgundy">Comments</h2>
        <div className="mt-3">
          <CommentThread postId={post.id} authorId={user!.id} comments={comments ?? []} nameFor={nameFor} />
        </div>
      </div>
    </div>
  );
}
