/** Browser-side helpers for the practice recording library. No credentials here: uploads go to a short-lived URL the server minted. */
export const RECORDER_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

/** iPhone Safari/PWA records audio/mp4; Chrome/Android record webm. Pick the first type the browser can produce. */
export function pickRecorderType(isSupported: (t: string) => boolean): string | null {
  return RECORDER_TYPES.find((t) => isSupported(t)) ?? null;
}
export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export type UploadResult = { ok: true } | { ok: false; message: string; retryable: boolean };

/** PUT with progress. Network loss or a timeout is retryable; a 4xx from R2 (expired or rejected URL) asks for a fresh URL. */
export function uploadWithProgress(url: string, blob: Blob, contentType: string, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? { ok: true } : { ok: false, message: xhr.status === 403 ? "The upload link expired. Retrying will start a fresh upload." : "The upload was not accepted.", retryable: true });
    xhr.onerror = () => resolve({ ok: false, message: "The connection dropped. Your recording is saved on this device; retry when you are back online.", retryable: true });
    xhr.ontimeout = xhr.onerror;
    xhr.onabort = () => resolve({ ok: false, message: "Upload cancelled.", retryable: true });
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(blob);
  });
}

/* Unsent takes are kept in IndexedDB so a dropped connection, closed tab or phone lock never loses a recording. */
const DB = "dove-voice-pending", STORE = "takes";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "key" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export interface PendingTake { key: string; blob: Blob; contentType: string; durationSeconds: number; label: string; title: string; part: number; assignmentId: string | null; lessonId: string | null; reviseOf: string | null; createdAt: number }
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T>((res, rej) => { const r = fn(db.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  } catch { return null; }
}
export const savePending = (t: PendingTake) => run("readwrite", (s) => s.put(t));
export const removePending = (key: string) => run("readwrite", (s) => s.delete(key));
export const listPending = async (): Promise<PendingTake[]> => ((await run("readonly", (s) => s.getAll())) as PendingTake[] | null) ?? [];
