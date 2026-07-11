import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "ui.spec.mjs",
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4276",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 4276 --bind 127.0.0.1",
    port: 4276,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
