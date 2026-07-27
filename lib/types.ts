export type DpRole = "super_admin" | "faculty" | "teacher" | "mentor" | "student" | "guest";

export type LearningAreaKey = "discipleship_hub" | "creative_studio";

export interface LearningArea {
  id: string;
  area_key: LearningAreaKey;
  name: string;
  tagline: string | null;
  description: string | null;
  accent_color: string | null;
}

export interface Program {
  id: string;
  area_id: string;
  name: string;
  slug: string;
  description: string | null;
  phase_structure: Record<string, unknown>;
}

export type PathwayCode = "draw_near" | "hear_god" | "rooted" | "kingdom_mandate";

export type ContentStatus = "draft" | "published" | "scheduled" | "archived" | "coming_soon";

export interface Pathway {
  id: string;
  code: PathwayCode;
  name: string;
  subtitle: string | null;
  description: string | null;
  purpose: string | null;
  expected_outcomes: string[];
  scripture_ref: string | null;
  order_index: number;
  journey_order_index: number;
  accent_color: string | null;
  icon_key: string | null;
  status: ContentStatus;
  created_at: string;
}

export interface Course {
  id: string;
  area_id: string;
  program_id: string | null;
  title: string;
  subtitle: string | null;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  pillar: string | null;
  pathways: PathwayCode[];
  content_format: "course" | "series";
  difficulty_level: "foundational" | "growing" | "deepening" | null;
  estimated_duration: string | null;
  scripture_refs: string[];
  content_status: ContentStatus;
  order_index: number;
  is_published: boolean;
  is_standalone: boolean;
}

export interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
}

export interface LessonRow {
  id: string;
  module_id: string;
  title: string;
  subtitle: string | null;
  slug: string | null;
  status: "draft" | "scheduled" | "published";
  content_status: ContentStatus;
  pathways: PathwayCode[];
  estimated_duration_minutes: number | null;
  order_index: number;
}

export interface LessonReflection {
  id: string;
  lesson_id: string;
  student_id: string;
  what_learned: string | null;
  what_god_highlighting: string | null;
  belief_or_pattern_to_change: string | null;
  response_action: string | null;
  prayer_response: string | null;
  scripture_to_meditate: string | null;
  practical_next_step: string | null;
  follow_up_date: string | null;
  private_notes: string | null;
  shared_with_mentor: boolean;
  created_at: string;
  updated_at: string;
}

export interface LessonBlock {
  id: string;
  lesson_id: string;
  block_type: string;
  order_index: number;
  content: Record<string, unknown>;
}

/** content shape for block_type "lesson_media" — the primary Video/Audio/Transcript
    media card at the top of a lesson. Any field may be empty/omitted; the viewer
    renders honest empty states rather than fake players when media isn't uploaded yet. */
export interface LessonMediaContent {
  video_url?: string;
  video_provider?: "youtube" | "vimeo" | string;
  audio_url?: string;
  poster_eyebrow?: string;
  overview_heading?: string;
  overview_duration_label?: string;
  overview_summary?: string;
  overview_points?: string[];
  transcript?: { time: string; text: string }[];
}

/** content shape for block_type "teaching_section" — one section of the teaching flow
    (Introduction, etc). Scripture references are denormalized (full text + note stored
    inline) so the Scripture drawer never needs a second lookup table. */
export interface ScriptureRef {
  key: string;
  reference: string;
  text: string;
  note?: string;
}

export interface TeachingSectionContent {
  anchor: string;
  section_number?: string;
  heading: string;
  paragraphs: string[];
  scripture_refs?: ScriptureRef[];
  quote?: string;
  takeaway?: string;
}

/** content shape for block_type "takeaways" — the Key Takeaways recap grid. */
export interface TakeawaysContent {
  items: { heading: string; body: string }[];
}

export interface LessonBookmark {
  id: string;
  user_id: string;
  lesson_id: string;
  created_at: string;
}

export interface WiringCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scriptures: string[];
  strengths: string[];
  blind_spots: string[];
  recommended_practices: string[];
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  section: string | null;
  prompt: string;
  question_type: "multiple_choice" | "rating_scale" | "scenario" | "short_response";
  options: string[];
  is_required: boolean;
  order_index: number;
}

export interface DiscipleshipPlan {
  id: string;
  student_id: string;
  current_season: string | null;
  mentor_notes: string | null;
  review_date: string | null;
  status: "active" | "completed" | "continuing";
  version: number;
}

export interface Goal {
  id: string;
  plan_id: string;
  title: string;
  pillar: string | null;
  pathways: PathwayCode[];
  reason: string | null;
  starting_condition: string | null;
  desired_growth: string | null;
  scriptures: string[];
  status: "active" | "completed" | "continuing";
}

export interface ActionStep {
  id: string;
  goal_id: string | null;
  plan_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "completed";
}

export interface DpNote {
  id: string;
  author_id: string;
  title: string | null;
  body: string | null;
  note_kind: "personal" | "journal" | "shared" | "folder";
  tags: string[];
  pathways: PathwayCode[];
  visibility: "private" | "mentor" | "teacher" | "cohort" | "selected_students" | "community";
  save_status: "saving" | "saved" | "failed" | "offline";
  is_pinned: boolean;
  updated_at: string;
}

export interface CreativeProject {
  id: string;
  student_id: string;
  product_name: string;
  product_type: string | null;
  current_phase: string;
  progress_percent: number;
  specifications: Record<string, unknown>;
  estimated_cost: number | null;
  selling_price: number | null;
  canva_link: string | null;
  recommended_from_discipleship: boolean;
}
