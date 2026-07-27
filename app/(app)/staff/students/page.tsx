import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";

export default async function StaffStudentsPage() {
  const supabase = createClient();
  const { data: mentees } = await supabase.from("dp_mentor_assignments").select("student_id").eq("status", "active");
  const studentIds = (mentees ?? []).map((m) => m.student_id);
  const { data: profiles } = studentIds.length ? await supabase.from("profiles").select("id,full_name,email").in("id", studentIds) : { data: [] };

  return (
    <div className="max-w-2xl pb-16">
      <h1 className="font-display text-3xl text-burgundy">Students</h1>
      <p className="mt-1 mb-6 font-body text-charcoal/70">Students currently assigned to you.</p>
      <ul className="divide-y divide-charcoal/10 card">
        {(profiles ?? []).map((p) => (
          <li key={p.id} className="p-4">
            <Link href={`/staff/students/${p.id}`} className="font-body text-charcoal hover:text-burgundy hover:underline">
              {p.full_name || p.email}
            </Link>
          </li>
        ))}
      </ul>
      {(!profiles || profiles.length === 0) && <EmptyState title="No students assigned" body="Once an admin assigns students to you, they'll appear here." />}
    </div>
  );
}
