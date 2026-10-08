import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, asUser } from "./harness";

// Real migrations 0001–0028 replayed in memory. Nothing here touches Supabase.
const ADMIN = "00000000-0000-0000-0000-0000000000a1";
const A = "00000000-0000-0000-0000-0000000000b1"; // enrolled student
const B = "00000000-0000-0000-0000-0000000000b2"; // signed-in, NOT enrolled
const C = "00000000-0000-0000-0000-0000000000b3"; // enrolled via program scope

let db: PGlite;
let openCourse: string, protectedCourse: string, protectedLesson: string, draftLesson: string, openLesson: string, programCourse: string;

const ids = (r: { rows: any[] }) => r.rows.map((x) => x.id);

beforeAll(async () => {
  ({ db } = await createDb());
  for (const [id, email] of [[ADMIN, "admin@x"], [A, "a@x"], [B, "b@x"], [C, "c@x"]]) await db.query("insert into auth.users(id,email) values ($1,$2)", [id, email]);
  await db.query("insert into dp_user_roles(user_id, role) values ($1,'super_admin')", [ADMIN]);

  const area = (await db.query<any>("select id from dp_learning_areas where area_key='creative_studio'")).rows[0].id;
  const mk = async (title: string, mode: string, program: string | null = null) =>
    (await db.query<any>("insert into dp_courses(area_id,program_id,title,is_published,access_mode) values ($1,$2,$3,true,$4) returning id", [area, program, title, mode])).rows[0].id;
  const program = (await db.query<any>("insert into dp_programs(name,slug) values ('P','p') returning id")).rows[0].id;

  openCourse = await mk("Open course", "open");
  protectedCourse = await mk("Protected course", "enrolled");
  programCourse = await mk("Program-scoped protected", "enrolled", program);

  const lesson = async (course: string, status: string) => {
    const m = (await db.query<any>("insert into dp_modules(course_id,title) values ($1,'m') returning id", [course])).rows[0].id;
    const l = (await db.query<any>("insert into dp_lessons(module_id,title,status) values ($1,'l',$2) returning id", [m, status])).rows[0].id;
    await db.query("insert into dp_lesson_blocks(lesson_id,block_type,content) values ($1,'written','{\"body\":\"secret\"}')", [l]);
    return l;
  };
  openLesson = await lesson(openCourse, "published");
  protectedLesson = await lesson(protectedCourse, "published");
  draftLesson = await lesson(protectedCourse, "draft");
  await lesson(programCourse, "published");

  await db.query("insert into dp_enrollments(user_id,area_id,scope_type,scope_id,status) values ($1,$2,'course',$3,'active')", [A, area, protectedCourse]);
  await db.query("insert into dp_enrollments(user_id,area_id,scope_type,scope_id,status) values ($1,$2,'program',$3,'active')", [C, area, program]);
}, 240000);

describe("migrations", () => {
  it("existing courses default to open + reflective", async () => {
    const r = await db.query<any>("select count(*)::int n from dp_courses where title not in ('How to Make an App with AI') and (access_mode <> 'open' and title not in ('Protected course','Program-scoped protected'))");
    expect(r.rows[0].n).toBe(0);
    const seeded = await db.query<any>("select access_mode, lesson_style, is_published, program_id from dp_courses where slug='how-to-make-an-app-with-ai'");
    expect(seeded.rows[0]).toMatchObject({ access_mode: "enrolled", lesson_style: "practical", is_published: false, program_id: null });
  });
  it("applies cleanly WITHOUT 0025 (no Dreams & Visions seed) and uses the approved title/subtitle", async () => {
    expect((await db.query<any>("select count(*)::int n from dp_courses where track_key='dreams_visions'")).rows[0].n).toBe(0);
    const c = await db.query<any>("select title, subtitle, description, slug from dp_courses where slug='how-to-make-an-app-with-ai'");
    expect(c.rows[0]).toMatchObject({ title: "How to Make an App with AI", subtitle: "Build your first app or website with AI—without knowing how to code.", description: "Build your first app or website with AI—without knowing how to code." });
  });
  it("seeds exactly the 7 draft module shells and no lessons", async () => {
    const m = await db.query<any>("select count(*)::int n from dp_modules m join dp_courses c on c.id=m.course_id where c.slug='how-to-make-an-app-with-ai'");
    expect(m.rows[0].n).toBe(7);
    const l = await db.query<any>("select count(*)::int n from dp_lessons l join dp_modules m on m.id=l.module_id join dp_courses c on c.id=m.course_id where c.slug='how-to-make-an-app-with-ai'");
    expect(l.rows[0].n).toBe(0);
  });
});

