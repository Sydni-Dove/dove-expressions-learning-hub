import { it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createDb } from "./harness";

it("completes the coaching workflow with real RLS for separate student and teacher roles", async () => {
  const { db } = await createDb();
  try {
    // Reuse the exact transaction exercised against Supabase. PGlite's harness
    // represents auth.uid through app.uid rather than Supabase's JWT claims.
    const sql = fs.readFileSync(path.join(__dirname, "voice-coaching.rollback.sql"), "utf8")
      .replace(/select set_config\('request.jwt.claims','\{"sub":"([^"]+)","role":"authenticated"\}',true\);/g,
        "select set_config('app.uid','$1',true); select set_config('app.role','authenticated',true);");
    await db.exec(sql);
    expect((await db.query<{n:number}>("select count(*)::int n from auth.users where email like '%fixture%example.invalid'")).rows[0].n).toBe(0);
  } finally { await db.close(); }
}, 240000);
