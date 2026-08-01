import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3356",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "bunx next dev --port 3356",
    url: "http://localhost:3356/demo/upload",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