describe("course access (RLS)", () => {
  it("open course: any signed-in student still reads lessons + blocks (existing behavior preserved)", async () => {
    expect(ids(await asUser(db, B, "select id from dp_lessons where id=$1", [openLesson]))).toEqual([openLesson]);
    expect((await asUser(db, B, "select id from dp_lesson_blocks where lesson_id=$1", [openLesson])).rows.length).toBe(1);
  });
  it("enrolled student reads a protected lesson and its blocks", async () => {
    expect(ids(await asUser(db, A, "select id from dp_lessons where id=$1", [protectedLesson]))).toEqual([protectedLesson]);
    expect((await asUser(db, A, "select id from dp_lesson_blocks where lesson_id=$1", [protectedLesson])).rows.length).toBe(1);
  });
  it("NON-enrolled signed-in student cannot read protected lesson, blocks, or modules by direct query", async () => {
    expect((await asUser(db, B, "select id from dp_lessons where id=$1", [protectedLesson])).rows.length).toBe(0);
    expect((await asUser(db, B, "select id from dp_lesson_blocks where lesson_id=$1", [protectedLesson])).rows.length).toBe(0);
    expect((await asUser(db, B, "select id from dp_modules where course_id=$1", [protectedCourse])).rows.length).toBe(0);
  });
  it("dp_can_access_course reflects enrollment, program scope, and staff", async () => {
    const can = async (u: string, c: string) => (await asUser<any>(db, u, "select dp_can_access_course($1) ok", [c])).rows[0].ok;
    expect(await can(A, protectedCourse)).toBe(true);
    expect(await can(B, protectedCourse)).toBe(false);
    expect(await can(C, programCourse)).toBe(true); // program-scope enrollment reaches the course
    expect(await can(C, protectedCourse)).toBe(false);
    expect(await can(ADMIN, protectedCourse)).toBe(true);
    expect(await can(B, openCourse)).toBe(true);
  });
  it("a withdrawn enrollment stops granting access", async () => {
    await db.query("update dp_enrollments set status='withdrawn' where user_id=$1", [A]);
    expect((await asUser(db, A, "select id from dp_lessons where id=$1", [protectedLesson])).rows.length).toBe(0);
    await db.query("update dp_enrollments set status='active' where user_id=$1", [A]);
  });
  it("staff keep access, including draft lessons", async () => {
    const r = await asUser(db, ADMIN, "select id from dp_lessons where id = any($1)", [[protectedLesson, draftLesson]]);
    expect(r.rows.length).toBe(2);
  });
  it("students never see blocks of DRAFT lessons (previously leaked)", async () => {
    expect((await asUser(db, A, "select id from dp_lesson_blocks where lesson_id=$1", [draftLesson])).rows.length).toBe(0);
  });
});

describe("enrollment lock", () => {
  it("a student cannot enroll themselves", async () => {
    await expect(
      asUser(db, B, "insert into dp_enrollments(user_id,scope_type,scope_id,status) values ($1,'course',$2,'active')", [B, protectedCourse])
    ).rejects.toThrow(/row-level security/i);
    expect((await asUser(db, B, "select id from dp_lessons where id=$1", [protectedLesson])).rows.length).toBe(0);
  });
  it("staff can create enrollments", async () => {
    const r = await asUser(db, ADMIN, "insert into dp_enrollments(user_id,scope_type,scope_id,status) values ($1,'course',$2,'active') returning id", [B, protectedCourse]);
    expect(r.rows.length).toBe(1);
    expect((await asUser(db, B, "select id from dp_lessons where id=$1", [protectedLesson])).rows.length).toBe(1);
    await db.query("delete from dp_enrollments where user_id=$1", [B]);
  });
});

describe("protected resources (storage policy from 0026 + gate from 0027)", () => {
  it("signing/reading a private object follows lesson access", async () => {
    const name = `lessons/${protectedLesson}/resources/checklist.pdf`;
    await db.query("insert into storage.objects(bucket_id,name) values ('course-media-private',$1)", [name]);
    const q = "select name from storage.objects where bucket_id='course-media-private' and name=$1";
    expect((await asUser(db, A, q, [name])).rows.length).toBe(1);
    expect((await asUser(db, B, q, [name])).rows.length).toBe(0);
    expect((await asUser(db, null, q, [name]).catch(() => ({ rows: [] }))).rows.length).toBe(0);
    expect((await asUser(db, ADMIN, q, [name])).rows.length).toBe(1);
  });
  it("students cannot upload to the private bucket", async () => {
    await expect(asUser(db, A, "insert into storage.objects(bucket_id,name) values ('course-media-private','lessons/x/y.pdf')")).rejects.toThrow(/row-level security/i);
  });
});

