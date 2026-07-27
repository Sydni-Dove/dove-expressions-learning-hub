"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SessionType = "initial" | "follow_up" | "group";

export default function SessionLogForm({ studentId, mentorId }: { studentId: string; mentorId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [sessionType, setSessionType] = useState<SessionType>("follow_up");
  const [agenda, setAgenda] = useState("");
  const [studentVisibleNotes, setStudentVisibleNotes] = useState("");
  const [privateFacultyNotes, setPrivateFacultyNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const [consentAsked, setConsentAsked] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState<"yes" | "no" | null>(null);
  const [wasRecorded, setWasRecorded] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const canRecord = consentAsked && recordingConsent === "yes";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (wasRecorded && !canRecord) {
      setError("A session can only be marked as recorded after the student's consent was explicitly asked and given.");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("dp_sessions").insert({
      student_id: studentId,
      mentor_id: mentorId,
      session_type: sessionType,
      scheduled_at: new Date().toISOString(),
      agenda: agenda || null,
      student_visible_notes: studentVisibleNotes || null,
      private_faculty_notes: privateFacultyNotes || null,
      follow_up_date: followUpDate || null,
      recording_consent: consentAsked ? recordingConsent === "yes" : null,
      recording_consent_at: consentAsked ? new Date().toISOString() : null,
      was_recorded: canRecord ? wasRecorded : false,
      created_by: mentorId
    });
    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSaved(true);
    router.push(`/staff/students/${studentId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-6">
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Session type</label>
        <select
          value={sessionType}
          onChange={(e) => setSessionType(e.target.value as SessionType)}
          className="w-full input"
        >
          <option value="initial">Initial / discovery</option>
          <option value="follow_up">Follow-up</option>
          <option value="group">Group</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Agenda</label>
        <textarea
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          rows={2}
          className="w-full input"
        />
      </div>

      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Student-visible summary</label>
        <p className="mb-1 font-ui text-xs text-charcoal/50">The student will see this.</p>
        <textarea
          value={studentVisibleNotes}
          onChange={(e) => setStudentVisibleNotes(e.target.value)}
          rows={3}
          className="w-full input"
        />
      </div>

      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Private faculty notes</label>
        <p className="mb-1 font-ui text-xs text-charcoal/50">Never shown to the student.</p>
        <textarea
          value={privateFacultyNotes}
          onChange={(e) => setPrivateFacultyNotes(e.target.value)}
          rows={3}
          className="w-full input"
        />
      </div>

      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Follow-up date</label>
        <input
          type="date"
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
          className="w-full input"
        />
      </div>

      <div className="rounded-card border border-gold/40 bg-gold/10 p-4">
        <p className="font-ui text-sm font-semibold text-[#5c3d00]">Recording consent</p>
        <p className="mt-1 font-body text-sm text-[#5c3d00]/90">
          This session is not recorded by default. A student may decline and still receive full mentoring.
        </p>
        <label className="mt-3 flex items-center gap-2 font-ui text-sm text-charcoal">
          <input
            type="checkbox"
            checked={consentAsked}
            onChange={(e) => {
              setConsentAsked(e.target.checked);
              if (!e.target.checked) {
                setRecordingConsent(null);
                setWasRecorded(false);
              }
            }}
          />
          I explicitly asked the student whether this session could be recorded
        </label>

        {consentAsked && (
          <div className="mt-3 space-y-2 pl-6">
            <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
              <input
                type="radio"
                name="recordingConsent"
                checked={recordingConsent === "yes"}
                onChange={() => setRecordingConsent("yes")}
              />
              The student said yes
            </label>
            <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
              <input
                type="radio"
                name="recordingConsent"
                checked={recordingConsent === "no"}
                onChange={() => {
                  setRecordingConsent("no");
                  setWasRecorded(false);
                }}
              />
              The student said no
            </label>

            {recordingConsent === "yes" && (
              <label className="mt-2 flex items-center gap-2 font-ui text-sm text-charcoal">
                <input type="checkbox" checked={wasRecorded} onChange={(e) => setWasRecorded(e.target.checked)} />
                This session was actually recorded
              </label>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">
          {error}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : saved ? "Saved" : "Log session"}
      </button>
    </form>
  );
}
