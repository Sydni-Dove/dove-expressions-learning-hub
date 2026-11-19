import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser } from "./harness";

/**
 * Guided-lesson database behavior, replayed against the REAL migrations in memory.
 * IMPORTANT: every string below is synthetic placeholder text. Real course content must never
 * appear in this repository (it is public) — it is imported through the staff workflow.
 */
const ADMIN = "00000000-0000-0000-0000-0000000000a1";
const STUDENT = "00000000-0000-0000-0000-0000000000b1"; // enrolled in the Voice program
const OUTSIDER = "00000000-0000-0000-0000-0000000000b2"; // signed in, not enrolled
const OTHER_STUDENT = "00000000-0000-0000-0000-0000000000b3"; // enrolled too (privacy checks)

const SECRET_FEEDBACK = "SYNTHETIC-KEY-EXPLANATION-xyz";

// Same shape as the real course: 11 sections = 7 original + 4 supplements.
const N = 11;
const CORRECT = [1, 0, 2, 0, 1, 2, 0, 1, 2, 0, 1];
const PAGES = [2, 3, 1, 4, 2, 3, 1, 2, 4, 3, 2];
const payload = (extra: any = {}) => ({
  title: "Synthetic Course",
  version: "test-1",
  format: { teachingMinutes: "5-10 including reading", exerciseMinutes: "10-25", originalSectionCount: 7, supplementalSectionCount: 4 },
  sections: Array.from({ length: N }, (_, i) => section(`syn-${String(i + 1).padStart(2, "0")}`, `Synthetic Section ${i + 1}`, PAGES[i], CORRECT[i], "")),
  ...extra
});
function section(id: string, title: string, pages: number, correctIndex: number, _label: string) {
  return {
    id, title, goal: "Synthetic goal.", reading: ["Synthetic 1:1"],
    pages: Array.from({ length: pages }, (_, i) => ({ id: `page-${i + 1}`, title: `${title} page ${i + 1}`, body: `Synthetic body ${i + 1}.\n\nSecond synthetic paragraph.` })),
    questions: [1, 2, 3, 4].map((n) => ({ id: `q${n}`, type: "reflection", prompt: `Synthetic question ${n}?` })),
    exercise: { title: "Synthetic exercise", minutes: "10-15", steps: ["Step one.", "Step two."], response: "Write a synthetic response." },
    knowledgeCheck: { id: "check", prompt: "Synthetic check?", options: ["Option A", "Option B", "Option C"], correctIndex, feedback: SECRET_FEEDBACK + "-" + id }
  };
}

/** Rows a caller can see; a signed-out caller may be refused outright ("permission denied"), which also counts as seeing nothing. */
const visibleRows = async (p: Promise<{ rows: any[] }>) => {
  try { return (await p).rows.length; } catch (e: any) { if (/permission denied/i.test(String(e?.message))) return 0; throw e; }
};

let db: PGlite;
let courseId: string, areaId: string, programId: string;
let lessons: { id: string; slug: string; title: string }[] = [];

const rpcImport = (uid: string | null, p: any, o: any = {}) =>
  asUser<any>(db, uid, "select dp_import_guided_course($1::uuid, $2::jsonb, $3::jsonb) r", [courseId, JSON.stringify(p), JSON.stringify(o)]);

beforeAll(async () => {
  ({ db } = await createDb());
  for (const [id, email] of [[ADMIN, "a@x"], [STUDENT, "s@x"], [OUTSIDER, "o@x"], [OTHER_STUDENT, "s2@x"]]) {
    await db.query("insert into auth.users(id,email) values ($1,$2)", [id, email]);
  }
  await db.query("insert into dp_user_roles(user_id, role) values ($1,'super_admin')", [ADMIN]);
  const c = (await db.query<any>("select id, area_id, program_id from dp_courses where slug='worship-development'")).rows[0];
  ({ id: courseId, area_id: areaId, program_id: programId } = c);
  for (const u of [STUDENT, OTHER_STUDENT]) {
    await db.query("insert into dp_enrollments(user_id,area_id,scope_type,scope_id,status) values ($1,$2,'program',$3,'active')", [u, areaId, programId]);
  }
}, 240000);

