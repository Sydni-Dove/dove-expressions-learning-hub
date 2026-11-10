import { TRACK_META, type TrackKey } from "@/lib/voice-curriculum";

/** Post-consultation intake. SEPARATE from skill assessments: it records goals and choices, not ability. It can be completed in Google Forms
 *  and imported later (parseIntakeCsv), or filled in the Hub. It never presumes religious beliefs; the prophetic/tongues questions are not on it. */
export const INTAKE_AREAS = [
  { id: "foundations", label: "Vocal Foundations (breath, pitch, tone, range)", areaKeys: ["posture-breath", "pitch-ear", "tone-resonance", "range", "registers"] },
  { id: "song", label: "Song & Performance (interpretation, confidence, stamina)", areaKeys: ["interpretation", "confidence-mic", "stamina-dynamics"] },
  { id: "harmony", label: "Harmony and blending", areaKeys: ["harmony"] },
  { id: "agility", label: "Agility, riffs and runs", areaKeys: ["agility"] },
  { id: "improv", label: "Improvisation and ad-libbing", areaKeys: ["improvisation"] },
  { id: "worship", label: "Worship leadership basics", areaKeys: ["worship-leading"] }
] as const;

export const INTAKE_QUESTIONS = [
  { id: "goals", text: "What would you most like to get out of voice coaching?", type: "text" },
  { id: "singing_experience", text: "Tell us about your singing experience so far.", type: "text" },
  { id: "styles", text: "What songs or styles do you want to sing?", type: "text" },
  { id: "interest_areas", text: "Which areas would you like to explore? (choose any, or none)", type: "multi", options: INTAKE_AREAS.map((a) => a.label) },
  { id: "creative_worship", text: "Creative Worship Expression is optional. Which, if any, interest you?", type: "multi", options: [...Object.values(TRACK_META).map((t) => t.title), "None of these"] },
  { id: "practice_minutes", text: "About how many minutes a week can you practice?", type: "single", options: ["Under 30", "30–60", "1–2 hours", "More than 2 hours"] },
  { id: "voice_health", text: "Anything about your voice or health we should be careful with?", type: "text" },
  { id: "avoid", text: "Is there anything you would NOT like included in your coaching?", type: "text" },
  { id: "notes", text: "Anything else we should know?", type: "text" }
] as const;

export interface IntakeAnswers { goals?: string; singing_experience?: string; styles?: string; interest_areas?: string[]; creative_worship?: string[]; practice_minutes?: string; voice_health?: string; avoid?: string; notes?: string }

const TRACK_BY_TITLE = new Map<string, TrackKey>(Object.entries(TRACK_META).map(([k, v]) => [v.title.toLowerCase(), k as TrackKey]));
/** Tracks the student ASKED for on the intake. Asking is not approval: the instructor must also approve before a track enters a plan. */
export function requestedTracks(a: IntakeAnswers): TrackKey[] {
  return [...new Set((a.creative_worship ?? []).map((t) => TRACK_BY_TITLE.get(t.trim().toLowerCase())).filter(Boolean) as TrackKey[])];
}
export function interestAreaKeys(a: IntakeAnswers): string[] {
  const picked = new Set((a.interest_areas ?? []).map((s) => s.trim().toLowerCase()));
  return INTAKE_AREAS.filter((i) => picked.has(i.label.toLowerCase())).flatMap((i) => [...i.areaKeys]);
}

/** Minimal RFC-4180 parser (quotes, doubled quotes, newlines in cells). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export interface ImportedIntake { email: string; answers: IntakeAnswers; submittedAt?: string }
/** Google Forms exports one column per question, headed by the question text. Matching is by question text (case-insensitive, ignoring punctuation);
 *  unmatched columns are ignored. Rows without an email are returned in `rejected` for the instructor to fix by hand. */
export function parseIntakeCsv(text: string): { rows: ImportedIntake[]; rejected: { line: number; reason: string }[]; unmatchedColumns: string[] } {
  const grid = parseCsv(text);
  if (grid.length < 2) return { rows: [], rejected: [], unmatchedColumns: [] };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const headers = grid[0].map(norm);
  const emailCol = headers.findIndex((h) => h === "email address" || h === "email");
  const tsCol = headers.findIndex((h) => h === "timestamp");
  const byQ = new Map(INTAKE_QUESTIONS.map((q) => [norm(q.text), q]));
  const cols = headers.map((h, i) => ({ i, q: byQ.get(h) })).filter((c) => c.q);
  const unmatchedColumns = grid[0].filter((_, i) => i !== emailCol && i !== tsCol && !byQ.has(headers[i]));
  const rows: ImportedIntake[] = []; const rejected: { line: number; reason: string }[] = [];
  grid.slice(1).forEach((r, idx) => {
    const email = (r[emailCol] ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { rejected.push({ line: idx + 2, reason: "Missing or invalid email" }); return; }
    const answers: Record<string, unknown> = {};
    for (const { i, q } of cols) {
      const v = (r[i] ?? "").trim(); if (!v || !q) continue;
      answers[q.id] = q.type === "multi" ? v.split(/\s*,\s*(?=[A-Z])|\s*;\s*/).map((s) => s.trim()).filter(Boolean) : v;
    }
    rows.push({ email, answers: answers as IntakeAnswers, submittedAt: tsCol >= 0 ? r[tsCol]?.trim() : undefined });
  });
  return { rows, rejected, unmatchedColumns };
}
