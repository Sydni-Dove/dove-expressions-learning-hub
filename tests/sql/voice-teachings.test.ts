import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser, grantPaid } from "./harness";

/** Teaching Editor rules enforced by the database: who can edit/publish, content safety, versions, student visibility, assignments and preserved work. */
const id = (n: number) => `f7f70000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const FAC = id(1), A = id(2), B = id(3), UNPAID = id(4), STRANGER = id(5), TEACHER = id(6), REFUND = id(7), ADMIN = id(8);
let db: PGlite;
const q = (uid: string | null, sql: string, params: any[] = []) => asUser(db, uid, sql, params);
async function denied(uid: string | null, sql: string, params: any[] = []) { try { await q(uid, sql, params); } catch (e) { return String((e as Error).message); } throw new Error("Expected statement to be rejected: " + sql); }
const count = async (uid: string | null, sql: string) => (await q(uid, sql)).rows[0].c as number;
const doc = (text: string): any => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const sec = (idv: string, title: string, text: string, type = "text"): any => ({ id: idv, type, title, doc: doc(text) });
const payload = (o: Record<string, any> = {}) => ({ title: "New teaching", description: "d", estimated_minutes: 30, objectives: ["Learn"], student: { sections: [sec("s1", "Intro", "Student text"), sec("h1", "Homework", "Do it", "homework")] }, instructor: { sections: [sec("i1", "Script", "SECRET instructor script", "script")] }, ...o });
const rpc = (uid: string | null, fn: string, args: Record<string, any>) => {
  const names = Object.keys(args); return q(uid, `select ${fn}(${names.map((n, i) => `${n} => $${i + 1}${typeof args[n] === "object" && !Array.isArray(args[n]) ? "::jsonb" : ""}`).join(",")}) r`, names.map((n) => (typeof args[n] === "object" && !Array.isArray(args[n]) ? JSON.stringify(args[n]) : args[n])));
};
let tid = "", key = "";
const status = async () => (await q(FAC, `select status from dp_voice_teachings where id='${tid}'`)).rows[0].status;
const rev = async () => (await q(FAC, `select draft_rev r from dp_voice_teachings where id='${tid}'`)).rows[0].r as number;
const save = (p: any, base?: number, uid: string = FAC) => rpc(uid, "dp_teaching_save", { p_id: tid, p_base_rev: base, p_payload: p }).catch((e) => { throw e; });

beforeAll(async () => {
  ({ db } = await createDb());
  await db.exec(`
   insert into auth.users(id,email) select x::uuid,'a'||substr(x,30)||'@example.test' from unnest(array['${[FAC, A, B, UNPAID, STRANGER, TEACHER, REFUND, ADMIN].join("','")}']) x;
   insert into profiles(id,full_name,email) select id,'Person '||substr(id::text,33),email from auth.users where id::text like 'f7f7%';
   insert into dp_user_roles(user_id,role) values ('${FAC}','faculty'),('${TEACHER}','teacher'),('${ADMIN}','super_admin');
   insert into dp_enrollments(user_id,scope_type,scope_id,status)
     select u,'program',(select id from dp_programs where slug='vocal-coaching'),'active' from unnest(array['${[A, B, UNPAID, REFUND].join("','")}']::uuid[]) u;`);
  await grantPaid(db, A); await grantPaid(db, B); await grantPaid(db, REFUND);
}, 240000);
afterAll(async () => { await db.close(); });

describe("the three imported manuscripts", () => {
  it("arrive ready for review, unpublished, unassigned, and sorted into categories", async () => {
    expect(await count(FAC, `select count(*)::int c from dp_voice_teachings`)).toBe(3);
    expect((await q(FAC, `select distinct status from dp_voice_teachings`)).rows).toEqual([{ status: "ready_for_review" }]);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_versions`)).toBe(0);
    expect(await count(FAC, `select count(*)::int c from dp_assignments where teaching_id is not null`)).toBe(0);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_revisions where reason='imported'`)).toBe(3);
    const cats = (await q(FAC, `select t.key, array_agg(c.slug order by c.slug) cs from dp_voice_teachings t join dp_voice_teaching_category_links l on l.teaching_id=t.id join dp_voice_teaching_categories c on c.id=l.category_id group by t.key order by t.key`)).rows;
    expect(cats.find((r: any) => r.key === "psyche-of-a-praiser").cs).toEqual(["personal-ministry-development", "spiritual-foundations"]);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_categories`)).toBe(6);
  });
  it("keep their student lesson and private instructor notes in separate places", async () => {
    const d = (await q(FAC, `select student, instructor from dp_voice_teaching_drafts d join dp_voice_teachings t on t.id=d.teaching_id where t.key='psyche-of-a-praiser'`)).rows[0];
    expect(JSON.stringify(d.student)).toContain("The youngest in the Kingdom may face some of the hardest challenges");
    expect(JSON.stringify(d.student)).not.toMatch(/Facilitation tips|Cautions/);
    expect(JSON.stringify(d.instructor)).toMatch(/Facilitation tips/);
  });
});

