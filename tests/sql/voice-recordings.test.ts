import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser, grantPaid } from "./harness";

const id = (n: number) => `f2f20000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = id(1), B = id(2), STRANGER = id(3), T = id(4), FAC = id(6);
const COURSE = id(21), MODULE = id(31), LESSON = id(41), ASSIGN_A = id(51), ASSIGN_B = id(52);

let db: PGlite;
const q = (uid: string | null, sql: string, params: any[] = []) => asUser(db, uid, sql, params);
async function denied(uid: string | null, sql: string, params: any[] = []) {
  try { await q(uid, sql, params); } catch (e) { return String((e as Error).message); }
  throw new Error("Expected statement to be rejected: " + sql);
}
const begin = (uid: string, asg: string | null, extra: { part?: number; revise?: string | null; bytes?: number; label?: string } = {}) =>
  q(uid, `select * from dp_recording_begin($1,null,$2,'Take',$3,'audio/mp4',$4,120,$5)`, [asg, extra.label ?? "Verse", extra.part ?? 1, extra.bytes ?? 2_000_000, extra.revise ?? null]);

beforeAll(async () => {
  ({ db } = await createDb());
  await db.exec(`
   insert into auth.users(id,email) select x::uuid,'r'||substr(x,30)||'@example.test' from unnest(array['${[A, B, STRANGER, T, FAC].join("','")}']) x;
   insert into profiles(id,full_name,email) select id,'User '||substr(id::text,33),email from auth.users where id::text like 'f2f2%';
   insert into dp_user_roles(user_id,role) values ('${T}','teacher'),('${FAC}','faculty');
   insert into dp_enrollments(user_id,scope_type,scope_id,status)
     select u,'program',(select id from dp_programs where slug='vocal-coaching'),'active' from unnest(array['${A}','${B}']::uuid[]) u;
   insert into dp_courses(id,area_id,program_id,title,slug,is_published,access_mode)
     select '${COURSE}',area_id,id,'Fixture voice','fixture-voice-rec',true,'open' from dp_programs where slug='vocal-coaching';
   insert into dp_modules(id,course_id,title) values ('${MODULE}','${COURSE}','M');
   insert into dp_lessons(id,module_id,title,status) values ('${LESSON}','${MODULE}','L','published');
   insert into dp_class_teachers(course_id,user_id) values ('${COURSE}','${T}');
  `);
  await grantPaid(db, A); await grantPaid(db, B);
  await q(T, `insert into dp_assignments(id,course_id,lesson_id,assigned_to_user_id,title) values
    ('${ASSIGN_A}','${COURSE}','${LESSON}','${A}','A practice'),('${ASSIGN_B}','${COURSE}','${LESSON}','${B}','B practice')`);
}, 120000);
afterAll(async () => { await db.close(); });

describe("practice recording library", () => {
  let first: string;
  it("reserves a per-student object key and starts as a pending draft", async () => {
    const r = await begin(A, ASSIGN_A);
    first = r.rows[0].id;
    expect(r.rows[0].storage_key).toBe(`voice/${A}/${ASSIGN_A}/${first}.m4a`);
    expect((await q(A, `select status from dp_practice_recordings where id=$1`, [first])).rows[0].status).toBe("pending");
  });
  it("refuses a stranger, another student's assignment and oversize files", async () => {
    expect(await denied(STRANGER, `select * from dp_recording_begin('${ASSIGN_A}',null,'Verse','x',1,'audio/mp4',1000,10)`)).toMatch(/Voice enrollment/);
    expect(await denied(B, `select * from dp_recording_begin('${ASSIGN_A}',null,'Verse','x',1,'audio/mp4',1000,10)`)).toMatch(/not yours/);
    expect(await denied(A, `select * from dp_recording_begin('${ASSIGN_A}',null,'Verse','x',2,'audio/mp4',60000000,10)`)).toMatch(/larger/);
    expect(await denied(A, `select * from dp_recording_begin('${ASSIGN_A}',null,'Verse','x',2,'application/pdf',1000,10)`)).toMatch(/content_type/);
  });
  it("prevents a duplicate numbered part but allows several parts", async () => {
    expect(await denied(A, `select * from dp_recording_begin('${ASSIGN_A}',null,'Verse','dup',1,'audio/mp4',1000,10)`)).toMatch(/duplicate|unique/i);
    const p2 = await begin(A, ASSIGN_A, { part: 2, label: "Chorus" });
    expect(p2.rows[0].id).toBeTruthy();
  });
  it("keeps drafts private to the student and visible to Voice staff only", async () => {
    expect((await q(A, `select id from dp_practice_recordings`)).rows.length).toBe(2);
    expect((await q(B, `select id from dp_practice_recordings`)).rows.length).toBe(0);
    expect((await q(STRANGER, `select id from dp_practice_recordings`)).rows.length).toBe(0);
    expect((await q(FAC, `select id from dp_practice_recordings`)).rows.length).toBe(2);
  });
  it("blocks direct writes; only the functions change state", async () => {
    // Privileges are revoked in the migration; the test harness re-grants table access, so RLS (no write policy) must also hold.
    await q(A, `update dp_practice_recordings set status='reviewed' where id='${first}'`).catch(() => null);
    await q(A, `delete from dp_practice_recordings where id='${first}'`).catch(() => null);
    expect(await denied(A, `insert into dp_practice_recordings(student_id,storage_key,content_type,size_bytes) values ('${A}','voice/x','audio/mp4',1)`)).toMatch(/row-level security|permission/);
    expect((await q(A, `select status from dp_practice_recordings where id='${first}'`)).rows[0].status).toBe("pending");
  });
  it("cannot submit before the upload is confirmed, then saves and submits once", async () => {
    expect((await q(A, `select dp_recording_submit(array['${first}']::uuid[]) n`)).rows[0].n).toBe(0);
    await q(A, `select dp_recording_mark_saved('${first}',1900000,118)`);
    expect(await denied(B, `select dp_recording_mark_saved('${first}',1,1)`)).toMatch(/not found/);
    expect((await q(A, `select dp_recording_submit(array['${first}']::uuid[]) n`)).rows[0].n).toBe(1);
    expect((await q(A, `select dp_recording_submit(array['${first}']::uuid[]) n`)).rows[0].n).toBe(0);
  });
  it("lets a student discard only unsubmitted drafts", async () => {
    expect(await denied(A, `select dp_recording_discard('${first}')`)).toMatch(/unsubmitted/);
    const draft = (await begin(A, ASSIGN_A, { part: 3 })).rows[0].id;
    expect(await denied(B, `select dp_recording_discard('${draft}')`)).toMatch(/unsubmitted/);
    expect((await q(A, `select dp_recording_discard('${draft}') k`)).rows[0].k).toContain(draft);
  });
  it("only Voice staff review; feedback is appended and the original is preserved", async () => {
    expect(await denied(A, `select dp_recording_review('${first}','reviewed','nice')`)).toMatch(/not authorized/);
    await q(FAC, `select dp_recording_review('${first}','returned','Try again slower','Do the hum exercise twice')`);
    const rec = (await q(A, `select status,size_bytes from dp_practice_recordings where id='${first}'`)).rows[0];
    expect(rec.status).toBe("returned");
    expect(Number(rec.size_bytes)).toBe(1900000);
    const fb = (await q(A, `select kind,body,follow_up from dp_practice_recording_feedback where recording_id='${first}'`)).rows;
    expect(fb).toEqual([{ kind: "return_for_revision", body: "Try again slower", follow_up: "Do the hum exercise twice" }]);
    await q(FAC, `update dp_practice_recording_feedback set body='changed'`).catch(() => null);
    await q(FAC, `delete from dp_practice_recording_feedback`).catch(() => null);
    expect((await q(A, `select body from dp_practice_recording_feedback where recording_id='${first}'`)).rows[0].body).toBe("Try again slower");
    expect((await q(B, `select * from dp_practice_recording_feedback`)).rows.length).toBe(0);
  });
  it("revises a returned recording as a new row and keeps the original", async () => {
    expect(await denied(A, `select * from dp_recording_begin(null,null,'Verse','x',1,'audio/mp4',1000,10,'${(await begin(A, ASSIGN_A, { part: 4 })).rows[0].id}')`)).toMatch(/returned for revision/);
    const rev = (await begin(A, null, { revise: first })).rows[0];
    const row = (await q(A, `select revision_no,revision_of,part_no from dp_practice_recordings where id='${rev.id}'`)).rows[0];
    expect(row).toMatchObject({ revision_no: 2, revision_of: first, part_no: 1 });
    expect(await denied(A, `select * from dp_recording_begin(null,null,'Verse','x',1,'audio/mp4',1000,10,'${first}')`)).toMatch(/duplicate|unique/i);
    expect((await q(A, `select status from dp_practice_recordings where id='${first}'`)).rows[0].status).toBe("returned");
  });
  it("enforces the per-assignment recording cap", async () => {
    expect(await denied(A, `select * from dp_recording_begin('${ASSIGN_A}',null,'Verse','x',9,'audio/mp4',1000,10,null,2)`)).toMatch(/maximum number/);
  });
  it("cleanup is service-role only and targets abandoned uploads and discarded drafts", async () => {
    await denied(A, `select * from dp_recording_cleanup_candidates(0)`);
    await db.exec(`update dp_practice_recordings set created_at=now()-interval '2 days' where status='pending'`);
    await db.exec(`set role service_role`);
    const rows = (await db.query<any>(`select id,storage_key from dp_recording_cleanup_candidates(24)`)).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.storage_key.startsWith("voice/"))).toBe(true);
    expect((await db.query<any>(`select dp_recording_mark_purged($1::uuid[]) n`, [rows.map((r) => r.id)])).rows[0].n).toBe(rows.length);
    await db.exec(`reset role`);
    await db.exec(`set role service_role`);
    expect((await db.query<any>(`select count(*)::int c from dp_recording_cleanup_candidates(24)`)).rows[0].c).toBe(0);
    await db.exec(`reset role`);
  });
  it("removes access when a student leaves Voice", async () => {
    await db.exec(`update dp_enrollments set status='cancelled' where user_id='${A}'`);
    expect((await q(A, `select id from dp_practice_recordings`)).rows.length).toBe(0);
    await db.exec(`update dp_enrollments set status='active' where user_id='${A}'`);
  });
});
