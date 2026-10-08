import { createClient } from "@/lib/supabase/server";
import { getCourseSettingsRaw, canAccessCourse } from "@/lib/course-access";

export async function GET(_request: Request, { params }: { params: { courseId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in to download this worksheet.", { status: 401 });
  const { data: course } = await supabase.from("dp_courses").select("id,title").eq("id", params.courseId).maybeSingle();
  if (!course) return new Response("Course not found.", { status: 404 });
  const raw = await getCourseSettingsRaw(supabase, course.id);
  if (!raw) return new Response("Worksheet temporarily unavailable.", { status: 503 });
  const settings = { accessMode: raw.access_mode === "enrolled" ? "enrolled" as const : "open" as const, lessonStyle: raw.lesson_style === "practical" ? "practical" as const : "reflective" as const };
  // Ask the database to decide access, including assigned staff; do not bypass by role label.
  if (!(await canAccessCourse(supabase, course.id, settings, false))) {
    return new Response("Enrollment is required for this worksheet.", { status: 403 });
  }
  const worksheet = `${course.title}\nApp Objective Worksheet\n\nWorking name:\n\nWhat am I building, in one sentence or short paragraph?\n\nWho is it for?\n\nWhat is the main thing the user should be able to do?\n\nWhat would I need to see working before I can meaningfully evaluate the app?\n\nWhat future requirement do I already know about that could affect how this should be built?\n\nDescribe the central experience\nWhat does the person arrive needing to do?\nWhat do they do inside the app or website?\nWhat should they have when they finish?\n\nIdeas to park for later:\n\nMy next step:\n`;
  return new Response(worksheet, { headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": 'attachment; filename="app-objective-worksheet.txt"',
    "Cache-Control": "private, no-store"
  } });
}