describe("starting point: the repo's Worship Development shell", () => {
  it("is the unpublished, enrollment-only shell with 11 empty draft lessons in 4 modules", async () => {
    const r = await db.query<any>("select (select count(*)::int from dp_modules m where m.course_id=c.id) mods, (select count(*)::int from dp_lessons l join dp_modules m on m.id=l.module_id where m.course_id=c.id) les, (select count(*)::int from dp_lesson_blocks b join dp_lessons l on l.id=b.lesson_id join dp_modules m on m.id=l.module_id where m.course_id=c.id) blocks, c.is_published, c.access_mode from dp_courses c where id=$1", [courseId]);
    expect(r.rows[0]).toMatchObject({ mods: 4, les: 11, blocks: 0, is_published: false, access_mode: "enrolled" });
  });
});

describe("import (staff-authorized, atomic, versioned)", () => {
  it("is refused for a student, an outsider and a signed-out caller; nothing changes", async () => {
    for (const uid of [STUDENT, OUTSIDER]) await expect(rpcImport(uid, payload())).rejects.toThrow(/not authorized/i);
    await expect(rpcImport(null, payload())).rejects.toThrow();
    expect((await db.query<any>("select count(*)::int n from dp_lesson_blocks b join dp_lessons l on l.id=b.lesson_id join dp_modules m on m.id=l.module_id where m.course_id=$1", [courseId])).rows[0].n).toBe(0);
  });

  it("rejects malformed payloads before changing anything", async () => {
    const bad = [
      { ...payload(), sections: [] },
      { ...payload(), sections: [{ ...section("a", "A", 1, 0, ""), pages: [] }] },
      { ...payload(), sections: [section("dup", "A", 1, 0, ""), section("dup", "B", 1, 0, "")] },
      { ...payload(), sections: [{ ...section("a", "A", 1, 0, ""), knowledgeCheck: { id: "c", prompt: "p", options: ["x", "y"], correctIndex: 5, feedback: "" } }] }
    ];
    for (const p of bad) await expect(rpcImport(ADMIN, p)).rejects.toThrow();
    expect((await db.query<any>("select count(*)::int n from dp_lesson_blocks b join dp_lessons l on l.id=b.lesson_id join dp_modules m on m.id=l.module_id where m.course_id=$1", [courseId])).rows[0].n).toBe(0);
  });

  it("imports 11 sections into the shell: reuses its 11 lessons, archives the old modules, creates blocks, keys and assignments", async () => {
    const r = (await rpcImport(ADMIN, payload())).rows[0].r;
    expect(r).toMatchObject({ sections: 11, pages: PAGES.reduce((a, b) => a + b, 0), questions: 44, checks: 11, exercises: 11, archivedLessonVersions: 11, emptyModulesArchived: 4, lessonsNotInThisEdition: 0 });

    lessons = (await db.query<any>("select l.id, l.slug, l.title from dp_lessons l join dp_modules m on m.id=l.module_id where m.course_id=$1 and l.slug like 'syn-%' order by m.order_index, l.order_index", [courseId])).rows;
    expect(lessons.map((l) => l.slug)).toEqual(Array.from({ length: N }, (_, i) => `syn-${String(i + 1).padStart(2, "0")}`));
    const mods = (await db.query<any>("select m.title, (select count(*)::int from dp_lessons l where l.module_id=m.id) n from dp_modules m where m.course_id=$1 order by m.order_index", [courseId])).rows;
    expect(mods.map((m: any) => [m.title, m.n])).toEqual([["Core Sections", 7], ["Supplements", 4]]);

    // block order = screen order
    const blocks = (await db.query<any>("select block_type from dp_lesson_blocks where lesson_id=$1 order by order_index", [lessons[0].id])).rows.map((b: any) => b.block_type);
    expect(blocks).toEqual(["guided_intro", "guided_page", "guided_page", "guided_check", "guided_question", "guided_question", "guided_question", "guided_question", "guided_exercise"]);

    expect((await db.query<any>("select count(*)::int n from dp_lesson_answer_keys where lesson_id=any($1)", [lessons.map((l) => l.id)])).rows[0].n).toBe(11);
    expect((await db.query<any>("select count(*)::int n from dp_assignments where lesson_id=any($1) and assignment_type='reflection'", [lessons.map((l) => l.id)])).rows[0].n).toBe(11);
    // everything stays draft, unpublished, enrollment-only
    expect((await db.query<any>("select count(*)::int n from dp_lessons l join dp_modules m on m.id=l.module_id where m.course_id=$1 and l.status='published'", [courseId])).rows[0].n).toBe(0);
    expect((await db.query<any>("select is_published, access_mode from dp_courses where id=$1", [courseId])).rows[0]).toMatchObject({ is_published: false, access_mode: "enrolled" });
  });

  it("keeps the old shell's module and lesson titles: archived course + version snapshots", async () => {
    const archive = (await db.query<any>("select id, is_published, content_status, access_mode from dp_courses where slug='worship-development-archive'")).rows[0];
    expect(archive).toMatchObject({ is_published: false, content_status: "archived", access_mode: "enrolled" });
    const titles = (await db.query<any>("select title from dp_modules where course_id=$1 order by order_index", [archive.id])).rows.map((m: any) => m.title);
    expect(titles).toEqual(["Start Here", "Module 1: A Life of Worship", "Module 2: Heart and Offering", "Module 3: Praise in Action"]);
    const v = (await db.query<any>("select snapshot->>'title' t, snapshot->>'slug' s, content_version from dp_lesson_versions where lesson_id=$1", [lessons[0].id])).rows;
    expect(v).toHaveLength(1);
    expect(v[0].t).toMatch(/Praise Is What I Do/); // the old shell title survives in the archive
    expect(v[0].s).toBeNull();
    expect(v[0].content_version).toBe(1);
  });

  it("re-importing versions in place: previous blocks are snapshotted, no duplicates, version bumps", async () => {
    const before = (await db.query<any>("select content_version from dp_lessons where id=$1", [lessons[0].id])).rows[0].content_version;
    await rpcImport(ADMIN, payload({ version: "test-2" }));
    const l = (await db.query<any>("select content_version from dp_lessons where id=$1", [lessons[0].id])).rows[0];
    expect(l.content_version).toBe(before + 1);
    const snap = (await db.query<any>("select jsonb_array_length(snapshot->'blocks') n from dp_lesson_versions where lesson_id=$1 and content_version=$2", [lessons[0].id, before])).rows[0];
    expect(snap.n).toBe(9); // the 9 blocks of the earlier import were preserved
    expect((await db.query<any>("select count(*)::int n from dp_lesson_blocks where lesson_id=$1 and block_type='guided_page'", [lessons[0].id])).rows[0].n).toBe(2);
    expect((await db.query<any>("select count(*)::int n from dp_assignments where lesson_id=$1", [lessons[0].id])).rows[0].n).toBe(1);
    expect((await db.query<any>("select count(*)::int n from dp_lesson_answer_keys where lesson_id=$1", [lessons[0].id])).rows[0].n).toBe(1);
  });
});

