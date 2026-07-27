import { getCurrentUserAndRoles } from "@/lib/roles";
import { redirect } from "next/navigation";
import NotesApp from "@/components/NotesApp";

export default async function NotesPage() {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  return (
    <div>
      <h1 className="font-display text-3xl text-burgundy">Notes &amp; Journal</h1>
      <p className="mt-1 mb-6 font-body text-charcoal/70">
        Private by default. Sharing with your mentor, teacher, cohort, or community is always your choice.
      </p>
      <NotesApp userId={user!.id} />
    </div>
  );
}
