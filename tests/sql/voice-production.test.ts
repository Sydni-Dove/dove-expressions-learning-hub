import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser } from "./harness";

const id = (n: number) => `f1f10000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = id(1), B = id(2), C = id(3), T = id(4), ADMIN = id(5), FAC = id(6), D = id(7), E = id(8);
const COURSE = id(21), MODULE = id(31), LESSON = id(41), ASSIGN = id(51), ASSIGN_B = id(52);

let db: PGlite;
const q = (uid: string | null, sql: string, params: any[] = []) => asUser(db, uid, sql, params);
async function denied(uid: string | null, sql: string, params: any[] = []) {
  try { await q(uid, sql, params); } catch (e) { return String((e as Error).message); }
  throw new Error("Expected statement to be rejected: " + sql);
}

beforeAll(async () => {
  ({ db } = await createDb());
  await db.exec(`
   insert into auth.users(id,email) select x::uuid,'u'||substr(x,30)||'@example.test' from unnest(array['${[A, B, C, T, ADMIN, FAC, D, E].join("','")}']) x;
   insert into profiles(id,full_name,email) select id,'User '||substr(id::text,33),email from auth.users where id::text like 'f1f1%';
   update dp_courses set is_published=true where slug='voice-vocal-foundations';
   insert into dp_user_roles(user_id,role) values ('${T}','teacher'),('${ADMIN}','super_admin'),('${FAC}','faculty');
   insert into dp_enrollments(user_id,scope_type,scope_id,status)
     select u,'program',(select id from dp_programs where slug='vocal-coaching'),'active' from unnest(array['${A}','${B}','${D}','${E}']::uuid[]) u;
   insert into dp_courses(id,area_id,program_id,title,slug,is_published,access_mode)
     select '${COURSE}',area_id,id,'Fixture voice','fixture-voice-prod',true,'open' from dp_programs where slug='vocal-coaching';
   insert into dp_modules(id,course_id,title) values ('${MODULE}','${COURSE}','M');
   insert into dp_lessons(id,module_id,title,status) values ('${LESSON}','${MODULE}','L','published');
   insert into dp_class_teachers(course_id,user_id) values ('${COURSE}','${T}');
  `);
  // Assignment scope checks need an authenticated instructor.
  await q(T, `insert into dp_assignments(id,course_id,lesson_id,assigned_to_user_id,title,practice_steps)
     values ('${ASSIGN}','${COURSE}','${LESSON}','${A}','Breath practice',array['Warm up']),
            ('${ASSIGN_B}','${COURSE}','${LESSON}','${B}','B practice',array['Warm up'])`);
}, 120000);
afterAll(async () => { await db.close(); });

describe("private recordings", () => {
  it("allows a student to upload only into their own assignment folder", async () => {
    await q(A, `insert into storage.objects(bucket_id,name,owner) values ('voice-recordings','${A}/${ASSIGN}/take1.m4a','${A}')`);
    await denied(A, `insert into storage.objects(bucket_id,name,owner) values ('voice-recordings','${B}/${ASSIGN}/x.m4a','${A}')`);
    await denied(A, `insert into storage.objects(bucket_id,name,owner) values ('voice-recordings','${A}/${ASSIGN_B}/x.m4a','${A}')`);
    await denied(C, `insert into storage.objects(bucket_id,name,owner) values ('voice-recordings','${C}/${ASSIGN}/x.m4a','${C}')`);
  });
  it("keeps recordings private to the owner and the managing instructor", async () => {
    const path = `${A}/${ASSIGN}/take1.m4a`;
    const read = async (u: string | null) => (await q(u, `select count(*)::int n from storage.objects where name='${path}'`).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    expect(await read(A)).toBe(1);
    expect(await read(T)).toBe(1);
    expect(await read(ADMIN)).toBe(1);
    expect(await read(B)).toBe(0);
    expect(await read(C)).toBe(0);
    expect(await read(null)).toBe(0);
  });
  it("configures the bucket private with size and media-type limits", async () => {
    const { rows } = await db.query<any>(`select public,file_size_limit,allowed_mime_types from storage.buckets where id='voice-recordings'`);
    expect(rows[0].public).toBe(false);
    expect(Number(rows[0].file_size_limit)).toBe(52428800);
    expect(rows[0].allowed_mime_types).toContain("audio/mp4");
    expect(rows[0].allowed_mime_types).not.toContain("text/html");
  });
  it("validates submitted recording references", async () => {
    const own = `storage://voice-recordings/${A}/${ASSIGN}/take1.m4a`;
    await denied(A, `insert into dp_submissions(assignment_id,student_id,file_urls) values ('${ASSIGN}','${A}',array['storage://voice-recordings/${B}/${ASSIGN}/take1.m4a'])`);
    await denied(A, `insert into dp_submissions(assignment_id,student_id,file_urls) values ('${ASSIGN}','${A}',array['http://example.com/x.mp3'])`);
    await denied(A, `insert into dp_submissions(assignment_id,student_id,file_urls) values ('${ASSIGN}','${A}',array['javascript:alert(1)'])`);
    await q(A, `insert into dp_submissions(id,assignment_id,student_id,file_urls,content) values ('${id(61)}','${ASSIGN}','${A}',array['${own}'],'{"response":"one"}')`);
  });
  it("blocks deleting a recording once it is part of a submission, and records attempts", async () => {
    await q(A, `delete from storage.objects where name='${A}/${ASSIGN}/take1.m4a'`);
    expect((await db.query<any>(`select count(*)::int n from storage.objects where name='${A}/${ASSIGN}/take1.m4a'`)).rows[0].n).toBe(1);
    // Instructor returns the work; student uploads a second take and resubmits.
    await q(T, `select dp_review_submission('${id(61)}','Gentler onset','returned')`);
    await q(A, `insert into storage.objects(bucket_id,name,owner) values ('voice-recordings','${A}/${ASSIGN}/take2.m4a','${A}')`);
    await q(A, `update dp_submissions set status='revised',file_urls=array['storage://voice-recordings/${A}/${ASSIGN}/take2.m4a'],content='{"response":"two"}' where id='${id(61)}'`);
    const mine = (await q(A, `select attempt_no,file_urls[1] f from dp_submission_attempts order by attempt_no`)).rows;
    expect(mine.map((r: any) => r.attempt_no)).toEqual([1, 2]);
    expect(mine[0].f).toContain("take1");
    expect(mine[1].f).toContain("take2");
    expect((await q(B, `select count(*)::int n from dp_submission_attempts`)).rows[0].n).toBe(0);
    expect((await q(T, `select count(*)::int n from dp_submission_attempts`)).rows[0].n).toBe(2);
    // The first take is no longer referenced by the open attempt, so it may be removed while returned work is revised.
    await denied(A, `insert into dp_submission_attempts(submission_id,assignment_id,student_id,attempt_no) values ('${id(61)}','${ASSIGN}','${A}',9)`);
  });
});

