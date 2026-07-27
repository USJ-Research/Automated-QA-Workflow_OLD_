// Deterministic assertions for the flows that must always work.
// Run once per project (desktop/mobile/tablet) — no randomization here so
// regressions are reproducible; see dynamic.spec.js for broad fuzz coverage.
const { test, expect } = require('playwright/test');
const account = require('../fixtures/account.json');
const A = require('../utils/actions');

test.describe('Critical flows', () => {
  test('homepage loads with no unhandled JS errors', async ({ page }) => {
    const errors = A.watchErrors(page);
    await A.gotoHome(page);
    expect(errors, `Unhandled page errors on homepage: ${errors.join(' | ')}`).toEqual([]);
  });

  test('login with valid credentials succeeds', async ({ page }) => {
    await A.login(page, account.username, account.password);
    expect(await A.isLoggedIn(page)).toBeTruthy();
  });

  test('login with invalid credentials is rejected', async ({ page }) => {
    await A.login(page, account.username, 'definitely-wrong-password');
    expect(page.url()).toContain('/login/');
  });

  test('registration rejects a duplicate email', async ({ page }) => {
    await A.register(page, { username: A.uniqueUser(), email: account.email, password: 'SomeNewPassw0rd!' });
    expect(page.url()).toContain('/register/');
    await expect(page.getByText(/already taken/i)).toBeVisible();
  });

  test('registration rejects mismatched passwords', async ({ page }) => {
    await page.goto('/register/', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type=text]').fill(A.uniqueUser());
    await page.locator('input[type=email]').fill(`qa+${Date.now()}@example.com`);
    const pwFields = page.locator('input[type=password]');
    await pwFields.nth(0).fill('PasswordOne1!');
    await pwFields.nth(1).fill('PasswordTwo2!');
    await page.click('button[type=submit]');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/register/');
  });

  test('search returns a results page for a known term', async ({ page }) => {
    await A.search(page, 'javascript');
    expect(page.url()).toContain('q=');
  });

  test('search with a nonsense term shows an empty/no-results state without crashing', async ({ page }) => {
    const errors = A.watchErrors(page);
    await A.search(page, 'zzz-no-such-room-xyz-123');
    expect(errors).toEqual([]);
  });

  test('creating a room requires authentication', async ({ page }) => {
    const result = await A.createRoom(page, { title: 'Anon Room', description: 'x', topic: 'qa' });
    expect(result.redirectedToLogin).toBeTruthy();
  });

  test('authenticated user can open an existing room and see room detail', async ({ page }) => {
    await A.login(page, account.username, account.password);
    const opened = await A.openRandomRoom(page);
    expect(opened).toBeTruthy();
    await expect(page).toHaveURL(/\/room\/\d+\//);
  });

  test('logout clears the session', async ({ page }) => {
    await A.login(page, account.username, account.password);
    expect(await A.isLoggedIn(page)).toBeTruthy();
    await A.logout(page);
    await A.gotoHome(page);
    expect(await A.isLoggedIn(page)).toBeFalsy();
  });

  test('visiting an unknown route returns a non-200/soft-404 experience', async ({ page }) => {
    const resp = await page.goto('/this-route-does-not-exist-qa/', { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (resp) {
      expect([404, 200]).toContain(resp.status()); // document actual behavior; flag if it 500s
    }
  });
});
