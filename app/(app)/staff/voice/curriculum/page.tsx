import Link from "next/link";
import CurriculumBrowser from "@/components/voice/CurriculumBrowser";
import { requireRoles } from "@/lib/roles";

export default async function CurriculumPage() {
  await requireRoles(["faculty", "teacher", "super_admin"]);
  return (
    <div className="space-y-6 pb-20">
      <header><Link href="/staff/voice" className="link-action font-ui text-sm">← Voice command center</Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">Vocal coaching curriculum</h1>
        <p className="mt-1 max-w-2xl font-body text-sm text-charcoal/70">Twelve skill areas and three separate, optional Creative Worship tracks. Instructor-only: students see only the practice you assign. Draft content for your review; nothing here is published or advertised.</p></header>
      <CurriculumBrowser />
    </div>
  );
}
