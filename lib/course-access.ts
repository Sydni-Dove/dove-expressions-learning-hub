import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseAccessMode = "open" | "enrolled";
export type LessonStyle = "reflective" | "practical";

export interface CourseSettings {
  accessMode: CourseAccessMode;
  lessonStyle: LessonStyle;
}

const DEFAULT_SETTINGS: CourseSettings = { accessMode: "open", lessonStyle: "reflective" };

/**
 * Reads the per-course access/lesson-style settings (added in migration 0027).
 * Fails OPEN-and-REFLECTIVE if the columns don't exist yet, so the app keeps
 * behaving exactly as before on a database that hasn't been migrated.
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

/** Pure decision, kept separate so it is unit-testable. */
export function decideCourseAccess(input: {
  accessMode: CourseAccessMode;
  isStaff: boolean;
  hasEnrollment: boolean;
}): boolean {
  if (input.isStaff) return true;
  if (input.accessMode === "open") return true;
  return input.hasEnrollment;
}

/**
 * Route-level guard. This is a UX/defense-in-depth layer; the security boundary
 * is the RLS policy built on dp_can_access_course() (migration 0027), which
 * answers the same question inside the database.
 *
 * Staff roles are checked first (cheap), then the database function decides
 * enrollment — so a future purchase/entitlement flow only has to create an
 * enrollment row; no app code here changes.
 */
export async function canAccessCourse(
  supabase: SupabaseClient,
  courseId: string,
  settings: CourseSettings,
  isStaff: boolean
): Promise<boolean> {
  if (isStaff || settings.accessMode === "open") return true;
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
