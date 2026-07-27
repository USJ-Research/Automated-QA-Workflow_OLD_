// Reusable, randomized page actions shared by every spec.
// Each action takes (page, ctx) where ctx carries the run's account/state
// and returns nothing; assertions live inline so any action can fail a test.
const { expect } = require('playwright/test');

const SEARCH_TERMS = ['javascript', 'docker', 'kubernetes', 'python', 'testing', 'async', 'react', 'zzz-no-results-xyz'];
const CHAT_MESSAGES = [
  'Testing chat functionality - looks smooth so far!',
  'Checking if messages render correctly in this room.',
  'Just a QA note: everything loaded fine on this page.',
  'Does markdown or emoji break this input? 🚀',
];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Deterministic PRNG (mulberry32) for generating this run's randomized
// journeys, so titles computed at Playwright's list phase match the titles
// computed again inside each worker process. General action timing/content
// still uses Math.random() above, which doesn't need to match across phases.
function makeSeededRand(seed) {
  let a = seed >>> 0;
  return function seededRandFloat() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(list) { return list[rand(0, list.length - 1)]; }
function pause(page, minMs = 300, maxMs = 900) { return page.waitForTimeout(rand(minMs, maxMs)); }

function uniqueUser(prefix = 'qa') {
  return `${prefix}_${Date.now().toString(36)}${rand(10, 99)}`;
}

/** Attaches console/page error collectors; call assertNoNewErrors() to check. */
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function gotoHome(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('input[placeholder="Search for rooms..."]')).toBeVisible();
  await pause(page);
}

async function browseTopics(page) {
  await page.goto('/topics/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/topics\//);
  await pause(page);
}

async function browseActivities(page) {
  await page.goto('/activities/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/activities\//);
  await pause(page);
}

async function search(page, term = pick(SEARCH_TERMS)) {
  await gotoHome(page);
  const box = page.locator('input[placeholder="Search for rooms..."]');
  await box.click();
  await box.fill('');
  await box.type(term, { delay: rand(40, 110) });
  await page.keyboard.press('Enter');
  await page.waitForLoadState('domcontentloaded');
  await pause(page);
  return term;
}

async function openRandomRoom(page) {
  await gotoHome(page);
  const rooms = page.locator('a[href^="/room/"]');
  const count = await rooms.count();
  if (count === 0) return false;
  const target = rooms.nth(rand(0, count - 1));
  await target.click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/\/room\/\d+\//);
  await pause(page);
  return true;
}

async function postMessageInCurrentRoom(page) {
  const box = page.locator('input[placeholder*="message" i], textarea').first();
  if (!(await box.count())) return false;
  await box.click();
  await box.type(pick(CHAT_MESSAGES), { delay: rand(30, 90) });
  await pause(page, 400, 900);
  const sendBtn = page.locator('button[type=submit], button:has-text("Send")').first();
  if (await sendBtn.count()) {
    await sendBtn.click();
  } else {
    await page.keyboard.press('Enter').catch(() => {});
  }
  await page.waitForTimeout(rand(500, 1200));
  return true;
}

async function viewProfile(page, username) {
  await page.goto(`/profile/${username}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(page);
}

async function register(page, { username, email, password }) {
  await page.goto('/register/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=text]').fill(username);
  await page.locator('input[type=email]').fill(email);
  const pwFields = page.locator('input[type=password]');
  await pwFields.nth(0).fill(password);
  await pwFields.nth(1).fill(password);
  await page.click('button[type=submit]');
  await page.waitForLoadState('domcontentloaded');
}

async function login(page, username, password) {
  await page.goto('/login/', { waitUntil: 'domcontentloaded' });
  await page.fill('#duvindu_username', username);
  await pause(page, 200, 500);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForLoadState('domcontentloaded');
}

async function isLoggedIn(page) {
  await gotoHome(page);
  return (await page.locator('a[href="/login/"]').count()) === 0;
}

async function logout(page) {
  const dropdown = page.locator('button.dropdown-button');
  if (await dropdown.count()) {
    await dropdown.click();
    await pause(page, 300, 700);
  }
  const logoutLink = page.locator('a[href="/logout/"]');
  if (await logoutLink.count() && await logoutLink.isVisible()) {
    await logoutLink.click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return true;
  }
  return false;
}

async function createRoom(page, { title, description, topic }) {
  await page.goto('/create-room/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login/')) return { redirectedToLogin: true };

  const titleInput = page.locator('input[name*=title], input[name*=name]').first();
  if (!(await titleInput.count())) return { formFound: false };

  await titleInput.click();
  await titleInput.type(title, { delay: rand(40, 100) });

  const descInput = page.locator('textarea').first();
  if (await descInput.count()) {
    await descInput.click();
    await descInput.type(description, { delay: rand(20, 70) });
  }

  const topicInput = page.locator('input[name*=topic]').first();
  if (await topicInput.count()) {
    await topicInput.click();
    await topicInput.type(topic, { delay: rand(40, 90) });
  }

  await pause(page, 400, 900);
  await page.click('button[type=submit]');
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  return { formFound: true, redirectedToLogin: false, finalUrl: page.url() };
}

module.exports = {
  rand, pick, pause, uniqueUser, watchErrors, makeSeededRand,
  gotoHome, browseTopics, browseActivities, search,
  openRandomRoom, postMessageInCurrentRoom, viewProfile,
  register, login, logout, isLoggedIn, createRoom,
  SEARCH_TERMS, CHAT_MESSAGES,
};