describe("answer keys never reach students", () => {
  beforeAll(async () => {
    // Fixture only (superuser): students can reach a lesson only when the COURSE is published
    // (and they are enrolled) and the LESSON is published. The real course stays unpublished.
    await db.query("update dp_courses set is_published=true where id=$1", [courseId]);
    await db.query("update dp_lessons set status='published' where id=$1", [lessons[0].id]);
  });
  it("no key, correct index or explanation appears in any block a student can read", async () => {
    const rows = (await asUser<any>(db, STUDENT, "select content::text c from dp_lesson_blocks where lesson_id=$1", [lessons[0].id])).rows;
    expect(rows.length).toBe(9);
    const all = rows.map((r: any) => r.c).join("\n");
    expect(all).not.toMatch(/correct/i);
    expect(all).not.toContain(SECRET_FEEDBACK);
  });
  it("the key table is invisible to a student, an outsider and signed-out callers; staff can read it", async () => {
    for (const uid of [STUDENT, OUTSIDER, null]) {
      expect(await visibleRows(asUser<any>(db, uid, "select * from dp_lesson_answer_keys"))).toBe(0);
    }
    expect((await asUser<any>(db, ADMIN, "select * from dp_lesson_answer_keys")).rows.length).toBe(11);
    await expect(asUser(db, STUDENT, "insert into dp_lesson_answer_keys(lesson_id,check_id,correct_index) values ($1,'x',0)", [lessons[0].id])).rejects.toThrow(/row-level security/i);
    expect((await asUser<any>(db, STUDENT, "update dp_lesson_answer_keys set correct_index=0 returning 1")).rows.length).toBe(0);
  });
});

