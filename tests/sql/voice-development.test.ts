import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser } from "./harness";

const id = (n: number) => `f3f30000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = id(1), B = id(2), STRANGER = id(3), FAC = id(6);
let db: PGlite;
const q = (uid: string | null, sql: string, params: any[] = []) => asUser(db, uid, sql, params);
async function denied(uid: string | null, sql: string, params: any[] = []) {
  try { await q(uid, sql, params); } catch (e) { return String((e as Error).message); }
  throw new Error("Expected statement to be rejected: " + sql);
}
const unit = (seq: number, area: string, extra: Record<string, unknown> = {}) => ({ seq, week: seq, area_key: area, area_title: area, level: "beginner", objective: "Obj " + seq, exercise_keys: ["stance-check"], ...extra });
const savePlan = (uid: string, student: string | null, units: unknown[], pid: string | null = null) =>
  q(uid, `select dp_plan_save($1,$2,'Plan','twelve_week',$3::jsonb,array['Intake goals'],array['note'],'{"1":["because"]}'::jsonb,'private') id`, [pid, student, JSON.stringify(units)]);

beforeAll(async () => {
  ({ db } = await createDb());
  await db.exec(`
   insert into auth.users(id,email) select x::uuid,'d'||substr(x,30)||'@example.test' from unnest(array['${[A, B, STRANGER, FAC].join("','")}']) x;
   insert into profiles(id,full_name,email) select id,'User '||substr(id::text,33),email from auth.users where id::text like 'f3f3%';
   insert into dp_user_roles(user_id,role) values ('${FAC}','faculty');
   insert into dp_enrollments(user_id,scope_type,scope_id,status)
     select u,'program',(select id from dp_programs where slug='vocal-coaching'),'active' from unnest(array['${A}','${B}']::uuid[]) u;
  `);
}, 120000);
afterAll(async () => { await db.close(); });

describe("curriculum library visibility", () => {
  it("seeds the library for staff but students cannot browse unassigned curriculum or track skills", async () => {
    const staff = (await q(FAC, `select count(*)::int c from dp_voice_exercises where curriculum_key is not null`)).rows[0].c;
    expect(staff).toBeGreaterThan(60);
    expect((await q(A, `select count(*)::int c from dp_voice_exercises where curriculum_key is not null`)).rows[0].c).toBe(0);
    expect((await q(A, `select count(*)::int c from dp_voice_skills where slug like 'track-%'`)).rows[0].c).toBe(0);
    expect((await q(FAC, `select count(*)::int c from dp_voice_skills where slug like 'track-%'`)).rows[0].c).toBe(3);
  });
  it("reuses existing skills instead of duplicating them", async () => {
    expect((await q(FAC, `select count(*)::int c from dp_voice_skills where slug='pitch-ear'`)).rows[0].c).toBe(1);
  });
});

describe("track choice and approval", () => {
  it("needs the student's choice and the instructor's approval", async () => {
    await q(A, `select dp_voice_set_my_tracks(array['spontaneous_expression','prophetic_worship'], true)`);
    expect(await denied(A, `select dp_voice_set_my_tracks(array['made_up'], false)`)).toMatch(/Unknown track/);
    expect(await denied(A, `select dp_voice_approve_tracks('${A}', array['prophetic_worship'])`)).toMatch(/Not authorized/);
    await q(FAC, `select dp_voice_approve_tracks('${A}', array['spontaneous_expression','worship_leadership'])`);
    const p = (await q(A, `select selected_tracks,approved_tracks,tongues_requested from dp_voice_profiles`)).rows[0];
    expect(p.approved_tracks).toEqual(["spontaneous_expression"]); // worship_leadership was never chosen
    expect(p.tongues_requested).toBe(true);
    expect((await q(B, `select * from dp_voice_profiles`)).rows).toEqual([]);
  });
  it("dropping a track removes its approval and the tongues request", async () => {
    await q(A, `select dp_voice_set_my_tracks(array['spontaneous_expression'], true)`);
    const p = (await q(A, `select approved_tracks,tongues_requested from dp_voice_profiles`)).rows[0];
    expect(p.approved_tracks).toEqual(["spontaneous_expression"]);
    expect(p.tongues_requested).toBe(false);
    await q(A, `select dp_voice_set_my_tracks(array['spontaneous_expression','prophetic_worship'], false)`);
  });
});

describe("intake (separate from assessments)", () => {
  it("is private to the student and staff, and import records the student's own choice without approving it", async () => {
    await q(A, `select dp_voice_submit_intake('{"goals":"ad-libbing"}'::jsonb, array['spontaneous_expression','prophetic_worship'])`);
    expect((await q(A, `select count(*)::int c from dp_voice_intakes`)).rows[0].c).toBe(1);
    expect((await q(B, `select count(*)::int c from dp_voice_intakes`)).rows[0].c).toBe(0);
    expect((await q(STRANGER, `select count(*)::int c from dp_voice_intakes`)).rows[0].c).toBe(0);
    expect(await denied(A, `select dp_voice_import_intake('${B}','{}'::jsonb,'{}')`)).toMatch(/Not authorized/);
    await q(FAC, `select dp_voice_import_intake('${B}','{"goals":"harmony"}'::jsonb, array['worship_leadership'])`);
    const p = (await q(FAC, `select selected_tracks,approved_tracks from dp_voice_profiles where student_id='${B}'`)).rows[0];
    expect(p).toEqual({ selected_tracks: ["worship_leadership"], approved_tracks: [] });
    expect(await denied(FAC, `select dp_voice_import_intake('${STRANGER}','{}'::jsonb,'{}')`)).toMatch(/not enrolled/);
    await denied(A, `update dp_voice_intakes set answers='{}'`).catch(() => null);
  });
});

describe("assessments", () => {
  let personal: string, creative: string;
  it("gates assignment: Personal Time needs the prophetic track; Assessment A cannot be assigned", async () => {
    expect(await denied(FAC, `select dp_assessment_assign('${B}','personal_time')`)).toMatch(/Prophetic Worship Development/);
    expect(await denied(FAC, `select dp_assessment_assign('${A}','hearing_god')`)).toMatch(/source wording/);
    expect(await denied(A, `select dp_assessment_assign('${A}','creative_expression')`)).toMatch(/Not authorized/);
    personal = (await q(FAC, `select dp_assessment_assign('${A}','personal_time') id`)).rows[0].id;
    creative = (await q(FAC, `select dp_assessment_assign('${A}','creative_expression') id`)).rows[0].id;
    expect(await denied(FAC, `select dp_assessment_assign('${A}','personal_time')`)).toMatch(/unique|duplicate/i);
  });
  it("saves drafts, resumes, submits, and is then locked", async () => {
    await q(A, `select dp_assessment_save('${personal}','{"q1":"Daily"}'::jsonb)`);
    await q(A, `select dp_assessment_save('${personal}','{"q1":"Daily","q8":"I pray"}'::jsonb)`);
    const r = (await q(A, `select status,answers from dp_voice_assessments where id='${personal}'`)).rows[0];
    expect(r.status).toBe("in_progress"); expect(r.answers.q8).toBe("I pray");
    await q(A, `select dp_assessment_submit('${personal}')`);
    expect(await denied(A, `select dp_assessment_save('${personal}','{"q1":"Rarely"}'::jsonb)`)).toMatch(/not open/);
    expect(await denied(B, `select dp_assessment_submit('${personal}')`)).toMatch(/not open/);
  });
  it("keeps one student's answers from others", async () => {
    expect((await q(B, `select count(*)::int c from dp_voice_assessments`)).rows[0].c).toBe(0);
    expect((await q(STRANGER, `select count(*)::int c from dp_voice_assessments`)).rows[0].c).toBe(0);
    expect((await q(FAC, `select count(*)::int c from dp_voice_assessments`)).rows[0].c).toBe(2);
  });
  it("only accepts the student's own recordings as demonstrations", async () => {
    expect(await denied(A, `select dp_assessment_save('${creative}','{"d_adlib":"${id(900)}"}'::jsonb)`)).toMatch(/not yours/);
    await q(A, `select dp_assessment_save('${creative}','{"s_adlib":"Not yet","d_adlib":""}'::jsonb)`);
  });
  it("review keeps observations and notes staff-only and shares a summary only when written", async () => {
    await q(FAC, `select dp_assessment_review('${personal}','{"x":1}'::jsonb,'private thoughts',null)`);
    expect((await q(A, `select shared_summary,shared_at,status from dp_voice_assessments where id='${personal}'`)).rows[0]).toEqual({ shared_summary: null, shared_at: null, status: "reviewed" });
    expect((await q(A, `select count(*)::int c from dp_voice_assessment_private`)).rows[0].c).toBe(0);
    expect((await q(FAC, `select notes from dp_voice_assessment_private`)).rows[0].notes).toBe("private thoughts");
    expect(await denied(A, `select dp_assessment_review('${personal}','{}'::jsonb,'x','y')`)).toMatch(/Not authorized/);
    await q(FAC, `select dp_assessment_review('${personal}','{"x":1}'::jsonb,'private thoughts','Here is what we noticed together.')`);
    expect((await q(A, `select shared_summary from dp_voice_assessments where id='${personal}'`)).rows[0].shared_summary).toMatch(/noticed together/);
  });
});

describe("development plans", () => {
  let plan: string, unitId: string;
  it("rejects optional-track units unless the student chose AND the instructor approved", async () => {
    expect(await denied(FAC, `select dp_plan_save(null,'${A}','P','monthly','${JSON.stringify([unit(1, "track-prophetic-worship")])}'::jsonb,'{}','{}','{}',null)`)).toMatch(/choice and your approval/);
    await q(FAC, `select dp_voice_approve_tracks('${A}', array['spontaneous_expression','prophetic_worship'])`);
    expect(await denied(FAC, `select dp_plan_save(null,'${A}','P','monthly','${JSON.stringify([unit(1, "track-worship-leadership")])}'::jsonb,'{}','{}','{}',null)`)).toMatch(/choice and your approval/);
  });
  it("rejects singing in tongues unless the student explicitly requested it", async () => {
    expect(await denied(FAC, `select dp_plan_save(null,'${A}','P','monthly','${JSON.stringify([unit(1, "track-prophetic-worship", { exercise_keys: ["optional-tongues"] })])}'::jsonb,'{}','{}','{}',null)`)).toMatch(/explicitly requested/);
  });
  it("drafts are staff-only; sample plans never reach students; private rationale stays private", async () => {
    plan = (await savePlan(FAC, A, [unit(1, "posture-breath"), unit(2, "track-spontaneous-expression", { checkpoint: "progress" })])).rows[0].id;
    expect((await q(A, `select count(*)::int c from dp_voice_plans`)).rows[0].c).toBe(0);
    const sample = (await savePlan(FAC, null, [unit(1, "track-prophetic-worship")])).rows[0].id;
    expect((await q(FAC, `select is_sample,student_id from dp_voice_plans where id='${sample}'`)).rows[0]).toEqual({ is_sample: true, student_id: null });
    expect(await denied(FAC, `select dp_plan_activate('${sample}')`)).toMatch(/Only a student/);
    await q(FAC, `select dp_plan_activate('${plan}')`);
    expect((await q(A, `select count(*)::int c from dp_voice_plans`)).rows[0].c).toBe(1);
    expect((await q(A, `select count(*)::int c from dp_voice_plan_units`)).rows[0].c).toBe(2);
    expect((await q(A, `select count(*)::int c from dp_voice_plan_private`)).rows[0].c).toBe(0);
    expect((await q(B, `select count(*)::int c from dp_voice_plans`)).rows[0].c).toBe(0);
    expect(await denied(FAC, `select dp_plan_save('${plan}','${A}','Again','monthly','${JSON.stringify([unit(1, "pitch-ear")])}'::jsonb,'{}','{}','{}',null)`)).toMatch(/Only a draft/);
  });
  it("a sample copies into a draft for a student, with the track rules re-checked", async () => {
    const sample = (await q(FAC, `select id from dp_voice_plans where is_sample limit 1`)).rows[0].id;
    expect(await denied(FAC, `select dp_plan_copy_sample('${sample}','${B}')`)).toMatch(/choice and your approval/);
    const copy = (await q(FAC, `select dp_plan_copy_sample('${sample}','${A}') id`)).rows[0].id;
    expect((await q(FAC, `select status,is_sample from dp_voice_plans where id='${copy}'`)).rows[0]).toEqual({ status: "draft", is_sample: false });
    expect((await q(A, `select count(*)::int c from dp_voice_plans where id='${copy}'`)).rows[0].c).toBe(0);
  });
  it("assigns a planned lesson's practice through the existing assignment workflow, once", async () => {
    unitId = (await q(FAC, `select id from dp_voice_plan_units where plan_id='${plan}' and seq=1`)).rows[0].id;
    const aid = (await q(FAC, `select dp_plan_assign_unit('${unitId}', current_date + 7) id`)).rows[0].id;
    const a = (await q(A, `select title,practice_items from dp_assignments where id='${aid}'`)).rows[0];
    expect(a.title).toMatch(/Week 1/);
    expect(a.practice_items[0].title).toBe("Balanced stance check");
    expect(await denied(FAC, `select dp_plan_assign_unit('${unitId}', current_date)`)).toMatch(/already has practice/);
    expect(await denied(A, `select dp_plan_assign_unit('${unitId}', current_date)`)).toMatch(/Not authorized/);
    const second = (await q(FAC, `select id from dp_voice_plan_units where plan_id='${plan}' and seq=2`)).rows[0].id;
    // unit 2 is the spontaneous track (chosen and approved) -> allowed
    expect((await q(FAC, `select dp_plan_assign_unit('${second}', current_date + 14) id`)).rows[0].id).toBeTruthy();
  });
});

describe("progress checks", () => {
  it("are visible to the student only after they are shared; private notes stay with staff; saves never overwrite", async () => {
    const plan = (await q(FAC, `select id from dp_voice_plans where student_id='${A}' and status='active'`)).rows[0].id;
    const one = (await q(FAC, `select dp_progress_check_save('${plan}',4,'progress','{"breath":3}'::jsonb,'Steadier','Longer phrases','staff only',false) id`)).rows[0].id;
    expect((await q(A, `select count(*)::int c from dp_voice_progress_checks`)).rows[0].c).toBe(0);
    await q(FAC, `select dp_progress_check_save('${plan}',4,'progress','{"breath":4}'::jsonb,'Steadier still','Longer phrases','staff only 2',true)`);
    const seen = (await q(A, `select strengths from dp_voice_progress_checks`)).rows;
    expect(seen).toEqual([{ strengths: "Steadier still" }]);
    expect((await q(A, `select count(*)::int c from dp_voice_progress_check_private`)).rows[0].c).toBe(0);
    expect((await q(FAC, `select count(*)::int c from dp_voice_progress_checks where id='${one}'`)).rows[0].c).toBe(1);
    expect((await q(B, `select count(*)::int c from dp_voice_progress_checks`)).rows[0].c).toBe(0);
    expect(await denied(A, `select dp_progress_check_save('${plan}',4,'progress','{}'::jsonb,'x','y','z',true)`)).toMatch(/Not authorized/);
  });
  it("lose all access when the student leaves Voice", async () => {
    await db.exec(`update dp_enrollments set status='cancelled' where user_id='${A}'`);
    for (const t of ["dp_voice_plans", "dp_voice_assessments", "dp_voice_intakes", "dp_voice_profiles", "dp_voice_progress_checks"]) expect((await q(A, `select count(*)::int c from ${t}`)).rows[0].c, t).toBe(0);
    await db.exec(`update dp_enrollments set status='active' where user_id='${A}'`);
  });
});
