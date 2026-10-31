import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createBareDb } from "./harness";
import { diff, isEmptyDiff, snapshot, type Snapshot } from "./snapshot";
import { VOICE_MIGRATIONS, planAll } from "../../scripts/generate-rollbacks";

const rollbackFile = (m: string) => path.join(__dirname, "../../supabase/rollback", m.replace(/\.sql$/, ".rollback.sql"));

describe("migration rollback scripts", () => {
  it("each rollback restores the exact schema, policies, triggers, functions, ACLs and row counts from before its migration; re-applying works", async () => {
    const { db, files, apply } = await createBareDb();
    for (const f of files.filter((f) => !VOICE_MIGRATIONS.includes(f))) await apply(f);
    // Data that existed before the Voice release and must survive it untouched.
    await db.exec(`insert into dp_assignments(title,description) values ('Pre-existing homework','created before the release')`);
    const snaps: Snapshot[] = [await snapshot(db)];
    for (const m of VOICE_MIGRATIONS) { await apply(m); snaps.push(await snapshot(db)); }

    // An instructor edits one of the draft lesson blocks the migration inserted; rolling back must keep their edit.
    const edited = (await db.query<any>(`update dp_lesson_blocks set content=content||'{"edited_by_instructor":true}'::jsonb where id=(select b.id from dp_lesson_blocks b join dp_lessons l on l.id=b.lesson_id where l.slug='voice-breath-posture' and b.block_type='teaching_section' limit 1) returning id`)).rows[0];
    expect(edited?.id).toBeTruthy();
    const blocksAfterEdit = (await db.query<any>(`select count(*)::int c from dp_lesson_blocks`)).rows[0].c;

    expect(fs.readFileSync(rollbackFile(VOICE_MIGRATIONS[1]), "utf8")).toMatch(/\(values \('voice-evaluation-goals'/); // the draft-content rollback really lists the inserted blocks
    for (let i = VOICE_MIGRATIONS.length; i >= 1; i--) {
      const m = VOICE_MIGRATIONS[i - 1];
      const sql = fs.readFileSync(rollbackFile(m), "utf8");
      expect(sql, `${m} needs a manual step`).not.toMatch(/MANUAL STEPS NEEDED/);
      await db.exec(sql);
      const now = await snapshot(db);
      const d = diff(snaps[i - 1], now);
      if (m.startsWith("20261029100000") || m.startsWith("20261029090000")) d.rowsChanged = d.rowsChanged.filter((r) => !r.startsWith("public.dp_lesson_blocks")); // the edited block is kept on purpose
      const leftover = Object.fromEntries(Object.entries(d).filter(([, v]) => v.length));
      expect(leftover, `after rolling back ${m}`).toEqual({});
      expect(d, `after rolling back ${m}`).toEqual(Object.fromEntries(Object.keys(d).map((k) => [k, []])));
    }
    // Pre-existing data and the instructor's edit survived the whole release + rollback.
    expect((await db.query<any>(`select count(*)::int c from dp_assignments where title='Pre-existing homework'`)).rows[0].c).toBe(1);
    expect((await db.query<any>(`select count(*)::int c from dp_lesson_blocks where id='${edited.id}' and content->>'edited_by_instructor'='true'`)).rows[0].c).toBe(1);
    expect(blocksAfterEdit).toBeGreaterThan((await db.query<any>(`select count(*)::int c from dp_lesson_blocks`)).rows[0].c);

    // Recovery: after a full rollback the migrations can be applied again and give the same result as the first time.
    for (const m of VOICE_MIGRATIONS) await apply(m);
    const again = await snapshot(db);
    const d2 = diff(snaps[snaps.length - 1], again);
    d2.rowsChanged = d2.rowsChanged.filter((r) => r.startsWith("public.dp_lesson_blocks")); // a kept edited block means the draft insert skipped that lesson
    expect(d2.tablesAdded.concat(d2.tablesRemoved, d2.columnsAdded, d2.columnsRemoved, d2.functionsAdded, d2.functionsRemoved, d2.functionsChanged, d2.policiesAdded, d2.policiesRemoved, d2.policiesChanged, d2.triggersAdded, d2.triggersRemoved, d2.constraintsAdded, d2.constraintsRemoved, d2.constraintsChanged)).toEqual([]);
    await db.close();
  }, 600000);

  it("the committed rollback scripts match what the generator produces now (no hand edits, no drift)", async () => {
    const { db, results } = await planAll();
    for (const r of results) expect(fs.readFileSync(rollbackFile(r.file), "utf8"), r.file).toBe(r.sql);
    await db.close();
  }, 600000);

  it("rolling back only the newest migrations leaves the earlier ones working (partial rollback)", async () => {
    const { db, files, apply } = await createBareDb();
    for (const f of files) await apply(f);
    for (const m of [...VOICE_MIGRATIONS].reverse().slice(0, 3)) await db.exec(fs.readFileSync(rollbackFile(m), "utf8"));
    // 20261030090000 recordings and earlier remain
    expect((await db.query<any>(`select count(*)::int c from information_schema.tables where table_name='dp_practice_recordings'`)).rows[0].c).toBe(1);
    expect((await db.query<any>(`select count(*)::int c from information_schema.tables where table_name='dp_voice_plans'`)).rows[0].c).toBe(0);
    expect((await db.query<any>(`select count(*)::int c from pg_proc where proname='dp_plan_revise'`)).rows[0].c).toBe(0);
    expect((await db.query<any>(`select count(*)::int c from pg_proc where proname='dp_recording_begin'`)).rows[0].c).toBe(1);
    await db.close();
  }, 600000);
});
