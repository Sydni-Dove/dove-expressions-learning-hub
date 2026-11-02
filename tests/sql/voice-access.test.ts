import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser } from "./harness";

/** Onboarding and payment-access rules, enforced by the database: intake BEFORE payment; assessments, recordings, new practice and coaching resources AFTER verified payment. */
const id = (n: number) => `f6f60000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const FAC = id(1), PROSPECT = id(2), UNPAID = id(3), PAID = id(4), OTHER = id(5), STRANGER = id(6), INST = id(7), REFUND = id(8), EXPIRED = id(9), AMBIG = id(10), PLUS = id(11);
const TEACHER = id(12), ADMIN = id(13), OFFLINE = id(14), COMP = id(15), CAP = id(16), KEEP = id(17);
const TIER_NULL = id(94), TIER_TWO = id(95);
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
const assign = async (student: string, kind = "creative_expression", reason = "Fits their goals", accept = true) => {
  const r = await q(FAC, `select dp_assessment_assign('${student}','${kind}','${reason}') id`);
  if (accept) await q(student, `select dp_assessment_consent('${r.rows[0].id}', true)`); // the student accepts the invitation
  return r;
};
const WEEKLY = (s: string) => `dp_assign_weekly_plan('${s}','Week','n','g',current_date+7,jsonb_build_array(jsonb_build_object('exercise_id',(select id from dp_voice_exercises where curriculum_key='stance-check'))))`;

beforeAll(async () => {
  ({ db } = await createDb());
  await db.exec(`
   insert into auth.users(id,email) select x::uuid,'a'||substr(x,30)||'@example.test' from unnest(array['${[FAC, PROSPECT, UNPAID, PAID, OTHER, STRANGER, INST, REFUND, EXPIRED, AMBIG, PLUS, TEACHER, ADMIN, OFFLINE, COMP, CAP, KEEP].join("','")}']) x;
   insert into profiles(id,full_name,email) select id,'Person '||substr(id::text,33),email from auth.users where id::text like 'f6f6%';
   insert into dp_user_roles(user_id,role) values ('${FAC}','faculty'),('${TEACHER}','teacher'),('${ADMIN}','super_admin');
   insert into dp_enrollments(user_id,scope_type,scope_id,status)
     select u,'program',(select id from dp_programs where slug='vocal-coaching'),'active' from unnest(array['${[UNPAID, PAID, OTHER, INST, REFUND, EXPIRED, AMBIG, PLUS, CAP, KEEP].join("','")}']::uuid[]) u;
   insert into dp_coaching_tiers(id,program_id,slug,name,lesson_minutes,lesson_count,installments,assessments_included,woo_product_ids)
     select '${TIER}',id,'one','One payment',60,4,1,2,array['wc-1'] from dp_programs where slug='vocal-coaching';
   insert into dp_coaching_tiers(id,program_id,slug,name,lesson_minutes,lesson_count,installments,assessments_included,woo_product_ids)
     select '${TIER3}',id,'three','Three payments',60,12,3,3,array['wc-3'] from dp_programs where slug='vocal-coaching';
   insert into dp_coaching_tiers(id,program_id,slug,name,lesson_minutes,lesson_count,installments,assessments_included,woo_product_ids)
     select '${TIER_NOASSESS}',id,'none','No assessments',60,1,1,0,array['wc-0'] from dp_programs where slug='vocal-coaching';
   insert into dp_coaching_tiers(id,program_id,slug,name,lesson_minutes,lesson_count,installments,assessments_included,woo_product_ids)
     select '${TIER_NULL}',id,'discretion','Instructor decides',60,12,1,null,array['wc-null'] from dp_programs where slug='vocal-coaching';
   insert into dp_coaching_tiers(id,program_id,slug,name,lesson_minutes,lesson_count,installments,assessments_included,woo_product_ids)
     select '${TIER_TWO}',id,'two','Two assessments',60,4,1,2,array['wc-two'] from dp_programs where slug='vocal-coaching';
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

