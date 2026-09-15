import { defineConfig } from "@playwright/test";

const apiPort = process.env.PERISCAN_E2E_API_PORT ?? "3011";
const apiOrigin =
  process.env.PERISCAN_E2E_API_ORIGIN ?? `http://127.0.0.1:${apiPort}`;
const apiBaseUrl = `${apiOrigin}/api/v1`;
const webPort = process.env.PERISCAN_E2E_WEB_PORT ?? "3010";
const webOrigin =
  process.env.PERISCAN_E2E_WEB_ORIGIN ?? `http://127.0.0.1:${webPort}`;

// Prefer system Chrome on macOS — Playwright's bundled headless shell can crash
// with missing icudtl.dat on some hosts. Override with PERISCAN_E2E_BROWSER.
const e2eBrowser = process.env.PERISCAN_E2E_BROWSER ?? "chrome";

export default defineConfig({
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: [["list"]],
  testDir: "./tests/e2e",
  timeout: 90_000,
  use: {
    baseURL: webOrigin,
    // "chrome" = installed Google Chrome channel; "chromium" = Playwright build
    ...(e2eBrowser === "chromium"
      ? {}
      : { channel: e2eBrowser as "chrome" | "msedge" | "chrome-beta" }),
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "pnpm --filter @periscan/api dev",
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgresql://periscan:periscan@127.0.0.1:5434/periscan",
        PERISCAN_API_PORT: apiPort,
        PERISCAN_DATA_REGION: process.env.PERISCAN_DATA_REGION ?? "us-east-1",
        PERISCAN_DEV_MODE: process.env.PERISCAN_DEV_MODE ?? "true",
        // E2E seeds via Playwright APIRequestContext (cookie session, no JS
        // double-submit header). Browser UI mutations still go through the web
        // client which attaches x-csrf-token. CSRF remains forced in production.
        PERISCAN_CSRF_ENFORCE:
          process.env.PERISCAN_CSRF_ENFORCE ?? "false",
        PERISCAN_JWT_SECRET:
          process.env.PERISCAN_JWT_SECRET ?? "periscan-e2e-session-secret",
        // E2E suites sign up once per file; keep auth room without open-relay defaults.
        PERISCAN_AUTH_RATE_LIMIT_MAX:
          process.env.PERISCAN_AUTH_RATE_LIMIT_MAX ?? "200",
        PERISCAN_RATE_LIMIT_MAX: process.env.PERISCAN_RATE_LIMIT_MAX ?? "10000",
        REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379"
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: `${apiBaseUrl}/health`
    },
    {
      command: "pnpm --filter @periscan/web dev",
      env: {
        ...process.env,
        PERISCAN_API_URL: apiOrigin,
        PERISCAN_WEB_PORT: webPort
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: `${webOrigin}/api/v1/health`
    }
  ],
  workers: 1
});
