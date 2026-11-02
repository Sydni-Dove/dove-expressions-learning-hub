import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser, grantPaid } from "./harness";
import { TEACHING_MODULES } from "../../lib/voice-teaching";

/** Worship Development teachings: instructor-assigned only, student content visible only once assigned, instructor notes always private. */
const id = (n: number) => `f7f70000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const FAC = id(1), A = id(2), B = id(3), UNPAID = id(4), STRANGER = id(5), TEACHER = id(6), REFUND = id(7);
let db: PGlite;
const q = (uid: string | null, sql: string, params: any[] = []) => asUser(db, uid, sql, params);
async function denied(uid: string | null, sql: string) { try { await q(uid, sql); } catch (e) { return String((e as Error).message); } throw new Error("Expected statement to be rejected: " + sql); }
const count = async (uid: string | null, sql: string) => (await q(uid, sql)).rows[0].c as number;
const assign = (student: string, key: string, by: string | null = FAC) => q(by, `select dp_assign_teaching_module('${student}','${key}',current_date+7,'Take your time.') id`);

beforeAll(async () => {
  ({ db } = await createDb());
  await db.exec(`
   insert into auth.users(id,email) select x::uuid,'a'||substr(x,30)||'@example.test' from unnest(array['${[FAC, A, B, UNPAID, STRANGER, TEACHER, REFUND].join("','")}']) x;
   insert into profiles(id,full_name,email) select id,'Person '||substr(id::text,33),email from auth.users where id::text like 'f7f7%';
   insert into dp_user_roles(user_id,role) values ('${FAC}','faculty'),('${TEACHER}','teacher');
   insert into dp_enrollments(user_id,scope_type,scope_id,status)
     select u,'program',(select id from dp_programs where slug='vocal-coaching'),'active' from unnest(array['${[A, B, UNPAID, REFUND].join("','")}']::uuid[]) u;`);
  await grantPaid(db, A); await grantPaid(db, B); await grantPaid(db, REFUND);
  const sql = (await import("node:fs")).readFileSync("supabase/migrations/20261102100000_dp_voice_worship_teachings_seed.sql", "utf8");
  void sql; // the seed is applied by createDb (all migrations)
}, 240000);
afterAll(async () => { await db.close(); });

describe("seed", () => {
  it("loads all three modules, with instructor notes held separately", async () => {
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_modules`)).toBe(3);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_module_private`)).toBe(3);
    expect((await q(FAC, `select key from dp_voice_teaching_modules order by module_number`)).rows.map((r: any) => r.key)).toEqual(TEACHING_MODULES.map((m) => m.key));
    const c = (await q(FAC, `select student_content c from dp_voice_teaching_modules where key='psyche-of-a-praiser'`)).rows[0].c;
    expect(c.featured.coreStatement).toMatch(/^The youngest in the Kingdom/);
    expect(c.leaders.title).toBe("How to Protect and Develop Spiritually Young Worshipers");
    expect(JSON.stringify(c)).not.toMatch(/facilitation|cautions/);
  });
});

describe("nothing is assigned automatically", () => {
  it("no student sees any module before the instructor assigns one, enrolled or not", async () => {
    for (const u of [A, B, UNPAID, STRANGER, TEACHER]) expect(await count(u, `select count(*)::int c from dp_voice_teaching_modules`)).toBe(0);
    expect(await count(FAC, `select count(*)::int c from dp_assignments where teaching_module_id is not null`)).toBe(0);
  });
});

describe("assigning", () => {
  it("only the instructor can assign; students and non-voice teachers cannot", async () => {
    expect(await denied(A, `select dp_assign_teaching_module('${A}','being-in-the-word')`)).toMatch(/not authorized/);
    expect(await denied(TEACHER, `select dp_assign_teaching_module('${A}','being-in-the-word')`)).toMatch(/not authorized/);
    expect(await denied(null, `select dp_assign_teaching_module('${A}','being-in-the-word')`)).toMatch(/permission denied|not authorized/);
  });
  it("requires an enrolled Voice student, an active module, and verified payment", async () => {
    expect(await denied(FAC, `select dp_assign_teaching_module('${STRANGER}','being-in-the-word')`)).toMatch(/not enrolled/);
    expect(await denied(FAC, `select dp_assign_teaching_module('${A}','no-such-module')`)).toMatch(/not available/);
    expect(await denied(FAC, `select dp_assign_teaching_module('${UNPAID}','being-in-the-word')`)).toMatch(/verified payment/);
  });
  it("assigns one module to one student as a personalized assignment (no course), and prevents duplicates", async () => {
    const r = await assign(A, "praise-is-what-i-do");
    const a = (await q(A, `select * from dp_assignments where id='${r.rows[0].id}'`)).rows[0];
    expect(a).toMatchObject({ assigned_to_user_id: A, course_id: null, teaching_module_id: expect.any(String) });
    expect(a.practice_steps.length).toBeGreaterThanOrEqual(4);
    expect(a.practice_items[0].module_key).toBe("praise-is-what-i-do");
    expect(await denied(FAC, `select dp_assign_teaching_module('${A}','praise-is-what-i-do')`)).toMatch(/already assigned/);
    expect(await count(B, `select count(*)::int c from dp_assignments where teaching_module_id is not null`)).toBe(0);
  });
});

describe("visibility", () => {
  it("the student sees ONLY the assigned module; other students and outsiders see nothing", async () => {
    expect((await q(A, `select key from dp_voice_teaching_modules`)).rows.map((r: any) => r.key)).toEqual(["praise-is-what-i-do"]);
    for (const u of [B, UNPAID, STRANGER, TEACHER]) expect(await count(u, `select count(*)::int c from dp_voice_teaching_modules`)).toBe(0);
  });
  it("instructor notes are never visible to students, even for an assigned module; staff can read them", async () => {
    expect(await count(A, `select count(*)::int c from dp_voice_teaching_module_private`)).toBe(0);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_module_private`)).toBe(3);
    expect(await count(TEACHER, `select count(*)::int c from dp_voice_teaching_module_private`)).toBe(0);
    expect(await count(null, `select 1 c`)).toBe(1);
    expect(await count(null, `select count(*)::int c from dp_voice_teaching_modules`).catch(() => 0)).toBe(0);
  });
  it("nobody can change the teaching text through the API", async () => {
    expect(await denied(A, `update dp_voice_teaching_modules set title='x'`).catch((e) => String(e))).toBeTruthy();
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_modules where title='x'`)).toBe(0);
    for (const u of [FAC, A]) { await q(u, `update dp_voice_teaching_modules set title='x'`).catch(() => {}); await q(u, `update dp_voice_teaching_module_private set instructor_notes='{}'`).catch(() => {}); }
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_module_private where instructor_notes='{}'::jsonb`)).toBe(0);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_modules where title='x'`)).toBe(0);
  });
});

describe("existing student workflow is reused and records are preserved", () => {
  it("the student submits the take-home assignment and the instructor reviews it with feedback", async () => {
    const aid = (await q(A, `select id from dp_assignments where teaching_module_id is not null limit 1`)).rows[0].id;
    await q(A, `insert into dp_submissions(assignment_id,student_id,content,status) values ('${aid}','${A}','{"text":"My reflection"}','submitted')`);
    expect(await count(FAC, `select count(*)::int c from dp_submissions where assignment_id='${aid}'`)).toBe(1);
    expect(await count(B, `select count(*)::int c from dp_submissions where assignment_id='${aid}'`)).toBe(0);
    const sid = (await q(A, `select id from dp_submissions where assignment_id='${aid}'`)).rows[0].id;
    await q(FAC, `select dp_review_submission('${sid}','Well done','approved')`);
    expect(await count(A, `select count(*)::int c from dp_feedback`)).toBeGreaterThanOrEqual(1);
  });
  it("after a refund the student keeps reading and revisiting the assigned teaching, but new ones cannot be assigned", async () => {
    await assign(REFUND, "being-in-the-word");
    await db.exec(`update dp_coaching_packages set payment_status='refunded' where student_id='${REFUND}'`);
    expect((await q(REFUND, `select key from dp_voice_teaching_modules`)).rows.map((r: any) => r.key)).toEqual(["being-in-the-word"]);
    expect(await count(REFUND, `select count(*)::int c from dp_assignments where teaching_module_id is not null`)).toBe(1);
    expect(await denied(FAC, `select dp_assign_teaching_module('${REFUND}','psyche-of-a-praiser')`)).toMatch(/verified payment/);
  });
  it("does not touch enrollment or any other student's assignments", async () => {
    expect(await count(FAC, `select count(*)::int c from dp_enrollments where user_id='${STRANGER}'`)).toBe(0);
    expect(await count(FAC, `select count(*)::int c from dp_assignments where assigned_to_user_id='${B}'`)).toBe(0);
  });
});