describe("dp_check_guided_answer", () => {
  const check = (uid: string | null, lessonId: string, choice: number) =>
    asUser<any>(db, uid, "select * from dp_check_guided_answer($1,'check',$2)", [lessonId, choice]);
  it("tells an enrolled student whether they were right, with feedback, only after they choose", async () => {
    const right = (await check(STUDENT, lessons[0].id, 1)).rows[0]; // syn-01 correct index = 1
    expect(right).toMatchObject({ correct: true, feedback: SECRET_FEEDBACK + "-syn-01" });
    const wrong = (await check(STUDENT, lessons[0].id, 0)).rows[0];
    expect(wrong.correct).toBe(false);
  });
  it("refuses an outsider, a signed-out caller, an unpublished lesson, and an unknown check", async () => {
    await expect(check(OUTSIDER, lessons[0].id, 1)).rejects.toThrow(/unavailable/i);
    await expect(check(null, lessons[0].id, 1)).rejects.toThrow();
    await expect(check(STUDENT, lessons[1].id, 0)).rejects.toThrow(/unavailable/i); // lesson 2 is still draft
    await expect(asUser(db, STUDENT, "select * from dp_check_guided_answer($1,'nope',0)", [lessons[0].id])).rejects.toThrow(/unavailable/i);
  });
  it("lets staff preview a DRAFT lesson's check", async () => {
    expect((await check(ADMIN, lessons[1].id, 0)).rows[0].correct).toBe(true); // syn-02 correct index = 0
  });
});

describe("student drafts are private and resumable", () => {
  const content = { answers: { q1: "my private words" }, screen: 3 };
  it("a student saves, updates and reloads their own draft", async () => {
    await asUser(db, STUDENT, "insert into dp_lesson_drafts(user_id,lesson_id,content) values ($1,$2,$3::jsonb)", [STUDENT, lessons[0].id, JSON.stringify(content)]);
    await asUser(db, STUDENT, "update dp_lesson_drafts set content=$3::jsonb where user_id=$1 and lesson_id=$2", [STUDENT, lessons[0].id, JSON.stringify({ ...content, screen: 5 })]);
    const r = (await asUser<any>(db, STUDENT, "select content, updated_at from dp_lesson_drafts where lesson_id=$1", [lessons[0].id])).rows;
    expect(r).toHaveLength(1);
    expect(r[0].content).toMatchObject({ screen: 5, answers: { q1: "my private words" } });
  });
  it("nobody else can read or change it — not another student, an outsider, or staff", async () => {
    for (const uid of [OTHER_STUDENT, OUTSIDER, ADMIN, null]) {
      expect(await visibleRows(asUser<any>(db, uid, "select * from dp_lesson_drafts"))).toBe(0);
    }
    expect((await asUser<any>(db, OTHER_STUDENT, "update dp_lesson_drafts set content='{}'::jsonb returning 1")).rows.length).toBe(0);
    expect((await asUser<any>(db, OTHER_STUDENT, "delete from dp_lesson_drafts returning 1")).rows.length).toBe(0);
    await expect(asUser(db, OTHER_STUDENT, "insert into dp_lesson_drafts(user_id,lesson_id,content) values ($1,$2,'{}'::jsonb)", [STUDENT, lessons[0].id])).rejects.toThrow(/row-level security/i);
  });
  it("cannot be created for a lesson the student cannot read (unpublished or not enrolled)", async () => {
    await expect(asUser(db, STUDENT, "insert into dp_lesson_drafts(user_id,lesson_id,content) values ($1,$2,'{}'::jsonb)", [STUDENT, lessons[1].id])).rejects.toThrow(/row-level security/i);
    await expect(asUser(db, OUTSIDER, "insert into dp_lesson_drafts(user_id,lesson_id,content) values ($1,$2,'{}'::jsonb)", [OUTSIDER, lessons[0].id])).rejects.toThrow(/row-level security/i);
  });
  it("refuses an oversized draft", async () => {
    await expect(asUser(db, STUDENT, "update dp_lesson_drafts set content=jsonb_build_object('x', repeat('a', 300000)) where lesson_id=$1", [lessons[0].id])).rejects.toThrow(/dp_lesson_drafts_size/);
  });
});

