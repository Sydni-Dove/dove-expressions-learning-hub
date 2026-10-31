import { INTAKE_QUESTIONS, parseCsv, requestedTracks, type IntakeAnswers } from "./intake";

/** Google Forms import that does not depend on exact wording: suggest a mapping from similar wording, let the instructor correct and save it,
 *  preview every row, and make repeat imports safe with a stable per-response key. */
export type FieldId = "email" | "timestamp" | (typeof INTAKE_QUESTIONS)[number]["id"];
const HINTS: Record<string, string[]> = {
  goals: ["goals", "get out of", "want from", "hope", "reason for lessons", "why are you here", "what do you want"],
  singing_experience: ["experience", "background", "singing history", "sung before", "training"],
  styles: ["songs", "styles", "genre", "music you", "sing"],
  interest_areas: ["areas", "explore", "focus", "interested in", "topics"],
  creative_worship: ["creative worship", "worship expression", "optional", "tracks", "ad lib", "prophetic"],
  practice_minutes: ["practice", "minutes", "time a week", "how much time", "hours"],
  voice_health: ["health", "careful", "injury", "strain", "medical", "vocal rest"],
  avoid: ["not like included", "avoid", "do not want", "dont want", "exclude", "uncomfortable"],
  notes: ["anything else", "other", "comments", "notes", "additional"]
};
export const IMPORT_FIELDS: { id: FieldId; label: string; hints: string[] }[] = [
  { id: "email", label: "Student email (required)", hints: ["email", "e mail", "email address"] },
  { id: "timestamp", label: "Submitted at", hints: ["timestamp", "submitted", "date"] },
  ...INTAKE_QUESTIONS.map((q) => ({ id: q.id as FieldId, label: q.text, hints: HINTS[q.id] ?? [] }))
];

export const normalizeHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => new Set(normalizeHeader(s).split(" ").filter((t) => t.length > 2 && !["the", "you", "your", "what", "would", "how", "and", "for", "with", "that", "are", "any", "our"].includes(t)));

