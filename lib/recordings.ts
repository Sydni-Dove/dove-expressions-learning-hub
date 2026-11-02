import { makeStorageRef, isStorageRef, parseStorageRef } from "@/lib/storage";

export const RECORDING_BUCKET = "voice-recordings";
export const TESTIMONIAL_BUCKET = "voice-testimonials";
/** Mirrors the bucket limit enforced by Storage (migration 20261029090000). */
export const MAX_RECORDING_MB = 50;
export const MAX_RECORDING_BYTES = MAX_RECORDING_MB * 1024 * 1024;

export const AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const RECORDING_TYPES = [...AUDIO_TYPES, ...VIDEO_TYPES];
const EXTENSIONS = ["mp3", "m4a", "aac", "wav", "webm", "ogg", "mp4", "mov"];

function typeFor(file: { name: string; type: string }) {
  if (file.type) return file.type.toLowerCase();
  return "";
}

/** Returns a plain-language problem, or null when the file may be uploaded. */
export function validateMediaFile(file: { name: string; size: number; type: string }, allowed: string[] = RECORDING_TYPES): string | null {
  if (!file.size) return "That file is empty.";
  if (file.size > MAX_RECORDING_BYTES) return `That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${MAX_RECORDING_MB} MB; trim the recording or share a link instead.`;
  const type = typeFor(file);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowed.includes(type) || !EXTENSIONS.includes(ext)) return "Use an audio or video recording (MP3, M4A, WAV, MP4, MOV or WebM).";
  return null;
}

export function safeFileName(name: string) {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".").replace(/^\.+/, "");
  return clean.slice(-80) || "recording";
}

/** <student>/<assignment>/<time>-<name> — the exact shape the storage policies require. */
export function recordingPath(studentId: string, assignmentId: string, fileName: string, now = Date.now()) {
  return `${studentId}/${assignmentId}/${now}-${safeFileName(fileName)}`;
}

export const recordingRef = (path: string) => makeStorageRef(RECORDING_BUCKET, path);
export const isUploadedRecording = (value: string) => isStorageRef(value) && parseStorageRef(value)?.bucket === RECORDING_BUCKET;
export function isVideoName(value: string) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(value) && !/\.(m4a)(\?|$)/i.test(value);
}
export function recordingLabel(value: string) {
  if (!isUploadedRecording(value)) return "Recording link";
  const file = value.split("/").pop() ?? "";
  return file.replace(/^\d+-/, "") || "Uploaded recording";
}
