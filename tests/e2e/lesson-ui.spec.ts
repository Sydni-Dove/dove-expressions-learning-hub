import { test, expect } from "@playwright/test";

test.describe("practical lesson UI (fixture)", () => {
  test("Do This Now and Prompt Card render, and Copy works with feedback", async ({ page, context, browserName }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await page.goto("/dev/lesson-preview?style=practical");
    const dtn = page.getByTestId("do-this-now");
    await expect(dtn).toBeVisible();
    await expect(dtn).toContainText("Write the one-sentence objective");
    await expect(page.getByTestId("prompt-text")).toContainText("Do not write code yet.");

    await page.getByTestId("prompt-copy").click();
    await expect(page.getByTestId("prompt-copy")).toContainText("Copied");
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    if (clip !== null) expect(clip).toBe("I want to build [idea]. The main objective is [objective].\n\nRules:\n  1. Ask me questions first.\n  2. Do not write code yet.");
  });

  test("practical style hides the spiritual reflection flow; reflective style keeps it", async ({ page }) => {
    await page.goto("/dev/lesson-preview?style=practical");
    await expect(page.getByTestId("reflection-form")).toHaveCount(0);
    await expect(page.getByText("Continue to Reflection")).toHaveCount(0);
    await expect(page.getByTestId("mark-complete")).toBeVisible();

    await page.goto("/dev/lesson-preview?style=reflective");
    await expect(page.getByTestId("reflection-form")).toBeVisible();
    await expect(page.locator("#completion-heading")).toHaveText("Continue to Reflection");
  });

  test("restricted resources show an honest unavailable state", async ({ page }) => {
    await page.goto("/dev/lesson-preview");
    await expect(page.getByText("unavailable or access-restricted")).toBeVisible();
    await expect(page.getByRole("link", { name: "Checklist (PDF)" })).toHaveAttribute("href", "https://example.com/checklist.pdf");
  });

  test("Previous/Next states at first, middle and last lesson", async ({ page }) => {
    await page.goto("/dev/lesson-preview?pos=first");
    await expect(page.getByTestId("prev-lesson")).toHaveCount(0);
    await expect(page.getByTestId("next-lesson")).toHaveAttribute("href", "/courses/c/lessons/n");
    await page.goto("/dev/lesson-preview?pos=middle");
    await expect(page.getByTestId("prev-lesson")).toBeVisible();
    await expect(page.getByTestId("next-lesson")).toBeVisible();
    await page.goto("/dev/lesson-preview?pos=last");
    await expect(page.getByTestId("next-lesson")).toHaveCount(0);
    await expect(page.getByTestId("finish-course")).toHaveAttribute("href", "/courses/c");
  });

  test("no horizontal overflow and tap targets usable (incl. phone width)", async ({ page }) => {
    await page.goto("/dev/lesson-preview?style=practical");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const box = await page.getByTestId("prompt-copy").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    await page.screenshot({ path: `output/playwright/lesson-practical-${test.info().project.name}.png`, fullPage: true });
  });
});

test('source lesson sample is readable and has its action prompt and worksheet', async ({ page }) => {
  await page.goto('/dev/lesson-preview?sample=1');
  await expect(page.getByRole('heading', { name: 'Start With the Objective, Not the Technology', exact: true })).toBeVisible();
  await expect(page.getByTestId('do-this-now')).toContainText('Save My Build');
  await expect(page.getByTestId('prompt-text')).toContainText('Ask only the questions that materially affect');
  await expect(page.getByRole('link', { name: 'Download workbook' })).toHaveAttribute('href', /worksheets\/app-objective$/);
  await expect(page.getByText('Continue to Reflection')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `output/playwright/app-objective-${test.info().project.name}.png`, fullPage: true });
});

test('practical lessons hide the four-step tracker and an empty Scripture List; reflective lessons keep the tracker', async ({ page }) => {
  await page.goto('/dev/lesson-preview?style=practical');
  await expect(page.locator('[aria-label="Lesson stages"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Scripture List' })).toHaveCount(0);
  await page.goto('/dev/lesson-preview?style=reflective');
  await expect(page.locator('[aria-label="Lesson stages"]')).toBeVisible();
});