describe("offline, cash, Square and complimentary access: verified, audited, instructor-only", () => {
  const grant = (who: string, student: string, kind: string, method: string, ref: string, reason: string, paidOn = "current_date", amount = "null", assessments = "null", tier = TIER) =>
    q(who, `select dp_voice_record_access_grant('${student}','${tier}','${kind}','${method}','${ref}','${reason}',${paidOn},${amount},${assessments}) id`);
  it("only a super admin or faculty member can verify a payment or grant complimentary access", async () => {
    for (const who of [TEACHER, PAID, UNPAID, STRANGER]) expect(await denied(who, `select dp_voice_record_access_grant('${OFFLINE}','${TIER}','offline_payment','cash','r1','',current_date)`)).toMatch(/Only a super admin or a faculty member/);
    expect((await access(OFFLINE)).paid).toBe(false);
  });
  it("requires the method, a reference or reason, and a believable date", async () => {
    await expect(grant(FAC, OFFLINE, "offline_payment", "bitcoin", "ref", "")).rejects.toThrow(/Choose how the payment was made|check/i);
    expect(await denied(FAC, `select dp_voice_record_access_grant('${OFFLINE}','${TIER}','offline_payment','cash','  ','',current_date)`)).toMatch(/receipt, check or transaction reference/);
    expect(await denied(FAC, `select dp_voice_record_access_grant('${OFFLINE}','${TIER}','complimentary','complimentary','','  ',current_date)`)).toMatch(/why this access is complimentary/);
    expect(await denied(FAC, `select dp_voice_record_access_grant('${OFFLINE}','${TIER}','offline_payment','cash','r1','',current_date+30)`)).toMatch(/date the payment was received/);
    expect(await denied(FAC, `select dp_voice_record_access_grant('${OFFLINE}','${TIER}','offline_payment','cash','r1','',current_date-2000)`)).toMatch(/date the payment was received/);
    expect(await denied(FAC, `select dp_voice_record_access_grant('${OFFLINE}','${id(999)}','offline_payment','cash','r1','',current_date)`)).toMatch(/active Voice package/);
    expect(await denied(FAC, `select dp_voice_record_access_grant('${id(998)}','${TIER}','offline_payment','cash','r1','',current_date)`)).toMatch(/no account/);
    expect(await count(FAC, `select count(*)::int c from dp_voice_access_grants`)).toBe(0);
  });
  it("a verified offline payment makes the person eligible; it does not enroll them", async () => {
    expect(await count(null, `select count(*)::int c from dp_enrollments where user_id='${OFFLINE}'`)).toBe(0);
    await grant(FAC, OFFLINE, "offline_payment", "square", "SQ-1042", "", "current_date", "18000");
    expect(await access(OFFLINE)).toMatchObject({ enrolled: false, paid: true, via: "offline_payment" });
    expect(await count(null, `select count(*)::int c from dp_enrollments where user_id='${OFFLINE}'`)).toBe(0); // still the instructor's decision
    const pkg = (await db.query<any>(`select payment_status,source,assessments_included from dp_coaching_packages where student_id='${OFFLINE}'`)).rows[0];
    expect(pkg).toMatchObject({ payment_status: "paid", source: "manual", assessments_included: 2 });
    expect(await denied(FAC, `select dp_assessment_assign('${OFFLINE}','creative_expression','x')`)).toMatch(/not enrolled/); // eligibility is not enrollment
  });
  it("complimentary access is a different kind of record, never labelled as a payment", async () => {
    await grant(ADMIN, COMP, "complimentary", "complimentary", "", "Scholarship for the worship team");
    expect(await access(COMP)).toMatchObject({ paid: true, via: "complimentary" });
    expect((await db.query<any>(`select payment_status from dp_coaching_packages where student_id='${COMP}'`)).rows[0].payment_status).toBe("complimentary");
    const rows = (await q(FAC, `select kind,method,reference from dp_voice_access_grants order by recorded_at`)).rows;
    expect(rows.map((r: any) => r.kind)).toEqual(["offline_payment", "complimentary"]);
    expect(rows[1]).toMatchObject({ method: "complimentary", reference: null });
    const people = (await q(FAC, `select paid_via from dp_voice_people() where id in ('${OFFLINE}','${COMP}') order by paid_via`)).rows.map((r: any) => r.paid_via);
    expect(people).toEqual(["complimentary", "offline_payment"]);
    expect(await count(null, `select count(*)::int c from dp_package_payments where package_id in (select id from dp_coaching_packages where student_id='${COMP}')`)).toBe(0); // no payment transaction exists
  });
  it("an instructor-made manual package with no verified grant still gives no access", async () => {
    await q(FAC, `select dp_create_package('${KEEP}','${TIER}','paid')`);
    expect((await access(KEEP)).paid).toBe(false);
  });
  it("keeps an audit trail nobody can alter, and payment references stay with authorized staff", async () => {
    const ev = (await q(FAC, `select event,actor from dp_voice_access_events order by at`)).rows;
    expect(ev.map((e: any) => e.event)).toEqual(["payment_recorded", "complimentary_granted"]);
    expect(ev[0].actor).toBe(FAC);
    for (const who of [TEACHER, PAID, OFFLINE, STRANGER]) { expect(await count(who, `select count(*)::int c from dp_voice_access_grants`)).toBe(0); expect(await count(who, `select count(*)::int c from dp_voice_access_events`)).toBe(0); }
    await expect(db.exec(`update dp_voice_access_events set event='enrolled'`)).rejects.toThrow(/cannot be changed/);
    await expect(db.exec(`delete from dp_voice_access_events`)).rejects.toThrow(/cannot be changed/);
    await expect(db.exec(`delete from dp_voice_access_grants`)).rejects.toThrow(/cannot be deleted/);
    await expect(db.exec(`update dp_voice_access_grants set reference='edited'`)).rejects.toThrow(/Only the revocation fields/);
    await expect(db.exec(`update dp_voice_access_grants set method='cash' where kind='complimentary'`)).rejects.toThrow();
  });
  it("revoking needs a reason, closes new work, keeps every record, and is itself audited", async () => {
    const g = (await q(FAC, `select id from dp_voice_access_grants where kind='offline_payment'`)).rows[0].id;
    expect(await denied(TEACHER, `select dp_voice_revoke_access_grant('${g}','refunded in cash')`)).toMatch(/Only a super admin or a faculty member/);
    expect(await denied(FAC, `select dp_voice_revoke_access_grant('${g}','  ')`)).toMatch(/Say why/);
    await q(FAC, `select dp_voice_revoke_access_grant('${g}','Refunded in cash on request')`);
    expect((await access(OFFLINE)).paid).toBe(false);
    expect(await denied(FAC, `select dp_voice_revoke_access_grant('${g}','again')`)).toMatch(/already revoked/);
    expect(await count(FAC, `select count(*)::int c from dp_voice_access_grants where id='${g}' and revoked_at is not null and revoke_reason is not null`)).toBe(1);
    expect(await count(FAC, `select count(*)::int c from dp_voice_access_events where event='access_revoked'`)).toBe(1);
  });
});

