/** Worship Development teachings: instructor-led, Scripture-based lessons for vocal students who serve or want to serve in praise and worship ministry.
 *  They are teaching resources, NOT intake forms or assessments, and they are kept separate from technical vocal instruction.
 *  Scripture is paraphrased (read it in your own Bible); the song "Praise Is What I Do" is a thematic reference only and no lyrics are reproduced. */
export interface ScriptureNote { ref: string; paraphrase: string; context: string }
export interface Point { heading: string; body: string[]; example?: string }
export interface Activity { title: string; setup: string; steps: string[]; debrief: string[] }
export interface Assignment { title: string; summary: string; steps: string[]; minutes: number }
export interface StudentContent {
  intro: string[];
  points: Point[];
  /** A longer featured subsection (Module 3: "Gifted but Still Growing"). */
  featured?: { title: string; coreStatement?: string; sections: Point[] };
  /** A section for praise team leaders and mentors (Module 3). */
  leaders?: { title: string; sections: Point[] };
  discussion: string[];
  activity: Activity;
  reflection: string[];
  assignment: Assignment;
  application: string[];
}
export interface InstructorNotes {
  overview: string[];
  timing: { minutes: number; segment: string }[];
  notes: Point[];
  facilitation: string[];
  cautions: string[];
  /** Detailed notes for any featured subsection or leaders section. */
  featuredNotes?: Point[];
  leaderNotes?: Point[];
}
export interface TeachingModule {
  key: string; number: number; title: string; mainMessage: string; summary: string; estimatedMinutes: number;
  objectives: string[]; scriptures: ScriptureNote[];
  student: StudentContent; instructor: InstructorNotes;
}
export const AREA_TITLE = "Worship Development";
export const AREA_DESCRIPTION = "Instructor-led, Scripture-based teachings for students who serve or want to serve in praise and worship ministry. They develop the person alongside the voice and are kept separate from technical vocal instruction. Assigned one at a time by the instructor; nothing here is assigned automatically.";
