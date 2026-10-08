import { defineConfig, devices } from "@playwright/test";

// Browser tests run against a local dev server using fixture data (no live DB writes).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  use: { baseURL: "http://localhost:3101" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } }
  ],
  webServer: {
    command: "npx next dev -p 3101",
    url: "http://localhost:3101/login",
    timeout: 240_000,
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_ENABLE_DEV_HARNESS: "1" }
  }
});
