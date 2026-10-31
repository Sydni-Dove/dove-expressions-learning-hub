import { expect, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const F = JSON.parse(fs.readFileSync(path.join(__dirname, "../../testing/local-supabase/ids.json"), "utf8")) as {
  ids: Record<string, string>; password: string; users: Record<string, { email: string; name: string }>;
  fixtures: Record<"voice" | "creative", { courseId: string; lessons: Record<"open" | "gated", { id: string; file: string }> }>;
};
export type Who = "voiceOnly" | "creative" | "multi" | "instructor" | "admin" | "scopedTeacher" | "stranger" | "unpaid" | "prospect";
export const API = "http://localhost:54321";
export const ANON = fs.readFileSync(path.join(__dirname, "../../testing/local-supabase/anon.txt"), "utf8").trim();

export async function login(browser: Browser, who: Who, viewport?: { width: number; height: number }) {
  const ctx = await browser.newContext(viewport ? { viewport } : {});
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.fill("input[type=email]", F.users[who].email);
  await page.fill("input[type=password]", F.password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
  return { ctx, page };
}

export async function accessToken(who: Who) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: F.users[who].email, password: F.password }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("no token for " + who);
  return j.access_token as string;
}
export async function rest(who: Who, pathAndQuery: string, init: RequestInit = {}) {
  const t = await accessToken(who);
  return fetch(`${API}/rest/v1/${pathAndQuery}`, { ...init, headers: { apikey: ANON, authorization: `Bearer ${t}`, "content-type": "application/json", prefer: "return=representation", ...(init.headers ?? {}) } });
}

export async function expectNoHorizontalOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, "horizontal overflow in px").toBeLessThanOrEqual(1);
}