describe("My Build (dp_builds)", () => {
  const upsert = "insert into dp_builds(user_id,course_id,app_name,live_url) values ($1,$2,$3,$4) returning id";
  it("enrolled student creates and updates their own record; one per course", async () => {
    const r = await asUser(db, A, upsert, [A, protectedCourse, "Prayer app", "https://example.com"]);
    expect(r.rows.length).toBe(1);
    await asUser(db, A, "update dp_builds set notes='hello', current_focus='auth' where user_id=$1 and course_id=$2", [A, protectedCourse]);
    const back = await asUser<any>(db, A, "select notes,current_focus,app_name,updated_at>created_at as touched from dp_builds where user_id=$1", [A]);
    expect(back.rows[0]).toMatchObject({ notes: "hello", current_focus: "auth", app_name: "Prayer app" });
    await expect(asUser(db, A, upsert, [A, protectedCourse, "dup", ""])).rejects.toThrow(/unique/i);
  });
  it("another student cannot read, modify, or create into it", async () => {
    expect((await asUser(db, B, "select id from dp_builds")).rows.length).toBe(0);
    expect((await asUser(db, B, "update dp_builds set notes='hacked' where user_id=$1 returning id", [A])).rows.length).toBe(0);
    expect((await asUser(db, B, "delete from dp_builds where user_id=$1 returning id", [A])).rows.length).toBe(0);
    await expect(asUser(db, B, upsert, [A, protectedCourse, "x", ""])).rejects.toThrow(/row-level security/i);
  });
  it("a non-enrolled student cannot create a build for a protected course", async () => {
    await expect(asUser(db, B, upsert, [B, protectedCourse, "x", ""])).rejects.toThrow(/row-level security/i);
  });
  it("staff can read (not write) student builds; course relationship is intact", async () => {
    const r = await asUser<any>(db, ADMIN, "select user_id, course_id from dp_builds");
    expect(r.rows[0]).toMatchObject({ user_id: A, course_id: protectedCourse });
    expect((await asUser(db, ADMIN, "update dp_builds set notes='staff edit' returning id")).rows.length).toBe(0);
  });
  it("rejects unsafe links and oversized text at the database level", async () => {
    await expect(asUser(db, C, "insert into dp_builds(user_id,course_id,repo_url) values ($1,$2,'javascript:alert(1)')", [C, programCourse])).rejects.toThrow(/dp_builds_urls/);
    await expect(asUser(db, C, "insert into dp_builds(user_id,course_id,repo_url) values ($1,$2,'https://u:p@github.com/x')", [C, programCourse])).rejects.toThrow(/dp_builds_urls/);
    await expect(asUser(db, C, "insert into dp_builds(user_id,course_id,notes) values ($1,$2,$3)", [C, programCourse, "x".repeat(8001)])).rejects.toThrow(/dp_builds_len/);
  });
  it("anonymous users have no access", async () => {
    // (The harness grants table privileges broadly; RLS alone must still return nothing.)
    expect((await asUser(db, null, "select id from dp_builds")).rows.length).toBe(0);
  });
});

describe("rollback script", () => {
  it("restores pre-0027 behavior and removes what 0027/0028 added", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { db: db2 } = await createDb();
    await db2.exec(fs.readFileSync(path.join(__dirname, "../../supabase/rollback/ROLLBACK_0027_0028_practical_courses.sql"), "utf8"));
    const cols = await db2.query<any>("select column_name from information_schema.columns where table_name='dp_courses' and column_name in ('access_mode','lesson_style')");
    expect(cols.rows.length).toBe(0);
    const t = await db2.query<any>("select to_regclass('dp_builds') r");
    expect(t.rows[0].r).toBeNull();
  }, 240000);

  it("0025/0026 rollback removes the seeded course, storage policies and helper", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { db: db3 } = await createDb();
    await db3.exec(fs.readFileSync(path.join(__dirname, "../../supabase/rollback/ROLLBACK_0027_0028_practical_courses.sql"), "utf8"));
    await db3.exec(fs.readFileSync(path.join(__dirname, "../../supabase/rollback/ROLLBACK_0025_0026.sql"), "utf8"));
    expect((await db3.query<any>("select count(*)::int n from dp_courses where slug='dreams-and-visions'")).rows[0].n).toBe(0);
    expect((await db3.query<any>("select count(*)::int n from pg_policies where schemaname='storage' and policyname like 'course_media%'")).rows[0].n).toBe(0);
    expect((await db3.query<any>("select to_regproc('dp_safe_uuid(text)') r")).rows[0].r).toBeNull();
  }, 240000);
});
