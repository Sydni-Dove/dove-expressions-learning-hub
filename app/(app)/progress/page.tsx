import { redirect } from "next/navigation";

// Superseded by the Four Pathways model: this page used to show progress by
// the old Three Pillars (draw_near / hear_god / fulfill_mandate). The
// Discipleship Journey page now covers everything this page did, framed
// around the four pathways instead, so we redirect rather than keep two
// competing "progress" views with different language. Route kept (not
// deleted) so any existing links/bookmarks still land somewhere useful.
export default function ProgressPage() {
  redirect("/discipleship/journey");
}