describe("enrollment stays an instructor decision", () => {
  it("payment, offline verification and an intake never enroll anyone; only a faculty member or super admin enrolls, with an audit entry", async () => {
    expect(await count(null, `select count(*)::int c from dp_enrollments where user_id='${COMP}'`)).toBe(0);
    for (const who of [TEACHER, STRANGER, COMP]) expect(await denied(who, `select dp_voice_enroll_student('${COMP}')`)).toMatch(/Only a super admin or a faculty member/);
    expect(await denied(COMP, `insert into dp_enrollments(user_id,scope_type,scope_id) values ('${COMP}','program',(select id from dp_programs where slug='vocal-coaching'))`)).toMatch(/row-level security/); // no self-enrollment
    await q(FAC, `select dp_voice_enroll_student('${COMP}','Approved after consultation')`);
    expect(await access(COMP)).toMatchObject({ enrolled: true, paid: true });
    expect(await denied(FAC, `select dp_voice_enroll_student('${COMP}')`)).toMatch(/Already enrolled/);
    const ev = (await q(FAC, `select details from dp_voice_access_events where event='enrolled'`)).rows;
    expect(ev).toHaveLength(1); expect(ev[0].details).toMatchObject({ note: "Approved after consultation", eligible: true });
  });
});

describe("package entitlements are configurable and never block personalized coaching by default", () => {
  const allowance = async (s: string) => (await db.query<any>(`select dp_private.assessments_allowance('${s}') a`)).rows[0].a as number;
  it("a blank allowance leaves it to the instructor; a number is a cap; zero means none; a grant can override", async () => {
    await buy(CAP, TIER_NULL, "ord-cap-1");
    expect(await allowance(CAP)).toBeGreaterThan(100); // instructor decides
    const a = (await assign(CAP)).rows[0].id; // still one at a time, with a reason
    await q(CAP, `select dp_assessment_save('${a}','{"s_adlib":"Not yet"}'::jsonb)`); await q(CAP, `select dp_assessment_submit('${a}')`);
    expect(await denied(FAC, `select dp_assessment_assign('${CAP}','creative_expression','   ')`)).toMatch(/why this assessment fits/);
    await buy(KEEP, TIER_TWO, "ord-keep-1");
    expect(await allowance(KEEP)).toBe(2);
    await buy(INST, TIER_NOASSESS, "ord-zero-2");
    // grant override beats the package value
    await grant(FAC, PLUS, "complimentary", "complimentary", "", "Mentoring scholarship", "current_date", "null", "1", TIER_TWO);
    expect((await db.query<any>(`select assessments_included from dp_coaching_packages where student_id='${PLUS}' and access_grant_id is not null`)).rows[0].assessments_included).toBe(1);
  });
  it("editing a package later never changes what a student already bought", async () => {
    await db.exec(`update dp_coaching_tiers set assessments_included=9 where id='${TIER_TWO}'`);
    expect((await db.query<any>(`select assessments_included from dp_coaching_packages where student_id='${KEEP}' and tier_id='${TIER_TWO}'`)).rows[0].assessments_included).toBe(2);
    expect(await allowance(KEEP)).toBe(2);
  });
  it("the tier default is no longer zero", async () => {
    expect((await db.query<any>(`select column_default, is_nullable from information_schema.columns where table_name='dp_coaching_tiers' and column_name='assessments_included'`)).rows[0]).toMatchObject({ is_nullable: "YES" });
  });
  function grant(who: string, student: string, kind: string, method: string, ref: string, reason: string, paidOn = "current_date", amount = "null", assessments = "null", tier = TIER) {
    return q(who, `select dp_voice_record_access_grant('${student}','${tier}','${kind}','${method}','${ref}','${reason}',${paidOn},${amount},${assessments}) id`);
  }
});

