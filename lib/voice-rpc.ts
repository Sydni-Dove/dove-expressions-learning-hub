"use client";
import { createClient } from "@/lib/supabase/client";

/** Calls a database function as the signed-in user (row-level security and the function's own checks decide). Returns a plain-language error. */
export async function callRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const { data, error } = await createClient().rpc(name, args);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    return { ok: true, data: data as T };
  } catch { return { ok: false, error: "You appear to be offline. Try again when you are connected." }; }
}
export function friendlyDbError(m: string) {
  if (/duplicate key|unique/i.test(m)) return "That already exists.";
  if (/row-level security|permission denied/i.test(m)) return "You do not have access to do that.";
  return m.length < 220 ? m : "Something went wrong. Try again.";
}
