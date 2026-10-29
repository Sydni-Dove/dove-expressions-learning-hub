import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { login, expectNoHorizontalOverflow, type Who } from "./helpers";

const sizes = [["phone", 390, 844], ["tablet", 820, 1180], ["desktop", 1440, 900]] as const;
const pages: [Who, string, string][] = [
  ["voiceOnly", "/voice", "student-dashboard"], ["voiceOnly", "/voice/resources", "student-resources"], ["voiceOnly", "/assignments", "student-assignments"],
  ["instructor", "/staff/voice", "command-center"], ["instructor", "/staff/voice/library", "library-admin"], ["instructor", "/staff/voice/plans", "plans-goals"],
  ["instructor", "/staff/voice/packages", "packages-admin"], ["admin", "/staff/voice-reviews", "testimonial-review"]
];
fs.mkdirSync("testing/local-supabase/screenshots", { recursive: true });
for (const [name, w, h] of sizes) {
  test.describe(name, () => {
    for (const who of ["voiceOnly", "instructor", "admin"] as Who[]) {
      test(`${who} pages fit at ${w}px`, async ({ browser }) => {
        const { ctx, page } = await login(browser, who, { width: w, height: h });
        for (const [u, path, label] of pages.filter((p) => p[0] === who)) {
          await page.goto(path); await page.waitForLoadState("networkidle");
          await expect(page.locator("h1").first()).toBeVisible();
          await expectNoHorizontalOverflow(page);
          // controls must be reachable: every button/link is at least 24px tall (WCAG 2.2 target size minimum)
          const tiny = await page.evaluate(() => [...document.querySelectorAll("main a, main button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 24 && !e.closest("[hidden]"); }).length);
          expect(tiny, `${label}: controls under 24px tall`).toBe(0);
          await page.screenshot({ path: `testing/local-supabase/screenshots/${name}-${label}.png`, fullPage: true });
        }
        await ctx.close();
      });
    }
  });
}
