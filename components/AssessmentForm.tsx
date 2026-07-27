"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";
import type { AssessmentQuestion } from "@/lib/types";

export default function AssessmentForm({
  assessmentId,
  questions,
  userId,
  existingResponseId,
  existingAnswers,
  categoryCodeToId
}: {
  assessmentId: string;
  questions: AssessmentQuestion[];
  userId: string;
  existingResponseId: string | null;
  existingAnswers: Record<string, number>;
  categoryCodeToId: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const sections = useMemo(() => Array.from(new Set(questions.map((q) => q.section || "General"))), [questions]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(existingAnswers);
  const [responseId, setResponseId] = useState<string | null>(existingResponseId);
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");
  const [submitting, setSubmitting] = useState(false);

  const currentSection = sections[sectionIndex];
  const sectionQuestions = questions.filter((q) => (q.section || "General") === currentSection);
  const answeredInSection = sectionQuestions.filter((q) => answers[q.id] !== undefined).length;

  async function persist(nextAnswers: Record<string, number>) {
    setStatus("saving");
    try {
      if (responseId) {
        const { error } = await supabase.from("dp_assessment_responses").update({ answers: nextAnswers }).eq("id", responseId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("dp_assessment_responses")
          .insert({ assessment_id: assessmentId, student_id: userId, answers: nextAnswers, status: "in_progress" })
          .select("id")
          .single();
        if (error) throw error;
        setResponseId(data.id);
      }
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  }

  function selectOption(questionId: string, optionIndex: number) {
    const next = { ...answers, [questionId]: optionIndex };
    setAnswers(next);
    persist(next);
  }

  async function submitAssessment() {
    setSubmitting(true);
    // Tally scores from each question's weight_map (option index -> category code)
    const scores: Record<string, number> = {};
    for (const q of questions) {
      const chosen = answers[q.id];
      if (chosen === undefined) continue;
      const weightMap = (q as any).weight_map as Record<string, string> | undefined;
      const code = weightMap?.[String(chosen)];
      if (code) scores[code] = (scores[code] || 0) + 1;
    }
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const primaryCode = ranked[0]?.[0];
    const secondaryCode = ranked[1]?.[0];

    if (responseId) {
      await supabase.from("dp_assessment_responses").update({ answers, status: "submitted", submitted_at: new Date().toISOString() }).eq("id", responseId);
    }

    const { data: resultRow, error } = await supabase
      .from("dp_wiring_results")
      .insert({
        response_id: responseId,
        student_id: userId,
        primary_category_id: primaryCode ? categoryCodeToId[primaryCode] : null,
        secondary_category_id: secondaryCode ? categoryCodeToId[secondaryCode] : null,
        scores
      })
      .select("id")
      .single();

    setSubmitting(false);
    if (!error && resultRow) {
      router.push("/wiring/results");
    }
  }

  const isLastSection = sectionIndex === sections.length - 1;
  const totalAnswered = Object.keys(answers).length;
  const overallPercent = questions.length ? Math.round((totalAnswered / questions.length) * 100) : 0;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <p className="font-ui text-xs font-semibold uppercase tracking-wide text-sunrise">
          Section {sectionIndex + 1} of {sections.length}: {currentSection}
        </p>
        <SaveStatus status={status} />
      </div>

      <div
        role="progressbar"
        aria-valuenow={overallPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Assessment progress"
        className="h-2 w-full overflow-hidden rounded-full bg-pale-pink"
      >
        <div className="h-full rounded-full bg-burgundy transition-all" style={{ width: `${overallPercent}%` }} />
      </div>

      <div className="space-y-8">
        {sectionQuestions.map((q, qi) => (
          <fieldset key={q.id} className="card p-6">
            <legend className="font-body text-lg text-charcoal">
              {qi + 1}. {q.prompt}
              {q.is_required && (
                <span className="ml-1 text-coral" aria-label="required">
                  *
                </span>
              )}
            </legend>
            <div className="mt-4 space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 font-body text-sm transition ${
                    answers[q.id] === oi ? "border-burgundy bg-pale-pink/40" : "border-charcoal/15 hover:border-burgundy/40"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === oi}
                    onChange={() => selectOption(q.id, oi)}
                    className="h-4 w-4 accent-[#630000]"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setSectionIndex((i) => Math.max(0, i - 1))}
          disabled={sectionIndex === 0}
          className="btn-secondary disabled:opacity-40"
        >
          Back
        </button>
        <p className="font-ui text-xs text-charcoal/50">
          {answeredInSection} of {sectionQuestions.length} answered in this section
        </p>
        {isLastSection ? (
          <button onClick={submitAssessment} disabled={submitting || totalAnswered === 0} className="btn-primary">
            {submitting ? "Submitting…" : "Submit assessment"}
          </button>
        ) : (
          <button onClick={() => setSectionIndex((i) => Math.min(sections.length - 1, i + 1))} className="btn-primary">
            Next section
          </button>
        )}
      </div>
    </div>
  );
}
