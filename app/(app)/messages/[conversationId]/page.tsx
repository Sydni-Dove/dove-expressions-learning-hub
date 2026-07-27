import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { EmptyState } from "@/components/ui";
import MessageThread from "@/components/MessageThread";

export default async function ConversationPage({ params }: { params: { conversationId: string } }) {
  const supabase = createClient();
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");

  const { data: conversation } = await supabase
    .from("dp_conversations")
    .select("id,title,is_group")
    .eq("id", params.conversationId)
    .maybeSingle();

  if (!conversation) {
    return <EmptyState title="Not available" body="This conversation doesn't exist, or you're not part of it." />;
  }

  const [{ data: messages }, { data: participants }] = await Promise.all([
    supabase.from("dp_messages").select("id,sender_id,body,created_at").eq("conversation_id", conversation.id).order("created_at"),
    supabase.from("dp_conversation_participants").select("user_id").eq("conversation_id", conversation.id)
  ]);

  const participantIds = (participants ?? []).map((p) => p.user_id);
  const { data: profiles } = participantIds.length ? await supabase.from("profiles").select("id,full_name,email").in("id", participantIds) : { data: [] };
  const nameFor = (id: string) => profiles?.find((p) => p.id === id)?.full_name || profiles?.find((p) => p.id === id)?.email || "Someone";

  const otherId = participantIds.find((id) => id !== user!.id);
  const title = conversation.title || (otherId ? nameFor(otherId) : "Conversation");

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <Link href="/messages" className="font-ui text-sm text-charcoal/60 underline">
          ← Messages
        </Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">{title}</h1>
      </div>

      <MessageThread conversationId={conversation.id} userId={user!.id} messages={messages ?? []} nameFor={nameFor} />
    </div>
  );
}
