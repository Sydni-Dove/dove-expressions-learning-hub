import Link from "next/link";
import VoiceReviewForm from "@/components/VoiceReviewForm";
import { getStudentPrograms } from "@/lib/student-programs";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { BookOpen, CalendarDays, ClipboardList, MicVocal, MessageSquare, Music2, Video } from "lucide-react";

export default async function VocalCoachingPage() {
  const { user } = await getCurrentUserAndRoles();
  if (!user) redirect("/login");
  const programs = await getStudentPrograms(user.id);
  if (!programs.includes("voice")) redirect("/dashboard");
  const supabase = createClient();

  // RLS determines which student sessions and course enrollments are readable.
  const [{ data: sessions }, { data: enrollments }] = await Promise.all([
    supabase.from("dp_sessions")
      .select("id,scheduled_at,session_type,student_visible_notes,follow_up_date")
      .eq("student_id", user.id)
      .order("scheduled_at", { ascending: false })
      .limit(12),
    supabase.from("dp_enrollments")
      .select("scope_id,status")
      .eq("user_id", user.id)
      .eq("scope_type", "course")
      .eq("status", "active")
  ]);
  const courseIds = (enrollments ?? []).map((e) => e.scope_id);
  const { data: courses } = courseIds.length
    ? await supabase.from("dp_courses").select("id,title,description").in("id", courseIds)
    : { data: [] as { id: string; title: string; description: string | null }[] };

  const cards = [
    { href: "/assignments", title: "Practice & assignments", detail: "Submit your assigned exercises, songs, and recording links.", icon: ClipboardList },
    { href: "/live", title: "Sessions & workshops", detail: "See instructor-led sessions and learning events.", icon: CalendarDays },
    { href: "/library", title: "Training resources", detail: "Browse available learning materials and vocal resources.", icon: BookOpen },
    { href: "/messages", title: "Contact your instructor", detail: "Ask questions and follow up on your coaching.", icon: MessageSquare }
  ];

  return (
    <div className="space-y-8 pb-16">
      <header className="rounded-card-lg bg-burgundy-gradient p-6 text-soft sm:p-8">
        <div className="flex items-center gap-2 text-sm font-ui text-soft/75"><MicVocal className="h-5 w-5" /> Vocal & Creative Arts</div>
        <h1 className="mt-3 font-display text-3xl text-soft">Voice Learning Home</h1>
        <p className="mt-2 max-w-2xl font-body text-soft/85">Your dedicated home for vocal development. Find your coaching feedback, practice assignments, lessons, and workshops in one place. Only instructor-shared notes appear here.</p>
      </header>
      <section>
        <h2 className="font-display text-2xl text-burgundy">Your Voice Studio</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {cards.map(({ href, title, detail, icon: Icon }) => (
            <Link key={href} href={href} className="card card-hover flex gap-3 p-5">
              <Icon className="mt-1 h-6 w-6 shrink-0 text-burgundy" aria-hidden="true" />
              <span><span className="block font-display text-lg text-burgundy">{title}</span><span className="mt-1 block font-body text-sm text-charcoal/70">{detail}</span></span>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="flex items-center gap-2 font-display text-2xl text-burgundy"><Music2 className="h-5 w-5" /> My enrolled courses</h2>
        {(courses ?? []).length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(courses ?? []).map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="card card-hover p-5">
                <h3 className="font-display text-lg text-burgundy">{course.title}</h3>
                {course.description && <p className="mt-2 font-body text-sm text-charcoal/70">{course.description}</p>}
                <p className="mt-3 font-ui text-sm font-semibold text-burgundy">Open course →</p>
              </Link>
            ))}
          </div>
        ) : <p className="mt-3 rounded-2xl bg-white p-5 font-body text-sm text-charcoal/70">No active courses are linked to your account yet. Your instructor can enroll you when your training materials are ready.</p>}
      </section>
      <section>
        <h2 className="font-display text-2xl text-burgundy">Session notes shared with you</h2>
        {(sessions ?? []).filter((s) => s.student_visible_notes).length ? (
          <div className="mt-3 space-y-3">
            {(sessions ?? []).filter((s) => s.student_visible_notes).map((s) => (
              <article key={s.id} className="card p-5">
                <p className="font-ui text-sm font-semibold text-burgundy">{s.session_type.replace(/_/g, " ")} · {s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString() : "Session"}</p>
                <p className="mt-2 whitespace-pre-wrap font-body text-sm text-charcoal/80">{s.student_visible_notes}</p>
                {s.follow_up_date && <p className="mt-2 font-ui text-xs text-charcoal/60">Follow-up: {new Date(s.follow_up_date).toLocaleDateString()}</p>}
              </article>
            ))}
          </div>
        ) : <p className="mt-3 rounded-2xl bg-white p-5 font-body text-sm text-charcoal/70">Your instructor has not shared any session notes here yet.</p>}
      </section>
      <section className="card p-5">
        <div className="flex items-center gap-2"><Video className="h-5 w-5 text-burgundy" /><h2 className="font-display text-xl text-burgundy">Student testimonials</h2></div>
        <p className="mt-2 font-body text-sm text-charcoal/70">Share your experience through a written review or video link. Every submission is private until reviewed, and public use requires your separate permission.\n        </p><VoiceReviewForm studentId={user.id} />
      </section>
    </div>
  );
}
