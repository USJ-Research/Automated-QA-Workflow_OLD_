const { defineConfig, devices } = require('playwright/test');

// Fix one seed for the whole run (list phase + all workers share this env
// var) so randomized test titles generated in dynamic.spec.js stay stable
// between Playwright's list phase and worker execution. Override with
// QA_SEED=<number> to reproduce a specific run's journeys.
process.env.QA_SEED = process.env.QA_SEED || String(Date.now());

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90_000,
  fullyParallel: false, // journeys share the persistent QA account; keep them sequential
  retries: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'report' }]],
  use: {
    baseURL: 'https://research.duvindu.org',
    headless: false,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
    { name: 'Tablet', use: { ...devices['iPad Mini'] } },
  ],
});
