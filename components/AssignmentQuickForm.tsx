"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AssignmentRow {
  id: string; title: string; description?: string | null; assignment_type: string;
  due_at: string | null; assigned_to_user_id?: string | null;
  song?: string | null; goal?: string | null; pacing?: string | null; practice_steps?: string[];
}
const TYPES = ["written", "reflection", "scripture_study", "checklist", "file", "voice_memo", "project", "discussion", "testimony", "quiz"];
export default function AssignmentQuickForm({ lessonId, courseId, assignments }: {
  lessonId: string; courseId: string; assignments: AssignmentRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AssignmentRow | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("voice_memo");
  const [dueAt, setDueAt] = useState("");
  const [student, setStudent] = useState("");
  const [song, setSong] = useState("");
  const [goal, setGoal] = useState("");
  const [pacing, setPacing] = useState("");
  const [steps, setSteps] = useState("");
  const [students, setStudents] = useState<{id:string;full_name:string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    createClient().rpc("dp_course_students", {target_course_id:courseId}).then(({data,error}) => {
      if (!active) return;
      if (error) setError("The enrolled student list could not be loaded.");
      else setStudents(data ?? []);
    });
    return () => { active = false; };
  }, [courseId]);
  function edit(a: AssignmentRow | null) {
    setEditing(a); setTitle(a?.title ?? ""); setDescription(a?.description ?? "");
    setType(a?.assignment_type ?? "voice_memo"); setDueAt(a?.due_at?.slice(0,10) ?? "");
    setStudent(a?.assigned_to_user_id ?? ""); setSong(a?.song ?? ""); setGoal(a?.goal ?? "");
    setPacing(a?.pacing ?? ""); setSteps(a?.practice_steps?.join("\n") ?? ""); setOpen(true); setError("");
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const supabase = createClient();
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) throw Error("Please sign in again.");
      const values = { lesson_id:lessonId, course_id:courseId, title:title.trim(), description:description.trim(),
        assignment_type:type, due_at:dueAt ? `${dueAt}T23:59:59Z` : null, assigned_to_user_id:student || null,
        song:song.trim(), goal:goal.trim(), pacing:pacing.trim(), practice_steps:steps.split("\n").map(s=>s.trim()).filter(Boolean) };
      const result = editing ? await supabase.from("dp_assignments").update(values).eq("id",editing.id).select("id").single()
        : await supabase.from("dp_assignments").insert({...values,created_by:user.id}).select("id").single();
      if (result.error) throw result.error;
      setOpen(false); router.refresh();
    } catch(e) { setError((e as {message?:string}).message ?? "Could not save assignment."); }
    finally { setSaving(false); }
  }
  return <div className="space-y-3">
    {assignments.map(a=><div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4"><span className="font-body text-sm">{a.title}</span><button className="btn-secondary" onClick={()=>edit(a)}>Personalize assignment</button></div>)}
    {!open ? <button className="btn-secondary" onClick={()=>edit(null)}>+ Assign practice</button> : <form onSubmit={save} className="card space-y-3 p-5">
      <h3 className="font-display text-xl text-burgundy">{editing ? "Personalize practice" : "Assign practice"}</h3>
      <p className="font-body text-sm">Use the curriculum as a starting point. Choose the song, goals, exercises and pace for this student. Draft lessons remain unavailable to students until you publish them.</p>
      <label className="block font-ui text-sm">Student<select value={student} onChange={e=>setStudent(e.target.value)} className="input mt-1 w-full"><option value="">Everyone enrolled in this course or program</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name || s.id}</option>)}</select></label>
      <label className="block font-ui text-sm">Title<input required value={title} onChange={e=>setTitle(e.target.value)} className="input mt-1 w-full"/></label>
      <label className="block font-ui text-sm">Practice instructions<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="input mt-1 w-full"/></label>
      <label className="block font-ui text-sm">Song<input value={song} onChange={e=>setSong(e.target.value)} className="input mt-1 w-full"/></label>
      <label className="block font-ui text-sm">Personal goal<input value={goal} onChange={e=>setGoal(e.target.value)} className="input mt-1 w-full"/></label>
      <label className="block font-ui text-sm">Practice pace<input value={pacing} onChange={e=>setPacing(e.target.value)} placeholder="For example: 10 minutes, three days this week" className="input mt-1 w-full"/></label>
      <label className="block font-ui text-sm">Guided practice steps (one per line)<textarea value={steps} onChange={e=>setSteps(e.target.value)} rows={4} className="input mt-1 w-full"/></label>
      <label className="block font-ui text-sm">Response format<select value={type} onChange={e=>setType(e.target.value)} className="input mt-1 block">{TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g," ")}</option>)}</select></label>
      <label className="block font-ui text-sm">Target date (optional)<input type="date" value={dueAt} onChange={e=>setDueAt(e.target.value)} className="input mt-1 block"/></label>
      {error && <p role="alert" className="text-sm text-burgundy">{error}</p>}
      <div className="flex gap-3"><button disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save assignment"}</button><button type="button" disabled={saving} onClick={()=>setOpen(false)} className="btn-secondary">Cancel</button></div>
    </form>}
  </div>;
}