describe("existing submission, review and completion rules are unchanged", () => {
  let assignmentId: string, submissionId: string;
  it("an enrolled student submits once; a second attempt is refused", async () => {
    assignmentId = (await db.query<any>("select id from dp_assignments where lesson_id=$1", [lessons[0].id])).rows[0].id;
    const content = { kind: "guided_section", answers: { q1: "synthetic answer" } };
    const r = await asUser<any>(db, STUDENT, "insert into dp_submissions(assignment_id,student_id,content) values ($1,$2,$3::jsonb) returning id, status", [assignmentId, STUDENT, JSON.stringify(content)]);
    submissionId = r.rows[0].id;
    expect(r.rows[0].status).toBe("submitted");
    await expect(asUser(db, STUDENT, "insert into dp_submissions(assignment_id,student_id,content) values ($1,$2,'{}'::jsonb)", [assignmentId, STUDENT])).rejects.toThrow(/attempt already exists/i);
  });
  it("an outsider cannot submit to it", async () => {
    await expect(asUser(db, OUTSIDER, "insert into dp_submissions(assignment_id,student_id,content) values ($1,$2,'{}'::jsonb)", [assignmentId, OUTSIDER])).rejects.toThrow();
  });
  it("a student cannot approve their own work, edit it while submitted, or mark the lesson complete", async () => {
    await expect(asUser(db, STUDENT, "update dp_submissions set status='approved' where id=$1", [submissionId])).rejects.toThrow();
    await expect(asUser(db, STUDENT, "update dp_submissions set status='revised' where id=$1", [submissionId])).rejects.toThrow(/Only returned work/i);
    await expect(asUser(db, STUDENT, "insert into dp_lesson_progress(user_id,lesson_id,status,completion_method) values ($1,$2,'completed','student_marked')", [STUDENT, lessons[0].id])).rejects.toThrow(/instructor records Voice lesson completion/i);
  });
  it("another student cannot see the submission", async () => {
    expect((await asUser<any>(db, OTHER_STUDENT, "select id from dp_submissions")).rows.length).toBe(0);
  });
  it("instructor returns it; the student revises; instructor approves; the lesson completes", async () => {
    await asUser(db, ADMIN, "select dp_review_submission($1,'Please add detail.','returned')", [submissionId]);
    expect((await asUser<any>(db, STUDENT, "select status from dp_submissions where id=$1", [submissionId])).rows[0].status).toBe("returned");
    const fb = (await asUser<any>(db, STUDENT, "select content from dp_feedback where submission_id=$1 and not is_private", [submissionId])).rows;
    expect(fb.map((f: any) => f.content)).toContain("Please add detail.");
    await asUser(db, STUDENT, "update dp_submissions set status='revised', content=$2::jsonb where id=$1", [submissionId, JSON.stringify({ kind: "guided_section", answers: { q1: "better" } })]);
    await asUser(db, ADMIN, "select dp_review_submission($1,'Well done.','approved')", [submissionId]);
    expect((await asUser<any>(db, STUDENT, "select status from dp_lesson_progress where lesson_id=$1 and user_id=$2", [lessons[0].id, STUDENT])).rows[0].status).toBe("completed");
  });
});

