import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir: "test-results/app",
  testDir: "./tests/app",
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL: process.env.ROOMLY_REVIEW_URL || "http://127.0.0.1:3001",
    storageState: process.env.ROOMLY_REVIEW_AUTH,
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
