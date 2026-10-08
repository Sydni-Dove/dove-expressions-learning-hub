import Link from "next/link";

export default function LessonCompletion({
  courseId,
  isComplete,
  markCompleteButton,
  practical = false,
  myBuildHref
}: {
  courseId: string;
  isComplete: boolean;
  markCompleteButton: React.ReactNode;
  practical?: boolean;
  myBuildHref?: string;
}) {
  if (practical) {
    return (
      <section id="completion" aria-labelledby="completion-heading" className="scroll-mt-24 border-b border-charcoal/10 py-8">
        <h2 id="completion-heading" className="mb-4 font-display text-2xl text-burgundy sm:text-3xl">
          Finish this lesson
        </h2>
        <div className="card card-band-sunrise max-w-[860px] p-6 sm:p-8">
          <p className="font-body text-charcoal/80">Done with the Do This Now steps? Mark the lesson complete when you are ready, then move on.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {markCompleteButton}
            <span className="pill bg-burgundy/10 text-burgundy">{isComplete ? "Lesson complete" : "Not yet complete"}</span>
            {myBuildHref && (
              <Link href={myBuildHref} className="btn-secondary">
                Open My Build
              </Link>
            )}
            <Link href={`/courses/${courseId}`} className="btn-secondary">
              Return to Course
            </Link>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section id="completion" aria-labelledby="completion-heading" className="scroll-mt-24 border-b border-charcoal/10 py-8">
      <span className="mb-2 block font-display text-2xl text-gold">05</span>
      <h2 id="completion-heading" className="mb-4 font-display text-2xl text-burgundy sm:text-3xl">
        Continue to Reflection
      </h2>
      <div className="card card-band-gold max-w-[860px] p-6 sm:p-8">
        <h3 className="font-display text-2xl text-burgundy">The teaching portion is finished.</h3>
        <p className="mt-2 font-body text-charcoal/80">You&rsquo;ve received the teaching. Now slow down, reflect, pray, and record what God is showing you.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {markCompleteButton}
          <span className="pill bg-burgundy/10 text-burgundy">{isComplete ? "Teaching complete" : "Not yet complete"}</span>
          <a href="#reflection" className="btn-primary">
            Continue to Reflection
          </a>
          <Link href={`/courses/${courseId}`} className="btn-secondary">
            Return to Course
          </Link>
        </div>
      </div>
    </section>
  );
}