describe("course resources (private workbook downloads)", () => {
  let rid: string;
  beforeAll(async () => {
    rid = (await db.query<any>("insert into dp_course_resources(course_id,kind,title,storage_path,file_name) values ($1,'workbook','Synthetic workbook','lessons/" + "00000000-0000-0000-0000-000000000000" + "/workbooks/x.pdf','x.pdf') returning id", [courseId])).rows[0].id;
  });
  it("is readable by an enrolled student and staff, not by an outsider or signed-out caller", async () => {
    expect((await asUser<any>(db, STUDENT, "select id from dp_course_resources where id=$1", [rid])).rows.length).toBe(1);
    expect((await asUser<any>(db, ADMIN, "select id from dp_course_resources where id=$1", [rid])).rows.length).toBe(1);
    for (const uid of [OUTSIDER, null]) expect(await visibleRows(asUser<any>(db, uid, "select id from dp_course_resources where id=$1", [rid]))).toBe(0);
  });
  it("an inactive resource disappears for students; students cannot create or edit resources", async () => {
    await db.query("update dp_course_resources set is_active=false where id=$1", [rid]);
    expect((await asUser<any>(db, STUDENT, "select id from dp_course_resources where id=$1", [rid])).rows.length).toBe(0);
    expect((await asUser<any>(db, ADMIN, "select id from dp_course_resources where id=$1", [rid])).rows.length).toBe(1);
    await db.query("update dp_course_resources set is_active=true where id=$1", [rid]);
    await expect(asUser(db, STUDENT, "insert into dp_course_resources(course_id,title,storage_path) values ($1,'x','lessons/a/b.pdf')", [courseId])).rejects.toThrow(/row-level security/i);
    expect((await asUser<any>(db, STUDENT, "update dp_course_resources set title='hacked' returning 1")).rows.length).toBe(0);
  });
  it("only paths inside the private lessons/ area are accepted", async () => {
    await expect(db.query("insert into dp_course_resources(course_id,title,storage_path) values ($1,'x','other/place.pdf')", [courseId])).rejects.toThrow(/dp_course_resources_path/);
    await expect(db.query("insert into dp_course_resources(course_id,title,storage_path) values ($1,'x','lessons/../etc.pdf')", [courseId])).rejects.toThrow(/dp_course_resources_path/);
  });
});

