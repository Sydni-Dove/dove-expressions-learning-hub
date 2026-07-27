import type { SupabaseClient } from "@supabase/supabase-js";
import type { PathwayCode } from "@/lib/types";

export type PathwayStats = {
  publishedCourseCount: number;
  comingSoonCount: number;
  totalLessons: number;
  completedLessons: number;
};

export type PathwayStatus = "Not Started" | "In Progress" | "Completed";

export function statusForStats(s: PathwayStats): PathwayStatus {
  if (s.totalLessons === 0 || s.completedLessons === 0) return "Not Started";
  if (s.completedLessons >= s.totalLessons) return "Completed";
  return "In Progress";
}

/** Shared server-side computation of per-pathway course/lesson progress for a
    given user. Used by the Discipleship home page, each pathway detail page,
    and the personal Discipleship Journey page so the numbers always agree. */
export async function getPathwayProgress(supabase: SupabaseClient<any>, userId: string) {
  const [{ data: pathways }, { data: courses }, { data: modules }, { data: lessons }, { data: progressRows }] = await Promise.all([
    supabase.from("dp_pathways").select("*").order("order_index"),
    supabase
      .from("dp_courses")
      .select("id,title,subtitle,slug,description,pathways,is_published,content_status,content_format,order_index"),
    supabase.from("dp_modules").select("id,course_id"),
    supabase.from("dp_lessons").select("id,module_id,title,status").eq("status", "published"),
    supabase.from("dp_lesson_progress").select("lesson_id,status").eq("user_id", userId)
  ]);

  const moduleToCourse = new Map((modules ?? []).map((m: any) => [m.id, m.course_id]));
  const lessonsByCourse = new Map<string, { id: string; title: string }[]>();
  for (const l of lessons ?? []) {
    const courseId = moduleToCourse.get(l.module_id);
    if (!courseId) continue;
    if (!lessonsByCourse.has(courseId)) lessonsByCourse.set(courseId, []);
    lessonsByCourse.get(courseId)!.push({ id: l.id, title: l.title });
  }

  const completedIds = new Set((progressRows ?? []).filter((p: any) => p.status === "completed").map((p: any) => p.lesson_id));
  const inProgressIds = new Set((progressRows ?? []).filter((p: any) => p.status === "in_progress").map((p: any) => p.lesson_id));

  const stats: Record<string, PathwayStats> = {};
  for (const p of pathways ?? []) stats[p.code] = { publishedCourseCount: 0, comingSoonCount: 0, totalLessons: 0, completedLessons: 0 };

  for (const c of courses ?? []) {
    for (const code of (c.pathways ?? []) as PathwayCode[]) {
      if (!stats[code]) continue;
      // Archived content is excluded from both "available" and "coming soon" counts —
      // it's no longer active, not upcoming. Confirmed via QA review round 2.
      if (c.content_status === "archived") continue;
      if (c.is_published) {
        stats[code].publishedCourseCount += 1;
        const courseLessons = lessonsByCourse.get(c.id) ?? [];
        stats[code].totalLessons += courseLessons.length;
        stats[code].completedLessons += courseLessons.filter((l) => completedIds.has(l.id)).length;
      } else if (c.content_status === "coming_soon") {
        stats[code].comingSoonCount += 1;
      }
    }
  }

  const courseProgress = (courses ?? []).map((c: any) => {
    const courseLessons = lessonsByCourse.get(c.id) ?? [];
    const completed = courseLessons.filter((l) => completedIds.has(l.id)).length;
    const percent = courseLessons.length ? Math.round((completed / courseLessons.length) * 100) : 0;
    return { ...c, totalLessons: courseLessons.length, completedLessons: completed, percent };
  });

  return { pathways: pathways ?? [], courses: courseProgress, lessonsByCourse, completedIds, inProgressIds, stats };
}