describe("schedule, capacity and credits", () => {
  const base = `(date_trunc('week', current_date)::date + 7)`; // a future Monday
  const plan = (student: string, cadence: string, minutes: number, dayOffset: number, week: number, time: string) =>
    `insert into dp_coaching_plans(student_id,program_id,instructor_id,cadence,lesson_minutes,first_lesson_on,lesson_time,timezone)
     select '${student}',id,'${T}','${cadence}',${minutes},${base}+${dayOffset + week * 7},'${time}','America/Chicago' from dp_programs where slug='vocal-coaching'`;

  it("rejects overlapping slots but lets two biweekly students alternate weeks", async () => {
    await q(ADMIN, plan(A, "weekly", 60, 0, 0, "10:00"));
    await denied(ADMIN, plan(B, "weekly", 45, 0, 0, "10:30")); // overlaps 10:00-11:00
    await denied(ADMIN, plan(B, "biweekly", 45, 0, 1, "10:30")); // weekly owns every week
    await q(ADMIN, plan(B, "weekly", 45, 0, 0, "11:00")); // adjacent is fine
    await q(ADMIN, plan(D, "biweekly", 60, 1, 0, "14:00"));
    await q(ADMIN, plan(E, "biweekly", 60, 1, 1, "14:00")); // opposite week: shares the position
    await denied(ADMIN, plan(C, "biweekly", 60, 1, 2, "14:00")); // same parity as D (and C is not enrolled)
    const { rows } = await db.query<any>(`select student_id,week_parity from dp_coaching_plans where cadence='biweekly' order by week_parity`);
    expect(rows.map((r: any) => r.week_parity)).toEqual([0, 1]);
    await denied(ADMIN, plan(C, "weekly", 45, 3, 0, "09:00")); // not enrolled
  });
  it("lists the roster for program managers only", async () => {
    expect((await q(T, `select count(*)::int n from dp_program_students('vocal-coaching')`)).rows[0].n).toBe(4);
    expect((await q(ADMIN, `select count(*)::int n from dp_program_students('vocal-coaching')`)).rows[0].n).toBe(4);
    for (const u of [A, C]) expect((await q(u, `select count(*)::int n from dp_program_students('vocal-coaching')`)).rows[0].n).toBe(0);
  });
  it("limits plan management to authorized staff", async () => {
    expect((await q(A, `select count(*)::int n from dp_coaching_plans`)).rows[0].n).toBe(1); // own plan only
    await denied(A, plan(A, "weekly", 45, 4, 0, "08:00"));
    expect((await q(C, `select count(*)::int n from dp_coaching_plans`)).rows[0].n).toBe(0);
    expect((await q(T, `select count(*)::int n from dp_coaching_plans`)).rows[0].n).toBe(4);
  });
  it("generates alternating lessons idempotently", async () => {
    const through = `current_date + 28`;
    const weekly = (await q(T, `select dp_generate_appointments((select id from dp_coaching_plans where student_id='${A}'), ${through}) n`)).rows[0].n;
    const bi = (await q(T, `select dp_generate_appointments((select id from dp_coaching_plans where student_id='${D}'), ${through}) n`)).rows[0].n;
    const bi2 = (await q(T, `select dp_generate_appointments((select id from dp_coaching_plans where student_id='${E}'), ${through}) n`)).rows[0].n;
    expect(weekly).toBeGreaterThanOrEqual(3);
    expect(bi).toBeGreaterThanOrEqual(1);
    expect(bi2).toBeGreaterThanOrEqual(1);
    expect((await q(T, `select dp_generate_appointments((select id from dp_coaching_plans where student_id='${A}'), ${through}) n`)).rows[0].n).toBe(0);
    const overlap = await db.query<any>(`select count(*)::int n from dp_sessions a join dp_sessions b on a.id<b.id and a.mentor_id=b.mentor_id
      and a.scheduled_at<b.scheduled_at+make_interval(mins=>b.lesson_minutes) and b.scheduled_at<a.scheduled_at+make_interval(mins=>a.lesson_minutes)
      where a.plan_id is not null and b.plan_id is not null`);
    expect(overlap.rows[0].n).toBe(0);
    await denied(A, `select dp_generate_appointments((select id from dp_coaching_plans where student_id='${A}'), current_date + 14)`);
    await denied(T, `select dp_generate_appointments((select id from dp_coaching_plans where student_id='${A}'), current_date + 400)`);
  });
  it("consumes credits only for completed, late-cancelled and missed lessons within paid, unexpired packages", async () => {
    const prog = `(select id from dp_programs where slug='vocal-coaching')`;
    await q(ADMIN, `insert into dp_coaching_packages(id,student_id,program_id,lesson_minutes,credits_total,payment_status,expires_at) values
      ('${id(71)}','${A}',${prog},60,2,'paid',now()+interval '30 days'),
      ('${id(72)}','${A}',${prog},60,5,'pending',null),
      ('${id(73)}','${A}',${prog},60,5,'paid',now()-interval '1 day'),
      ('${id(74)}','${A}',${prog},45,5,'paid',null)`);
    const lessons = (await db.query<any>(`select id from dp_sessions where student_id='${A}' and appointment_status='scheduled' order by scheduled_at limit 3`)).rows.map((r: any) => r.id);
    await q(T, `select dp_set_lesson_status('${lessons[0]}','completed')`);
    await q(T, `select dp_set_lesson_status('${lessons[1]}','cancelled')`);
    const bal = async () => (await q(T, `select package_id,credits_remaining from dp_package_balances where package_id in ('${id(71)}','${id(72)}','${id(73)}','${id(74)}') order by package_id`)).rows;
    expect((await bal()).find((r: any) => r.package_id === id(71)).credits_remaining).toBe(1);
    await q(T, `select dp_set_lesson_status('${lessons[2]}','late_cancelled')`);
    expect((await bal()).find((r: any) => r.package_id === id(71)).credits_remaining).toBe(0);
    // Pending/expired/45-minute packages were never drawn on.
    for (const p of [72, 73, 74]) expect((await bal()).find((r: any) => r.package_id === id(p)).credits_remaining).toBe(p === 74 ? 5 : 5);
    // Correcting a status gives the credit back.
    await q(T, `select dp_set_lesson_status('${lessons[2]}','cancelled')`);
    expect((await bal()).find((r: any) => r.package_id === id(71)).credits_remaining).toBe(1);
    await denied(A, `select dp_set_lesson_status('${lessons[0]}','scheduled')`).catch(() => null);
    expect((await db.query<any>(`select appointment_status from dp_sessions where id='${lessons[0]}'`)).rows[0].appointment_status).toBe("completed");
  });
  it("gives students a safe overview and nothing about other students", async () => {
    const mine = (await q(A, `select dp_my_coaching_overview('vocal-coaching') o`)).rows[0].o;
    expect(mine.plan.cadence).toBe("weekly");
    expect(mine.credits_by_minutes).toEqual({ "45": 5, "60": 1 });
    expect(mine.upcoming.length).toBeGreaterThan(0);
    expect(JSON.stringify(mine)).not.toMatch(/private|notes/i);
    expect((await q(C, `select dp_my_coaching_overview('vocal-coaching') o`)).rows[0].o).toBeNull();
    const other = (await q(B, `select dp_my_coaching_overview('vocal-coaching') o`)).rows[0].o;
    expect(other.credits_by_minutes).toEqual({});
    expect(other.packages).toEqual([]);
    expect((await q(B, `select count(*)::int n from dp_coaching_packages`)).rows[0].n).toBe(0);
    await denied(A, `insert into dp_coaching_packages(student_id,program_id,lesson_minutes,credits_total,payment_status) select '${A}',id,60,99,'paid' from dp_programs where slug='vocal-coaching'`);
  });
  it("records WooCommerce purchases idempotently, service role only", async () => {
    const call = (order: string, status: string, who = "service_role") =>
      db.exec(`set role ${who}`).then(() => db.query<any>(`select dp_record_package_purchase('${D}','vocal-coaching',60,4,90,'${order}','1','SKU-60-4','${status}') id`))
        .finally(() => db.exec("reset role"));
    const first = (await call("1001", "pending")).rows[0].id;
    expect((await call("1001", "paid")).rows[0].id).toBe(first);
    const row = (await db.query<any>(`select payment_status from dp_coaching_packages where id='${first}'`)).rows[0];
    expect(row.payment_status).toBe("paid");
    const second = (await call("1002", "paid")).rows[0].id;
    expect((await db.query<any>(`select renewal_of from dp_coaching_packages where id='${second}'`)).rows[0].renewal_of).toBe(first);
    expect((await db.query<any>(`select count(*)::int n from dp_coaching_packages where external_order_id='1001'`)).rows[0].n).toBe(1);
    await expect(call("1003", "paid", "authenticated")).rejects.toThrow();
    await expect(call("1004", "bogus")).rejects.toThrow();
    expect((await q(ADMIN, `select renewed from dp_package_balances where package_id='${first}'`)).rows[0].renewed).toBe(true);
  });
});