describe("specialized assessments need the student's consent", () => {
  it("an assignment is an invitation: nothing can be started until the student accepts, and they can decline at no cost", async () => {
    await buy(OTHER, TIER_NULL, "ord-consent-1");
    await q(FAC, `select dp_voice_enroll_student('${OTHER}')`).catch(() => null);
    const inv = (await assign(OTHER, "creative_expression", "Chosen for ad-libbing", false)).rows[0].id;
    expect(await denied(OTHER, `select dp_assessment_save('${inv}','{"s_adlib":"Not yet"}'::jsonb)`)).toMatch(/accept this assessment first/);
    expect(await denied(FAC, `select dp_assessment_consent('${inv}',true)`)).toMatch(/Voice enrollment required|not waiting/); // staff cannot consent for a student
    expect(await denied(PAID, `select dp_assessment_consent('${inv}',true)`)).toMatch(/not waiting for your decision/); // nor can another student
    await q(OTHER, `select dp_assessment_consent('${inv}', false)`);
    expect((await q(OTHER, `select status,declined_at is not null d from dp_voice_assessments where id='${inv}'`)).rows[0]).toEqual({ status: "declined", d: true });
    expect(await denied(OTHER, `select dp_assessment_consent('${inv}', true)`)).toMatch(/not waiting for your decision/); // a decision is final for that invitation
    // declining does not use up the package allowance, and the instructor can choose differently later
    expect((await assign(OTHER, "creative_expression", "A second, different suggestion")).rows[0].id).toBeTruthy();
  });
});

