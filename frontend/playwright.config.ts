import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "cd ../backend && DEMO_ENABLED=true PYTHONPATH=.:tests .venv/bin/uvicorn browser_server:app --host 127.0.0.1 --port 8011",
      url: "http://127.0.0.1:8011/api/health",
      reuseExistingServer: false,
    },
    {
      command:
        "VITE_DEMO_ENABLED=true VITE_API_TARGET=http://127.0.0.1:8011 npm run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
    },
  ],
});
