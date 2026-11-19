import type { GuidedSubmissionContent } from "@/lib/guided-lesson";

/**
 * Read-only view of a guided-section submission for the instructor. Shows the prompts the student
 * actually saw (stored in the submission) next to their answers.
 */
export default function GuidedSubmissionView({ content }: { content: GuidedSubmissionContent }) {
  return (
    <div className="space-y-5" data-testid="guided-submission-view">
      <p className="font-ui text-xs text-charcoal/55">Section: <strong>{content.sectionTitle}</strong> · lesson content version {content.contentVersion}</p>

      {content.check && (
        <div className="rounded-control bg-charcoal/[0.04] p-3">
          <h3 className="font-ui text-xs font-bold uppercase tracking-wide text-sunrise-dark">Knowledge check</h3>
          <p className="mt-1 font-body text-sm text-charcoal/85">{content.check.prompt}</p>
          <p className="mt-2 font-body text-sm">
            <span className="text-charcoal/60">Chose: </span>
            <strong>{content.check.choiceText || "No answer"}</strong>
            {content.check.correct === true && <span className="ml-2 rounded-pill bg-green-100 px-2 py-0.5 font-ui text-xs text-green-800">answered correctly</span>}
            {content.check.correct === false && <span className="ml-2 rounded-pill bg-sunrise/15 px-2 py-0.5 font-ui text-xs text-charcoal/80">answered incorrectly</span>}
            {content.check.correct === null && <span className="ml-2 font-ui text-xs text-charcoal/50">(not checked by the student)</span>}
          </p>
        </div>
      )}

      {content.answers.map((a, i) => (
        <div key={a.id}>
          {a.group && (i === 0 || content.answers[i - 1].group !== a.group) && (
            <h3 className="mb-2 mt-2 border-b border-charcoal/10 pb-1 font-display text-lg text-burgundy" data-testid="answer-group">{a.group}</h3>
          )}
          <h3 className="font-ui text-xs font-bold uppercase tracking-wide text-sunrise-dark">{a.group ? `Question ${content.answers.slice(0, i).filter((x) => x.group === a.group).length + 1}` : `Reflection ${i + 1}`}</h3>
          <p className="mt-1 font-body text-sm font-semibold text-charcoal/85">{a.prompt}</p>
          <p className="mt-1 whitespace-pre-line rounded-control border border-charcoal/10 bg-white p-3 font-body text-sm text-charcoal/85">{a.response || "No answer."}</p>
        </div>
      ))}

      {content.exercise && (
        <div>
          <h3 className="font-ui text-xs font-bold uppercase tracking-wide text-sunrise-dark">Practice: {content.exercise.title}</h3>
          {content.exercise.steps.length > 0 && (
            <ol className="mt-1 list-decimal space-y-1 pl-5 font-body text-sm text-charcoal/70">
              {content.exercise.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
          {content.exercise.prompt && <p className="mt-2 font-body text-sm font-semibold text-charcoal/85">{content.exercise.prompt}</p>}
          <p className="mt-1 whitespace-pre-line rounded-control border border-charcoal/10 bg-white p-3 font-body text-sm text-charcoal/85">{content.exercise.response || "No response."}</p>
        </div>
      )}
    </div>
  );
}