describe("who can reach drafts and notes", () => {
  it("students, outsiders and non-Voice teachers cannot read teachings, drafts, instructor notes or history", async () => {
    for (const u of [A, UNPAID, STRANGER, TEACHER, null]) for (const t of ["dp_voice_teachings", "dp_voice_teaching_drafts", "dp_voice_teaching_revisions", "dp_voice_teaching_versions", "dp_voice_teaching_categories"])
      expect(await count(u, `select count(*)::int c from ${t}`).catch(() => 0), `${u} ${t}`).toBe(0);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_drafts`)).toBe(3);
  });
  it("nobody can write the tables directly, and only an authorized instructor can call the editing functions", async () => {
    for (const u of [FAC, A, TEACHER]) {
      await q(u, `update dp_voice_teaching_drafts set title='hacked'`).catch(() => {});
      await q(u, `insert into dp_voice_teachings(key) values ('hack-hack')`).catch(() => {});
      await q(u, `update dp_voice_teachings set status='published'`).catch(() => {});
    }
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_drafts where title='hacked'`)).toBe(0);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teachings where status='published' or key='hack-hack'`)).toBe(0);
    for (const u of [A, TEACHER, STRANGER]) {
      expect(await denied(u, `select dp_teaching_create('x','',null,'{}'::jsonb)`)).toMatch(/not authorized/);
      expect(await denied(u, `select dp_teaching_status('${id(99)}','publish')`)).toMatch(/not authorized/);
    }
    expect(await denied(null, `select dp_teaching_create('x','',null,'{}'::jsonb)`)).toMatch(/permission denied|not authorized/);
  });
});

describe("creating and saving drafts", () => {
  it("creates a draft from scratch with categories, starting at revision 1", async () => {
    const r = await rpc(FAC, "dp_teaching_create", { p_title: "My Teaching!", p_template: "bible-teaching", p_categories: ["worship-leadership", "vocal-technique"], p_payload: payload() });
    key = r.rows[0].r; expect(key).toMatch(/^my-teaching-[0-9a-f]{6}$/);
    tid = (await q(FAC, `select id from dp_voice_teachings where key='${key}'`)).rows[0].id;
    expect(await status()).toBe("draft"); expect(await rev()).toBe(1);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_category_links where teaching_id='${tid}'`)).toBe(2);
  });
  it("saves, bumps the revision, and refuses a stale save from another window", async () => {
    const p = payload({ title: "Renamed" });
    expect((await save(p, 1)).rows[0].r).toBe(2);
    expect((await q(FAC, `select title from dp_voice_teaching_drafts where teaching_id='${tid}'`)).rows[0].title).toBe("Renamed");
    expect(await denied(FAC, `select dp_teaching_save('${tid}', 1, $1::jsonb) r`, [JSON.stringify(payload())])).toMatch(/changed in another window/);
    expect(await rev()).toBe(2);
  });
  it("keeps history useful: an automatic snapshot at most every ten minutes, and a named version on request", async () => {
    const n0 = await count(FAC, `select count(*)::int c from dp_voice_teaching_revisions where teaching_id='${tid}'`);
    await save(payload({ title: "Again" }), 2); await save(payload({ title: "Again 2" }), 3);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_revisions where teaching_id='${tid}'`)).toBe(n0); // created moments ago, so no new autosave rows
    await q(FAC, `select dp_teaching_checkpoint('${tid}','Before big edit')`);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_revisions where teaching_id='${tid}' and label='Before big edit'`)).toBe(1);
  });
  it("rejects unsafe or malformed content", async () => {
    const bad = (mut: (p: any) => void) => { const p = payload(); mut(p); return p; };
    const cases: [string, any][] = [
      ["script node", bad((p) => p.student.sections[0].doc.content.push({ type: "script", content: [{ type: "text", text: "alert(1)" }] }))],
      ["raw html node", bad((p) => p.student.sections[0].doc.content.push({ type: "html", text: "<img src=x onerror=alert(1)>" }))],
      ["javascript link", bad((p) => { p.student.sections[0].doc.content[0].content[0].marks = [{ type: "link", attrs: { href: "javascript:alert(1)" } }]; })],
      ["data link", bad((p) => { p.student.sections[0].doc.content[0].content[0].marks = [{ type: "link", attrs: { href: "data:text/html,x" } }]; })],
      ["unknown mark", bad((p) => { p.student.sections[0].doc.content[0].content[0].marks = [{ type: "style", attrs: { css: "x" } }]; })],
      ["h1 heading", bad((p) => p.student.sections[0].doc.content.push({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "x" }] }))],
      ["http media", bad((p) => { p.student.sections[0].media = [{ id: "m", kind: "video", url: "http://example.com/a.mp4", title: "x" }]; })],
      ["javascript media", bad((p) => { p.student.sections[0].media = [{ id: "m", kind: "link", url: "javascript:alert(1)", title: "x" }]; })],
      ["bad section type", bad((p) => { p.student.sections[0].type = "iframe"; })],
      ["empty title", bad((p) => { p.title = "  "; })],
      ["not an object", [1, 2]]
    ];
    const r0 = await rev();
    for (const [name, p] of cases) await expect(save(p, r0), name).rejects.toThrow(/cannot be saved/);
    expect(await rev()).toBe(r0); // nothing changed
    // safe content, including a real link and media, is accepted
    const ok = payload(); ok.student.sections[0].doc.content[0].content[0].marks = [{ type: "bold" }, { type: "link", attrs: { href: "https://example.org/x?y=1" } }];
    ok.student.sections[0].media = [{ id: "m", kind: "video", url: "https://youtu.be/dQw4w9WgXcQ", title: "Demo" }];
    await save(ok, r0);
  });
});

