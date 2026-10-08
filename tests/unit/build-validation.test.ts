import { describe, it, expect } from "vitest";
import { validateBuild, looksLikeSecret, isSafeHttpUrl } from "@/lib/build-validation";

describe("My Build validation", () => {
  it("accepts text and normal links", () => {
    const r = validateBuild({ app_name: "Prayer Planner", repo_url: "https://github.com/me/app", live_url: "" });
    expect(r.ok).toBe(true);
  });
  it("rejects non-http(s) and credential-bearing URLs", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("https://user:pass@github.com/x")).toBe(false);
    expect(isSafeHttpUrl("ftp://x.com")).toBe(false);
    expect(isSafeHttpUrl("https://x.com/ok")).toBe(true);
  });
  it("flags things that look like keys, tokens or passwords", () => {
    for (const s of ["sk-abcdefghijklmnopqrstuvwx", "ghp_abcdefghijklmnopqrstuvwxyz0123", "password: hunter2hunter2", "AKIAABCDEFGHIJKLMNOP", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij"]) {
      expect(looksLikeSecret(s), s).toBe(true);
    }
    expect(looksLikeSecret("I want to build a prayer app for wives")).toBe(false);
  });
  it("blocks a secret pasted into notes", () => {
    const r = validateBuild({ notes: "my key is sk-abcdefghijklmnopqrstuvwx" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.notes).toMatch(/password|key|token/i);
  });
  it("enforces length limits", () => {
    expect(validateBuild({ app_name: "x".repeat(121) }).ok).toBe(false);
  });
});
