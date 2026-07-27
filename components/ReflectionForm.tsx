"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";

const QUESTIONS: { key: string; label: string }[] = [
  { key: "resonated", label: "What parts of the profile resonate with you?" },
  { key: "did_not_resonate", label: "What parts do not resonate?" },
  { key: "surprised", label: "What surprised you?" },
  { key: "others_recognized", label: "What have others recognized in you?" },
  { key: "most_alive", label: "When have you felt most spiritually alive and aligned?" },
  { key: "want_to_grow", label: "What do you want to grow in?" },
  { key: "questions", label: "What questions do you have about your results?" }
];

export default function ReflectionForm({ resultId, studentId }: { resultId: string; studentId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");
  const [submitting, setSubmitting] = useState(false);

  function update(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function submit() {
    setSubmitting(true);
    setStatus("saving");
    const { error } = await supabase.from("dp_wiring_reflections").insert({
      result_id: resultId,
      student_id: studentId,
      ...answers
    });
    setSubmitting(false);
    if (error) {
      setStatus("failed");
      return;
    }
    setStatus("saved");
    router.push("/wiring/results");
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex justify-end">
        <SaveStatus status={status} />
      </div>
      {QUESTIONS.map((q) => (
        <div key={q.key} className="card p-5">
          <label htmlFor={q.key} className="font-body text-charcoal">
            {q.label}
          </label>
          <textarea
            id={q.key}
            rows={3}
            value={answers[q.key] || ""}
            onChange={(e) => update(q.key, e.target.value)}
            className="mt-2 w-full input"
          />
        </div>
      ))}
      <button onClick={submit} disabled={submitting} className="btn-primary">
        {submitting ? "Saving…" : "Save my reflection"}
      </button>
    </div>
  );
}
