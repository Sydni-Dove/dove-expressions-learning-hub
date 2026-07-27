import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles, hasAnyRole } from "@/lib/roles";
import { EmptyState } from "@/components/ui";
import NewConversationForm from "@/components/NewConversationForm";

export default async function MessagesPage() {
  const supabase = createClient();
  const { user, roles } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  const isStaff = hasAnyRole(roles, ["faculty", "teacher", "mentor", "super_admin"]);

  const { data: participantRows } = await supabase
    .from("dp_conversation_participants")
    .select("conversation_id")
    .eq("user_id", user!.id);
  const conversationIds = (participantRows ?? []).map((p) => p.conversation_id);

  const { data: conversations } = conversationIds.length
    ? await supabase
        .from("dp_conversations")
        .select("id,is_group,title,created_at")
        .in("id", conversationIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Last message + other participant, per conversation.
  const conversationSummaries = await Promise.all(
    (conversations ?? []).map(async (c) => {
      const [{ data: lastMessage }, { data: otherParticipants }] = await Promise.all([
        supabase.from("dp_messages").select("body,created_at,sender_id").eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("dp_conversation_participants").select("user_id").eq("conversation_id", c.id).neq("user_id", user!.id)
      ]);
      return { conversation: c, lastMessage, otherUserId: otherParticipants?.[0]?.user_id };
    })
  );

  const otherIds = Array.from(new Set(conversationSummaries.map((s) => s.otherUserId).filter(Boolean))) as string[];
  const { data: otherProfiles } = otherIds.length ? await supabase.from("profiles").select("id,full_name,email").in("id", otherIds) : { data: [] };
  const nameFor = (id?: string) => (id && (otherProfiles?.find((p) => p.id === id)?.full_name || otherProfiles?.find((p) => p.id === id)?.email)) || "Conversation";

  // Who this user is allowed to start a new conversation with: students see staff, staff see students.
  const targetRole = isStaff ? "student" : "faculty";
  const { data: roleRows } = await supabase.from("dp_user_roles").select("user_id").eq("role", targetRole);
  let candidateIds = Array.from(new Set((roleRows ?? []).map((r) => r.user_id))).filter((id) => id !== user!.id);
  if (!isStaff) {
    const { data: teacherRows } = await supabase.from("dp_user_roles").select("user_id").in("role", ["teacher", "mentor", "super_admin"]);
    candidateIds = Array.from(new Set([...candidateIds, ...(teacherRows ?? []).map((r) => r.user_id)])).filter((id) => id !== user!.id);
  }
  const { data: candidates } = candidateIds.length ? await supabase.from("profiles").select("id,full_name,email").in("id", candidateIds) : { data: [] };

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">Messages</h1>
        <p className="mt-1 font-body text-sm text-charcoal/70">
          {isStaff ? "Message your students directly." : "Message your mentor, teachers, or faculty."}
        </p>
      </div>

      <NewConversationForm userId={user!.id} people={candidates ?? []} />

      <ul className="divide-y divide-charcoal/10 card">
        {conversationSummaries.map(({ conversation, lastMessage, otherUserId }) => (
          <li key={conversation.id}>
            <Link href={`/messages/${conversation.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-pale-pink/20">
              <div className="min-w-0">
                <p className="font-ui text-sm font-semibold text-charcoal">{conversation.title || nameFor(otherUserId)}</p>
                <p className="truncate font-body text-sm text-charcoal/60">{lastMessage?.body || "No messages yet"}</p>
              </div>
              {lastMessage && <p className="shrink-0 font-ui text-xs text-charcoal/40">{new Date(lastMessage.created_at).toLocaleDateString()}</p>}
            </Link>
          </li>
        ))}
      </ul>
      {conversationSummaries.length === 0 && <EmptyState title="No conversations yet" body="Start one above." />}
    </div>
  );
}
