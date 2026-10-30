// Usage: node testing/local-supabase/run.mjs up | seed | down
// up   : start Postgres + GoTrue + PostgREST + Storage in Docker, replay repo migrations, seed test fixtures.
// seed : reset fixtures only (keeps containers).  down : stop and delete containers and volumes.
import { spawnSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ANON_KEY, SERVICE_KEY, JWT_SECRET, API_URL, DB_URL, OWNER_ID, PASSWORD } from "./env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const compose = (...args) => spawnSync("docker", ["compose", "-f", path.join(here, "docker-compose.yml"), ...args], { stdio: "inherit", env: { ...process.env, JWT_SECRET, ANON_KEY, SERVICE_KEY } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const USERS = {
  voiceOnly: { email: "voice-only@fixture.test", name: "Vera Voice" },
  creative: { email: "creative-only@fixture.test", name: "Cleo Creative" },
  multi: { email: "multi-program@fixture.test", name: "Maya Multi" },
  instructor: { email: "instructor@fixture.test", name: "Ivy Instructor" },
  admin: { email: "admin@fixture.test", name: "Ada Admin" },
  scopedTeacher: { email: "scoped-teacher@fixture.test", name: "Terry Teacher" },
  stranger: { email: "stranger@fixture.test", name: "Sam Stranger" } // signed in, enrolled in nothing
};

async function waitFor(fn, what, tries = 90) {
  for (let i = 0; i < tries; i++) { try { if (await fn()) return; } catch {} await sleep(2000); }
  throw new Error("Timed out waiting for " + what);
}

async function client() { const c = new pg.Client({ connectionString: DB_URL }); await c.connect(); return c; }

async function migrate() {
  const c = await client();
  // The live project already has a profiles table from another app; give migrations the same starting point.
  await c.query(`create table if not exists public.profiles(id uuid primary key, full_name text, email text, role text);`);
  await c.query(`insert into auth.users(id,aud,role,email,instance_id) values ('${OWNER_ID}','authenticated','authenticated','owner@fixture.test','00000000-0000-0000-0000-000000000000') on conflict do nothing`);
  const dir = path.join(repo, "supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => /^(?:\d{4}|\d{14})_.*\.sql$/.test(f)).sort().filter((f) => !f.startsWith("0025"));
  for (const f of files) {
    try { await c.query(fs.readFileSync(path.join(dir, f), "utf8")); }
    catch (e) { await c.end(); throw new Error(`Migration ${f} failed: ${e.message}`); }
  }
  await c.end();
  console.log(`replayed ${files.length} migrations`);
}

async function adminCreate(u) {
  const r = await fetch(`${API_URL}/auth/v1/admin/users`, { method: "POST", headers: { "content-type": "application/json", apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ email: u.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: u.name } }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`create ${u.email}: ${JSON.stringify(j)}`);
  return j.id;
}

async function seed() {
  const c = await client();
  const ids = {};
  for (const [k, u] of Object.entries(USERS)) {
    const existing = await c.query("select id from auth.users where email=$1", [u.email]);
    ids[k] = existing.rows[0]?.id ?? (await adminCreate(u));
    await c.query("insert into public.profiles(id,full_name,email) values ($1,$2,$3) on conflict (id) do update set full_name=excluded.full_name,email=excluded.email", [ids[k], u.name, u.email]);
  }
  const all = Object.values(ids);
  // Remove anything earlier test runs created, so every run starts from the same fixtures.
  for (const t of ["dp_voice_progress_check_private", "dp_voice_progress_checks", "dp_voice_plan_private", "dp_voice_plan_units", "dp_voice_plans", "dp_voice_assessment_private", "dp_voice_assessments", "dp_voice_intakes", "dp_voice_profiles", "dp_practice_recording_feedback", "dp_practice_recordings", "dp_submission_attempts", "dp_submissions", "dp_feedback", "dp_assignment_progress", "dp_assignments", "dp_voice_goal_updates", "dp_voice_goals",
    "dp_voice_plan_templates", "dp_voice_testimonials", "dp_sessions", "dp_coaching_plans", "dp_unmatched_payments", "dp_package_payments", "dp_coaching_packages", "dp_coaching_tiers", "dp_lesson_access", "dp_consultation_inquiries"])
    await c.query(`delete from ${t}`);
  await c.query("delete from dp_voice_exercises where curriculum_key is null"); // keep the migration-seeded curriculum library
  await c.query("delete from storage.objects where bucket_id in ('voice-recordings','voice-testimonials')");
  for (const t of ["dp_enrollments", "dp_user_roles", "dp_class_teachers"]) await c.query(`delete from ${t} where user_id = any($1::uuid[])`, [all]);
  const prog = async (slug) => (await c.query("select id from dp_programs where slug=$1", [slug])).rows[0].id;
  const voice = await prog("vocal-coaching");
  const creative = await prog("stationery-product-creation-roadmap");
  const enroll = (u, p) => c.query("insert into dp_enrollments(user_id,scope_type,scope_id,status) values ($1,'program',$2,'active')", [u, p]);
  await enroll(ids.voiceOnly, voice); await enroll(ids.creative, creative); await enroll(ids.multi, voice); await enroll(ids.multi, creative);
  await c.query("insert into dp_user_roles(user_id,role) values ($1,'faculty'),($2,'super_admin'),($3,'teacher')", [ids.instructor, ids.admin, ids.scopedTeacher]);
  // The scoped teacher is a class teacher of a non-voice course only.
  const other = (await c.query("select id from dp_courses where program_id=$1 limit 1", [creative])).rows[0];
  if (other) await c.query("insert into dp_class_teachers(course_id,user_id) values ($1,$2)", [other.id, ids.scopedTeacher]);
  // Published fixture courses (local only): one in Voice, one in Creative, each with an open and a payment-gated lesson plus a private file.
  const fixtures = {};
  await c.query("delete from dp_courses where slug in ('fixture-voice-course','fixture-creative-course')");
  for (const [key, programId, slug] of [["voice", voice, "fixture-voice-course"], ["creative", creative, "fixture-creative-course"]]) {
    const area = (await c.query("select area_id from dp_programs where id=$1", [programId])).rows[0].area_id;
    const course = (await c.query("insert into dp_courses(area_id,program_id,title,slug,is_published,access_mode) values ($1,$2,$3,$4,true,'open') returning id", [area, programId, `Fixture ${key} course`, slug])).rows[0].id;
    const mod = (await c.query("insert into dp_modules(course_id,title,order_index) values ($1,$2,1) returning id", [course, `Fixture ${key} module`])).rows[0].id;
    const lessons = {};
    for (const [n, label] of [[1, "open"], [2, "gated"]]) {
      const l = (await c.query("insert into dp_lessons(module_id,title,slug,order_index,status) values ($1,$2,$3,$4,'published') returning id", [mod, `Fixture ${key} lesson ${label}`, `fixture-${key}-lesson-${label}`, n])).rows[0].id;
      await c.query("insert into dp_lesson_blocks(lesson_id,block_type,order_index,content) values ($1,'teaching_section',1,$2)", [l, JSON.stringify({ anchor: "intro", heading: `${key} ${label} teaching`, paragraphs: [`SECRET-${key.toUpperCase()}-${label.toUpperCase()} teaching content`] })]);
      const up = await fetch(`${API_URL}/storage/v1/object/course-media-private/lessons/${l}/audio.mp3`, { method: "POST", headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "audio/mpeg", "x-upsert": "true" }, body: Buffer.alloc(512, 3) });
      if (!up.ok) throw new Error("fixture file upload failed: " + (await up.text()));
      lessons[label] = { id: l, file: `lessons/${l}/audio.mp3` };
    }
    fixtures[key] = { courseId: course, lessons };
  }
  fs.writeFileSync(path.join(here, "ids.json"), JSON.stringify({ ids, password: PASSWORD, users: USERS, fixtures }, null, 2));
  await c.end();
  console.log("seeded", Object.keys(ids).length, "fixture users (no real data)");
}

