import { describe, it, expect, vi } from "vitest";
import { getCourseSettings, canAccessCourse } from "@/lib/course-access";

function fakeSupabase(opts: { settings?: any; settingsError?: boolean; rpc?: { data: any; error: any } }) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => (opts.settingsError ? { data: null, error: { message: "column does not exist" } } : { data: opts.settings ?? null, error: null }) }) })
    }),
    rpc: vi.fn(async () => opts.rpc ?? { data: false, error: null })
  } as any;
}

describe("getCourseSettings", () => {
  it("fails closed with enrolled + reflective when the columns don't exist (pre-migration DB)", async () => {
    expect(await getCourseSettings(fakeSupabase({ settingsError: true }), "c")).toEqual({ accessMode: "enrolled", lessonStyle: "reflective" });
  });
  it("reads enrolled/practical", async () => {
    const s = fakeSupabase({ settings: { access_mode: "enrolled", lesson_style: "practical" } });
    expect(await getCourseSettings(s, "c")).toEqual({ accessMode: "enrolled", lessonStyle: "practical" });
  });
});

describe("canAccessCourse", () => {
  const enrolled = { accessMode: "enrolled", lessonStyle: "practical" } as const;
  it("checks the database even for open courses and staff", async () => {
    const s = fakeSupabase({});
    expect(await canAccessCourse(s, "c", { accessMode: "open", lessonStyle: "reflective" }, false)).toBe(false);
    expect(await canAccessCourse(s, "c", enrolled, true)).toBe(false);
    expect(s.rpc).toHaveBeenCalledTimes(2);
  });
  it("asks dp_can_access_course for enrolled courses", async () => {
    expect(await canAccessCourse(fakeSupabase({ rpc: { data: true, error: null } }), "c", enrolled, false)).toBe(true);
    expect(await canAccessCourse(fakeSupabase({ rpc: { data: false, error: null } }), "c", enrolled, false)).toBe(false);
  });
  it("fails closed if the check errors", async () => {
    expect(await canAccessCourse(fakeSupabase({ rpc: { data: null, error: { message: "boom" } } }), "c", enrolled, false)).toBe(false);
  });
});

