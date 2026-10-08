"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";
import { validateBuild, EMPTY_BUILD, type BuildFields } from "@/lib/build-validation";

const SECTIONS: { title: string; blurb?: string; fields: { key: keyof BuildFields; label: string; type?: "text" | "url" | "area"; rows?: number; placeholder?: string }[] }[] = [
  {
    title: "App objective",
    fields: [
      { key: "app_name", label: "Working name", placeholder: "What are you calling it?" },
      { key: "building_what", label: "What am I building?", type: "area", rows: 3 },
      { key: "audience", label: "Who is it for?", type: "area", rows: 3 },
      { key: "central_action", label: "What is the central experience / main action?", type: "area", rows: 3 }
    ]
  },
  {
    title: "Project links",
    blurb: "Links only. Never paste passwords, API keys, or tokens anywhere on this page.",
    fields: [
      { key: "repo_url", label: "Repository URL", type: "url", placeholder: "https://github.com/…" },
      { key: "preview_url", label: "Preview URL", type: "url", placeholder: "https://…" },
      { key: "live_url", label: "Live URL", type: "url", placeholder: "https://…" }
    ]
  },
  {
    title: "My AI building team",
    blurb: "These are roles, not three different tools — one AI can fill all three.",
    fields: [
      { key: "strategist_tool", label: "Strategist (plans & decides)", placeholder: "e.g. Claude" },
      { key: "developer_tool", label: "Developer (builds)", placeholder: "e.g. Claude Code" },
      { key: "evaluator_tool", label: "Evaluator (checks & reviews)", placeholder: "e.g. Claude" }
    ]
  },
  {
    title: "Project status",
    fields: [
      { key: "current_focus", label: "Current focus", type: "area", rows: 2 },
      { key: "notes", label: "Notes", type: "area", rows: 5 },
      { key: "parked_ideas", label: "Parked ideas (not now, maybe later)", type: "area", rows: 3 }
    ]
  }
];

export default function MyBuildForm({ userId, courseId, initial }: { userId: string; courseId: string; initial: Partial<BuildFields> | null }) {
  const supabase = createClient();
  const [values, setValues] = useState<BuildFields>({ ...EMPTY_BUILD, ...(initial ?? {}) });
  const [errors, setErrors] = useState<Partial<Record<keyof BuildFields, string>>>({});
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function save() {
    setMessage(null);
    const result = validateBuild(values);
    if (!result.ok) {
      setErrors(result.errors);
      setStatus("failed");
      setMessage("Please fix the highlighted fields before saving.");
      return;
    }
    setErrors({});
    setStatus("saving");
    const { error } = await supabase
      .from("dp_builds")
      .upsert({ user_id: userId, course_id: courseId, ...result.fields }, { onConflict: "user_id,course_id" });
    if (error) {
      setStatus("failed");
      setMessage("We couldn’t save just now. Your text is still here — try again in a moment.");
    } else {
      setStatus("saved");
      setDirty(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-6"
      data-testid="my-build-form"
    >
      {SECTIONS.map((section) => (
        <fieldset key={section.title} className="card p-5 sm:p-6">
          <legend className="sr-only">{section.title}</legend>
          <h2 className="font-display text-xl text-burgundy">{section.title}</h2>
          {section.blurb && <p className="mt-1 font-ui text-sm text-charcoal/60">{section.blurb}</p>}
          <div className="mt-4 space-y-4">
            {section.fields.map((f) => {
              const id = `build-${f.key}`;
              return (
                <div key={f.key}>
                  <label htmlFor={id} className="field-label">{f.label}</label>
                  {f.type === "area" ? (
                    <textarea id={id} rows={f.rows ?? 3} value={values[f.key]} onChange={(e) => { setValues({ ...values, [f.key]: e.target.value }); setDirty(true); }} className="w-full input" />
                  ) : (
                    <input id={id} type={f.type === "url" ? "url" : "text"} inputMode={f.type === "url" ? "url" : undefined} value={values[f.key]} placeholder={f.placeholder} onChange={(e) => { setValues({ ...values, [f.key]: e.target.value }); setDirty(true); }} className="w-full input" />
                  )}
                  {errors[f.key] && <p role="alert" className="mt-1 font-ui text-xs text-[#7a2c1c]">{errors[f.key]}</p>}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-card bg-soft/95 p-3 shadow-card backdrop-blur">
        <button type="submit" className="btn-primary" disabled={status === "saving"} data-testid="my-build-save">
          {status === "saving" ? "Saving…" : "Save My Build"}
        </button>
        <SaveStatus status={status} />
        {dirty && status !== "saving" && <span className="font-ui text-xs text-charcoal/50">Unsaved changes</span>}
        {message && <span role="alert" className="font-ui text-xs text-[#7a2c1c]">{message}</span>}
      </div>
    </form>
  );
}