const cmd = process.argv[2];
if (cmd === "down") { compose("down", "-v"); process.exit(0); }
if (cmd === "up") {
  if (compose("up", "-d", "--wait", "db").status !== 0) process.exit(1);
  // The image's service roles must share one known local password before GoTrue/PostgREST/Storage connect.
  execSync(`docker exec -e PGPASSWORD=postgres dove-local-db-1 psql -h localhost -U supabase_admin -d postgres -c "alter role supabase_auth_admin password 'postgres'; alter role authenticator password 'postgres'; alter role supabase_storage_admin password 'postgres';"`, { stdio: "inherit" });
  if (compose("up", "-d").status !== 0) process.exit(1);
  await waitFor(async () => (await fetch(`${API_URL.replace("54321", "9999")}/health`)).ok, "GoTrue");
  await waitFor(async () => { const c = await client(); try { await c.query("select 1 from auth.users limit 1"); return true; } finally { await c.end(); } }, "auth schema");
  await waitFor(async () => { const c = await client(); try { await c.query("select allowed_mime_types, file_size_limit, public from storage.buckets limit 1"); await sleep(5000); return true; } finally { await c.end(); } }, "storage schema");
  await migrate();
  // PostgREST caches the schema; reload it after migrations.
  const c = await client(); await c.query("notify pgrst, 'reload schema'"); await c.end(); await sleep(2000);
}
if (cmd === "up" || cmd === "seed") {
  await waitFor(async () => (await fetch(`${API_URL}/auth/v1/health`, { headers: { apikey: ANON_KEY } })).ok, "gateway (run: node testing/local-supabase/proxy.mjs)", 5);
  await seed();
}
