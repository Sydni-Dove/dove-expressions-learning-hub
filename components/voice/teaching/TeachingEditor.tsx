"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import SectionList from "./SectionList";
import { StudentLesson } from "./DocView";
import { callRpc } from "@/lib/voice-rpc";
import { createClient } from "@/lib/supabase/client";
import { INSTRUCTOR_TYPES, STUDENT_TYPES, emptyStudentSections, sanitizeContent, type Payload } from "@/lib/voice-teaching/doc";
import { STATUS_HELP, STATUS_LABEL, STATUS_STYLE, type TeachingStatus } from "@/lib/voice-teaching/constants";

type Save = "saved" | "dirty" | "saving" | "error" | "conflict";
type Tab = "student" | "instructor" | "details" | "preview" | "history" | "assign";
export interface EditorTeaching { id: string; key: string; status: TeachingStatus; draft_rev: number; published_rev: number | null; published_version_no: number | null; template: string | null }
const field = "mt-1 block font-normal min-h-[44px] w-full rounded-xl border border-[#630000]/25 bg-white px-3 py-2 text-base text-[#1B1717] focus:outline-none focus:ring-2 focus:ring-[#630000]/40";
const btn = "min-h-[44px] rounded-full px-5 text-sm font-bold disabled:opacity-50";
const REASON: Record<string, string> = { imported: "Imported from the original manuscript", created: "Created", autosave: "Automatic save", saved_version: "Saved version", ready_for_review: "Marked ready for review", returned_to_draft: "Returned to draft", published: "Published", archived: "Archived", unarchived: "Unarchived", before_restore: "Saved before a restore", restored: "Restored" };
const TABS: [Tab, string][] = [["student", "Student lesson"], ["instructor", "Instructor notes"], ["details", "Details"], ["preview", "Preview"], ["history", "History"], ["assign", "Assign"]];

function History({ teachingId, onRestore, editable }: { teachingId: string; onRestore: (id: string) => void; editable: boolean }) {
  const [rows, setRows] = useState<{ id: string; rev_no: number; reason: string; label: string | null; title: string; created_at: string }[] | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => { createClient().from("dp_voice_teaching_revisions").select("id,rev_no,reason,label,title,created_at").eq("teaching_id", teachingId).order("created_at", { ascending: false }).limit(100).then(({ data }) => setRows(data ?? [])); }, [teachingId]);
  if (!rows) return <p className="text-sm">Loading history…</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#4a3a3a]">Earlier versions of this teaching. Restoring copies an earlier version into your draft (your current text is saved first, so you can undo a restore). Published versions that students already have never change.</p>
      <ul className="divide-y divide-[#630000]/10 rounded-2xl border border-[#630000]/15 bg-white">{rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <span className="min-w-0"><span className="block text-sm font-semibold text-[#630000]">{REASON[r.reason] ?? r.reason}{r.label ? ` — ${r.label}` : ""}</span>
            <span className="block truncate text-xs text-[#4a3a3a]">{new Date(r.created_at).toLocaleString("en-US")} · “{r.title}”</span></span>
          {editable && (pick === r.id
            ? <span className="flex gap-2"><button className={`${btn} bg-[#630000] text-white`} onClick={() => { setPick(null); onRestore(r.id); }}>Confirm restore</button><button className={`${btn} border border-[#630000]/30 text-[#630000]`} onClick={() => setPick(null)}>Cancel</button></span>
            : <button className={`${btn} border border-[#630000]/30 text-[#630000]`} onClick={() => setPick(r.id)}>Restore this version</button>)}
        </li>))}</ul>
    </div>);
}

