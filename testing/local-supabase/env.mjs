// LOCAL TEST CREDENTIALS ONLY. The JWT secret below is a throwaway used by the Docker stack on this machine;
// it has no relation to any real Supabase project and must never be reused anywhere else.
import { createHmac } from "node:crypto";

export const JWT_SECRET = "local-test-only-jwt-secret-at-least-32-characters-long";
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
export function sign(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ iss: "supabase-local", iat: 1700000000, exp: 4102444800, ...payload });
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
export const ANON_KEY = sign({ role: "anon" });
export const SERVICE_KEY = sign({ role: "service_role" });
export const API_URL = "http://localhost:54321";
export const DB_URL = "postgres://postgres:postgres@localhost:54322/postgres";
export const OWNER_ID = "6a2bcb35-e14b-4f1e-a3e6-8fb2c00c4fdb"; // referenced by migration 0020
export const PASSWORD = "Local-test-Passw0rd!";