describe("sequenced sections (dp_replace_guided_section)", () => {
  const seq = (over: any = {}) => ({
    opening: false,
    steps: [
      { kind: "page", id: "p1", title: "Synthetic page one", body: "Synthetic body one." },
      { kind: "responses", id: "s1", label: "Questions", title: "Synthetic page one", forPage: "p1", items: [{ kind: "question", id: "n1-q1", prompt: "Synthetic question A?" }, { kind: "question", id: "n1-q2", prompt: "Synthetic question B?" }] },
      { kind: "page", id: "p2", title: "Synthetic page two", body: "Synthetic body two." },
      { kind: "responses", id: "s2", label: "Questions and Exercise", title: "Synthetic page two", forPage: "p2", items: [{ kind: "question", id: "n2-q1", prompt: "Synthetic question C?" }, { kind: "note", title: "Synthetic exercise", body: "Synthetic instructions." }, { kind: "question", id: "n2-q2", prompt: "Synthetic question D?" }] },
      { kind: "responses", id: "s3", label: "Exercise", title: "Synthetic standalone", forPage: "", items: [{ kind: "question", id: "n3-q1", prompt: "Synthetic question E?" }] }
    ],
    ...over
  });
  const replace = (uid: string | null, lessonId: string, section: any, note = "synthetic test") =>
    asUser<any>(db, uid, "select dp_replace_guided_section($1::uuid, $2::jsonb, $3) r", [lessonId, JSON.stringify(section), note]);

  it("is refused for a student, an outsider and a signed-out caller; nothing changes", async () => {
    const before = (await db.query<any>("select content_version from dp_lessons where id=$1", [lessons[1].id])).rows[0].content_version;
    for (const uid of [STUDENT, OUTSIDER]) await expect(replace(uid, lessons[1].id, seq())).rejects.toThrow(/not authorized|not found/i); // a draft lesson is invisible to them
    await expect(replace(null, lessons[1].id, seq())).rejects.toThrow();
    expect((await db.query<any>("select content_version from dp_lessons where id=$1", [lessons[1].id])).rows[0].content_version).toBe(before);
  });

  it("rejects malformed sections before changing anything", async () => {
    const before = (await db.query<any>("select count(*)::int n from dp_lesson_blocks where lesson_id=$1", [lessons[1].id])).rows[0].n;
    const s = seq();
    const bad = [
      { steps: [] },
      { steps: [{ kind: "responses", id: "x", title: "t", items: [{ kind: "question", id: "q", prompt: "p" }] }] }, // no teaching page
      { steps: [s.steps[0], { ...s.steps[1], forPage: "missing" }] },
      { steps: [s.steps[0], { ...s.steps[1], items: [{ kind: "note", title: "only a note" }] }] },
      { steps: [s.steps[0], s.steps[1], { ...s.steps[2] }, { ...s.steps[3], items: [{ kind: "question", id: "n1-q1", prompt: "reused id" }] }] },
      { steps: [{ ...s.steps[0], body: " " }] },
      { steps: [{ kind: "mystery" }] }
    ];
    for (const b of bad) await expect(replace(ADMIN, lessons[1].id, b)).rejects.toThrow();
    expect((await db.query<any>("select count(*)::int n from dp_lesson_blocks where lesson_id=$1", [lessons[1].id])).rows[0].n).toBe(before);
  });

  it("replaces one lesson: new block order, no knowledge check or key, previous version archived, other lessons untouched", async () => {
    const other = (await db.query<any>("select content_version from dp_lessons where id=$1", [lessons[2].id])).rows[0].content_version;
    const before = (await db.query<any>("select content_version from dp_lessons where id=$1", [lessons[1].id])).rows[0].content_version;
    const r = (await replace(ADMIN, lessons[1].id, seq())).rows[0].r;
    expect(r).toMatchObject({ pages: 2, screens: 3, questions: 5, contentVersion: before + 1 });
    const blocks = (await db.query<any>("select block_type, content from dp_lesson_blocks where lesson_id=$1 order by order_index", [lessons[1].id])).rows;
    expect(blocks.map((b: any) => b.block_type)).toEqual([
      "guided_intro", "guided_page", "guided_screen", "guided_question", "guided_question",
      "guided_page", "guided_screen", "guided_question", "guided_note", "guided_question", "guided_screen", "guided_question"
    ]);
    expect(blocks[0].content.opening).toBe(false);
    expect(blocks[2].content).toMatchObject({ screen_id: "s1", label: "Questions", for_page: "p1" });
    expect((await db.query<any>("select count(*)::int n from dp_lesson_answer_keys where lesson_id=$1", [lessons[1].id])).rows[0].n).toBe(0);
    const snap = (await db.query<any>("select jsonb_array_length(snapshot->'blocks') blocks, jsonb_array_length(snapshot->'answer_keys') keys, note from dp_lesson_versions where lesson_id=$1 and content_version=$2", [lessons[1].id, before])).rows[0];
    expect(snap.blocks).toBeGreaterThan(5);
    expect(snap.keys).toBe(1);
    expect(snap.note).toBe("synthetic test");
    expect((await db.query<any>("select content_version from dp_lessons where id=$1", [lessons[2].id])).rows[0].content_version).toBe(other);
    expect((await db.query<any>("select status from dp_lessons where id=$1", [lessons[1].id])).rows[0].status).not.toBe("published");
  });

  it("keeps existing submissions and the assignment; students still cannot read the draft lesson", async () => {
    const subsBefore = (await db.query<any>("select count(*)::int n from dp_submissions s join dp_assignments a on a.id=s.assignment_id where a.lesson_id=$1", [lessons[0].id])).rows[0].n;
    expect(subsBefore).toBe(1);
    const r = (await replace(ADMIN, lessons[0].id, seq())).rows[0].r;
    expect(r.existingSubmissionsKept).toBe(1);
    expect((await db.query<any>("select count(*)::int n from dp_submissions s join dp_assignments a on a.id=s.assignment_id where a.lesson_id=$1", [lessons[0].id])).rows[0].n).toBe(1);
    expect((await db.query<any>("select count(*)::int n from dp_assignments where lesson_id=$1", [lessons[0].id])).rows[0].n).toBe(1);
  });

  it("an unpublished sequenced lesson is invisible to an enrolled student", async () => {
    expect((await asUser<any>(db, OTHER_STUDENT, "select id from dp_lesson_blocks where lesson_id=$1", [lessons[1].id])).rows.length).toBe(0);
  });
});
