import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "webkit",
        launchOptions: process.env.FINANCE_WEBKIT_EXECUTABLE
          ? { executablePath: process.env.FINANCE_WEBKIT_EXECUTABLE }
          : undefined,
      },
    },
  ],
  webServer: {
    command: "pnpm start:e2e",
    url: "http://localhost:3000/ready",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
