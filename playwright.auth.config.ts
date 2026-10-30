import { defineConfig, devices } from "@playwright/test";

// Authenticated browser tests against the disposable local stack (testing/local-supabase). Never run against production.
const executablePath = process.env.PW_CHROMIUM || undefined;
const launchOptions = executablePath ? { executablePath } : {};
export default defineConfig({
  testDir: "tests/e2e-auth",
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "testing/local-supabase/results.json" }]],
  use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:3111", launchOptions, screenshot: "only-on-failure", trace: "off" },
  projects: [
    { name: "desktop", testMatch: /voice-five-roles\.spec\.ts/, use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "recordings", testMatch: /recordings\.spec\.ts/, use: { ...devices["Desktop Chrome"], permissions: ["microphone"], launchOptions: { ...launchOptions, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } } },
    { name: "development", testMatch: /development\.spec\.ts/, use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "responsive", testMatch: /responsive\.spec\.ts/, use: { launchOptions } }
  ]
});
