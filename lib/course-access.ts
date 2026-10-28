import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseAccessMode = "open" | "enrolled";
export type LessonStyle = "reflective" | "practical";

export interface CourseSettings {
  accessMode: CourseAccessMode;
  lessonStyle: LessonStyle;
}

const DEFAULT_SETTINGS: CourseSettings = { accessMode: "enrolled", lessonStyle: "reflective" };

/**
 * Reads the per-course access/lesson-style settings (added in migration 0027).
 * Missing settings fail closed. The database still decides authorization.
 */
export async function getCourseSettings(supabase: SupabaseClient, courseId: string): Promise<CourseSettings> {
  const { data, error } = await supabase
    .from("dp_courses")
    .select("access_mode,lesson_style")
    .eq("id", courseId)
    .maybeSingle();
  if (error || !data) return DEFAULT_SETTINGS;
  return {
    accessMode: data.access_mode === "enrolled" ? "enrolled" : "open",
    lessonStyle: data.lesson_style === "practical" ? "practical" : "reflective"
  };
}

/**
 * Route-level guard. This is a UX/defense-in-depth layer; the security boundary
 * is the RLS policy built on dp_can_access_course() (migration 0027), which
 * answers the same question inside the database.
 *
 * The database evaluates staff scope and program membership on every request.
 */
export async function canAccessCourse(
  supabase: SupabaseClient,
  courseId: string,
  settings: CourseSettings,
  isStaff: boolean
): Promise<boolean> {
  // The database decides staff scope and program membership for every course.
  // A global UI role or an open setting cannot bypass this check.
  const { data, error } = await supabase.rpc("dp_can_access_course", { target_course_id: courseId });
  return !error && data === true;
}

/** Raw settings row, or null when the columns don't exist yet (pre-0027 database). */
export async function getCourseSettingsRaw(
  supabase: SupabaseClient,
  courseId: string
): Promise<{ access_mode: string; lesson_style: string } | null> {
  const { data, error } = await supabase.from("dp_courses").select("access_mode,lesson_style").eq("id", courseId).maybeSingle();
  if (error || !data) return null;
  return data as { access_mode: string; lesson_style: string };
}