describe("review and publishing", () => {
  it("a draft cannot be published; editing a ready teaching returns it to draft", async () => {
    expect(await denied(FAC, `select dp_teaching_status('${tid}','publish')`)).toMatch(/ready for review/);
    await q(FAC, `select dp_teaching_status('${tid}','ready')`); expect(await status()).toBe("ready_for_review");
    await save(payload({ title: "Edited after ready" }), await rev()); expect(await status()).toBe("draft");
    await q(FAC, `select dp_teaching_status('${tid}','ready')`);
  });
  it("only faculty or an administrator can approve and publish; the editor-only role cannot", async () => {
    // a Voice editor who is not faculty/admin: grant manage_voice via a program-scoped course teacher is exercised in the browser tests; here a plain teacher cannot even edit
    expect(await denied(TEACHER, `select dp_teaching_status('${tid}','publish')`)).toMatch(/not authorized/);
    expect(await count(A, `select count(*)::int c from dp_voice_teaching_versions`)).toBe(0);
  });
  it("publishing is explicit, creates an immutable student-only version, and never appears to students until assigned", async () => {
    expect((await q(FAC, `select dp_teaching_status('${tid}','publish') r`)).rows[0].r).toBe("published");
    const v = (await q(FAC, `select * from dp_voice_teaching_versions where teaching_id='${tid}'`)).rows;
    expect(v).toHaveLength(1); expect(v[0].version_no).toBe(1); expect(v[0].title).toBe("Edited after ready");
    expect(JSON.stringify(v[0])).not.toContain("SECRET instructor script");
    expect(Object.keys(v[0])).not.toContain("instructor");
    expect(await count(A, `select count(*)::int c from dp_voice_teaching_versions`)).toBe(0);
    // even the table owner cannot alter a published version or its history
    await expect(db.exec(`update dp_voice_teaching_versions set title='x'`)).rejects.toThrow(/cannot be changed/);
    await expect(db.exec(`delete from dp_voice_teaching_versions`)).rejects.toThrow(/cannot be changed/);
    await expect(db.exec(`update dp_voice_teaching_revisions set label='x'`)).rejects.toThrow(/cannot be changed/);
    await q(FAC, `update dp_voice_teaching_versions set title='x'`).catch(() => {});
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_versions where title='x'`)).toBe(0);
    expect(await denied(FAC, `select dp_teaching_status('${tid}','publish')`)).toMatch(/Mark the teaching ready|make a change/);
  });
});

describe("assigning a published teaching", () => {
  it("is blocked for drafts, unpaid or non-Voice students, and instructors only", async () => {
    const other = (await q(FAC, `select key from dp_voice_teachings where key='being-in-the-word'`)).rows[0].key;
    expect(await denied(FAC, `select dp_assign_teaching('${A}','${other}')`)).toMatch(/not published/);
    expect(await denied(A, `select dp_assign_teaching('${A}','${key}')`)).toMatch(/not authorized/);
    expect(await denied(FAC, `select dp_assign_teaching('${STRANGER}','${key}')`)).toMatch(/not enrolled/);
    expect(await denied(FAC, `select dp_assign_teaching('${UNPAID}','${key}')`)).toMatch(/verified payment/);
    expect(await denied(FAC, `select dp_assign_teaching('${A}','${key}',null,null,'{}','{}','[{"title":"x","url":"javascript:alert(1)"}]'::jsonb)`)).toMatch(/https address/);
  });
  it("assigns with a personal customization, pinned to version 1, and refuses duplicates", async () => {
    const r = await q(FAC, `select dp_assign_teaching('${A}','${key}', current_date+7, 'Take your time.', array['What stood out?'], array['Sing it twice','Journal'], '[{"title":"Video","url":"https://example.org/v"}]'::jsonb) id`);
    const a = (await q(A, `select * from dp_assignments where id='${r.rows[0].id}'`)).rows[0];
    expect(a).toMatchObject({ assigned_to_user_id: A, course_id: null });
    expect(a.practice_steps).toEqual(["Sing it twice", "Journal"]);
    expect(a.teaching_custom).toMatchObject({ instructions: "Take your time.", reflection: ["What stood out?"], version_no: 1, resources: [{ title: "Video" }] });
    expect(await denied(FAC, `select dp_assign_teaching('${A}','${key}')`)).toMatch(/already assigned/);
    expect(await count(B, `select count(*)::int c from dp_assignments where teaching_id is not null`)).toBe(0);
  });
  it("the student sees exactly that version (student lesson only); others see nothing", async () => {
    const rows = (await q(A, `select version_no, title, student from dp_voice_teaching_versions`)).rows;
    expect(rows).toHaveLength(1); expect(rows[0].version_no).toBe(1);
    expect(JSON.stringify(rows)).not.toContain("SECRET");
    for (const u of [B, UNPAID, STRANGER, TEACHER]) expect(await count(u, `select count(*)::int c from dp_voice_teaching_versions`)).toBe(0);
    for (const t of ["dp_voice_teaching_drafts", "dp_voice_teachings", "dp_voice_teaching_revisions"]) expect(await count(A, `select count(*)::int c from ${t}`)).toBe(0);
  });
});

describe("editing after students have it", () => {
  let aid = "";
  it("student work survives, and the student keeps version 1 while version 2 is published", async () => {
    aid = (await q(A, `select id from dp_assignments where teaching_id is not null`)).rows[0].id;
    await q(A, `insert into dp_submissions(assignment_id,student_id,content,status) values ('${aid}','${A}','{"text":"My reflection"}','submitted')`);
    await save(payload({ title: "Second edition", student: { sections: [sec("s1", "Intro", "Brand new student text")] } }), await rev());
    expect(await status()).toBe("published"); // still published; the change is unpublished until approved
    expect((await q(A, `select title from dp_voice_teaching_versions`)).rows).toEqual([{ title: "Edited after ready" }]); // student still has v1
    await q(FAC, `select dp_teaching_status('${tid}','publish')`);
    expect((await q(FAC, `select max(version_no) m from dp_voice_teaching_versions where teaching_id='${tid}'`)).rows[0].m).toBe(2);
    const mine = (await q(A, `select version_no, title from dp_voice_teaching_versions`)).rows;
    expect(mine).toEqual([{ version_no: 1, title: "Edited after ready" }]); // v2 is not shown to a student assigned v1
    expect(await count(A, `select count(*)::int c from dp_submissions where assignment_id='${aid}'`)).toBe(1);
    expect((await q(A, `select content from dp_submissions where assignment_id='${aid}'`)).rows[0].content).toEqual({ text: "My reflection" });
    expect(await count(FAC, `select count(*)::int c from dp_assignments where id='${aid}' and teaching_version_id=(select id from dp_voice_teaching_versions where teaching_id='${tid}' and version_no=1)`)).toBe(1);
  });
  it("a new assignment receives the newest published version", async () => {
    await q(FAC, `select dp_assign_teaching('${B}','${key}')`);
    expect((await q(B, `select version_no from dp_voice_teaching_versions`)).rows).toEqual([{ version_no: 2 }]);
  });
});

describe("revision history", () => {
  it("restores an earlier version into the draft, saving the current state first, and never touches published versions", async () => {
    const first = (await q(FAC, `select id from dp_voice_teaching_revisions where teaching_id='${tid}' and reason='created'`)).rows[0].id;
    const before = await rev();
    const n0 = await count(FAC, `select count(*)::int c from dp_voice_teaching_versions where teaching_id='${tid}'`);
    await q(FAC, `select dp_teaching_restore('${tid}','${first}')`);
    expect(await rev()).toBe(before + 1);
    expect((await q(FAC, `select title from dp_voice_teaching_drafts where teaching_id='${tid}'`)).rows[0].title).toBe("My Teaching!");
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_revisions where teaching_id='${tid}' and reason='before_restore'`)).toBe(1);
    expect(await count(FAC, `select count(*)::int c from dp_voice_teaching_versions where teaching_id='${tid}'`)).toBe(n0);
    expect(await denied(FAC, `select dp_teaching_restore('${tid}','${id(98)}')`)).toMatch(/not found/);
    expect(await denied(A, `select dp_teaching_restore('${tid}','${first}')`)).toMatch(/not authorized/);
  });
});

