import { describe, it, expect, vi } from "vitest";
import { decideCourseAccess, getCourseSettings, canAccessCourse } from "@/lib/course-access";

function fakeSupabase(opts: { settings?: any; settingsError?: boolean; rpc?: { data: any; error: any } }) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => (opts.settingsError ? { data: null, error: { message: "column does not exist" } } : { data: opts.settings ?? null, error: null }) }) })
    }),
    rpc: vi.fn(async () => opts.rpc ?? { data: false, error: null })
  } as any;
}

describe("decideCourseAccess", () => {
  it("staff always pass", () => expect(decideCourseAccess({ accessMode: "enrolled", isStaff: true, hasEnrollment: false })).toBe(true));
  it("open courses pass for everyone", () => expect(decideCourseAccess({ accessMode: "open", isStaff: false, hasEnrollment: false })).toBe(true));
  it("enrolled courses need an enrollment", () => {
    expect(decideCourseAccess({ accessMode: "enrolled", isStaff: false, hasEnrollment: false })).toBe(false);
    expect(decideCourseAccess({ accessMode: "enrolled", isStaff: false, hasEnrollment: true })).toBe(true);
  });
});

describe("getCourseSettings", () => {
  it("falls back to open + reflective when the columns don't exist (pre-migration DB)", async () => {
    expect(await getCourseSettings(fakeSupabase({ settingsError: true }), "c")).toEqual({ accessMode: "open", lessonStyle: "reflective" });
  });
  it("reads enrolled/practical", async () => {
    const s = fakeSupabase({ settings: { access_mode: "enrolled", lesson_style: "practical" } });
    expect(await getCourseSettings(s, "c")).toEqual({ accessMode: "enrolled", lessonStyle: "practical" });
  });
});

describe("canAccessCourse", () => {
  const enrolled = { accessMode: "enrolled", lessonStyle: "practical" } as const;
  it("does not call the database for open courses or staff", async () => {
    const s = fakeSupabase({});
    expect(await canAccessCourse(s, "c", { accessMode: "open", lessonStyle: "reflective" }, false)).toBe(true);
    expect(await canAccessCourse(s, "c", enrolled, true)).toBe(true);
    expect(s.rpc).not.toHaveBeenCalled();
  });
  it("asks dp_can_access_course for enrolled courses", async () => {
    expect(await canAccessCourse(fakeSupabase({ rpc: { data: true, error: null } }), "c", enrolled, false)).toBe(true);
    expect(await canAccessCourse(fakeSupabase({ rpc: { data: false, error: null } }), "c", enrolled, false)).toBe(false);
  });
  it("fails closed if the check errors", async () => {
    expect(await canAccessCourse(fakeSupabase({ rpc: { data: null, error: { message: "boom" } } }), "c", enrolled, false)).toBe(false);
  });
});