describe("what was completed stays available after a refund, revoked access or expiry", () => {
  it("assessments, answers, recordings, plans, feedback, goals and completed lessons stay readable; new paid activity stops", async () => {
    const asg = (await assign(KEEP)).rows[0].id;
    await q(KEEP, `select dp_assessment_save('${asg}','{"s_adlib":"Somewhat"}'::jsonb)`); await q(KEEP, `select dp_assessment_submit('${asg}')`);
    await q(FAC, `select dp_assessment_review('${asg}','{}'::jsonb,'private note','Shared summary')`);
    const rec = (await q(KEEP, `select id from dp_recording_begin(null,null,'Verse','t',1,'audio/mp4',1000,30)`)).rows[0].id;
    await q(KEEP, `select dp_recording_mark_saved('${rec}',900,30)`); await q(KEEP, `select dp_recording_submit(array['${rec}']::uuid[])`);
    await q(FAC, `select dp_recording_review('${rec}','reviewed','Nice work')`);
    const unit = JSON.stringify([{ seq: 1, week: 1, area_key: "range", area_title: "Range", level: "beginner", objective: "o", exercise_keys: ["range-map"] }]);
    const plan = (await q(FAC, `select dp_plan_save(null,'${KEEP}','P','monthly','${unit}'::jsonb,'{}','{}','{}','x') id`)).rows[0].id;
    await q(FAC, `select dp_plan_activate('${plan}')`);
    await db.exec(`insert into dp_voice_goals(student_id,title) values ('${KEEP}','Steady breath')`);
    // lessons: one completed, one not; both level-gated
    await db.exec(`insert into dp_courses(id,area_id,program_id,title,slug,is_published,access_mode) select '${id(70)}',area_id,id,'Keep course','keep-course',true,'open' from dp_programs where slug='vocal-coaching';
      insert into dp_modules(id,course_id,title) values ('${id(71)}','${id(70)}','M');
      insert into dp_lessons(id,module_id,title,status) values ('${id(72)}','${id(71)}','Done lesson','published'),('${id(73)}','${id(71)}','Not done lesson','published');
      insert into dp_lesson_blocks(lesson_id,block_type,order_index,content) values ('${id(72)}','teaching_section',1,'{"heading":"done"}'),('${id(73)}','teaching_section',1,'{"heading":"not done"}');
      insert into dp_lesson_access(lesson_id,min_level) values ('${id(72)}',2),('${id(73)}',2);
      set session_replication_role=replica;
      insert into dp_lesson_progress(user_id,lesson_id,status,completed_at) values ('${KEEP}','${id(72)}','completed',now());
      set session_replication_role=origin;`);
    const snapshot = async () => ({
      assessments: await count(KEEP, `select count(*)::int c from dp_voice_assessments where status in ('reviewed','submitted')`), summary: (await q(KEEP, `select shared_summary s from dp_voice_assessments where id='${asg}'`)).rows[0].s,
      recs: await count(KEEP, `select count(*)::int c from dp_practice_recordings`), feedback: await count(KEEP, `select count(*)::int c from dp_practice_recording_feedback`),
      plans: await count(KEEP, `select count(*)::int c from dp_voice_plans where status='active'`), goals: await count(KEEP, `select count(*)::int c from dp_voice_goals`)
    });
    const before = await snapshot();
    expect(before).toMatchObject({ assessments: 1, recs: 1, feedback: 1, plans: 1, goals: 1, summary: "Shared summary" });
    await buy(KEEP, TIER_TWO, "ord-keep-1", "refunded");
    expect((await access(KEEP)).paid).toBe(false);
    expect(await snapshot()).toEqual(before); // nothing hidden or deleted
    // the completed lesson's content is still readable; the unfinished gated one is closed
    await db.exec(`update dp_coaching_packages set resource_level=0 where student_id='${KEEP}'`);
    expect(await count(KEEP, `select count(*)::int c from dp_lesson_blocks where lesson_id='${id(72)}'`)).toBe(1);
    expect(await count(KEEP, `select count(*)::int c from dp_lesson_blocks where lesson_id='${id(73)}'`)).toBe(0);
    // new paid activity is closed; instructor-only notes stay private
    expect(await denied(KEEP, `select * from dp_recording_begin(null,null,'Verse','t',2,'audio/mp4',1000,30)`)).toMatch(/paid, current/);
    expect(await denied(FAC, `select dp_assessment_assign('${KEEP}','creative_expression','again')`)).toMatch(/verified payment/);
    expect(await count(KEEP, `select count(*)::int c from dp_voice_assessment_private`)).toBe(0);
    expect(await count(KEEP, `select count(*)::int c from dp_voice_plan_private`)).toBe(0);
    expect(await count(OTHER, `select count(*)::int c from dp_voice_assessments where student_id='${KEEP}'`)).toBe(0);
  });
});