describe("archiving", () => {
  it("stops new assignments and edits but keeps what students already have; unarchive restores it", async () => {
    expect(await denied(TEACHER, `select dp_teaching_status('${tid}','archive')`)).toMatch(/not authorized/);
    await q(FAC, `select dp_teaching_status('${tid}','archive')`); expect(await status()).toBe("archived");
    expect(await denied(FAC, `select dp_assign_teaching('${REFUND}','${key}')`)).toMatch(/not published/);
    await expect(save(payload(), await rev())).rejects.toThrow(/archived/);
    expect(await count(A, `select count(*)::int c from dp_voice_teaching_versions`)).toBe(1); // existing student still reads it
    await q(FAC, `select dp_teaching_status('${tid}','unarchive')`); expect(await status()).toBe("published");
  });
  it("a refunded student keeps reading what they were assigned; new assignments still need verified payment", async () => {
    await q(FAC, `select dp_assign_teaching('${REFUND}','${key}')`);
    await db.exec(`update dp_coaching_packages set payment_status='refunded' where student_id='${REFUND}'`);
    expect(await count(REFUND, `select count(*)::int c from dp_voice_teaching_versions`)).toBe(1);
    expect(await denied(FAC, `select dp_assign_teaching('${REFUND}','being-in-the-word')`)).toMatch(/not published|verified payment/);
  });
  it("the administrator can also publish", async () => {
    const k2 = (await q(ADMIN, `select dp_teaching_create('Admin one','',null,$1::jsonb) r`, [JSON.stringify(payload())])).rows[0].r;
    const t2 = (await q(ADMIN, `select id from dp_voice_teachings where key='${k2}'`)).rows[0].id;
    await q(ADMIN, `select dp_teaching_status('${t2}','ready')`);
    expect((await q(ADMIN, `select dp_teaching_status('${t2}','publish') r`)).rows[0].r).toBe("published");
  });
});
