import { describe, it, expect, vi, beforeEach } from "vitest";

const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
let current: { user: any; roleRows: { role: string }[] } = { user: null, roleRows: [] };

vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: current.user } }) },
    from: () => ({ select: () => ({ eq: async () => ({ data: current.roleRows }) }) })
  })
}));

import { requireRoles } from "@/lib/roles";

const STAFF = ["faculty", "teacher", "mentor", "super_admin"] as const;

beforeEach(() => {
  redirect.mockClear();
  current = { user: null, roleRows: [] };
});

describe("requireRoles (staff route guard)", () => {
  it("sends signed-out visitors to /login", async () => {
    await expect(requireRoles([...STAFF])).rejects.toThrow("REDIRECT:/login");
  });
  it("sends a plain student (no dp role rows) to /dashboard", async () => {
    current = { user: { id: "s" }, roleRows: [] };
    await expect(requireRoles([...STAFF])).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("sends an explicit student role to /dashboard", async () => {
    current = { user: { id: "s" }, roleRows: [{ role: "student" }] };
    await expect(requireRoles([...STAFF])).rejects.toThrow("REDIRECT:/dashboard");
  });
  it.each(STAFF)("lets %s through the base staff guard", async (role) => {
    current = { user: { id: "x" }, roleRows: [{ role }] };
    await expect(requireRoles([...STAFF])).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("tighter sections: a mentor is blocked from faculty-only pages, faculty allowed", async () => {
    current = { user: { id: "m" }, roleRows: [{ role: "mentor" }] };
    await expect(requireRoles(["faculty", "super_admin"])).rejects.toThrow("REDIRECT:/dashboard");
    current = { user: { id: "f" }, roleRows: [{ role: "faculty" }] };
    await expect(requireRoles(["faculty", "super_admin"])).resolves.toBeTruthy();
  });
});
