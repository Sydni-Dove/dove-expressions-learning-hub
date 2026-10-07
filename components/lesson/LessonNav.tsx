import Link from "next/link";

export interface LessonNavTarget {
  courseId: string;
  previousId: string | null;
  nextId: string | null;
  isLast: boolean;
}

/**
 * Previous / Next lesson links. Plain links — navigating never marks a lesson
 * complete (that stays an explicit "Mark complete" action). On the first lesson
 * Previous is omitted; on the last lesson Next becomes a course-completion action.
 */
export default function LessonNav({ courseId, previousId, nextId, isLast }: LessonNavTarget) {
  const base = `/courses/${courseId}`;
  return (
    <nav aria-label="Lesson navigation" className="my-8 grid gap-3 sm:grid-cols-2" data-testid="lesson-nav">
      <div>
        {previousId && (
          <Link href={`${base}/lessons/${previousId}`} className="btn-secondary w-full sm:w-auto" data-testid="prev-lesson">
            ← Previous lesson
          </Link>
        )}
      </div>
      <div className="sm:text-right">
        {nextId ? (
          <Link href={`${base}/lessons/${nextId}`} className="btn-primary w-full sm:w-auto" data-testid="next-lesson">
            Next lesson →
          </Link>
        ) : isLast ? (
          <Link href={base} className="btn-primary w-full sm:w-auto" data-testid="finish-course">
            Finish — back to course ✓
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
