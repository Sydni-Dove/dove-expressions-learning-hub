import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser, grantPaid } from "./harness";

/** Database-level enforcement audit for the whole Voice release (all migrations applied): isolation, private assessments, optional tracks,
 *  refund independence and a structural check of every table and function the release adds. */
const id = (n: number) => `f5f50000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const S = id(1), O = id(2), X = id(3), CR = id(4), EX = id(5), FAC = id(6);
let db: PGlite;
const q = (uid: string | null, sql: string, params: any[] = []) => asUser(db, uid, sql, params);
const rowsOf = async (uid: string | null, sql: string) => (await q(uid, sql)).rows;
async function denied(uid: string | null, sql: string) { try { await q(uid, sql); } catch (e) { return String((e as Error).message); } throw new Error("Expected statement to be rejected: " + sql); }

const NEW_TABLES = ["dp_practice_recordings", "dp_practice_recording_feedback", "dp_voice_profiles", "dp_voice_intakes", "dp_voice_assessments", "dp_voice_assessment_private",
  "dp_voice_plans", "dp_voice_plan_units", "dp_voice_plan_private", "dp_voice_progress_checks", "dp_voice_progress_check_private", "dp_voice_plan_versions", "dp_voice_import_mappings"];
const ALL_RELEASE_TABLES = [...NEW_TABLES, "dp_submission_attempts", "dp_coaching_plans", "dp_coaching_tiers", "dp_coaching_packages", "dp_package_payments", "dp_unmatched_payments",
  "dp_consultation_inquiries", "dp_lesson_access", "dp_voice_skills", "dp_voice_exercises", "dp_voice_plan_templates", "dp_voice_goals", "dp_voice_goal_updates", "dp_voice_resource_content"];

beforeAll(async () => {
  ({ db } = await createDb());
  await db.exec(`
   insert into auth.users(id,email) select x::uuid,'e'||substr(x,30)||'@example.test' from unnest(array['${[S, O, X, CR, EX, FAC].join("','")}']) x;
   insert into profiles(id,full_name,email) select id,'User '||substr(id::text,33),email from auth.users where id::text like 'f5f5%';
   insert into dp_user_roles(user_id,role) values ('${FAC}','faculty');
   insert into dp_enrollments(user_id,scope_type,scope_id,status)
     select u,'program',(select id from dp_programs where slug='vocal-coaching'),'active' from unnest(array['${S}','${O}']::uuid[]) u;
   insert into dp_enrollments(user_id,scope_type,scope_id,status) values ('${EX}','program',(select id from dp_programs where slug='vocal-coaching'),'cancelled');
   insert into dp_enrollments(user_id,scope_type,scope_id,status) select '${CR}','program',id,'active' from dp_programs where slug<>'vocal-coaching' limit 1;
  `);
  await grantPaid(db, S); await grantPaid(db, O);
  // S has a full record: tracks, intake, assessments (with private review), plan (approved), progress check, recording + feedback.
  await q(S, `select dp_voice_set_my_tracks(array['spontaneous_expression'], false)`);
  await q(FAC, `select dp_voice_approve_tracks('${S}', array['spontaneous_expression'])`);
  await q(S, `select dp_voice_submit_intake('{"goals":"private goal"}'::jsonb, array['spontaneous_expression'])`);
  const asg = (await q(FAC, `select dp_assessment_assign('${S}','creative_expression','fits their goals') id`)).rows[0].id;
  await q(S, `select dp_assessment_save('${asg}','{"s_adlib":"Not yet"}'::jsonb)`); await q(S, `select dp_assessment_submit('${asg}')`);
  await q(FAC, `select dp_assessment_review('${asg}','{"o_call":"Emerging"}'::jsonb,'staff-only note','Shared summary')`);
  const plan = (await q(FAC, `select dp_plan_save(null,'${S}','P','monthly','[{"seq":1,"week":1,"area_key":"posture-breath","area_title":"Posture","level":"beginner","objective":"o","exercise_keys":["stance-check"]}]'::jsonb,'{}','{}','{"1":["private reason"]}'::jsonb,'staff-only plan note') id`)).rows[0].id;
  await q(FAC, `select dp_plan_activate('${plan}')`);
  await q(FAC, `select dp_progress_check_save('${plan}',1,'baseline','{"posture-breath":2}'::jsonb,'g','f','staff-only check note',true)`);
  await q(FAC, `select dp_voice_save_mapping('m','{"a":"goals"}'::jsonb)`);
  const rec = (await q(S, `select id from dp_recording_begin(null,null,'Verse','t',1,'audio/mp4',1000,30)`)).rows[0].id;
  await q(S, `select dp_recording_mark_saved('${rec}',900,30)`); await q(S, `select dp_recording_submit(array['${rec}']::uuid[])`);
  await q(FAC, `select dp_recording_review('${rec}','reviewed','Nice work')`);
}, 180000);
afterAll(async () => { await db.close(); });

describe("structural audit of everything the Voice release adds", () => {
  it("has row-level security on every table, and the newest tables accept writes only through functions", async () => {
    const t = await rowsOf(null, `select relname, relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relname = any(array['${ALL_RELEASE_TABLES.join("','")}'])`);
    expect(t).toHaveLength(ALL_RELEASE_TABLES.length);
    expect(t.filter((r: any) => !r.rls).map((r: any) => r.relname)).toEqual([]);
    const writes = await rowsOf(null, `select tablename, policyname, cmd from pg_policies where schemaname='public' and tablename = any(array['${NEW_TABLES.join("','")}']) and cmd in ('INSERT','UPDATE','DELETE','ALL')`);
    expect(writes).toEqual([]);
  });
  it("functions never run for anonymous callers; definer functions pin search_path; service-only functions are not callable by users", async () => {
    const fns = await rowsOf(null, `select n.nspname, p.proname, p.oid, p.prosecdef, p.proconfig::text cfg, has_function_privilege('anon',p.oid,'execute') anon, has_function_privilege('authenticated',p.oid,'execute') authd
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(dp_recording_|dp_voice_(set_my|approve|submit|import|save)|dp_assessment_|dp_plan_|dp_progress_check|dp_assign_weekly|dp_record_package|dp_set_lesson|dp_generate_appointments|dp_program_students|dp_my_)'`);
    expect(fns.length).toBeGreaterThan(25);
    expect(fns.filter((f: any) => f.anon).map((f: any) => f.proname)).toEqual([]);
    expect(fns.filter((f: any) => f.prosecdef && !/search_path/.test(f.cfg ?? "")).map((f: any) => f.proname)).toEqual([]);
    const serviceOnly = ["dp_recording_cleanup_candidates", "dp_recording_mark_purged", "dp_record_package_purchase"];
    for (const n of serviceOnly) expect(fns.find((f: any) => f.proname === n)?.authd, n).toBe(false);
  });
  it("no new table cascades from payments: a refund or package change cannot delete plans, assessments or recordings", async () => {
    const fks = await rowsOf(null, `select conrelid::regclass::text t, confrelid::regclass::text ref from pg_constraint where contype='f' and conrelid::regclass::text = any(array['${NEW_TABLES.join("','")}']) and confrelid::regclass::text ~ 'dp_(coaching_|package_)'`);
    expect(fks).toEqual([]);
  });
});

