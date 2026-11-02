import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser, grantPaid } from "./harness";

const id = (n: number) => `f4f40000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = id(1), B = id(2), STRANGER = id(3), FAC = id(6);
let db: PGlite;
const q = (uid: string | null, sql: string, params: any[] = []) => asUser(db, uid, sql, params);
async function denied(uid: string | null, sql: string, params: any[] = []) {
  try { await q(uid, sql, params); } catch (e) { return String((e as Error).message); }
  throw new Error("Expected statement to be rejected: " + sql);
}
const unit = (seq: number, area: string, extra: Record<string, unknown> = {}) => ({ seq, week: seq, area_key: area, area_title: area, level: "beginner", objective: "Obj " + seq + " " + area, exercise_keys: ["stance-check"], ...extra });
const savePlan = (student: string | null, units: unknown[], pid: string | null = null) =>
  q(FAC, `select dp_plan_save($1,$2,'Plan','twelve_week',$3::jsonb,array['b'],array['n'],'{}'::jsonb,'p') id`, [pid, student, JSON.stringify(units)]);
let plan: string; let unitIds: string[];

beforeAll(async () => {
  ({ db } = await createDb());
  await db.exec(`
   insert into auth.users(id,email) select x::uuid,'v'||substr(x,30)||'@example.test' from unnest(array['${[A, B, STRANGER, FAC].join("','")}']) x;
   insert into profiles(id,full_name,email) select id,'User '||substr(id::text,33),email from auth.users where id::text like 'f4f4%';
   insert into dp_user_roles(user_id,role) values ('${FAC}','faculty');
   insert into dp_enrollments(user_id,scope_type,scope_id,status)
     select u,'program',(select id from dp_programs where slug='vocal-coaching'),'active' from unnest(array['${A}','${B}']::uuid[]) u;
  `);
  await grantPaid(db, A);
  await q(A, `select dp_voice_set_my_tracks(array['spontaneous_expression'], false)`);
  await q(FAC, `select dp_voice_approve_tracks('${A}', array['spontaneous_expression'])`);
  plan = (await savePlan(A, [unit(1, "posture-breath"), unit(2, "pitch-ear", { exercise_keys: ["match-one-note"] }), unit(3, "track-spontaneous-expression", { exercise_keys: ["ad-lib-gaps"] })])).rows[0].id;
  await q(FAC, `select dp_plan_activate('${plan}')`);
  unitIds = (await q(FAC, `select id from dp_voice_plan_units where plan_id='${plan}' order by seq`)).rows.map((r: any) => r.id);
}, 120000);
afterAll(async () => { await db.close(); });

const current = async () => (await q(FAC, `select id,seq,week,area_key,area_title,level,objective,exercise_keys,assignment_key,checkpoint,follow_up,segment_advice,status from dp_voice_plan_units where plan_id='${plan}' order by seq`)).rows;

describe("controlled editing of an approved plan", () => {
  let assignmentId: string;
  it("keeps assigned and done lessons exactly as they were", async () => {
    assignmentId = (await q(FAC, `select dp_plan_assign_unit('${unitIds[0]}', current_date + 7) id`)).rows[0].id;
    await q(FAC, `select dp_plan_unit_set_status('${unitIds[1]}','done')`);
    const rows = await current();
    const change = (i: number, extra: object) => rows.map((r: any, j: number) => (j === i ? { ...r, ...extra } : r));
    expect(await denied(FAC, `select dp_plan_revise('${plan}','${JSON.stringify(change(0, { objective: "changed" }))}'::jsonb,'why')`)).toMatch(/cannot be changed/);
    expect(await denied(FAC, `select dp_plan_revise('${plan}','${JSON.stringify(change(1, { level: "advanced" }))}'::jsonb,'why')`)).toMatch(/cannot be changed/);
    expect(await denied(FAC, `select dp_plan_revise('${plan}','${JSON.stringify(rows.slice(1))}'::jsonb,'why')`)).toMatch(/cannot be removed/);
    expect((await q(FAC, `select version_no from dp_voice_plans where id='${plan}'`)).rows[0].version_no).toBe(1);
  });
  it("revises the lessons still ahead, records the old version, and requires a reason and staff", async () => {
    const rows = await current();
    const next = [rows[0], rows[1], { ...rows[2], objective: "New objective", level: "intermediate" }, { ...unit(4, "range"), exercise_keys: ["range-map"] }];
    expect(await denied(FAC, `select dp_plan_revise('${plan}','${JSON.stringify(next)}'::jsonb,'  ')`)).toMatch(/Say why/);
    expect(await denied(A, `select dp_plan_revise('${plan}','${JSON.stringify(next)}'::jsonb,'x')`)).toMatch(/Not authorized/);
    expect((await q(FAC, `select dp_plan_revise('${plan}','${JSON.stringify(next)}'::jsonb,'Student ready for range work') v`)).rows[0].v).toBe(2);
    const after = await current();
    expect(after).toHaveLength(4);
    expect(after[2].objective).toBe("New objective");
    expect(after.map((r: any) => r.id).slice(0, 3)).toEqual(unitIds); // same lesson rows, not recreated
    const v = (await q(FAC, `select version_no,reason,snapshot->'units'->2->>'objective' obj from dp_voice_plan_versions where plan_id='${plan}'`)).rows;
    expect(v).toHaveLength(1);
    expect(v[0].reason).toMatch(/As approved: Student ready for range work/);
    expect(v[0].obj).toMatch(/^Obj 3/); // the old objective is preserved in the history
  });
  it("keeps the assignment, the student's recordings and progress untouched", async () => {
    expect((await q(A, `select count(*)::int c from dp_assignments where id='${assignmentId}'`)).rows[0].c).toBe(1);
    expect((await current())[0].assigned_assignment_id ?? assignmentId).toBeTruthy();
    expect((await q(FAC, `select status,assigned_assignment_id from dp_voice_plan_units where id='${unitIds[0]}'`)).rows[0]).toEqual({ status: "assigned", assigned_assignment_id: assignmentId });
    const rec = (await q(A, `select id from dp_recording_begin(null,null,'Warmup','x',1,'audio/mp4',1000,30)`)).rows[0].id;
    await q(A, `select dp_recording_mark_saved('${rec}',900,30)`);
    await q(FAC, `select dp_progress_check_save('${plan}',4,'progress','{"posture-breath":3}'::jsonb,'ok','next','n',true)`);
    const rows = await current();
    await q(FAC, `select dp_plan_revise('${plan}','${JSON.stringify(rows)}'::jsonb,'No-op edit to prove records stay')`);
    expect((await q(A, `select count(*)::int c from dp_practice_recordings where id='${rec}'`)).rows[0].c).toBe(1);
    expect((await q(A, `select count(*)::int c from dp_voice_progress_checks`)).rows[0].c).toBe(1);
    expect((await q(FAC, `select count(*)::int c from dp_voice_plan_versions where plan_id='${plan}'`)).rows[0].c).toBe(2);
  });
  it("re-checks optional tracks and hides history from students", async () => {
    const rows = await current();
    await q(FAC, `select dp_voice_approve_tracks('${A}', array[]::text[])`);
    const bad = [...rows, unit(5, "track-spontaneous-expression", { exercise_keys: ["call-response"] })];
    expect(await denied(FAC, `select dp_plan_revise('${plan}','${JSON.stringify(bad)}'::jsonb,'add track')`)).toMatch(/not chosen|have not approved/);
    await q(FAC, `select dp_voice_approve_tracks('${A}', array['spontaneous_expression'])`);
    expect((await q(A, `select count(*)::int c from dp_voice_plan_versions`)).rows[0].c).toBe(0);
    expect((await q(A, `select count(*)::int c from dp_voice_plan_units`)).rows[0].c).toBe(4);
    expect(await denied(FAC, `select dp_plan_unit_set_status('${unitIds[2]}','planned')`)).toMatch(/only be marked done/);
  });
  it("cannot revise a draft, a sample, or another plan's lessons", async () => {
    const draft = (await savePlan(A, [unit(1, "range")])).rows[0].id;
    expect(await denied(FAC, `select dp_plan_revise('${draft}','${JSON.stringify([unit(1, "range")])}'::jsonb,'x')`)).toMatch(/approved, active/);
    const rows = await current();
    expect(await denied(FAC, `select dp_plan_revise('${plan}','${JSON.stringify([...rows, { ...unit(5, "range"), id: "00000000-0000-4000-8000-000000000999" }])}'::jsonb,'x')`)).toMatch(/does not belong/);
  });
});

describe("structured progress ratings", () => {
  it("accepts 1-5 ratings only for skill areas in the plan, including a baseline", async () => {
    expect(await denied(FAC, `select dp_progress_check_save('${plan}',1,'baseline','{"harmony":3}'::jsonb,'','','',false)`)).toMatch(/not a skill area in this plan/);
    expect(await denied(FAC, `select dp_progress_check_save('${plan}',1,'baseline','{"posture-breath":6}'::jsonb,'','','',false)`)).toMatch(/1 to 5/);
    expect(await denied(FAC, `select dp_progress_check_save('${plan}',1,'baseline','{"posture-breath":"high"}'::jsonb,'','','',false)`)).toMatch(/1 to 5/);
    await q(FAC, `select dp_progress_check_save('${plan}',1,'baseline','{"posture-breath":2,"pitch-ear":3}'::jsonb,'Starting point','','',false)`);
    await q(FAC, `select dp_progress_check_save('${plan}',8,'midpoint','{"posture-breath":4,"pitch-ear":3}'::jsonb,'','','',true)`);
    expect((await q(FAC, `select count(*)::int c from dp_voice_progress_checks where kind in ('baseline','midpoint')`)).rows[0].c).toBe(2);
    expect((await q(A, `select kind from dp_voice_progress_checks where kind in ('baseline','midpoint')`)).rows).toEqual([{ kind: "midpoint" }]); // baseline stays private until shared
  });
});

describe("Google Forms import: repeat-safe and saved mappings", () => {
  const imp = (key: string, ts: string, tracks = "array['worship_leadership']") => q(FAC, `select * from dp_voice_import_intake('${B}','{"goals":"x"}'::jsonb,${tracks},'${ts}'::timestamptz,'${key}')`);
  it("records the same response once and reports the repeat", async () => {
    const first = (await imp("response-key-0000001", "2026-10-01T10:00:00Z")).rows[0];
    expect(first.duplicate).toBe(false);
    const again = (await imp("response-key-0000001", "2026-10-01T10:00:00Z")).rows[0];
    expect(again).toEqual({ id: first.id, duplicate: true });
    expect((await q(FAC, `select count(*)::int c from dp_voice_intakes where student_id='${B}'`)).rows[0].c).toBe(1);
  });
  it("an older response never overrides newer choices; a newer one does", async () => {
    await imp("response-key-0000002", "2026-10-05T10:00:00Z", "array['spontaneous_expression']");
    await imp("response-key-0000003", "2026-09-01T10:00:00Z", "array['prophetic_worship']");
    expect((await q(FAC, `select selected_tracks from dp_voice_profiles where student_id='${B}'`)).rows[0].selected_tracks).toEqual(["spontaneous_expression"]);
    expect((await q(FAC, `select count(*)::int c from dp_voice_intakes where student_id='${B}'`)).rows[0].c).toBe(3);
  });
  it("requires a key, staff and an enrolled student", async () => {
    expect(await denied(FAC, `select * from dp_voice_import_intake('${B}','{}'::jsonb,'{}',now(),'short')`)).toMatch(/import key/);
    expect(await denied(A, `select * from dp_voice_import_intake('${B}','{}'::jsonb,'{}',now(),'response-key-0000009')`)).toMatch(/Not authorized/);
    expect(await denied(FAC, `select * from dp_voice_import_intake('${STRANGER}','{}'::jsonb,'{}',now(),'response-key-0000010')`)).toMatch(/not enrolled/);
  });
  it("saves a mapping by name (updating it in place), visible to staff only", async () => {
    await q(FAC, `select dp_voice_save_mapping('Fall form','{"Why are you here?":"goals"}'::jsonb)`);
    await q(FAC, `select dp_voice_save_mapping('Fall form','{"Why are you here?":"goals","Style?":"styles"}'::jsonb)`);
    expect((await q(FAC, `select header_map from dp_voice_import_mappings where name='Fall form'`)).rows).toHaveLength(1);
    expect((await q(A, `select * from dp_voice_import_mappings`)).rows).toEqual([]);
    expect(await denied(A, `select dp_voice_save_mapping('x','{}'::jsonb)`)).toMatch(/Not authorized/);
  });
});

describe("recording feedback -> follow-up assignment", () => {
  let rec: string; let breathEx: string; let trackEx: string; let tonguesEx: string;
  beforeAll(async () => {
    rec = (await q(A, `select id from dp_recording_begin(null,null,'Verse','Take',2,'audio/mp4',1000,30)`)).rows[0].id;
    breathEx = (await q(FAC, `select id from dp_voice_exercises where curriculum_key='low-breath-release'`)).rows[0].id;
    trackEx = (await q(FAC, `select id from dp_voice_exercises where curriculum_key='abide-time'`)).rows[0].id;
    tonguesEx = (await q(FAC, `select id from dp_voice_exercises where curriculum_key='optional-tongues'`)).rows[0].id;
  });
  it("only after the student submits; only staff", async () => {
    expect(await denied(FAC, `select dp_recording_assign_followup('${rec}','${breathEx}',current_date+3)`)).toMatch(/only after the student submits/);
    await q(A, `select dp_recording_mark_saved('${rec}',900,30)`);
    await q(A, `select dp_recording_submit(array['${rec}']::uuid[])`);
    expect(await denied(A, `select dp_recording_assign_followup('${rec}','${breathEx}',current_date+3)`)).toMatch(/Not authorized/);
  });
  it("creates a real assignment for that student, linked from an appended feedback entry", async () => {
    await q(FAC, `select dp_recording_review_assign('${rec}','reviewed','Good work','Slow the breath','${breathEx}',current_date+5)`);
    const fb = (await q(A, `select kind,body,follow_up_assignment_id from dp_practice_recording_feedback where recording_id='${rec}' order by created_at`)).rows;
    expect(fb).toHaveLength(2);
    expect(fb[0].body).toBe("Good work");
    expect(fb[1].follow_up_assignment_id).toBeTruthy();
    const a = (await q(A, `select title,practice_items from dp_assignments where id='${fb[1].follow_up_assignment_id}'`)).rows[0];
    expect(a.title).toMatch(/^Follow-up:/);
    expect(a.practice_items[0].exercise_id).toBe(breathEx);
    expect((await q(B, `select count(*)::int c from dp_practice_recording_feedback`)).rows[0].c).toBe(0);
    expect((await q(B, `select count(*)::int c from dp_assignments where id='${fb[1].follow_up_assignment_id}'`)).rows[0].c).toBe(0);
  });
  it("optional-track and request-only exercises obey the same gates, and a failed follow-up rolls the review back", async () => {
    const rec2 = (await q(A, `select id from dp_recording_begin(null,null,'Verse','Take',3,'audio/mp4',1000,30)`)).rows[0].id;
    await q(A, `select dp_recording_mark_saved('${rec2}',900,30)`); await q(A, `select dp_recording_submit(array['${rec2}']::uuid[])`);
    expect(await denied(FAC, `select dp_recording_assign_followup('${rec2}','${trackEx}',current_date+3)`)).toMatch(/not available for this student/); // prophetic not chosen
    expect(await denied(FAC, `select dp_recording_assign_followup('${rec2}','${tonguesEx}',current_date+3)`)).toMatch(/not available for this student/);
    expect(await denied(FAC, `select dp_recording_review_assign('${rec2}','returned','Try again','x','${trackEx}',current_date+3)`)).toMatch(/not available/);
    expect((await q(FAC, `select status from dp_practice_recordings where id='${rec2}'`)).rows[0].status).toBe("submitted");
    expect((await q(FAC, `select count(*)::int c from dp_practice_recording_feedback where recording_id='${rec2}'`)).rows[0].c).toBe(0);
  });
});

describe("sample pathway safeguards", () => {
  let sample: string; let copy: string;
  it("a sample is staff-only and copying keeps only lessons the student may have", async () => {
    sample = (await savePlan(null, [unit(1, "posture-breath"), unit(2, "track-prophetic-worship", { exercise_keys: ["abide-time"] }), unit(3, "track-spontaneous-expression", { exercise_keys: ["ad-lib-gaps"] })])).rows[0].id;
    expect((await q(A, `select count(*)::int c from dp_voice_plans where id='${sample}'`)).rows[0].c).toBe(0);
    copy = (await q(FAC, `select dp_plan_copy_sample('${sample}','${A}') id`)).rows[0].id;
    const units = (await q(FAC, `select seq,week,area_key from dp_voice_plan_units where plan_id='${copy}' order by seq`)).rows;
    expect(units.map((u: any) => u.area_key)).toEqual(["posture-breath", "track-spontaneous-expression"]); // prophetic dropped: not chosen
    expect(units.map((u: any) => u.seq)).toEqual([1, 2]);
    const p = (await q(FAC, `select status,is_sample,student_id,source_sample_id from dp_voice_plans where id='${copy}'`)).rows[0];
    expect(p).toEqual({ status: "draft", is_sample: false, student_id: A, source_sample_id: sample });
    expect((await q(A, `select count(*)::int c from dp_voice_plans where id='${copy}'`)).rows[0].c).toBe(0);
    expect((await q(FAC, `select title,notes::text n,basis::text b from dp_voice_plans where id='${copy}'`)).rows[0]).toMatchObject({ title: "Development plan (draft for review)" });
    expect(JSON.stringify((await q(FAC, `select p.*,u.* from dp_voice_plans p join dp_voice_plan_units u on u.plan_id=p.id where p.id='${copy}'`)).rows)).not.toMatch(/Stephanie|sample title/i);
    expect((await q(FAC, `select rationale from dp_voice_plan_private where plan_id='${copy}'`)).rows[0].rationale).toEqual({}); // hypothetical reasons do not carry over
  });
  it("cannot be approved until the instructor confirms the sample's assumptions were replaced", async () => {
    expect(await denied(FAC, `select dp_plan_activate('${copy}')`)).toMatch(/came from a sample/);
    expect(await denied(A, `select dp_plan_mark_sample_reviewed('${copy}')`)).toMatch(/Not authorized/);
    await q(FAC, `select dp_plan_mark_sample_reviewed('${copy}')`);
    await q(FAC, `select dp_plan_activate('${copy}')`);
    expect((await q(A, `select count(*)::int c from dp_voice_plans where id='${copy}'`)).rows[0].c).toBe(1);
  });
  it("refuses to copy to someone who is not in Voice", async () => {
    expect(await denied(FAC, `select dp_plan_copy_sample('${sample}','${STRANGER}')`)).toMatch(/not enrolled/);
  });
});
