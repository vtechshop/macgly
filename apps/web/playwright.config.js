import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  use: {
    // Override to point at a production-mode server (the API serving dist/),
    // which is the only way to exercise the prerendered route shells.
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  timeout: 15000,
  reporter: 'list',
});