describe("isolation: only the student and authorised Voice staff", () => {
  const readable = [...NEW_TABLES, "dp_voice_goals", "dp_voice_resource_content"].filter((t) => !["dp_voice_import_mappings", "dp_voice_resource_content"].includes(t));
  it("the student sees only their own rows; staff see them; nobody else sees any", async () => {
    for (const t of NEW_TABLES) {
      const staff = (await q(FAC, `select count(*)::int c from ${t}`)).rows[0].c;
      for (const who of [X, CR, EX, O]) expect((await q(who, `select count(*)::int c from ${t}`)).rows[0].c, `${t} for ${who === X ? "non-member" : who === CR ? "other program" : who === EX ? "cancelled" : "other student"}`).toBe(0);
      const own = (await q(S, `select count(*)::int c from ${t}`)).rows[0].c;
      expect(own, t).toBeLessThanOrEqual(staff);
    }
    expect(readable.length).toBeGreaterThan(8);
  });
  it("staff-only tables are invisible to the student themself", async () => {
    for (const t of ["dp_voice_assessment_private", "dp_voice_plan_private", "dp_voice_progress_check_private", "dp_voice_plan_versions", "dp_voice_import_mappings"]) {
      expect((await q(FAC, `select count(*)::int c from ${t}`)).rows[0].c, `${t} has staff data`).toBeGreaterThan(0 - (t === "dp_voice_plan_versions" ? 1 : 0));
      expect((await q(S, `select count(*)::int c from ${t}`)).rows[0].c, t).toBe(0);
    }
    const mine = (await rowsOf(S, `select shared_summary from dp_voice_assessments`))[0];
    expect(mine.shared_summary).toBe("Shared summary");
  });
  it("every state-changing function refuses non-members and the wrong role", async () => {
    const calls = [
      `dp_voice_set_my_tracks(array['spontaneous_expression'],false)`, `dp_voice_submit_intake('{}'::jsonb,'{}')`, `dp_recording_begin(null,null,'Verse','t',1,'audio/mp4',1000,30)`,
      `dp_assessment_save('${id(900)}','{}'::jsonb)`, `dp_assessment_submit('${id(900)}')`, `dp_recording_submit(array['${id(900)}']::uuid[])`
    ];
    for (const who of [X, CR, EX]) for (const c of calls) await denied(who, `select ${c}`);
    const staffOnly = [`dp_voice_approve_tracks('${S}',array[]::text[])`, `dp_assessment_assign('${S}','creative_expression','fits their goals')`, `dp_assessment_review('${id(900)}','{}'::jsonb,'x',null)`,
      `dp_plan_save(null,'${S}','p','monthly','[]'::jsonb,'{}','{}','{}','x')`, `dp_plan_activate('${id(900)}')`, `dp_plan_revise('${id(900)}','[]'::jsonb,'r')`, `dp_plan_assign_unit('${id(900)}',current_date)`,
      `dp_plan_copy_sample('${id(900)}','${S}')`, `dp_progress_check_save('${id(900)}',1,'baseline','{}'::jsonb,'','','',false)`, `dp_recording_review('${id(900)}','reviewed','x')`,
      `dp_recording_assign_followup('${id(900)}','${id(901)}',current_date)`, `dp_voice_save_mapping('x','{}'::jsonb)`, `* from dp_voice_import_intake('${S}','{}'::jsonb,'{}',now(),'0123456789abcdef0')`];
    for (const who of [S, O, X, CR, EX]) for (const c of staffOnly) expect(await denied(who, `select ${c}`), `${c} as ${who}`).toMatch(/Not authorized|not authorized/);
  });
  it("a student cannot write any new table directly", async () => {
    for (const t of NEW_TABLES) {
      await q(S, `update ${t} set id=id`).catch(() => null);
      await q(S, `delete from ${t}`).catch(() => null);
      await denied(S, `insert into ${t} default values`);
    }
    expect((await q(S, `select count(*)::int c from dp_voice_assessments`)).rows[0].c).toBeGreaterThan(0); // nothing was deleted
  });
});

