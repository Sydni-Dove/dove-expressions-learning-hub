"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MarkCompleteButton({
  lessonId,
  userId,
  initiallyComplete
}: {
  lessonId: string;
  userId: string;
  initiallyComplete: boolean;
}) {
  const [complete, setComplete] = useState(initiallyComplete);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function toggle() {
    setLoading(true);
    const nextStatus = complete ? "in_progress" : "completed";
    const { error } = await supabase.from("dp_lesson_progress").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        status: nextStatus,
        completion_method: "student_marked",
        completed_at: nextStatus === "completed" ? new Date().toISOString() : null
      },
      { onConflict: "user_id,lesson_id" }
    );
    setLoading(false);
    if (!error) {
      setComplete(!complete);
      router.refresh();
    }
  }

  return (
    <button onClick={toggle} disabled={loading} className={complete ? "btn-secondary" : "btn-primary"}>
      {loading ? "Saving…" : complete ? "Marked complete ✓" : "Mark lesson complete"}
    </button>
  );
}
