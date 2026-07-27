"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";

type ReflectionFields = {
  what_learned: string;
  what_god_highlighting: string;
  belief_or_pattern_to_change: string;
  response_action: string;
  prayer_response: string;
  scripture_to_meditate: string;
  practical_next_step: string;
  follow_up_date: string;
  private_notes: string;
  shared_with_mentor: boolean;
};

const EMPTY: ReflectionFields = {
  what_learned: "",
  what_god_highlighting: "",
  belief_or_pattern_to_change: "",
  response_action: "",
  prayer_response: "",
  scripture_to_meditate: "",
  practical_next_step: "",
  follow_up_date: "",
  private_notes: "",
  shared_with_mentor: false
};

const QUESTIONS: { key: keyof ReflectionFields; label: string; placeholder: string }[] = [
  { key: "what_learned", label: "What did you learn?", placeholder: "The main thing this lesson taught you…" },
  { key: "what_god_highlighting", label: "What is God highlighting?", placeholder: "Anything that stood out, convicted you, or felt especially alive…" },
  { key: "belief_or_pattern_to_change", label: "What belief or pattern needs to change?", placeholder: "Be honest — this is between you and God first." },
  { key: "response_action", label: "What will you do in response?", placeholder: "A concrete, practical response — not just an intention." },
  { key: "prayer_response", label: "Prayer response", placeholder: "Write out a short prayer in response to what you received." },
  { key: "scripture_to_meditate", label: "Scripture to meditate on", placeholder: "A verse or passage to carry with you this week." },
  { key: "practical_next_step", label: "Practical next step", placeholder: "One specific, doable next step." }
];

export default function LessonReflectionForm({ lessonId, userId }: { lessonId: string; userId: string }) {
  const [fields, setFields] = useState<ReflectionFields>(EMPTY);
  const [reflectionId, setReflectionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");
  const [expanded, setExpanded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("dp_lesson_reflections").select("*").eq("lesson_id", lessonId).eq("student_id", userId).maybeSingle();
      if (data) {
        setReflectionId(data.id);
        setFields({
          what_learned: data.what_learned || "",
          what_god_highlighting: data.what_god_highlighting || "",
          belief_or_pattern_to_change: data.belief_or_pattern_to_change || "",
          response_action: data.response_action || "",
          prayer_response: data.prayer_response || "",
          scripture_to_meditate: data.scripture_to_meditate || "",
          practical_next_step: data.practical_next_step || "",
          follow_up_date: data.follow_up_date || "",
          private_notes: data.private_notes || "",
          shared_with_mentor: !!data.shared_with_mentor
        });
        if (Object.values(data).some((v) => typeof v === "string" && v.trim().length > 0)) setExpanded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function save(next: ReflectionFields) {
    setStatus("saving");
    try {
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      const payload = { lesson_id: lessonId, student_id: userId, ...next, follow_up_date: next.follow_up_date || null };
      const { data, error } = await supabase
        .from("dp_lesson_reflections")
        .upsert(payload, { onConflict: "lesson_id,student_id" })
        .select("id")
        .single();
      if (error) throw error;
      setReflectionId(data.id);
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  }

  function update(key: keyof ReflectionFields, value: string | boolean) {
    const next = { ...fields, [key]: value };
    setFields(next);
  }

  function commit() {
    save(fields);
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-burgundy">Reflection &amp; Activation</h3>
          <p className="font-ui text-xs text-charcoal/50">Receive → Record → Understand → Respond → Build</p>
        </div>
        {reflectionId && <SaveStatus status={status} />}
      </div>

      {!expanded ? (
        <button onClick={() => setExpanded(true)} className="btn-secondary mt-4">
          Start reflecting on this lesson
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">{q.label}</label>
              <textarea
                value={fields[q.key] as string}
                onChange={(e) => update(q.key, e.target.value)}
                onBlur={commit}
                placeholder={q.placeholder}
                rows={2}
                className="w-full input"
              />
            </div>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Follow-up date</label>
              <input
                type="date"
                value={fields.follow_up_date}
                onChange={(e) => update("follow_up_date", e.target.value)}
                onBlur={commit}
                className="w-full input"
              />
            </div>
            <label className="mt-6 flex items-center gap-2 font-ui text-sm text-charcoal">
              <input
                type="checkbox"
                checked={fields.shared_with_mentor}
                onChange={(e) => {
                  update("shared_with_mentor", e.target.checked);
                  save({ ...fields, shared_with_mentor: e.target.checked });
                }}
              />
              Share this reflection with my mentor
            </label>
          </div>

          <div>
            <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Private notes</label>
            <textarea
              value={fields.private_notes}
              onChange={(e) => update("private_notes", e.target.value)}
              onBlur={commit}
              placeholder="Anything else, just for you."
              rows={3}
              className="w-full input"
            />
            <p className="mt-1 font-ui text-xs text-charcoal/50">
              Private notes are never shared, even if you share the rest of this reflection.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
