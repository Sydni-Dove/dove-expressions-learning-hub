import { z } from "zod";

/**
 * My Build is intentionally text + URLs only. Students must never store
 * credentials here, so URLs are restricted to plain http(s) with no embedded
 * user:password, and free-text fields are screened for things that look like
 * API keys / tokens / passwords before they are saved.
 */

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/, // OpenAI/Anthropic-style secret keys
  /\bsk_(live|test)_[A-Za-z0-9]{10,}/, // Stripe
  /\bgh[pousr]_[A-Za-z0-9]{20,}/, // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/, // JWT
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/, // Slack
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(password|passwd|pwd|api[_ -]?key|secret|token)\s*[:=]\s*\S{6,}/i
];

export function looksLikeSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

export const SECRET_WARNING =
  "That looks like a password, API key, or token. Please remove it — My Build is only for notes and links, never credentials.";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .refine((v) => !looksLikeSecret(v), SECRET_WARNING);

const optionalUrl = z
  .string()
  .trim()
  .max(500, "That link is too long.")
  .refine((v) => v === "" || isSafeHttpUrl(v), "Use a full link starting with http:// or https:// (no username or password in it).")
  .refine((v) => !looksLikeSecret(v), SECRET_WARNING);

export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && !u.username && !u.password;
  } catch {
    return false;
  }
}

export const buildSchema = z.object({
  app_name: optionalText(120),
  building_what: optionalText(1000),
  audience: optionalText(1000),
  central_action: optionalText(1000),
  repo_url: optionalUrl,
  preview_url: optionalUrl,
  live_url: optionalUrl,
  strategist_tool: optionalText(120),
  developer_tool: optionalText(120),
  evaluator_tool: optionalText(120),
  current_focus: optionalText(2000),
  notes: optionalText(8000),
  parked_ideas: optionalText(4000)
});

export type BuildFields = z.infer<typeof buildSchema>;

export const EMPTY_BUILD: BuildFields = {
  app_name: "",
  building_what: "",
  audience: "",
  central_action: "",
  repo_url: "",
  preview_url: "",
  live_url: "",
  strategist_tool: "",
  developer_tool: "",
  evaluator_tool: "",
  current_focus: "",
  notes: "",
  parked_ideas: ""
};

/** Returns { fields } on success or { errors: { field: message } } on failure. */
export function validateBuild(input: Partial<BuildFields>):
  | { ok: true; fields: BuildFields }
  | { ok: false; errors: Partial<Record<keyof BuildFields, string>> } {
  const result = buildSchema.safeParse({ ...EMPTY_BUILD, ...input });
  if (result.success) return { ok: true, fields: result.data };
  const errors: Partial<Record<keyof BuildFields, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof BuildFields;
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
