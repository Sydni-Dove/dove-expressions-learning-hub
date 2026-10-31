import type { SupabaseClient } from "@supabase/supabase-js";

/** Recordings with their feedback, newest first. RLS decides what the caller may see; the filter only narrows. */
export async function loadRecordings(supabase: SupabaseClient, opts: { studentId?: string; status?: string[] } = {}) {
  let q = supabase.from("dp_practice_recordings")
    .select("id,student_id,assignment_id,label,title,part_no,revision_no,status,duration_seconds,created_at,submitted_at,dp_assignments(title)")
    .neq("status", "pending").order("created_at", { ascending: false }).limit(200);
  if (opts.studentId) q = q.eq("student_id", opts.studentId);
  if (opts.status?.length) q = q.in("status", opts.status);
  const { data } = await q;
  const rows = (data ?? []) as any[];
  const ids = rows.map((r) => r.id);
  const fb = ids.length ? (await supabase.from("dp_practice_recording_feedback").select("id,recording_id,kind,body,follow_up,follow_up_assignment_id,created_at").in("recording_id", ids).order("created_at")).data ?? [] : [];
  const names = new Map<string, string>();
  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  if (!opts.studentId && studentIds.length) {
    const { data: people } = await supabase.rpc("dp_program_students", { target_program_slug: "vocal-coaching" });
    for (const p of (people ?? []) as { id?: string; student_id?: string; full_name?: string | null; email?: string | null }[]) names.set(p.id ?? p.student_id ?? "", p.full_name || p.email || "Student");
  }
  return rows.map((r) => ({
    id: r.id, label: r.label, title: r.title, part_no: r.part_no, revision_no: r.revision_no, status: r.status, duration_seconds: r.duration_seconds,
    created_at: r.created_at, submitted_at: r.submitted_at, assignmentTitle: r.dp_assignments?.title ?? null, studentName: names.get(r.student_id),
    feedback: fb.filter((f: any) => f.recording_id === r.id)
  }));
}
