/** Shown the moment a student moves to another section, while that section loads. */
export default function LessonLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4" role="status" aria-live="polite" data-testid="lesson-loading">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-burgundy/20 border-t-burgundy" aria-hidden="true" />
        <p className="mt-4 font-ui text-sm text-charcoal/70">Opening the section…</p>
      </div>
    </div>
  );
}
