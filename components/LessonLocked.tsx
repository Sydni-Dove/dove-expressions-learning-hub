import Link from "next/link";

/** Shown instead of teaching content a student's payments do not cover yet. Their records stay available. */
export default function LessonLocked({ title, backHref, neededLessons, neededLevel, unlockedNow }: { title: string; backHref: string; neededLessons: number; neededLevel: number; unlockedNow: number }) {
  return <main className="mx-auto max-w-2xl px-4 py-16">
    <Link href={backHref} className="link-action font-ui text-sm">← Back</Link>
    <h1 className="mt-4 font-display text-3xl text-burgundy">{title}</h1>
    <section role="status" className="mt-6 rounded-3xl border border-burgundy/15 bg-pale-pink/40 p-6">
      <h2 className="font-display text-xl text-burgundy">This lesson is not open yet</h2>
      <p className="mt-2 font-body text-sm leading-relaxed">
        {neededLevel > 0 && unlockedNow < neededLessons && unlockedNow === 0
          ? "This lesson is part of a coaching package you have not purchased."
          : `This lesson opens once ${neededLessons} lessons of your package are paid for. Right now ${unlockedNow} ${unlockedNow === 1 ? "is" : "are"} unlocked.`}
        {" "}Your completed lessons, assignments, feedback and progress stay available. Message your instructor if you have a question about your payments.
      </p>
      <Link href="/messages" className="btn-primary mt-4 inline-flex">Message your instructor</Link>
    </section>
  </main>;
}
