import Link from "next/link";

/** Shown when a signed-in student opens a protected course they aren't enrolled in. */
export default function CourseLocked({ courseId }: { courseId?: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center" data-testid="course-locked" data-course={courseId}>
      <h1 className="font-display text-3xl text-burgundy">This course is for enrolled students</h1>
      <p className="mt-3 font-body text-charcoal/70">
        You&rsquo;re signed in, but this course isn&rsquo;t on your account yet. If you believe you should have access,
        reach out and we&rsquo;ll get you in.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/courses" className="btn-secondary">My Courses</Link>
        <Link href="/help" className="btn-primary">Get help</Link>
      </div>
    </div>
  );
}