export default function TeachingEditor({ teaching, initial, categories, selected, canPublish, assignSlot }: { teaching: EditorTeaching; initial: Payload; categories: { slug: string; name: string }[]; selected: string[]; canPublish: boolean; assignSlot: ReactNode }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("student");
  const [p, setP] = useState<Payload>(initial); const [cats, setCats] = useState<string[]>(selected);
  const [status, setStatus] = useState<TeachingStatus>(teaching.status); const [rev, setRev] = useState(teaching.draft_rev); const [pubRev, setPubRev] = useState(teaching.published_rev);
  const [pubNo, setPubNo] = useState(teaching.published_version_no);
  const [save, setSave] = useState<Save>("saved"); const [savedAt, setSavedAt] = useState<Date | null>(null); const [err, setErr] = useState("");
  const [epoch, setEpoch] = useState(0); const [confirm, setConfirm] = useState<null | "ready" | "publish" | "archive" | "unarchive" | "draft">(null); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const latest = useRef({ p: initial, cats: selected }); const savedJson = useRef(JSON.stringify({ p: initial, c: selected })); const revRef = useRef(teaching.draft_rev); const seq = useRef(0); const inflight = useRef(false); const dirty = useRef(false); const timer = useRef<ReturnType<typeof setTimeout>>();
  const editable = status !== "archived";

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    if (inflight.current) return false;
    if (!dirty.current) return true;
    inflight.current = true; const sent = seq.current; const sentJson = JSON.stringify({ p: latest.current.p, c: latest.current.cats }); setSave("saving");
    const r = await callRpc<number>("dp_teaching_save", { p_id: teaching.id, p_base_rev: revRef.current, p_payload: latest.current.p, p_categories: latest.current.cats });
    inflight.current = false;
    if (!r.ok) { setErr(r.error); setSave(/another window/i.test(r.error) ? "conflict" : "error"); return false; }
    revRef.current = r.data; setRev(r.data); savedJson.current = sentJson;
    setStatus((s) => (s === "ready_for_review" ? "draft" : s));
    if (seq.current === sent) { dirty.current = false; setSave("saved"); setSavedAt(new Date()); setErr(""); return true; }
    return flush(); // more edits arrived while saving
  }, [teaching.id]);
  const touch = useCallback((np: Payload, nc: string[]) => {
    latest.current = { p: np, cats: nc }; setP(np); setCats(nc);
    if (JSON.stringify({ p: np, c: nc }) === savedJson.current) { dirty.current = false; seq.current++; return; } // identical to what is saved: never write, never flip status
    seq.current++; dirty.current = true;
    setSave((s) => (s === "conflict" ? s : "dirty"));
    if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { void flush(); }, 1200);
  }, [flush]);
  const edit = (patch: Partial<Payload>) => touch({ ...latest.current.p, ...patch }, latest.current.cats);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void flush(); } };
    window.addEventListener("beforeunload", warn); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("keydown", key); if (timer.current) clearTimeout(timer.current); };
  }, [flush]);

  async function reload() {
    const sb = createClient();
    const [{ data: t }, { data: d }, { data: l }, { data: v }] = await Promise.all([
      sb.from("dp_voice_teachings").select("status,draft_rev,published_rev").eq("id", teaching.id).single(),
      sb.from("dp_voice_teaching_drafts").select("title,description,estimated_minutes,objectives,student,instructor").eq("teaching_id", teaching.id).single(),
      sb.from("dp_voice_teaching_category_links").select("dp_voice_teaching_categories(slug)").eq("teaching_id", teaching.id),
      sb.from("dp_voice_teaching_versions").select("version_no").eq("teaching_id", teaching.id).order("version_no", { ascending: false }).limit(1)
    ]);
    if (!t || !d) { setErr("Could not reload. Check your connection."); return; }
    const np: Payload = { title: d.title, description: d.description ?? "", estimated_minutes: d.estimated_minutes, objectives: Array.isArray(d.objectives) ? (d.objectives as string[]) : [], student: sanitizeContent(d.student), instructor: sanitizeContent(d.instructor) };
    const nc = ((l ?? []) as unknown as { dp_voice_teaching_categories: { slug: string } | { slug: string }[] | null }[]).flatMap((x) => (Array.isArray(x.dp_voice_teaching_categories) ? x.dp_voice_teaching_categories : x.dp_voice_teaching_categories ? [x.dp_voice_teaching_categories] : [])).map((c) => c.slug);
    latest.current = { p: np, cats: nc }; savedJson.current = JSON.stringify({ p: np, c: nc }); setP(np); setCats(nc); revRef.current = t.draft_rev; setRev(t.draft_rev); setPubRev(t.published_rev); setStatus(t.status as TeachingStatus);
    setPubNo(v?.[0]?.version_no ?? null); dirty.current = false; seq.current++; setSave("saved"); setErr(""); setEpoch((e) => e + 1);
  }
  async function act(action: "ready" | "draft" | "publish" | "archive" | "unarchive") {
    setConfirm(null); setBusy(true); setMsg(""); setErr("");
    if (!(await flush())) { setBusy(false); return; }
    const r = await callRpc<string>("dp_teaching_status", { p_id: teaching.id, p_action: action });
    if (!r.ok) { setErr(r.error); setBusy(false); return; }
    await reload(); router.refresh(); setBusy(false); // refresh re-reads the server-rendered Assign panel
    setMsg({ ready: "Marked ready for review. It is waiting for your approval and is not visible to students.", draft: "Returned to draft.", publish: "Published. Students can now be assigned this version.", archive: "Archived. Students who already have it keep it.", unarchive: "Unarchived." }[action]);
  }
  async function restore(id: string) {
    setBusy(true); setMsg(""); if (!(await flush())) { setBusy(false); return; }
    const r = await callRpc<number>("dp_teaching_restore", { p_id: teaching.id, p_revision_id: id });
    if (!r.ok) setErr(r.error); else { await reload(); router.refresh(); setMsg("Restored into your draft. Review it, then mark it ready when you are happy."); setTab("student"); }
    setBusy(false);
  }
  async function saveVersion() {
    const label = window.prompt("Name this version (optional), e.g. “Before shortening”"); if (label === null) return;
    if (!(await flush())) return;
    const r = await callRpc("dp_teaching_checkpoint", { p_id: teaching.id, p_label: label }); setMsg(r.ok ? "Version saved to History." : ""); if (!r.ok) setErr(r.error);
  }

  const hasChanges = status === "published" && pubRev !== rev;
  const empties = emptyStudentSections(p.student);
  const indicator = save === "saving" ? ["Saving…", "text-[#4a3a3a]"] : save === "dirty" ? ["Unsaved changes", "text-amber-800"] : save === "error" ? ["Not saved — retrying when you edit again", "text-[#9b1c1c]"] : save === "conflict" ? ["Changed in another window", "text-[#9b1c1c]"] : [savedAt ? `All changes saved ${savedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "All changes saved", "text-emerald-800"];
  const confirmText: Record<string, [string, string]> = {
    ready: ["Mark this teaching ready for review?", "It stays hidden from students until you approve and publish it."],
    draft: ["Return this teaching to draft?", "You can keep editing. It stays hidden from students."],
    publish: [`Approve and publish${pubNo ? ` as version ${pubNo + 1}` : ""}?`, "This makes the student lesson (never your instructor notes) available to assign. Students who already have an earlier version keep exactly that version."],
    archive: ["Archive this teaching?", "It can no longer be assigned. Students who already have it keep it, and all work is preserved."],
    unarchive: ["Unarchive this teaching?", "It returns to Published (if it was published before) or Draft."]
  };
  const switchTab = (t: Tab) => { void flush(); setTab(t); };

  return (
    <div className="teach-ui space-y-4" data-testid="teaching-editor">
      <div className="sticky top-0 z-20 -mx-4 border-b border-[#630000]/15 bg-[#FDFDFD]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[status]}`} data-testid="status-badge">{STATUS_LABEL[status]}</span>
              {hasChanges && <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-900">Unpublished changes</span>}
              {pubNo && <span className="text-xs text-[#4a3a3a]">Published version {pubNo}</span>}</div>
            <p className="mt-1 text-xs text-[#4a3a3a]">{STATUS_HELP[status]}</p></div>
          <div className="flex items-center gap-3"><span role="status" aria-live="polite" data-testid="save-indicator" className={`text-sm font-semibold ${indicator[1]}`}>{indicator[0]}</span>
            <button className={`${btn} border border-[#630000]/30 text-[#630000]`} disabled={save === "saved" || save === "saving" || save === "conflict"} onClick={() => void flush()}>Save now</button></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Workflow">
          {status === "draft" && <button className={`${btn} bg-sky-700 text-white`} disabled={busy} onClick={() => setConfirm("ready")}>Mark ready for review</button>}
          {status === "ready_for_review" && <button className={`${btn} border border-[#630000]/30 text-[#630000]`} disabled={busy} onClick={() => setConfirm("draft")}>Return to draft</button>}
          {(status === "ready_for_review" || hasChanges) && canPublish && <button className={`${btn} bg-[#630000] text-white`} disabled={busy} onClick={() => setConfirm("publish")}>{status === "published" ? "Publish update" : "Approve and publish"}</button>}
          {(status === "ready_for_review" || hasChanges) && !canPublish && <span className="self-center text-xs text-[#4a3a3a]">Only the instructor (faculty or administrator) can approve and publish.</span>}
          {status !== "archived" && canPublish && <button className={`${btn} border border-stone-400 text-stone-700`} disabled={busy} onClick={() => setConfirm("archive")}>Archive</button>}
          {status === "archived" && canPublish && <button className={`${btn} bg-[#630000] text-white`} disabled={busy} onClick={() => setConfirm("unarchive")}>Unarchive</button>}
          <button className={`${btn} border border-[#630000]/30 text-[#630000]`} disabled={busy || !editable} onClick={saveVersion}>Save a named version</button>
        </div>
        {confirm && (
          <div role="alertdialog" aria-label={confirmText[confirm][0]} className="mt-3 rounded-2xl border-2 border-[#630000] bg-[#FBF4F1] p-4">
            <p className="font-bold text-[#630000]">{confirmText[confirm][0]}</p><p className="mt-1 text-sm">{confirmText[confirm][1]}</p>
            {confirm === "publish" && empties.length > 0 && <p role="alert" className="mt-2 text-sm font-semibold text-[#9b1c1c]">These student sections are empty. Fill them in or delete them first: {empties.map((s) => s.title || "Untitled").join(", ")}.</p>}
            <div className="mt-3 flex gap-2"><button className={`${btn} bg-[#630000] text-white`} disabled={confirm === "publish" && empties.length > 0} onClick={() => void act(confirm)}>Yes, continue</button><button className={`${btn} border border-[#630000]/30 text-[#630000]`} onClick={() => setConfirm(null)}>Cancel</button></div>
          </div>)}
        {msg && <p role="status" className="mt-2 text-sm font-semibold text-emerald-800">{msg}</p>}
        {err && <p role="alert" className="mt-2 text-sm font-semibold text-[#9b1c1c]">{err} {save === "conflict" && <button className="underline" onClick={() => void reload()}>Reload the latest version</button>}</p>}
      </div>

      <div role="tablist" aria-label="Teaching sections" className="flex gap-1 overflow-x-auto rounded-2xl bg-[#F2DFD8]/60 p-1">
        {TABS.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} className={`min-h-[44px] shrink-0 rounded-xl px-4 text-sm font-bold ${tab === t ? "bg-[#630000] text-white" : "text-[#630000] hover:bg-white/60"}`} onClick={() => switchTab(t)}>{l}</button>)}
      </div>

      <div key={epoch} role="tabpanel">
        {tab === "student" && (
          <div className="space-y-5">
            <section className="rounded-2xl border border-[#630000]/15 bg-white p-4 sm:p-5">
              <h2 className="font-display text-xl text-[#630000]">Lesson basics</h2><p className="text-xs text-[#4a3a3a]">Students see these at the top of the lesson.</p>
              <label className="mt-3 block text-sm font-semibold text-[#630000]">Title<input className={field} value={p.title} maxLength={200} disabled={!editable} onChange={(e) => edit({ title: e.target.value })} /></label>
              <label className="mt-3 block text-sm font-semibold text-[#630000]">Short description<textarea className={field} rows={3} maxLength={2000} value={p.description} disabled={!editable} onChange={(e) => edit({ description: e.target.value })} /></label>
              <label className="mt-3 block text-sm font-semibold text-[#630000]">Session length (minutes)<input type="number" min={5} max={240} className={`${field} sm:w-40`} value={p.estimated_minutes ?? ""} disabled={!editable} onChange={(e) => edit({ estimated_minutes: e.target.value ? Number(e.target.value) : null })} /></label>
              <fieldset className="mt-3"><legend className="text-sm font-semibold text-[#630000]">Learning objectives</legend>
                {p.objectives.map((o, i) => <div key={i} className="mt-2 flex gap-2"><input aria-label={`Objective ${i + 1}`} className={field} value={o} maxLength={500} disabled={!editable} onChange={(e) => edit({ objectives: p.objectives.map((x, j) => (j === i ? e.target.value : x)) })} />
                  {editable && <button type="button" className="mt-1 min-h-[44px] rounded-xl border border-[#630000]/20 px-3 text-sm font-semibold text-[#630000]" aria-label={`Remove objective ${i + 1}`} onClick={() => edit({ objectives: p.objectives.filter((_, j) => j !== i) })}>Remove</button>}</div>)}
                {editable && <button type="button" className="mt-2 min-h-[44px] rounded-xl border border-[#630000]/20 px-3 text-sm font-semibold text-[#630000]" onClick={() => edit({ objectives: [...p.objectives, ""] })}>+ Add objective</button>}</fieldset>
            </section>
            <div><h2 className="font-display text-xl text-[#630000]">Student lesson</h2><p className="mb-2 text-xs text-[#4a3a3a]">Everything here is shown to students once the teaching is published and assigned to them.</p>
              <SectionList label="student" content={p.student} types={STUDENT_TYPES} editable={editable} onChange={(c) => edit({ student: c })} /></div>
          </div>)}
        {tab === "instructor" && (
          <div className="space-y-3"><p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><strong>Private.</strong> Instructor notes are stored separately and are never published or shown to students, in the lesson, the preview or the data they can request.</p>
            <SectionList label="instructor" content={p.instructor} types={INSTRUCTOR_TYPES} editable={editable} onChange={(c) => edit({ instructor: c })} /></div>)}
        {tab === "details" && (
          <section className="space-y-4 rounded-2xl border border-[#630000]/15 bg-white p-4 sm:p-5">
            <div><h2 className="font-display text-xl text-[#630000]">Categories</h2><p className="text-xs text-[#4a3a3a]">A teaching can sit in more than one category without being copied.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">{categories.map((c) => <label key={c.slug} className="flex min-h-[44px] items-center gap-3 rounded-xl border border-[#630000]/15 px-3"><input type="checkbox" className="h-5 w-5 accent-[#630000]" checked={cats.includes(c.slug)} disabled={!editable} onChange={(e) => touch(latest.current.p, e.target.checked ? [...cats, c.slug] : cats.filter((x) => x !== c.slug))} /><span>{c.name}</span></label>)}</div></div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-[#630000]">Address</dt><dd className="break-all">{teaching.key}</dd></div><div><dt className="font-semibold text-[#630000]">Started from</dt><dd>{teaching.template === "imported" ? "The original manuscript" : teaching.template ?? "A blank page"}</dd></div></dl>
          </section>)}
        {tab === "preview" && (
          <div><p role="note" className="mb-3 rounded-xl bg-[#F2DFD8] p-3 text-sm text-[#630000]"><strong>Student preview.</strong> This is exactly how the lesson looks to a student (instructor notes are not included){status !== "published" ? ". Students cannot see it until you publish and assign it" : hasChanges ? ". It shows your latest edits; students will see them after you publish the update" : ""}.</p>
            <div className="rounded-3xl border border-[#630000]/20 bg-[#FDFDFD] p-4 sm:p-6"><StudentLesson title={p.title} description={p.description} minutes={p.estimated_minutes} objectives={p.objectives} content={p.student} /></div></div>)}
        {tab === "history" && <History teachingId={teaching.id} editable={editable} onRestore={restore} />}
        {tab === "assign" && assignSlot}
      </div>
    </div>
  );
}