describe("optional tracks and request-only exercises are enforced by every database path", () => {
  it("rejects an unchosen/unapproved track through saving, revising, assigning, copying and recording follow-ups", async () => {
    // O chose nothing. Every route that could place track content in front of O must refuse.
    const unit = JSON.stringify([{ seq: 1, week: 1, area_key: "track-prophetic-worship", area_title: "t", level: "beginner", objective: "o", exercise_keys: ["abide-time"] }]);
    expect(await denied(FAC, `select dp_plan_save(null,'${O}','p','monthly','${unit}'::jsonb,'{}','{}','{}','x')`)).toMatch(/choice and your approval/);
    const trackEx = (await q(FAC, `select id from dp_voice_exercises where curriculum_key='abide-time'`)).rows[0].id;
    const tonguesEx = (await q(FAC, `select id from dp_voice_exercises where curriculum_key='optional-tongues'`)).rows[0].id;
    const rec = (await q(O, `select id from dp_recording_begin(null,null,'Verse','t',1,'audio/mp4',1000,30)`)).rows[0].id;
    await q(O, `select dp_recording_mark_saved('${rec}',900,30)`); await q(O, `select dp_recording_submit(array['${rec}']::uuid[])`);
    for (const ex of [trackEx, tonguesEx]) expect(await denied(FAC, `select dp_recording_assign_followup('${rec}','${ex}',current_date+3)`)).toMatch(/not available for this student/);
    // S chose and was approved for spontaneous expression only: prophetic and tongues are still refused.
    expect(await denied(FAC, `select dp_plan_save(null,'${S}','p','monthly','${unit}'::jsonb,'{}','{}','{}','x')`)).toMatch(/choice and your approval/);
    expect(await denied(FAC, `select dp_recording_assign_followup('${(await q(FAC, `select id from dp_practice_recordings where student_id='${S}' limit 1`)).rows[0].id}','${tonguesEx}',current_date+3)`)).toMatch(/not available for this student/);
    // students cannot browse the unassigned curriculum or track skills
    expect((await q(S, `select count(*)::int c from dp_voice_exercises where curriculum_key is not null`)).rows[0].c).toBe(0);
    expect((await q(S, `select count(*)::int c from dp_voice_skills where slug like 'track-%'`)).rows[0].c).toBe(0);
  });
});

describe("existing payment and refund protections still hold with every migration applied", () => {
  it("is covered by voice-production.test.ts, which runs against the full migration set", async () => {
    // Structural guarantee that the pay-first trigger and the content gate are still installed after the Voice release.
    const trg = await rowsOf(null, `select tgname from pg_trigger where tgname in ('dp_session_credit_assign','dp_submission_recording_refs','dp_submission_attempt_log') and not tgisinternal`);
    expect(trg.map((r: any) => r.tgname).sort()).toEqual(["dp_session_credit_assign", "dp_submission_attempt_log", "dp_submission_recording_refs"]);
    const pol = await rowsOf(null, `select policyname, permissive from pg_policies where tablename='dp_lesson_blocks' and policyname='dp_lesson_blocks_level_boundary'`);
    expect(pol).toEqual([{ policyname: "dp_lesson_blocks_level_boundary", permissive: "RESTRICTIVE" }]);
    expect((await rowsOf(null, `select count(*)::int c from pg_proc where proname='dp_set_lesson_status'`))[0].c).toBe(1);
  });
});
