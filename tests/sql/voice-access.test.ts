import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser } from "./harness";

/** Onboarding and payment-access rules, enforced by the database: intake BEFORE payment; assessments, recordings, new practice and coaching resources AFTER verified payment. */
const id = (n: number) => `f6f60000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const FAC = id(1), PROSPECT = id(2), UNPAID = id(3), PAID = id(4), OTHER = id(5), STRANGER = id(6), INST = id(7), REFUND = id(8), EXPIRED = id(9), AMBIG = id(10), PLUS = id(11);
const TIER = id(91), TIER3 = id(92), TIER_NOASSESS = id(93);
let db: PGlite;
const emailOf = (uid: string) => `a${uid.slice(29)}@example.test`;
const q = (uid: string | null, sql: string, params: any[] = []) => asUser(db, uid, sql, params);
async function denied(uid: string | null, sql: string) { try { await q(uid, sql); } catch (e) { return String((e as Error).message); } throw new Error("Expected statement to be rejected: " + sql); }
const asService = async <T>(fn: () => Promise<T>) => { await db.exec("set role service_role"); try { return await fn(); } finally { await db.exec("reset role"); } };
const buy = (student: string, tier: string, order: string, status = "paid", planRef: string | null = null) =>
  asService(() => db.query<any>(`select dp_record_package_purchase('${student}','${tier}',1,'${order}','1','wc-sku','${status}',${planRef ? `'${planRef}'` : "null"}) id`));
const count = async (uid: string | null, sql: string) => (await q(uid, sql)).rows[0].c as number;
const access = async (uid: string) => (await q(uid, `select dp_voice_my_access() a`)).rows[0].a;
const assign = (student: string, kind = "creative_expression", reason = "Fits their goals") => q(FAC, `select dp_assessment_assign('${student}','${kind}','${reason}') id`);
const WEEKLY = (s: string) => `dp_assign_weekly_plan('${s}','Week','n','g',current_date+7,jsonb_build_array(jsonb_build_object('exercise_id',(select id from dp_voice_exercises where curriculum_key='stance-check'))))`;

beforeAll(async () => {
  ({ db } = await createDb());
  await db.exec(`
   insert into auth.users(id,email) select x::uuid,'a'||substr(x,30)||'@example.test' from unnest(array['${[FAC, PROSPECT, UNPAID, PAID, OTHER, STRANGER, INST, REFUND, EXPIRED, AMBIG, PLUS].join("','")}']) x;
   insert into profiles(id,full_name,email) select id,'Person '||substr(id::text,33),email from auth.users where id::text like 'f6f6%';
   insert into dp_user_roles(user_id,role) values ('${FAC}','faculty');
   insert into dp_enrollments(user_id,scope_type,scope_id,status)
     select u,'program',(select id from dp_programs where slug='vocal-coaching'),'active' from unnest(array['${[UNPAID, PAID, OTHER, INST, REFUND, EXPIRED, AMBIG, PLUS].join("','")}']::uuid[]) u;
   insert into dp_coaching_tiers(id,program_id,slug,name,lesson_minutes,lesson_count,installments,assessments_included,woo_product_ids)
     select '${TIER}',id,'one','One payment',60,4,1,2,array['wc-1'] from dp_programs where slug='vocal-coaching';
   insert into dp_coaching_tiers(id,program_id,slug,name,lesson_minutes,lesson_count,installments,assessments_included,woo_product_ids)
     select '${TIER3}',id,'three','Three payments',60,12,3,3,array['wc-3'] from dp_programs where slug='vocal-coaching';
   insert into dp_coaching_tiers(id,program_id,slug,name,lesson_minutes,lesson_count,installments,assessments_included,woo_product_ids)
     select '${TIER_NOASSESS}',id,'none','No assessments',60,1,1,0,array['wc-0'] from dp_programs where slug='vocal-coaching';
  `);
}, 180000);
afterAll(async () => { await db.close(); });

describe("1-2. intake and the Vocal Demo happen BEFORE payment and unlock nothing", () => {
  it("an instructor invites someone after a consultation; they can complete the intake without enrolling or paying", async () => {
    expect(await access(PROSPECT)).toMatchObject({ enrolled: false, intake: false, paid: false });
    expect(await denied(PROSPECT, `select dp_voice_submit_intake('{}'::jsonb,'{}')`)).toMatch(/enrollment or an intake invitation/);
    expect(await denied(UNPAID, `select dp_voice_invite_intake('x@example.test')`)).toMatch(/Not authorized/);
    expect(await denied(FAC, `select dp_voice_invite_intake('nobody@example.test')`)).toMatch(/No account uses that email/);
    await q(FAC, `select dp_voice_invite_intake('${emailOf(PROSPECT)}')`);
    expect(await access(PROSPECT)).toMatchObject({ enrolled: false, intake: true, paid: false, status: "none" });
    await q(PROSPECT, `select dp_voice_submit_intake('{"goals":"ad-libbing"}'::jsonb, array['spontaneous_expression'])`);
    expect(await count(PROSPECT, `select count(*)::int c from dp_voice_intakes`)).toBe(1);
    expect(await count(STRANGER, `select count(*)::int c from dp_voice_intakes`)).toBe(0);
    expect(await denied(STRANGER, `select dp_voice_submit_intake('{}'::jsonb,'{}')`)).toMatch(/enrollment or an intake invitation/);
  });
  it("an enrolled student with no payment can also complete the intake; a Google Forms row can be imported for either", async () => {
    await q(UNPAID, `select dp_voice_submit_intake('{"goals":"harmony"}'::jsonb, '{}')`);
    expect(await count(UNPAID, `select count(*)::int c from dp_voice_intakes`)).toBe(1);
    const r = (await q(FAC, `select * from dp_voice_import_intake('${PROSPECT}','{"goals":"from the form"}'::jsonb, array['spontaneous_expression'], now(), 'import-key-prospect-0001')`)).rows[0];
    expect(r.duplicate).toBe(false);
    expect((await q(FAC, `select * from dp_voice_import_intake('${PROSPECT}','{"goals":"from the form"}'::jsonb, array['spontaneous_expression'], now(), 'import-key-prospect-0001')`)).rows[0].duplicate).toBe(true);
    expect(await denied(FAC, `select * from dp_voice_import_intake('${STRANGER}','{}'::jsonb,'{}',now(),'import-key-stranger-0001')`)).toMatch(/not enrolled in Voice and has not been invited/);
  });
  it("the instructor records the Vocal Demo at the consultation, before payment; it is append-only, staff-controlled and validated", async () => {
    expect(await denied(PROSPECT, `select dp_voice_record_demo('${PROSPECT}','{"pitch-ear":3}'::jsonb,'','','',false)`)).toMatch(/Not authorized/);
    expect(await denied(FAC, `select dp_voice_record_demo('${STRANGER}','{"pitch-ear":3}'::jsonb,'','','',false)`)).toMatch(/not enrolled in Voice and has not been invited/);
    expect(await denied(FAC, `select dp_voice_record_demo('${PROSPECT}','{}'::jsonb,'','','',false)`)).toMatch(/at least one skill/);
    expect(await denied(FAC, `select dp_voice_record_demo('${PROSPECT}','{"pitch-ear":6}'::jsonb,'','','',false)`)).toMatch(/1 to 5/);
    expect(await denied(FAC, `select dp_voice_record_demo('${PROSPECT}','{"singing-in-tongues":3}'::jsonb,'','','',false)`)).toMatch(/not one of the 12 skill areas/);
    await q(FAC, `select dp_voice_record_demo('${PROSPECT}','{"pitch-ear":2,"range":3,"posture-breath":2,"tone-resonance":3,"agility":1}'::jsonb,'Warm tone','Breath first','Private: nervous',false)`);
    expect(await count(PROSPECT, `select count(*)::int c from dp_voice_demos`)).toBe(0); // private until shared
    await q(FAC, `select dp_voice_record_demo('${PROSPECT}','{"pitch-ear":3,"range":3,"posture-breath":2,"tone-resonance":3,"agility":1}'::jsonb,'Warm tone','Breath first','Private: corrected',true)`);
    expect((await q(PROSPECT, `select strengths from dp_voice_demos`)).rows).toEqual([{ strengths: "Warm tone" }]);
    expect(await count(PROSPECT, `select count(*)::int c from dp_voice_demo_private`)).toBe(0);
    expect(await count(FAC, `select count(*)::int c from dp_voice_demos where student_id='${PROSPECT}'`)).toBe(2); // history kept
    expect(await count(STRANGER, `select count(*)::int c from dp_voice_demos`)).toBe(0);
  });
  it("intake and the demo unlock nothing: no enrollment, resources, assessments, recordings, practice or plan", async () => {
    for (const who of [PROSPECT, UNPAID]) {
      expect(await count(who, `select count(*)::int c from dp_voice_resource_content`), "resources").toBe(0);
      expect(await count(who, `select count(*)::int c from dp_voice_exercises`), "exercise library").toBe(0);
      expect(await count(who, `select count(*)::int c from dp_voice_skills`), "skills").toBe(0);
      expect(await count(who, `select count(*)::int c from dp_voice_assessments`), "assessments").toBe(0);
      expect(await denied(who, `select * from dp_recording_begin(null,null,'Verse','t',1,'audio/mp4',1000,30)`)).toMatch(/Voice enrollment|paid, current/);
      expect((await access(who)).paid).toBe(false);
    }
    expect(await count(null, `select count(*)::int c from dp_enrollments where user_id='${PROSPECT}'`)).toBe(0); // intake never enrolls anyone
    expect(await access(PROSPECT)).toMatchObject({ enrolled: false });
    expect(await denied(FAC, `select ${WEEKLY(UNPAID)} x`)).toMatch(/verified payment/);
    expect(await denied(FAC, `select ${WEEKLY(PROSPECT)} x`)).toMatch(/not enrolled|verified payment/);
  });
});

describe("3. unpaid students cannot be given assessments", () => {
  it("the instructor cannot assign, and even a raw insert is refused by the table", async () => {
    expect(await denied(FAC, `select dp_assessment_assign('${UNPAID}','creative_expression','Fits their goals')`)).toMatch(/verified payment/);
    expect(await denied(FAC, `select dp_assessment_assign('${PROSPECT}','creative_expression','Fits')`)).toMatch(/not enrolled/);
    try { await db.exec(`insert into dp_voice_assessments(student_id,kind) values ('${UNPAID}','creative_expression')`); throw new Error("inserted"); } catch (e) { expect(String(e)).toMatch(/verified payment/); }
    expect(await count(FAC, `select count(*)::int c from dp_voice_assessments where student_id in ('${UNPAID}','${PROSPECT}')`)).toBe(0);
  });
  it("manual and complimentary packages are not verified payment", async () => {
    await q(FAC, `select dp_create_package('${UNPAID}','${TIER}','paid')`);
    await q(FAC, `select dp_create_package('${UNPAID}','${TIER}','complimentary')`);
    expect((await access(UNPAID)).paid).toBe(false);
    expect(await denied(FAC, `select dp_assessment_assign('${UNPAID}','creative_expression','Fits')`)).toMatch(/verified payment/);
  });
});

describe("4-6. verified payment unlocks eligibility, never automatic assignment", () => {
  it("a verified, attributed WooCommerce payment makes only that student eligible; nothing is assigned automatically", async () => {
    await buy(PAID, TIER, "ord-paid-1");
    expect(await access(PAID)).toMatchObject({ enrolled: true, paid: true, status: "paid" });
    expect((await access(OTHER)).paid).toBe(false); // someone else's payment does not count
    expect(await count(FAC, `select count(*)::int c from dp_voice_assessments where student_id='${PAID}'`)).toBe(0);
    expect(await count(PAID, `select count(*)::int c from dp_voice_assessments`)).toBe(0);
  });
  it("assignment is an instructor decision, one at a time, with a reason, within what the package includes", async () => {
    expect(await denied(FAC, `select dp_assessment_assign('${PAID}','creative_expression','   ')`)).toMatch(/why this assessment fits/);
    expect(await denied(PAID, `select dp_assessment_assign('${PAID}','creative_expression','mine')`)).toMatch(/Not authorized/);
    const first = (await assign(PAID)).rows[0].id;
    expect((await q(PAID, `select assign_reason from dp_voice_assessments where id='${first}'`)).rows[0].assign_reason).toBe("Fits their goals");
    expect(await count(PAID, `select count(*)::int c from dp_voice_assessments`)).toBe(1); // only the one chosen
    await q(FAC, `select dp_voice_set_my_tracks('{}')`).catch(() => null);
  });
  it("a package that includes no assessments allows none; the allowance runs out", async () => {
    await buy(INST, TIER_NOASSESS, "ord-noassess-1");
    expect(await denied(FAC, `select dp_assessment_assign('${INST}','creative_expression','Fits')`)).toMatch(/does not include another assessment/);
    // PAID's package includes 2: finish the first, assign the second, then the allowance is spent
    const first = (await q(PAID, `select id from dp_voice_assessments order by assigned_at limit 1`)).rows[0].id;
    await q(PAID, `select dp_assessment_save('${first}','{"s_adlib":"Not yet"}'::jsonb)`); await q(PAID, `select dp_assessment_submit('${first}')`);
    await assign(PAID, "creative_expression", "second");
    await q(PAID, `select dp_assessment_submit((select id from dp_voice_assessments where status='assigned' limit 1))`);
    expect(await denied(FAC, `select dp_assessment_assign('${PAID}','creative_expression','third')`)).toMatch(/does not include another assessment/);
  });
  it("prophetic assessments need the student's selection AND the instructor's authorization, on top of payment", async () => {
    await buy(PLUS, TIER3, "ord-plus-1");
    await q(FAC, `select dp_voice_approve_tracks('${PLUS}', array[]::text[])`).catch(() => null);
    expect(await denied(FAC, `select dp_assessment_assign('${PLUS}','personal_time','fits')`)).toMatch(/choice of Prophetic Worship Development and your authorization/);
    await q(PLUS, `select dp_voice_set_my_tracks(array['prophetic_worship'], false)`);
    expect(await denied(FAC, `select dp_assessment_assign('${PLUS}','personal_time','fits')`)).toMatch(/your authorization/); // chosen, not yet approved
    await q(FAC, `select dp_voice_approve_tracks('${PLUS}', array['prophetic_worship'])`);
    expect((await assign(PLUS, "personal_time", "Wants prophetic worship")).rows[0].id).toBeTruthy();
    expect(await denied(FAC, `select dp_assessment_assign('${PLUS}','hearing_god','fits')`)).toMatch(/source wording/);
  });
  it("a paid student can complete and submit; recordings, resources and new practice open", async () => {
    expect(await count(PAID, `select count(*)::int c from dp_voice_assessments where status='submitted'`)).toBe(2);
    expect(await count(PAID, `select count(*)::int c from dp_voice_resource_content`)).toBeGreaterThan(0);
    expect(await count(PAID, `select count(*)::int c from dp_voice_skills`)).toBeGreaterThan(0);
    const rec = (await q(PAID, `select id from dp_recording_begin(null,null,'Verse','t',1,'audio/mp4',1000,30)`)).rows[0].id;
    await q(PAID, `select dp_recording_mark_saved('${rec}',900,30)`); await q(PAID, `select dp_recording_submit(array['${rec}']::uuid[])`);
    expect((await q(FAC, `select ${WEEKLY(PAID)} id`)).rows[0].id).toBeTruthy();
  });
});

describe("7. the instructor approves the plan before the student sees it, and only for a paid student", () => {
  it("a draft is invisible even to a paid student; approval needs payment; revision needs payment", async () => {
    const unit = JSON.stringify([{ seq: 1, week: 1, area_key: "range", area_title: "Range", level: "beginner", objective: "o", exercise_keys: ["range-map"] }]);
    const draft = (await q(FAC, `select dp_plan_save(null,'${PAID}','P','monthly','${unit}'::jsonb,'{}','{}','{}','x') id`)).rows[0].id;
    expect(await count(PAID, `select count(*)::int c from dp_voice_plans`)).toBe(0);
    const unpaidDraft = (await q(FAC, `select dp_plan_save(null,'${UNPAID}','P','monthly','${unit}'::jsonb,'{}','{}','{}','x') id`)).rows[0].id;
    expect(await denied(FAC, `select dp_plan_activate('${unpaidDraft}')`)).toMatch(/paid, current/);
    await q(FAC, `select dp_plan_activate('${draft}')`);
    expect(await count(PAID, `select count(*)::int c from dp_voice_plans`)).toBe(1);
  });
});

describe("8-10. refunds, expiry, installments, wrong attribution; completed work is preserved", () => {
  it("installments: the first verified payment opens access; a pending or failed one does not", async () => {
    await buy(INST, TIER3, "ord-inst-0", "pending");
    await buy(UNPAID, TIER3, "ord-u3-pending", "pending");
    expect((await access(UNPAID)).paid).toBe(false);
    await buy(UNPAID, TIER3, "ord-u3-failed", "failed", "ord-u3-pending");
    expect((await access(UNPAID)).paid).toBe(false);
    const first = await buy(INST, TIER3, "ord-inst-1", "paid", "ord-inst-0");
    expect(first.rows[0].id).toBeTruthy();
    const pkg = async () => (await db.query<any>(`select installments_paid,payment_status from dp_coaching_packages where student_id='${INST}' and tier_id='${TIER3}'`)).rows[0];
    expect(await pkg()).toMatchObject({ installments_paid: 1, payment_status: "partial" });
    expect((await access(INST)).paid).toBe(true); // the first verified installment is enough for eligibility
    await buy(INST, TIER3, "ord-inst-2", "paid", "ord-inst-0");
    expect(await pkg()).toMatchObject({ installments_paid: 2, payment_status: "partial" });
    await buy(INST, TIER3, "ord-inst-0", "paid"); // the store later confirms the first (pending) order
    expect(await pkg()).toMatchObject({ installments_paid: 3, payment_status: "paid" });
    expect((await access(INST)).paid).toBe(true);
  });
  it("an unclear payment never unlocks the wrong purchase: it waits for a person, and cannot be attributed to someone else's package", async () => {
    await buy(AMBIG, TIER3, "ord-a-1", "pending"); // the student's one open plan, nothing paid yet
    await buy(AMBIG, TIER3, "ord-a-pay", "paid"); // paid, but carries no reference and a plan is already open -> waits
    expect((await access(AMBIG)).paid).toBe(false);
    const waiting = (await db.query<any>(`select id from dp_unmatched_payments where student_id='${AMBIG}' and resolved_at is null`)).rows;
    expect(waiting).toHaveLength(1);
    const theirs = (await db.query<any>(`select id from dp_coaching_packages where student_id='${AMBIG}' order by purchased_at limit 1`)).rows[0].id;
    const others = (await db.query<any>(`select id from dp_coaching_packages where student_id='${INST}' limit 1`)).rows[0].id;
    expect(await denied(FAC, `select dp_resolve_unmatched_payment('${waiting[0].id}','${others}')`)).toMatch(/Choose one of this student's purchases/);
    expect((await access(AMBIG)).paid).toBe(false);
    await q(FAC, `select dp_resolve_unmatched_payment('${waiting[0].id}','${theirs}')`);
    expect((await access(AMBIG)).paid).toBe(true); // only after a person matched it to the right purchase
    expect((await access(OTHER)).paid).toBe(false);
  });
  it("a refund removes eligibility but deletes nothing; new work is blocked, completed work stays", async () => {
    await buy(REFUND, TIER, "ord-ref-1");
    const a = (await assign(REFUND)).rows[0].id;
    await q(REFUND, `select dp_assessment_save('${a}','{"s_adlib":"Somewhat"}'::jsonb)`); await q(REFUND, `select dp_assessment_submit('${a}')`);
    await q(FAC, `select dp_assessment_review('${a}','{}'::jsonb,'staff note','Shared summary')`);
    const open = (await assign(REFUND, "creative_expression", "second")).rows[0].id; // assigned while paid, not started
    const rec = (await q(REFUND, `select id from dp_recording_begin(null,null,'Verse','t',1,'audio/mp4',1000,30)`)).rows[0].id;
    await q(REFUND, `select dp_recording_mark_saved('${rec}',900,30)`); await q(REFUND, `select dp_recording_submit(array['${rec}']::uuid[])`);
    const draftRec = (await q(REFUND, `select id from dp_recording_begin(null,null,'Chorus','t',2,'audio/mp4',1000,30)`)).rows[0].id;
    await q(REFUND, `select dp_recording_mark_saved('${draftRec}',900,30)`);
    await q(FAC, `select ${WEEKLY(REFUND)} x`);
    const before = { assessments: await count(REFUND, `select count(*)::int c from dp_voice_assessments`), recs: await count(REFUND, `select count(*)::int c from dp_practice_recordings`), asg: await count(REFUND, `select count(*)::int c from dp_assignments where practice_items is not null`) };
    await buy(REFUND, TIER, "ord-ref-1", "refunded");
    expect(await access(REFUND)).toMatchObject({ enrolled: true, paid: false, status: "refunded" });
    // everything done is still there and readable
    expect({ assessments: await count(REFUND, `select count(*)::int c from dp_voice_assessments`), recs: await count(REFUND, `select count(*)::int c from dp_practice_recordings`), asg: await count(REFUND, `select count(*)::int c from dp_assignments where practice_items is not null`) }).toEqual(before);
    expect((await q(REFUND, `select shared_summary from dp_voice_assessments where id='${a}'`)).rows[0].shared_summary).toBe("Shared summary");
    // new work is not
    expect(await denied(REFUND, `select dp_assessment_save('${open}','{"s_adlib":"x"}'::jsonb)`)).toMatch(/paid and current/);
    expect(await denied(REFUND, `select * from dp_recording_begin(null,null,'Verse','t',3,'audio/mp4',1000,30)`)).toMatch(/paid, current/);
    expect(await denied(REFUND, `select dp_recording_submit(array['${draftRec}']::uuid[])`)).toMatch(/paid, current/);
    expect(await denied(FAC, `select ${WEEKLY(REFUND)} x`)).toMatch(/verified payment/);
    expect(await denied(FAC, `select dp_assessment_assign('${REFUND}','creative_expression','third')`)).toMatch(/verified payment/);
    expect(await count(REFUND, `select count(*)::int c from dp_voice_resource_content`)).toBe(0);
    expect((await q(FAC, `select count(*)::int c from dp_voice_assessment_private`)).rows[0].c).toBeGreaterThan(0); // staff notes untouched
  });
  it("an expired package behaves like a refund for new work; renewing restores it; old records never change", async () => {
    await buy(EXPIRED, TIER, "ord-exp-1");
    const a = (await assign(EXPIRED)).rows[0].id;
    await q(EXPIRED, `select dp_assessment_save('${a}','{"s_adlib":"Somewhat"}'::jsonb)`); await q(EXPIRED, `select dp_assessment_submit('${a}')`);
    const first = await count(EXPIRED, `select count(*)::int c from dp_voice_assessments`);
    await db.exec(`update dp_coaching_packages set expires_at=now()-interval '1 day' where student_id='${EXPIRED}'`);
    expect(await access(EXPIRED)).toMatchObject({ paid: false });
    expect(await denied(FAC, `select dp_assessment_assign('${EXPIRED}','creative_expression','again')`)).toMatch(/verified payment/);
    expect(await count(EXPIRED, `select count(*)::int c from dp_voice_assessments`)).toBe(first);
    expect((await q(EXPIRED, `select status from dp_voice_assessments where id='${a}'`)).rows[0].status).toBe("submitted");
    await buy(EXPIRED, TIER, "ord-exp-2"); // renewal
    expect((await access(EXPIRED)).paid).toBe(true);
    expect((await assign(EXPIRED, "creative_expression", "after renewal")).rows[0].id).toBeTruthy();
  });
  it("a student who is not in Voice never becomes eligible by payment alone: access still requires enrollment", async () => {
    await buy(STRANGER, TIER, "ord-str-1");
    expect(await count(STRANGER, `select count(*)::int c from dp_voice_assessments`)).toBe(0);
    expect(await denied(FAC, `select dp_assessment_assign('${STRANGER}','creative_expression','x')`)).toMatch(/not enrolled/);
    expect(await denied(STRANGER, `select * from dp_recording_begin(null,null,'Verse','t',1,'audio/mp4',1000,30)`)).toMatch(/Voice enrollment/);
  });
});
