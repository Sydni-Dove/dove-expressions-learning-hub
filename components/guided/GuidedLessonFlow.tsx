"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_EXERCISE_CHARS,
  MAX_REFLECTION_CHARS,
  arrowDirection,
  buildScreens,
  buildSubmissionContent,
  clampScreen,
  draftFromSubmission,
  isWelcomeLesson,
  minutesLabel,
  normalizeDraft,
  studentCanEdit,
  toParagraphs,
  validateForSubmit,
  type GuidedDraft,
  type GuidedLesson,
  type SubmissionStatus
} from "@/lib/guided-lesson";

export interface GuidedResource {
  id: string;
  title: string;
  kind: string;
  file_name: string | null;
  version: string | null;
}

export interface GuidedLessonFlowProps {
  lessonId: string;
  lessonTitle: string;
  lessonStatus: string;
  contentVersion: number;
  courseId: string;
  courseTitle: string;
  guided: GuidedLesson;
  userId: string;
  initialDraft: unknown;
  assignmentId: string | null;
  submission: { id: string; status: SubmissionStatus; content: unknown } | null;
  feedback: { id: string; content: string; created_at: string }[];
  resources: GuidedResource[];
  isStaffPreview: boolean;
  position: { index: number; total: number };
  nextLessonId: string | null;
  prevLessonId: string | null;
  lessonCompleted: boolean;
}

type SaveState = { kind: "saved"; at: Date | null } | { kind: "dirty" } | { kind: "saving" } | { kind: "error"; message: string };

const STATUS_COPY: Record<SubmissionStatus, string> = {
  submitted: "Submitted — waiting for your instructor's review",
  revised: "Revision submitted — waiting for your instructor's review",
  returned: "Returned with feedback — you can revise and resubmit",
  approved: "Reviewed and approved",
  exempt: "Reviewed — marked exempt"
};

