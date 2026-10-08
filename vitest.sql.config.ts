import { defineConfig } from "vitest/config";
import path from "node:path";

// Database-level tests: real migrations replayed in in-memory Postgres (PGlite).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { environment: "node", include: ["tests/sql/**/*.test.ts"], testTimeout: 240000, hookTimeout: 240000, fileParallelism: false }
});
