import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:5189',
    channel: process.env.WATCHPARTY_BROWSER_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5189 --strictPort',
    url: 'http://127.0.0.1:5189',
    env: { VITE_USE_EMULATORS: 'true', VITE_YOUTUBE_API_KEY: 'emulator-catalogue' },
    reuseExistingServer: false,
  },
});
