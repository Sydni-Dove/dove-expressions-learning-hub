import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser } from "./harness";

const id = (n: number) => `f1f10000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = id(1), B = id(2), C = id(3), T = id(4), ADMIN = id(5), FAC = id(6), D = id(7), E = id(8);
const TIER = id(91), COURSE = id(21), MODULE = id(31), LESSON = id(41), ASSIGN = id(51), ASSIGN_B = id(52);

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
  it("records WooCommerce purchases from configurable tiers, idempotently, service role only", async () => {
    await q(ADMIN, `insert into dp_coaching_tiers(id,program_id,slug,name,lesson_minutes,lesson_count,valid_days,resource_level,personal_plan,assessments_included,recording_feedback_included,woo_product_ids)
      select '${TIER}',id,'guided','Guided',60,4,90,2,true,1,3,array['2001'] from dp_programs where slug='vocal-coaching'`);
    const call = (order: string, status: string, who = "service_role", qty = 1) =>
      db.exec(`set role ${who}`).then(() => db.query<any>(`select dp_record_package_purchase('${D}','${TIER}',${qty},'${order}','1','wc-product-2001','${status}') id`))
        .finally(() => db.exec("reset role"));
    const first = (await call("1001", "pending")).rows[0].id;
    expect((await call("1001", "paid")).rows[0].id).toBe(first);
    const row = (await db.query<any>(`select payment_status,credits_total,lesson_minutes,tier_name,resource_level,personal_plan,assessments_included,recording_feedback_included,expires_at is not null exp from dp_coaching_packages where id='${first}'`)).rows[0];
    expect(row).toMatchObject({ payment_status: "paid", credits_total: 4, lesson_minutes: 60, tier_name: "Guided", resource_level: 2, personal_plan: true, assessments_included: 1, recording_feedback_included: 3, exp: true });
    const second = (await call("1002", "paid", "service_role", 2)).rows[0].id;
    expect((await db.query<any>(`select renewal_of,credits_total,assessments_included from dp_coaching_packages where id='${second}'`)).rows[0]).toMatchObject({ renewal_of: first, credits_total: 8, assessments_included: 2 });
    expect((await db.query<any>(`select count(*)::int n from dp_coaching_packages where external_order_id='1001'`)).rows[0].n).toBe(1);
    await expect(call("1003", "paid", "authenticated")).rejects.toThrow();
    await expect(call("1004", "bogus")).rejects.toThrow();
    expect((await q(ADMIN, `select renewed from dp_package_balances where package_id='${first}'`)).rows[0].renewed).toBe(true);
  });
  it("snapshots entitlements so later tier edits do not change purchased packages", async () => {
    await q(ADMIN, `update dp_coaching_tiers set lesson_count=10,resource_level=0,personal_plan=false where id='${TIER}'`);
    const row = (await db.query<any>(`select credits_total,resource_level,personal_plan from dp_coaching_packages where external_order_id='1001'`)).rows[0];
    expect(row).toMatchObject({ credits_total: 4, resource_level: 2, personal_plan: true });
    await q(ADMIN, `update dp_coaching_tiers set lesson_count=4,resource_level=2,personal_plan=true where id='${TIER}'`);
  });
  it("lets only program managers manage tiers and prevents one product in two active packages", async () => {
    await denied(A, `insert into dp_coaching_tiers(program_id,slug,name,lesson_minutes,lesson_count) select id,'x','X',45,1 from dp_programs where slug='vocal-coaching'`);
    expect((await q(A, `select count(*)::int n from dp_coaching_tiers`)).rows[0].n).toBe(0);
    await denied(ADMIN, `insert into dp_coaching_tiers(program_id,slug,name,lesson_minutes,lesson_count,woo_product_ids) select id,'dup','Dup',45,1,array['2001','2002'] from dp_programs where slug='vocal-coaching'`);
    await denied(ADMIN, `insert into dp_coaching_tiers(program_id,slug,name,lesson_minutes,lesson_count) select id,'bad','Bad',30,1 from dp_programs where slug='vocal-coaching'`);
    await q(ADMIN, `insert into dp_coaching_tiers(program_id,slug,name,lesson_minutes,lesson_count,is_active,woo_product_ids) select id,'retired','Retired',45,1,false,array['2001'] from dp_programs where slug='vocal-coaching'`);
  });
  it("lets instructors record a package from a tier but never students", async () => {
    const pkg = (await q(T, `select dp_create_package('${E}','${TIER}','complimentary',2) id`)).rows[0].id;
    expect((await db.query<any>(`select credits_total,payment_status,source from dp_coaching_packages where id='${pkg}'`)).rows[0]).toMatchObject({ credits_total: 8, payment_status: "complimentary", source: "manual" });
    await denied(E, `select dp_create_package('${E}','${TIER}','paid')`);
    await denied(T, `select dp_create_package('${E}','${TIER}','refunded')`);
  });
  it("shows students their package benefits and feedback usage", async () => {
    const o = (await q(D, `select dp_my_coaching_overview('vocal-coaching') o`)).rows[0].o;
    const g = o.packages.find((p: any) => p.tier_name === "Guided" && p.credits_total === 4);
    expect(g).toMatchObject({ resource_level: 2, personal_plan: true, assessments_included: 1, recording_feedback_included: 3, recording_feedback_used: 0 });
  });
});

describe("level-gated reusable library", () => {
  const gated = id(81), open = id(82);
  beforeAll(async () => {
    await db.exec(`insert into dp_lessons(id,module_id,title,status) values ('${gated}','${MODULE}','Advanced resonance','published'),('${open}','${MODULE}','Open lesson','published')`);
  });
  const visible = async (u: string, lesson: string) => (await q(u, `select count(*)::int n from dp_lessons where id='${lesson}'`)).rows[0].n;
  it("keeps untagged lessons open to every enrolled student (no behaviour change)", async () => {
    for (const u of [A, B, D, E]) expect(await visible(u, open)).toBe(1);
    expect(await visible(C, open)).toBe(0); // not enrolled
  });
  it("hides a tagged lesson until the student's package level reaches it", async () => {
    await denied(A, `insert into dp_lesson_access(lesson_id,min_level) values ('${gated}',1)`);
    await q(T, `insert into dp_lesson_access(lesson_id,min_level) values ('${gated}',2)`);
    expect(await visible(A, gated)).toBe(0);  // no package
    expect(await visible(B, gated)).toBe(0);
    expect(await visible(D, gated)).toBe(1);  // Guided package, level 2, paid
    expect(await visible(T, gated)).toBe(1);  // instructor
    expect(await visible(ADMIN, gated)).toBe(1);
    expect(await visible(C, gated)).toBe(0);
  });
  it("stops granting access when the package is refunded or expired", async () => {
    await db.exec(`update dp_coaching_packages set payment_status='refunded' where student_id='${D}' and tier_id='${TIER}'`);
    expect(await visible(D, gated)).toBe(0);
    await db.exec(`update dp_coaching_packages set payment_status='paid',expires_at=now()-interval '1 day' where student_id='${D}' and tier_id='${TIER}'`);
    expect(await visible(D, gated)).toBe(0);
    await db.exec(`update dp_coaching_packages set expires_at=null where student_id='${D}' and tier_id='${TIER}'`);
    expect(await visible(D, gated)).toBe(1);
  });
  it("does not let a student read the access table or lower a level", async () => {
    expect((await q(D, `select count(*)::int n from dp_lesson_access`)).rows[0].n).toBe(0);
    await q(D, `delete from dp_lesson_access where lesson_id='${gated}'`);
    expect((await db.query<any>(`select count(*)::int n from dp_lesson_access`)).rows[0].n).toBe(1);
    await q(T, `delete from dp_lesson_access where lesson_id='${gated}'`);
    expect(await visible(A, gated)).toBe(1);
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

describe("student resource area", () => {
  const ex1 = id(101), ex2 = id(102), ex3 = id(103);
  beforeAll(async () => {
    // Skills exist from the migration; exercises are authored by the instructor (admin) below.
  });
  it("lets only the instructor manage the exercise library and templates; enrolled students read active exercises", async () => {
    const s = (await db.query<any>(`select id from dp_voice_skills where slug='breath-posture'`)).rows[0].id;
    await q(ADMIN, `insert into dp_voice_exercises(id,skill_id,title,instructions,video_url,source_name,minutes) values
      ('${ex1}','${s}','Lip trills','Gentle, steady airflow','https://www.youtube.com/watch?v=abc','YouTube',5),
      ('${ex2}','${s}','Hiss breathing','Four-count inhale, steady hiss',null,null,3)`);
    await q(ADMIN, `insert into dp_voice_exercises(id,skill_id,title,is_active) values ('${ex3}','${s}','Retired drill',false)`);
    await denied(ADMIN, `insert into dp_voice_exercises(skill_id,title,video_url) values ('${s}','Bad link','javascript:alert(1)')`);
    await denied(ADMIN, `insert into dp_voice_exercises(skill_id,title,video_url) values ('${s}','Insecure','http://example.com/v')`);
    await denied(A, `insert into dp_voice_exercises(skill_id,title) values ('${s}','Student made')`);
    await q(ADMIN, `insert into dp_voice_plan_templates(title,items) values ('Week 1 foundations','[{"exercise_id":"${ex1}"}]')`);
    const names = async (u: string | null) => (await q(u, `select title from dp_voice_exercises order by title`).catch(() => ({ rows: [] }))).rows.map((r: any) => r.title);
    expect(await names(A)).toEqual(["Hiss breathing", "Lip trills"]);
    expect(await names(T)).toEqual(["Hiss breathing", "Lip trills", "Retired drill"]);
    expect(await names(C)).toEqual([]);
    expect(await names(null)).toEqual([]);
    expect((await q(A, `select count(*)::int n from dp_voice_plan_templates`)).rows[0].n).toBe(0);
    expect((await q(A, `select count(*)::int n from dp_voice_skills`)).rows[0].n).toBeGreaterThanOrEqual(9);
  });
  it("assigns a weekly plan to one student as a snapshot, with checklist steps", async () => {
    const plan = (await q(ADMIN, `select dp_assign_weekly_plan('${A}','Week of Nov 2','Focus on easy airflow','Steadier breath','2026-11-08',
      '[{"exercise_id":"${ex1}","note":"Slowly","minutes":6},{"exercise_id":"${ex2}"}]'::jsonb) id`)).rows[0].id;
    await q(ADMIN, `update dp_voice_exercises set title='Lip trills (renamed)',video_url='https://example.com/new' where id='${ex1}'`);
    const mine = (await q(A, `select title,goal,practice_steps,practice_items,due_at from dp_assignments where id='${plan}'`)).rows[0];
    expect(mine.practice_steps).toEqual(["Lip trills (6 min)", "Hiss breathing (3 min)"]);
    expect(mine.practice_items[0]).toMatchObject({ title: "Lip trills", note: "Slowly", minutes: 6, video_url: "https://www.youtube.com/watch?v=abc", skill: "Breath and posture" });
    expect(mine.goal).toBe("Steadier breath");
    expect((await q(B, `select count(*)::int n from dp_assignments where id='${plan}'`)).rows[0].n).toBe(0);
    expect((await q(C, `select count(*)::int n from dp_assignments where id='${plan}'`)).rows[0].n).toBe(0);
  });
  it("rejects plans from students, for non-members, with retired or missing exercises, or empty", async () => {
    const call = (u: string, who: string, items: string) => q(u, `select dp_assign_weekly_plan('${who}','Plan','',null,null,'${items}'::jsonb)`);
    await expect(call(A, A, `[{"exercise_id":"${ex2}"}]`)).rejects.toThrow(/not authorized/);
    await expect(call(ADMIN, C, `[{"exercise_id":"${ex2}"}]`)).rejects.toThrow(/not enrolled/);
    await expect(call(ADMIN, A, `[{"exercise_id":"${ex3}"}]`)).rejects.toThrow(/no longer available/);
    await expect(call(ADMIN, A, `[{"exercise_id":"${id(999)}"}]`)).rejects.toThrow(/no longer available/);
    await expect(call(ADMIN, A, `[]`)).rejects.toThrow(/between 1 and 20/);
  });
  it("lets the student complete the plan, record and submit homework, and the instructor review it", async () => {
    const plan = (await db.query<any>(`select id from dp_assignments where title='Week of Nov 2'`)).rows[0].id;
    await q(A, `insert into dp_assignment_progress(assignment_id,student_id,checked_steps,minutes,response) values ('${plan}','${A}',array[0,1],9,'Felt easier')`);
    await q(A, `insert into storage.objects(bucket_id,name,owner) values ('voice-recordings','${A}/${plan}/take.m4a','${A}')`);
    await q(A, `insert into dp_submissions(assignment_id,student_id,file_urls,content) values ('${plan}','${A}',array['storage://voice-recordings/${A}/${plan}/take.m4a'],'{"minutes":9}')`);
    expect((await q(ADMIN, `select count(*)::int n from dp_submissions where assignment_id='${plan}'`)).rows[0].n).toBe(1);
    expect((await q(B, `select count(*)::int n from dp_submissions where assignment_id='${plan}'`)).rows[0].n).toBe(0);
    expect((await q(ADMIN, `select count(*)::int n from storage.objects where name like '${A}/${plan}/%'`)).rows[0].n).toBe(1);
    await q(ADMIN, `select dp_review_submission((select id from dp_submissions where assignment_id='${plan}'),'Lovely steady airflow','approved')`);
    expect((await q(A, `select count(*)::int n from dp_feedback where content='Lovely steady airflow'`)).rows[0].n).toBe(1);
  });
  it("limits goals to the instructor, lets the student read their own and log progress only", async () => {
    await q(ADMIN, `insert into dp_voice_goals(id,student_id,title,detail) values ('${id(111)}','${A}','Sing the chorus in tune','Match pitch on the bridge'),('${id(112)}','${B}','Breath control','')`);
    expect((await q(A, `select count(*)::int n from dp_voice_goals`)).rows[0].n).toBe(1);
    expect((await q(C, `select count(*)::int n from dp_voice_goals`)).rows[0].n).toBe(0);
    await denied(A, `insert into dp_voice_goals(student_id,title) values ('${A}','Self goal')`);
    await q(A, `update dp_voice_goals set status='achieved' where id='${id(111)}'`);
    expect((await db.query<any>(`select status from dp_voice_goals where id='${id(111)}'`)).rows[0].status).toBe("active");
    await q(A, `insert into dp_voice_goal_updates(goal_id,author_id,note,rating) values ('${id(111)}','${A}','Hit the high note twice',4)`);
    await denied(A, `insert into dp_voice_goal_updates(goal_id,author_id,note) values ('${id(112)}','${A}','not my goal')`);
    await denied(A, `insert into dp_voice_goal_updates(goal_id,author_id,note) values ('${id(111)}','${B}','impersonation')`);
    await denied(A, `insert into dp_voice_goal_updates(goal_id,author_id,rating) values ('${id(111)}','${A}',9)`);
    await q(ADMIN, `insert into dp_voice_goal_updates(goal_id,author_id,note) values ('${id(111)}','${ADMIN}','Great progress')`);
    expect((await q(A, `select count(*)::int n from dp_voice_goal_updates`)).rows[0].n).toBe(2);
    expect((await q(B, `select count(*)::int n from dp_voice_goal_updates`)).rows[0].n).toBe(0);
    await q(ADMIN, `update dp_voice_goals set status='achieved' where id='${id(111)}'`);
    expect((await db.query<any>(`select achieved_at is not null a from dp_voice_goals where id='${id(111)}'`)).rows[0].a).toBe(true);
  });
  it("shows the welcome and practice guide to enrolled students and lets only staff edit them", async () => {
    expect((await q(A, `select count(*)::int n from dp_voice_resource_content`)).rows[0].n).toBe(2);
    expect((await q(C, `select count(*)::int n from dp_voice_resource_content`)).rows[0].n).toBe(0);
    await q(A, `update dp_voice_resource_content set body='hacked' where key='welcome'`);
    expect((await db.query<any>(`select body from dp_voice_resource_content where key='welcome'`)).rows[0].body).not.toBe("hacked");
    await q(ADMIN, `update dp_voice_resource_content set body='Edited welcome' where key='welcome'`);
    expect((await q(A, `select body from dp_voice_resource_content where key='welcome'`)).rows[0].body).toBe("Edited welcome");
  });
});
