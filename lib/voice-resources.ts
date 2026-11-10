export type Skill = { id: string; slug: string; name: string; sort_order: number };
export type Exercise = { id: string; skill_id: string; title: string; instructions: string | null; video_url: string | null; source_name: string | null; minutes: number | null; is_active?: boolean };
export type PlanItem = { exercise_id: string; title: string; skill?: string; instructions?: string | null; video_url?: string | null; source_name?: string | null; minutes?: number | null; note?: string | null };
export type Goal = { id: string; student_id?: string; skill_id: string | null; title: string; detail: string | null; target_date: string | null; status: "active" | "achieved" | "paused"; achieved_at?: string | null };
export type GoalUpdate = { id: string; goal_id: string; author_id: string; note: string | null; rating: number | null; created_at: string };
export type TemplateItem = { exercise_id: string; note?: string; minutes?: number };

/** Only https links are ever linked out; anything else renders as plain text. */
export function safeLink(url: string | null | undefined): string | null {
  if (!url || !/^https:\/\/[^\s]+$/i.test(url)) return null;
  try { return new URL(url).href; } catch { return null; }
}
export function linkHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "external site"; }
}

export function groupBySkill(skills: Skill[], exercises: Exercise[]) {
  return [...skills].sort((a, b) => a.sort_order - b.sort_order)
    .map(skill => ({ skill, exercises: exercises.filter(e => e.skill_id === skill.id && e.is_active !== false).sort((a, b) => a.title.localeCompare(b.title)) }))
    .filter(g => g.exercises.length > 0);
}

/** Weekly plan assignments are the ones carrying a snapshot of library exercises. */
export const isWeeklyPlan = (a: { practice_items?: unknown }) => Array.isArray(a.practice_items) && a.practice_items.length > 0;

/** Average rating of the most recent ratings, newest first, to show direction without false precision. */
export function ratingTrend(updates: Pick<GoalUpdate, "rating" | "created_at">[]) {
  const rated = updates.filter(u => u.rating != null).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  if (rated.length < 2) return { latest: rated.at(-1)?.rating ?? null, change: null as number | null, count: rated.length };
  return { latest: rated.at(-1)!.rating!, change: rated.at(-1)!.rating! - rated[0].rating!, count: rated.length };
}