export type Mapping = Record<string, FieldId | "">; // header -> field ("" = ignore)
export function suggestMapping(headers: string[], saved: Record<string, string> = {}): { mapping: Mapping; source: Record<string, "saved" | "suggested" | "none"> } {
  const mapping: Mapping = {}; const source: Record<string, "saved" | "suggested" | "none"> = {}; const used = new Set<string>();
  const savedNorm = new Map(Object.entries(saved).map(([h, f]) => [normalizeHeader(h), f]));
  for (const h of headers) {
    const s = savedNorm.get(normalizeHeader(h));
    if (s !== undefined && (s === "" || IMPORT_FIELDS.some((f) => f.id === s))) { mapping[h] = s as FieldId | ""; source[h] = "saved"; if (s) used.add(s); }
  }
  const scored: { h: string; f: FieldId; score: number }[] = [];
  for (const h of headers) {
    if (h in mapping) continue;
    const nh = normalizeHeader(h); const th = tokens(h);
    for (const f of IMPORT_FIELDS) {
      let score = 0;
      const q = INTAKE_QUESTIONS.find((x) => x.id === f.id);
      if (q && normalizeHeader(q.text) === nh) score = 1;
      else if (f.id === "email") score = /(^| )e ?mail( |$)/.test(nh) ? 0.95 : 0;
      else if (f.id === "timestamp") score = nh === "timestamp" ? 0.95 : /submitted|timestamp/.test(nh) ? 0.7 : 0;
      else {
        const hint = f.hints.some((x) => nh.includes(normalizeHeader(x))) ? 0.55 : 0;
        const tq = q ? tokens(q.text) : new Set<string>();
        const inter = [...th].filter((t) => tq.has(t)).length; const jac = th.size && tq.size ? inter / (th.size + tq.size - inter) : 0;
        score = Math.max(hint, jac * 1.4);
      }
      if (score >= 0.5) scored.push({ h, f: f.id, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  for (const c of scored) {
    if (c.h in mapping || used.has(c.f)) continue; // each field is taken by its best-scoring header only
    mapping[c.h] = c.f; source[c.h] = "suggested"; used.add(c.f);
  }
  for (const h of headers) if (!(h in mapping)) { mapping[h] = ""; source[h] = "none"; }
  return { mapping, source };
}

/** Option lists can contain commas ("Vocal Foundations (breath, pitch, tone, range)"), so match known options first, then split what is left. */
export function matchOptions(value: string, options: readonly string[]): string[] {
  let rest = value; const found: string[] = [];
  for (const o of [...options].sort((a, b) => b.length - a.length)) { const i = rest.toLowerCase().indexOf(o.toLowerCase()); if (i >= 0) { found.push(o); rest = rest.slice(0, i) + "\u0000" + rest.slice(i + o.length); } }
  const extra = rest.split(/\u0000|;|,/).map((s) => s.trim()).filter(Boolean);
  return [...found, ...extra];
}

export async function importKey(email: string, timestamp: string, answers: unknown): Promise<string> {
  const text = `${email.toLowerCase().trim()}|${timestamp.trim()}|${JSON.stringify(answers, Object.keys(answers as object).sort())}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return "gf-" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

export type RowStatus = "new" | "duplicate" | "not_enrolled" | "invalid";
export interface PreviewRow { line: number; email: string; studentId?: string; status: RowStatus; reason?: string; answers: IntakeAnswers; tracks: ReturnType<typeof requestedTracks>; submittedAt?: string; key?: string }
export interface Preview { headers: string[]; mapping: Mapping; source: Record<string, string>; rows: PreviewRow[]; warnings: string[]; ignoredHeaders: string[]; unmappedFields: string[]; counts: Record<RowStatus, number> }

export async function buildPreview(csv: string, opts: { saved?: Record<string, string>; override?: Mapping; roster: { id: string; email: string | null }[]; existingKeys: Set<string> }): Promise<Preview> {
  const grid = parseCsv(csv);
  const empty: Preview = { headers: [], mapping: {}, source: {}, rows: [], warnings: ["No rows found. Paste the CSV exported from Google Forms, including the header row."], ignoredHeaders: [], unmappedFields: [], counts: { new: 0, duplicate: 0, not_enrolled: 0, invalid: 0 } };
  if (grid.length < 2) return empty;
  const headers = grid[0].map((h) => h.trim());
  const sug = suggestMapping(headers, opts.saved);
  const mapping = { ...sug.mapping, ...(opts.override ?? {}) };
  const col = (f: FieldId) => headers.findIndex((h) => mapping[h] === f);
  const emailCol = col("email"), tsCol = col("timestamp");
  const warnings: string[] = [];
  if (emailCol < 0) warnings.push("No column is mapped to the student's email. Choose one before importing.");
  const ignoredHeaders = headers.filter((h) => !mapping[h]);
  if (ignoredHeaders.length) warnings.push(`${ignoredHeaders.length} column${ignoredHeaders.length === 1 ? " is" : "s are"} not mapped and will be ignored: ${ignoredHeaders.join("; ")}`);
  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const unmappedFields = INTAKE_QUESTIONS.filter((q) => !mappedFields.has(q.id)).map((q) => q.text);
  if (unmappedFields.length) warnings.push(`Intake questions with no matching column (they will be blank): ${unmappedFields.join("; ")}`);
  const seen = new Set<string>(); const rows: PreviewRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]; const email = (row[emailCol] ?? "").trim().toLowerCase();
    const answers: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      const f = mapping[headers[i]]; const v = (row[i] ?? "").trim();
      if (!f || f === "email" || f === "timestamp" || !v) continue;
      const q = INTAKE_QUESTIONS.find((x) => x.id === f)!;
      answers[f] = q.type === "multi" ? matchOptions(v, (q as { options: readonly string[] }).options) : v;
    }
    const base = { line: r + 1, email, answers: answers as IntakeAnswers, tracks: requestedTracks(answers as IntakeAnswers), submittedAt: tsCol >= 0 ? row[tsCol]?.trim() : undefined };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { rows.push({ ...base, status: "invalid", reason: "Missing or invalid email" }); continue; }
    const student = opts.roster.find((s) => s.email?.toLowerCase() === email);
    if (!student) { rows.push({ ...base, status: "not_enrolled", reason: "Not enrolled in Voice" }); continue; }
    const key = await importKey(email, base.submittedAt ?? "", answers);
    if (opts.existingKeys.has(key) || seen.has(key)) { rows.push({ ...base, studentId: student.id, key, status: "duplicate", reason: "Already imported" }); continue; }
    seen.add(key); rows.push({ ...base, studentId: student.id, key, status: "new" });
  }
  const counts = { new: 0, duplicate: 0, not_enrolled: 0, invalid: 0 } as Record<RowStatus, number>;
  for (const r of rows) counts[r.status]++;
  return { headers, mapping, source: sug.source, rows, warnings, ignoredHeaders, unmappedFields, counts };
}
