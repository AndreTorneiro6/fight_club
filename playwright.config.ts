import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npx tsx scripts/demo.ts --test --production --port=3100",
    url: "http://localhost:3100/api/health",
    timeout: 90000,
    reuseExistingServer: false,
  },
});
