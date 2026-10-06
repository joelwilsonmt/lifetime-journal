import { defineConfig, devices } from '@playwright/test';

// By default the suite builds nothing itself: run `pnpm test:e2e`, which
// builds and then starts the production server on a fresh data folder.
// Set E2E_BASE_URL to test something already running (e.g. the container).
const external = process.env.E2E_BASE_URL;
const PORT = 3099;
const DATA_DIR = process.env.E2E_DATA_DIR ?? '.e2e-data';

export default defineConfig({
  testDir: 'e2e',
  // One server and one data folder, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: external ?? `http://127.0.0.1:${PORT}`,
    locale: 'en-US',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile\.spec/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile\.spec/,
    },
  ],
  webServer: external
    ? undefined
    : {
        command: `rm -rf ${DATA_DIR} && NODE_ENV=production PORT=${PORT} DATA_DIR=${DATA_DIR} node dist/server/index.js`,
        url: `http://127.0.0.1:${PORT}/api/health`,
        reuseExistingServer: false,
      },
});
