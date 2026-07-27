"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pill } from "@/components/ui";

interface LessonRow {
  id: string;
  title: string;
  status: string;
}

interface ModuleRow {
  id: string;
  title: string;
  order_index: number;
  lessons: LessonRow[];
}

export default function ModulesEditor({ courseId, modules }: { courseId: string; modules: ModuleRow[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);
  const [lessonTitles, setLessonTitles] = useState<Record<string, string>>({});
  const [busyModuleId, setBusyModuleId] = useState<string | null>(null);

  async function addModule() {
    if (!newModuleTitle.trim()) return;
    setAddingModule(true);
    await supabase.from("dp_modules").insert({
      course_id: courseId,
      title: newModuleTitle.trim(),
      order_index: modules.length
    });
    setAddingModule(false);
    setNewModuleTitle("");
    router.refresh();
  }

  async function addLesson(moduleId: string) {
    const title = (lessonTitles[moduleId] || "").trim();
    if (!title) return;
    setBusyModuleId(moduleId);
    const mod = modules.find((m) => m.id === moduleId);
    const { data, error } = await supabase
      .from("dp_lessons")
      .insert({
        module_id: moduleId,
        title,
        order_index: mod?.lessons.length ?? 0,
        status: "draft"
      })
      .select("id")
      .single();
    setBusyModuleId(null);
    if (!error && data) {
      setLessonTitles((prev) => ({ ...prev, [moduleId]: "" }));
      router.push(`/staff/courses/${courseId}/lessons/${data.id}/builder`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input
          value={newModuleTitle}
          onChange={(e) => setNewModuleTitle(e.target.value)}
          placeholder="New module title"
          className="min-w-[220px] flex-1 input"
        />
        <button onClick={addModule} disabled={addingModule} className="btn-primary">
          {addingModule ? "Adding…" : "+ Add module"}
        </button>
      </div>

      {modules.map((m) => (
        <div key={m.id} className="card p-5">
          <h3 className="font-display text-lg text-burgundy">{m.title}</h3>
          <div className="mt-3 space-y-2">
            {m.lessons.map((l) => (
              <Link
                key={l.id}
                href={`/staff/courses/${courseId}/lessons/${l.id}/builder`}
                className="flex items-center justify-between rounded-lg border border-charcoal/10 px-3 py-2 hover:border-burgundy/40"
              >
                <span className="font-body text-sm text-charcoal">{l.title}</span>
                <Pill tone={l.status === "published" ? "success" : "neutral"}>{l.status}</Pill>
              </Link>
            ))}
            {m.lessons.length === 0 && <p className="font-ui text-xs text-charcoal/50">No lessons yet.</p>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={lessonTitles[m.id] || ""}
              onChange={(e) => setLessonTitles((prev) => ({ ...prev, [m.id]: e.target.value }))}
              placeholder="New lesson title"
              className="min-w-[200px] flex-1 input"
            />
            <button onClick={() => addLesson(m.id)} disabled={busyModuleId === m.id} className="btn-secondary">
              {busyModuleId === m.id ? "Adding…" : "+ Add lesson"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
