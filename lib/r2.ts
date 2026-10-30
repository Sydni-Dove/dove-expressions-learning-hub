import { createHash, createHmac } from "node:crypto";

/**
 * Minimal Cloudflare R2 (S3-compatible) presigner. Server-only: it reads the access keys from the environment and
 * returns short-lived URLs; the keys themselves never leave the server and are never sent to a browser.
 * No SDK dependency — SigV4 query signing is small and fully unit-tested.
 */
export interface R2Config { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; endpoint: string }

/** Limits are configurable through env vars and fall back to the documented defaults. */
export function recordingLimits(env: Record<string, string | undefined> = process.env) {
  const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
  return {
    maxBytes: num(env.RECORDING_MAX_MB, 50) * 1024 * 1024,
    recommendedMinMinutes: num(env.RECORDING_RECOMMENDED_MIN_MINUTES, 3),
    recommendedMinutes: num(env.RECORDING_RECOMMENDED_MINUTES, 5),
    warnMinutes: num(env.RECORDING_WARN_MINUTES, 8),
    maxMinutes: num(env.RECORDING_MAX_MINUTES, 15),
    maxPartsPerAssignment: num(env.RECORDING_MAX_PARTS, 10),
    uploadUrlSeconds: num(env.RECORDING_UPLOAD_URL_SECONDS, 600),
    playbackUrlSeconds: num(env.RECORDING_PLAYBACK_URL_SECONDS, 900),
    pendingExpiryHours: num(env.RECORDING_PENDING_EXPIRY_HOURS, 24)
  };
}

export function r2Config(env: Record<string, string | undefined> = process.env): R2Config | null {
  const { R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket } = env;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint: env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com` };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s).digest();
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const encPath = (key: string) => key.split("/").map(enc).join("/");

export function presign(cfg: R2Config, method: "GET" | "PUT" | "DELETE" | "HEAD", key: string, expiresIn: number, opts: { now?: Date; contentType?: string } = {}) {
  if (expiresIn < 1 || expiresIn > 3600) throw new Error("R2 URLs must live between 1 second and 1 hour");
  const now = opts.now ?? new Date();
  const amz = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const date = amz.slice(0, 8);
  const host = new URL(cfg.endpoint).host;
  const scope = `${date}/auto/s3/aws4_request`;
  const signedHeaders = opts.contentType ? "content-type;host" : "host";
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKeyId}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders
  };
  const canonicalQuery = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join("&");
  const path = `/${enc(cfg.bucket)}/${encPath(key)}`;
  const headers = (opts.contentType ? `content-type:${opts.contentType}\n` : "") + `host:${host}\n`;
  const canonical = [method, path, canonicalQuery, headers, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amz, scope, sha256(canonical)].join("\n");
  const kDate = hmac("AWS4" + cfg.secretAccessKey, date);
  const signature = createHmac("sha256", hmac(hmac(hmac(kDate, "auto"), "s3"), "aws4_request")).update(toSign).digest("hex");
  return `${cfg.endpoint}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Object key: <student>/<assignment|general>/<recording id>.<ext>. The id comes from the database row, so a key is never reused. */
export function recordingKey(studentId: string, assignmentId: string | null, recordingId: string, ext: string) {
  return `voice/${studentId}/${assignmentId ?? "general"}/${recordingId}.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;
}

export const EXT_BY_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/aac": "aac", "audio/wav": "wav", "audio/x-wav": "wav",
  "audio/webm": "webm", "audio/ogg": "ogg", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm"
};
export function checkUpload(input: { contentType: string; size: number; durationSeconds?: number }, limits = recordingLimits()): string | null {
  const type = input.contentType.split(";")[0].trim().toLowerCase();
  if (!EXT_BY_TYPE[type]) return "Use an audio or video recording (MP3, M4A, WAV, MP4, MOV or WebM).";
  if (!(input.size > 0)) return "That file is empty.";
  if (input.size > limits.maxBytes) return `That file is larger than ${Math.round(limits.maxBytes / 1048576)} MB. Record a shorter part instead.`;
  if (input.durationSeconds && input.durationSeconds > limits.maxMinutes * 60) return `Recordings can be at most ${limits.maxMinutes} minutes. Split it into numbered parts.`;
  return null;
}
export type DurationAdvice = "ok" | "long" | "too_long";
export function durationAdvice(seconds: number, limits = recordingLimits()): DurationAdvice {
  if (seconds > limits.maxMinutes * 60) return "too_long";
  if (seconds > limits.warnMinutes * 60) return "long";
  return "ok";
}