export default function GuidedLessonFlow(props: GuidedLessonFlowProps) {
  const { lessonId, lessonTitle, lessonStatus, contentVersion, courseId, courseTitle, guided, userId, assignmentId, submission, feedback, resources, isStaffPreview, position, nextLessonId, lessonCompleted } = props;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const screens = useMemo(() => buildScreens(guided), [guided]);
  const welcome = isWelcomeLesson(guided);

  // Reflect a successful submit immediately; the server data (props) takes over after the refresh.
  const [localStatus, setLocalStatus] = useState<SubmissionStatus | null>(null);
  useEffect(() => setLocalStatus(null), [submission?.status]);
  const status: SubmissionStatus | null = localStatus ?? submission?.status ?? null;
  const locked = !studentCanEdit(status);

  // Starting point: a locked (submitted/approved) lesson shows what was submitted; a returned one
  // restores the submission so it can be revised; otherwise the saved private draft.
  const [draft, setDraft] = useState<GuidedDraft>(() => {
    if (submission && (locked || !props.initialDraft)) return draftFromSubmission(submission.content, contentVersion);
    return normalizeDraft(props.initialDraft, contentVersion);
  });
  const [screenIndex, setScreenIndex] = useState(() => clampScreen(locked ? 0 : normalizeDraft(props.initialDraft, contentVersion).screen, screens.length));
  const [save, setSave] = useState<SaveState>({ kind: "saved", at: null });
  const [checkResult, setCheckResult] = useState<{ choice: number; correct: boolean; feedback: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const screenRef = useRef(screenIndex);
  screenRef.current = screenIndex;
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const screen = screens[clampScreen(screenIndex, screens.length)];
  const pageCount = guided.pages.length;
  const draftVersionDiffers = draft.contentVersion !== contentVersion && !locked && !!props.initialDraft;

  // ---------------------------------------------------------------- saving
  const persist = useCallback(async (): Promise<boolean> => {
    if (locked) return true;
    setSave({ kind: "saving" });
    const content = { ...draftRef.current, contentVersion, screen: screenRef.current };
    const { error } = await supabase
      .from("dp_lesson_drafts")
      .upsert({ user_id: userId, lesson_id: lessonId, content, content_version: contentVersion }, { onConflict: "user_id,lesson_id" });
    if (error) {
      dirtyRef.current = true;
      setSave({ kind: "error", message: error.message });
      return false;
    }
    dirtyRef.current = false;
    setSave({ kind: "saved", at: new Date() });
    return true;
  }, [contentVersion, lessonId, locked, supabase, userId]);

  const scheduleSave = useCallback(() => {
    if (locked) return;
    dirtyRef.current = true;
    setSave((s) => (s.kind === "saving" ? s : { kind: "dirty" }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persist(), 900);
  }, [locked, persist]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // never lose typed work silently when the tab is closed
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  // ---------------------------------------------------------------- navigation
  const go = useCallback(
    (delta: number) => {
      const next = clampScreen(screenRef.current + delta, screens.length);
      if (next === screenRef.current) return;
      setScreenIndex(next);
      screenRef.current = next;
      setConfirming(false);
      if (!locked) {
        setDraft((d) => ({ ...d, screen: next }));
        scheduleSave();
      }
      window.scrollTo({ top: 0 });
      const s = screens[next];
      setAnnounce(s.kind === "page" ? `Page ${s.index + 1} of ${pageCount}: ${guided.pages[s.index]?.title ?? ""}` : s.kind === "opening" ? "Lesson opening" : s.kind === "questions" ? "Questions" : s.kind === "exercise" ? "Practice" : "Review and submit");
    },
    [guided.pages, locked, pageCount, scheduleSave, screens]
  );
  const goTo = useCallback((i: number) => go(clampScreen(i, screens.length) - screenRef.current), [go, screens.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const d = arrowDirection(e);
      if (!d) return;
      e.preventDefault();
      go(d === "next" ? 1 : -1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [screenIndex]);

  // ---------------------------------------------------------------- knowledge check
  const runCheck = useCallback(
    async (choice: number) => {
      if (!guided.check) return;
      setChecking(true);
      setCheckError(null);
      const { data, error } = await supabase.rpc("dp_check_guided_answer", { p_lesson_id: lessonId, p_check_id: guided.check.check_id, p_choice: choice });
      setChecking(false);
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setCheckError("We couldn't check that answer just now. Please try again.");
        return;
      }
      setCheckResult({ choice, correct: !!row.correct, feedback: String(row.feedback ?? "") });
      if (!locked) {
        setDraft((d) => ({ ...d, check: { choice, correct: !!row.correct } }));
        scheduleSave();
      }
    },
    [guided.check, locked, lessonId, scheduleSave, supabase]
  );

  // restore the feedback text for an answer chosen earlier (feedback is not stored in the draft)
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !guided.check || draft.check.choice === null) return;
    restored.current = true;
    void runCheck(draft.check.choice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- submit
  const requirements = validateForSubmit(guided, draft);

  async function submit() {
    if (!assignmentId) {
      setSubmitError("This section's practice assignment isn't set up yet. Please tell your instructor.");
      return;
    }
    if (!requirements.ok || locked) return;
    setSubmitting(true);
    setSubmitError(null);
    if (!(await persist())) {
      setSubmitting(false);
      setSubmitError("Your answers could not be saved, so nothing was submitted. Please try again.");
      return;
    }
    const content = buildSubmissionContent(guided, lessonId, lessonTitle, contentVersion, draftRef.current);
    const result = submission
      ? await supabase.from("dp_submissions").update({ status: "revised", content }).eq("id", submission.id)
      : await supabase.from("dp_submissions").insert({ assignment_id: assignmentId, student_id: userId, content });
    setSubmitting(false);
    if (result.error) {
      setSubmitError(result.error.message);
      return;
    }
    setConfirming(false);
    setLocalStatus(submission ? "revised" : "submitted");
    router.refresh();
  }

  // ---------------------------------------------------------------- rendering helpers
  const saveLabel =
    save.kind === "saving" ? "Saving…" :
    save.kind === "dirty" ? "Unsaved changes" :
    save.kind === "error" ? "Not saved" :
    save.at ? `Draft saved ${save.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Draft saved";

  const setAnswer = (id: string, value: string) => {
    setDraft((d) => ({ ...d, answers: { ...d.answers, [id]: value } }));
    scheduleSave();
  };

  const stepNames = ["Teaching", "Questions", "Practice", "Submit"].filter((n) => (n === "Questions" ? !!(guided.check || guided.questions.length) : n === "Practice" ? !!guided.exercise : true));
  const currentStep =
    screen.kind === "opening" || screen.kind === "page" ? "Teaching" : screen.kind === "questions" ? "Questions" : screen.kind === "exercise" ? "Practice" : "Submit";

  const isFirst = screenIndex === 0;
  const isLast = screenIndex === screens.length - 1;
  const nextLabel = screen.kind === "opening" ? "Start" : screen.kind === "page" && screen.index === pageCount - 1 ? (guided.check || guided.questions.length ? "Go to questions" : "Next") : "Next";

  const workbook = resources.length > 0 && (
    <aside className="card p-4 sm:p-5" aria-labelledby="workbook-heading" data-testid="workbook-card">
      <h2 id="workbook-heading" className="font-display text-lg text-burgundy">Workbook &amp; printable pages</h2>
      <ul className="mt-2 space-y-2">
        {resources.map((r) => (
          <li key={r.id}>
            <a href={`/courses/${courseId}/resources/${r.id}`} className="btn-secondary w-full justify-start sm:w-auto" data-testid="resource-download">
              Download: {r.title}{r.version ? ` (${r.version})` : ""} ↓
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-ui text-xs text-charcoal/60">
        Print it, or type in the PDF on your own device. Anything you type in the downloaded PDF stays on your device and is <strong>not</strong> sent to the Hub. To save your work here and send it to your instructor, use the screens in this lesson.
      </p>
    </aside>
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4 sm:px-6" data-testid="guided-flow">
      <header className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/courses/${courseId}`} className="inline-flex min-h-[44px] items-center font-ui text-sm text-charcoal/60 underline">← {courseTitle}</Link>
          <span className="font-ui text-xs uppercase tracking-wide text-charcoal/50">{welcome ? "Start here" : `Section ${position.index} of ${position.total}`}</span>
        </div>
        {!welcome && <ol className="mt-3 flex gap-1.5" aria-label="Lesson steps">
          {stepNames.map((n) => (
            <li key={n} aria-current={n === currentStep ? "step" : undefined} className={`flex-1 rounded-pill px-2 py-1 text-center font-ui text-[0.68rem] font-bold uppercase tracking-wide ${n === currentStep ? "bg-burgundy text-soft" : "bg-burgundy/10 text-burgundy/60"}`}>
              {n}
            </li>
          ))}
        </ol>}
      </header>

      {isStaffPreview && (
        <div role="note" className="mb-4 rounded-card border border-sunrise/40 bg-sunrise/10 p-3 font-ui text-sm text-charcoal/80" data-testid="staff-preview-banner">
          <strong>Instructor preview{lessonStatus !== "published" ? " (draft)" : ""}.</strong> This is what a student sees{lessonStatus !== "published" ? ", but students can't open this lesson yet" : ""}.{welcome ? "" : " Your answers save as your own private draft; submitting creates a real submission under your account."}
        </div>
      )}
      {draftVersionDiffers && (
        <div role="note" className="mb-4 rounded-card border border-gold/50 bg-gold/10 p-3 font-ui text-sm text-charcoal/80">This section was updated after you started. Your earlier answers were kept where the questions are the same.</div>
      )}

      {status && (
        <div role="status" className={`mb-4 rounded-card border p-4 ${status === "returned" ? "border-coral/50 bg-coral/10" : status === "approved" || status === "exempt" ? "border-green-600/30 bg-green-50" : "border-burgundy/20 bg-burgundy/5"}`} data-testid="submission-status" data-status={status}>
          <p className="font-ui text-sm font-bold text-burgundy">{STATUS_COPY[status]}</p>
          {lessonCompleted && <p className="mt-1 font-ui text-xs text-charcoal/70">Your instructor has recorded this section as complete.</p>}
          {feedback.length > 0 && (
            <ul className="mt-2 space-y-2">
              {feedback.map((f) => (
                <li key={f.id} className="rounded-control bg-white/70 p-3 font-body text-sm text-charcoal/85">
                  <span className="block font-ui text-[0.68rem] uppercase tracking-wide text-charcoal/50">Instructor feedback · {new Date(f.created_at).toLocaleDateString()}</span>
                  <span className="whitespace-pre-line">{f.content}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="sr-only" aria-live="polite" role="status">{announce}</p>

      <main>
        {screen.kind === "opening" && (
          <section aria-labelledby="screen-title" data-testid="screen-opening">
            <h1 id="screen-title" ref={headingRef} tabIndex={-1} className="font-display text-3xl leading-tight text-burgundy outline-none sm:text-4xl">{lessonTitle}</h1>
            {guided.intro?.goal && (
              <div className="mt-5">
                <h2 className="font-ui text-xs font-bold uppercase tracking-[0.18em] text-sunrise-dark">Learning goal</h2>
                <p className="mt-1 font-body text-lg leading-relaxed text-charcoal/90">{guided.intro.goal}</p>
              </div>
            )}
            {guided.intro && guided.intro.reading.length > 0 && (
              <div className="mt-5">
                <h2 className="font-ui text-xs font-bold uppercase tracking-[0.18em] text-sunrise-dark">Core Scripture reading</h2>
                <p className="mt-1 font-body text-sm text-charcoal/70">Read these in your own Bible before or alongside the teaching.</p>
                <ul className="mt-2 flex flex-wrap gap-2" data-testid="reading-list">
                  {guided.intro.reading.map((r) => (
                    <li key={r} className="rounded-pill border border-burgundy/20 bg-pale-pink/30 px-3 py-1 font-ui text-sm text-burgundy">{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 rounded-card bg-charcoal/[0.04] p-4 font-ui text-sm text-charcoal/75" data-testid="timing">
              {guided.intro?.timing && <p><strong>Estimated teaching time:</strong> {minutesLabel(guided.intro.timing)}.</p>}
              {guided.exercise?.minutes && <p className="mt-1"><strong>Practice exercise (separate):</strong> {minutesLabel(guided.exercise.minutes)}.</p>}
              <p className="mt-1 text-xs text-charcoal/55">These are estimates — take the time you need. {pageCount} teaching page{pageCount === 1 ? "" : "s"}, then questions and a practice exercise.</p>
            </div>
            <div className="mt-6">{workbook}</div>
          </section>
        )}

        {screen.kind === "page" && (
          <section aria-labelledby="screen-title" data-testid="screen-page">
            <p className="font-ui text-xs font-bold uppercase tracking-[0.18em] text-sunrise-dark" data-testid="page-counter">Page {screen.index + 1} of {pageCount}</p>
            <h1 id="screen-title" ref={headingRef} tabIndex={-1} className="mt-1 font-display text-2xl leading-tight text-burgundy outline-none sm:text-3xl">{guided.pages[screen.index].title}</h1>
            <div className="mt-4 space-y-4 font-body text-[1.08rem] leading-relaxed text-charcoal/90" data-testid="page-body">
              {toParagraphs(guided.pages[screen.index].body).map((p, i) => (
                <p key={i} className="whitespace-pre-line">{p}</p>
              ))}
            </div>
            {welcome && isLast && <div className="mt-6">{workbook}</div>}
          </section>
        )}

        {screen.kind === "questions" && (
          <section aria-labelledby="screen-title" data-testid="screen-questions">
            <h1 id="screen-title" ref={headingRef} tabIndex={-1} className="font-display text-2xl text-burgundy outline-none sm:text-3xl">Questions</h1>
            <p className="mt-1 font-body text-sm text-charcoal/70">Your answers save as a private draft. You can go back to the teaching at any time without losing them.</p>
            <button type="button" onClick={() => goTo(1)} className="mt-1 inline-flex min-h-[44px] items-center font-ui text-sm text-burgundy underline">Review the teaching pages</button>

            {guided.check && (
              <fieldset className="card mt-5 p-4 sm:p-5" disabled={locked} data-testid="knowledge-check">
                <legend className="px-1 font-ui text-xs font-bold uppercase tracking-[0.16em] text-sunrise-dark">Knowledge check</legend>
                <p className="font-body text-base text-charcoal/90">{guided.check.prompt}</p>
                <div className="mt-3 space-y-2">
                  {guided.check.options.map((o, i) => (
                    <label key={i} className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-control border p-3 font-body text-sm ${draft.check.choice === i ? "border-burgundy bg-burgundy/5" : "border-charcoal/15 bg-white"}`}>
                      <input
                        type="radio"
                        name={`check-${guided.check!.check_id}`}
                        checked={draft.check.choice === i}
                        onChange={() => {
                          setCheckResult(null);
                          setDraft((d) => ({ ...d, check: { choice: i, correct: null } }));
                          scheduleSave();
                        }}
                        className="mt-1 h-4 w-4 accent-[#630000]"
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-secondary" disabled={draft.check.choice === null || checking} onClick={() => draft.check.choice !== null && void runCheck(draft.check.choice)} data-testid="check-answer">
                    {checking ? "Checking…" : "Check my answer"}
                  </button>
                </div>
                {checkError && <p role="alert" className="mt-2 font-ui text-sm text-[#7a2c1c]">{checkError}</p>}
                {checkResult && checkResult.choice === draft.check.choice && (
                  <div role="status" className={`mt-3 rounded-control p-3 font-body text-sm ${checkResult.correct ? "bg-green-50 text-green-900" : "bg-sunrise/10 text-charcoal/90"}`} data-testid="check-result" data-correct={checkResult.correct}>
                    <strong>{checkResult.correct ? "That's right." : "Not quite — take another look."}</strong>
                    {checkResult.feedback && <p className="mt-1">{checkResult.feedback}</p>}
                  </div>
                )}
              </fieldset>
            )}

            <div className="mt-5 space-y-5">
              {guided.questions.map((q, i) => {
                const id = `q-${q.question_id}`;
                const value = draft.answers[q.question_id] ?? "";
                return (
                  <div key={q.question_id} data-testid="reflection">
                    <label htmlFor={id} className="block font-body text-base font-semibold text-charcoal">
                      <span className="mr-1 font-ui text-xs font-bold uppercase tracking-wide text-sunrise-dark">Reflection {i + 1}</span>
                      <span className="block">{q.prompt}</span>
                    </label>
                    <textarea
                      id={id}
                      value={value}
                      readOnly={locked}
                      maxLength={MAX_REFLECTION_CHARS}
                      rows={5}
                      onChange={(e) => setAnswer(q.question_id, e.target.value)}
                      onBlur={() => dirtyRef.current && void persist()}
                      className="input mt-2 w-full"
                      aria-describedby={`${id}-count`}
                    />
                    <p id={`${id}-count`} className="mt-1 text-right font-ui text-xs text-charcoal/45">{value.length} / {MAX_REFLECTION_CHARS}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 font-ui text-xs text-charcoal/55">Reflections are personal — they aren't graded automatically. Your instructor reads them when you submit.</p>
          </section>
        )}

        {screen.kind === "exercise" && guided.exercise && (
          <section aria-labelledby="screen-title" data-testid="screen-exercise">
            <p className="font-ui text-xs font-bold uppercase tracking-[0.18em] text-sunrise-dark">Practice exercise{guided.exercise.minutes ? ` · ${minutesLabel(guided.exercise.minutes)}` : ""}</p>
            <h1 id="screen-title" ref={headingRef} tabIndex={-1} className="mt-1 font-display text-2xl text-burgundy outline-none sm:text-3xl">{guided.exercise.title}</h1>
            <ol className="mt-4 list-decimal space-y-3 pl-5 font-body text-base leading-relaxed text-charcoal/90" data-testid="exercise-steps">
              {guided.exercise.steps.map((s, i) => <li key={i} className="pl-1">{s}</li>)}
            </ol>
            <div className="mt-5">
              <label htmlFor="exercise-response" className="block font-body text-base font-semibold text-charcoal">Your response{guided.exercise.response_prompt ? <span className="block font-normal text-charcoal/70">{guided.exercise.response_prompt}</span> : null}</label>
              <textarea
                id="exercise-response"
                value={draft.exercise}
                readOnly={locked}
                maxLength={MAX_EXERCISE_CHARS}
                rows={9}
                onChange={(e) => { setDraft((d) => ({ ...d, exercise: e.target.value })); scheduleSave(); }}
                onBlur={() => dirtyRef.current && void persist()}
                className="input mt-2 w-full"
                data-testid="exercise-response"
              />
              <p className="mt-1 text-right font-ui text-xs text-charcoal/45">{draft.exercise.length} / {MAX_EXERCISE_CHARS}</p>
            </div>
            <div className="mt-4">{workbook}</div>
          </section>
        )}

        {screen.kind === "submit" && (
          <section aria-labelledby="screen-title" data-testid="screen-submit">
            <h1 id="screen-title" ref={headingRef} tabIndex={-1} className="font-display text-2xl text-burgundy outline-none sm:text-3xl">Review &amp; submit</h1>
            <p className="mt-2 font-body text-base text-charcoal/80">Reading to the end doesn't complete this section. When you submit, your answers go to your instructor, who reviews them and records completion.</p>
            <ul className="mt-4 space-y-2 font-ui text-sm" data-testid="requirements">
              {guided.check && <Req ok={draft.check.choice !== null} label="Knowledge check answered" />}
              {guided.questions.map((q, i) => <Req key={q.question_id} ok={!!(draft.answers[q.question_id] ?? "").trim()} label={`Reflection ${i + 1} answered`} />)}
              {guided.exercise && <Req ok={!!draft.exercise.trim()} label="Practice response written" />}
            </ul>

            {locked ? (
              <p className="mt-5 font-body text-sm text-charcoal/70">You've already submitted this section. {status === "submitted" || status === "revised" ? "You'll be able to revise it if your instructor returns it." : ""}</p>
            ) : (
              <div className="mt-5 space-y-3">
                {!requirements.ok && <p className="font-ui text-sm text-[#7a2c1c]" role="status">Still to do: {requirements.missing.join("; ")}.</p>}
                {!assignmentId && <p role="alert" className="font-ui text-sm text-[#7a2c1c]">This section's practice assignment isn't set up yet, so it can't be submitted.</p>}
                {!confirming ? (
                  <button type="button" className="btn-primary" disabled={!requirements.ok || !assignmentId || submitting} onClick={() => setConfirming(true)} data-testid="submit-start">
                    {status === "returned" ? "Resubmit for review" : "Submit for review"}
                  </button>
                ) : (
                  <div className="rounded-card border border-burgundy/25 bg-burgundy/5 p-4" role="alertdialog" aria-labelledby="confirm-title">
                    <p id="confirm-title" className="font-body text-base text-charcoal/90">Send this to your instructor now? You won't be able to change it until it's returned to you.</p>
                    <div className="mt-3 flex gap-3">
                      <button type="button" className="btn-primary" disabled={submitting} onClick={() => void submit()} data-testid="submit-confirm">{submitting ? "Submitting…" : "Yes, submit"}</button>
                      <button type="button" className="btn-secondary" disabled={submitting} onClick={() => setConfirming(false)}>Not yet</button>
                    </div>
                  </div>
                )}
                {submitError && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]" data-testid="submit-error">{submitError}</p>}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {nextLessonId && <Link href={`/courses/${courseId}/lessons/${nextLessonId}`} className="btn-secondary">Go to the next section →</Link>}
              <Link href={`/courses/${courseId}`} className="btn-secondary">Back to the course</Link>
            </div>
            <div className="mt-6">{workbook}</div>
          </section>
        )}
      </main>

      {/* Bottom navigation — always reachable, large touch targets */}
      <nav aria-label="Lesson navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-burgundy/10 bg-soft/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="flow-nav">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <button type="button" className="btn-secondary" onClick={() => go(-1)} disabled={isFirst} aria-label="Back to the previous screen" data-testid="back">← Back</button>
          <div className="min-w-0 flex-1 text-center" role="status" aria-live="polite">
            {!locked && (screen.kind === "questions" || screen.kind === "exercise" || screen.kind === "submit") ? (
              <span className={`font-ui text-xs ${save.kind === "error" ? "font-bold text-[#7a2c1c]" : "text-charcoal/55"}`} data-testid="save-status" data-state={save.kind}>
                {saveLabel}
                {save.kind === "error" && (
                  <button type="button" className="ml-2 underline" onClick={() => void persist()} data-testid="save-retry">Retry</button>
                )}
              </span>
            ) : (
              <span className="font-ui text-xs text-charcoal/55">{screen.kind === "page" ? `Page ${screen.index + 1} of ${pageCount}` : ""}</span>
            )}
          </div>
          {!isLast ? (
            <button type="button" className="btn-primary" onClick={() => go(1)} aria-label="Go to the next screen" data-testid="next">{nextLabel} →</button>
          ) : welcome && nextLessonId ? (
            <Link href={`/courses/${courseId}/lessons/${nextLessonId}`} className="btn-primary" data-testid="welcome-begin">Begin the course →</Link>
          ) : (
            <span className="w-[84px]" aria-hidden="true" />
          )}
        </div>
      </nav>
    </div>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${ok ? "bg-green-600 text-white" : "border border-charcoal/30 text-transparent"}`}>✓</span>
      <span className={ok ? "text-charcoal/80" : "text-charcoal/60"}>{label}<span className="sr-only">{ok ? " — done" : " — not yet"}</span></span>
    </li>
  );
}
