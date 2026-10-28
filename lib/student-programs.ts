import { createClient } from "@/lib/supabase/server";

export type StudentProgram = "voice" | "discipleship" | "creative";
const slugMap: Record<string, StudentProgram> = {
  "vocal-coaching": "voice",
  "guided-discipleship-journey": "discipleship",
  "stationery-product-creation-roadmap": "creative"
};

/** Server-side student program memberships. Missing/failed memberships grant nothing. */
export async function getStudentPrograms(userId: string): Promise<StudentProgram[]> {
  const supabase = createClient();
  const { data: enrollments, error } = await supabase.from("dp_enrollments")
    .select("scope_id,scope_type").eq("user_id", userId).eq("status", "active");
  if (error || !enrollments?.length) return [];
  const programIds = enrollments.filter(e => e.scope_type === "program").map(e => e.scope_id);
  const courseIds = enrollments.filter(e => e.scope_type === "course").map(e => e.scope_id);
  if (courseIds.length) {
    const { data: courses } = await supabase.from("dp_courses").select("program_id").in("id",courseIds);
    for (const course of courses ?? []) if (course.program_id) programIds.push(course.program_id);
  }
  if (!programIds.length) return [];
  const { data: programs } = await supabase.from("dp_programs").select("slug").in("id",[...new Set(programIds)]);
  return [...new Set((programs ?? []).map(p => slugMap[p.slug]).filter((p):p is StudentProgram=>Boolean(p)))];
}
