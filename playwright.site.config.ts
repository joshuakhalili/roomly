import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  outputDir: "test-results/site",
  testDir: "./tests/site",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4334",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm --prefix site run dev -- --port 4334",
    url: "http://127.0.0.1:4334",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