describe("consultations", () => {
  it("is visible only to admins and faculty", async () => {
    await q(FAC, `insert into dp_consultation_inquiries(full_name,email,external_id) values ('Prospect','p@example.test','sheet-row-2')`);
    expect((await q(ADMIN, `select count(*)::int n from dp_consultation_inquiries`)).rows[0].n).toBe(1);
    for (const u of [A, T, null]) expect((await q(u, `select count(*)::int n from dp_consultation_inquiries`).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n).toBe(0);
    await denied(A, `insert into dp_consultation_inquiries(full_name,email) values ('x','x@example.test')`);
    await denied(FAC, `insert into dp_consultation_inquiries(full_name,email,external_id) values ('Dup','d@example.test','sheet-row-2')`);
  });
});

describe("testimonials", () => {
  it("records consent, blocks self-approval and enforces the publish gate", async () => {
    await q(A, `insert into dp_voice_testimonials(student_id,review_text,allow_public_use) values ('${A}','Great',true)`);
    await q(B, `insert into dp_voice_testimonials(student_id,review_text,allow_public_use) values ('${B}','Private only',false)`);
    await denied(C, `insert into dp_voice_testimonials(student_id,review_text) values ('${C}','Not a student')`);
    await denied(A, `insert into dp_voice_testimonials(student_id,review_text,status) values ('${A}','self approved','approved')`);
    await denied(A, `insert into dp_voice_testimonials(student_id,review_text,published_at) values ('${A}','self published',now())`);
    await denied(A, `insert into dp_voice_testimonials(student_id,video_path) values ('${A}','${B}/clip.mp4')`);
    await q(A, `update dp_voice_testimonials set status='approved' where student_id='${A}'`); // no student UPDATE policy: zero rows
    expect((await db.query<any>(`select status from dp_voice_testimonials where student_id='${A}'`)).rows[0].status).toBe("pending");
    const rows = (await db.query<any>(`select student_id,consented_at is not null as consented from dp_voice_testimonials order by review_text`)).rows;
    expect(rows.find((r: any) => r.student_id === A).consented).toBe(true);
    expect(rows.find((r: any) => r.student_id === B).consented).toBe(false);
    const idA = (await db.query<any>(`select id from dp_voice_testimonials where student_id='${A}'`)).rows[0].id;
    const idB = (await db.query<any>(`select id from dp_voice_testimonials where student_id='${B}'`)).rows[0].id;
    await denied(FAC, `update dp_voice_testimonials set published_at=now() where id='${idA}'`); // not approved yet
    await q(FAC, `update dp_voice_testimonials set status='approved',reviewed_at=now() where id in ('${idA}','${idB}')`);
    await denied(FAC, `update dp_voice_testimonials set published_at=now() where id='${idB}'`); // approved but no consent
    await denied(FAC, `update dp_voice_testimonials set allow_public_use=true where id='${idB}'`);
    await denied(FAC, `update dp_voice_testimonials set review_text='edited' where id='${idA}'`);
    await q(FAC, `update dp_voice_testimonials set published_at=now() where id='${idA}'`);
    expect((await db.query<any>(`select published_by from dp_voice_testimonials where id='${idA}'`)).rows[0].published_by).toBe(FAC);
    await q(FAC, `update dp_voice_testimonials set status='declined' where id='${idA}'`);
    expect((await db.query<any>(`select published_at from dp_voice_testimonials where id='${idA}'`)).rows[0].published_at).toBeNull();
    expect((await q(B, `select count(*)::int n from dp_voice_testimonials`)).rows[0].n).toBe(1);
    expect((await q(null, `select count(*)::int n from dp_voice_testimonials`).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n).toBe(0);
  });
  it("keeps testimonial videos private to the student and reviewers", async () => {
    await q(A, `insert into storage.objects(bucket_id,name,owner) values ('voice-testimonials','${A}/clip.mp4','${A}')`);
    await denied(C, `insert into storage.objects(bucket_id,name,owner) values ('voice-testimonials','${C}/clip.mp4','${C}')`);
    await denied(A, `insert into storage.objects(bucket_id,name,owner) values ('voice-testimonials','${B}/clip.mp4','${A}')`);
    const read = async (u: string | null) => (await q(u, `select count(*)::int n from storage.objects where bucket_id='voice-testimonials'`)).rows[0].n;
    expect(await read(A)).toBe(1);
    expect(await read(FAC)).toBe(1);
    expect(await read(ADMIN)).toBe(1);
    expect(await read(B)).toBe(0);
    expect(await read(T)).toBe(0);
    await q(A, `insert into dp_voice_testimonials(student_id,video_path,allow_public_use) values ('${A}','${A}/clip.mp4',true)`);
  });
});

describe("draft curriculum content", () => {
  it("adds teaching blocks to draft Voice lessons without publishing or overwriting", async () => {
    const lessons = (await db.query<any>(`select l.slug,l.status,(select count(*)::int from dp_lesson_blocks b where b.lesson_id=l.id) n
      from dp_lessons l where l.slug like 'voice-%' and l.slug not like 'fixture%' order by l.slug`)).rows;
    expect(lessons).toHaveLength(12);
    for (const l of lessons) { expect(l.status).toBe("draft"); expect(l.n).toBe(2); }
    const topics = (await db.query<any>(`select string_agg(content->>'heading',' | ') h from dp_lesson_blocks where block_type='teaching_section'`)).rows[0].h;
    for (const t of ["breath coordination and posture", "pitch accuracy and ear training", "range assessment", "chest, head and mixed", "transitions", "tone and resonance", "agility", "stamina and healthy", "gospel, worship and r&b", "song interpretation", "performance confidence", "development assessment"]) expect(topics.toLowerCase()).toContain(t);
  });
  it("does not touch lessons that already have content", async () => {
    const before = (await db.query<any>(`select count(*)::int n from dp_lesson_blocks`)).rows[0].n;
    const sql = (await import("node:fs")).readFileSync(new URL("../../supabase/migrations/20261029100000_dp_voice_draft_lesson_content.sql", import.meta.url), "utf8");
    await db.exec(sql);
    expect((await db.query<any>(`select count(*)::int n from dp_lesson_blocks`)).rows[0].n).toBe(before);
  });
});
