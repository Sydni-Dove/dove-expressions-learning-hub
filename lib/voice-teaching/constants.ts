export const AREA_TITLE = "Worship Development";
export const AREA_DESCRIPTION = "Instructor-led, Scripture-based teachings for students who serve or want to serve in praise and worship ministry. Written and approved by the instructor in the Teaching Editor; assigned one at a time. Nothing is assigned automatically.";
export type TeachingStatus = "draft" | "ready_for_review" | "published" | "archived";
export const STATUS_LABEL: Record<TeachingStatus, string> = { draft: "Draft", ready_for_review: "Ready for review", published: "Published", archived: "Archived" };
export const STATUS_HELP: Record<TeachingStatus, string> = {
  draft: "Editable. Not available to students.",
  ready_for_review: "Completed and waiting for your approval. Not available to students.",
  published: "Approved. Can be assigned to students.",
  archived: "No longer assignable. Students who already have it keep it."
};
export const STATUS_STYLE: Record<TeachingStatus, string> = {
  draft: "bg-amber-100 text-amber-900", ready_for_review: "bg-sky-100 text-sky-900", published: "bg-emerald-100 text-emerald-900", archived: "bg-stone-200 text-stone-700"
};
