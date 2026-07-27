// Dynamic, randomized user journeys.
//
// Instead of one fixed linear script, each test run shuffles a pool of
// realistic site actions and executes a different random subset/order.
// Across repeated runs (and 3 device projects in playwright.config.js) this
// gives broad, non-deterministic coverage of navigation, search, rooms and
// authenticated actions, while every action still carries its own assertion
// so a broken page fails the run instead of silently "looking fine".
const { test, expect } = require('playwright/test');
const account = require('../fixtures/account.json');
const A = require('../utils/actions');

// Seeded so the journey list (and their titles) is identical between
// Playwright's list phase and each worker process, while still being a
// different random selection on every actual test run (see QA_SEED in
// playwright.config.js).
const seededRandFloat = A.makeSeededRand(Number(process.env.QA_SEED));
function seededInt(min, max) { return Math.floor(seededRandFloat() * (max - min + 1)) + min; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = seededInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Each entry: name + fn(page, ctx). ctx.loggedIn tracks auth state across
// the journey so actions can decide whether to log in first.
const ACTIONS = [
  { name: 'browse-topics', fn: (page) => A.browseTopics(page) },
  { name: 'browse-activities', fn: (page) => A.browseActivities(page) },
  { name: 'random-search', fn: (page) => A.search(page) },
  { name: 'open-random-room', fn: (page) => A.openRandomRoom(page) },
  { name: 'revisit-home', fn: (page) => A.gotoHome(page) },
  {
    name: 'view-own-profile',
    fn: (page, ctx) => A.viewProfile(page, ctx.loggedIn ? account.username : 'duvindu'),
  },
  {
    name: 'post-message-in-room',
    fn: async (page, ctx) => {
      if (!ctx.loggedIn) return;
      const opened = await A.openRandomRoom(page);
      if (opened) await A.postMessageInCurrentRoom(page);
    },
  },
  {
    name: 'create-room',
    fn: async (page, ctx) => {
      if (!ctx.loggedIn) return;
      const suffix = A.rand(1000, 9999);
      await A.createRoom(page, {
        title: `QA Dynamic Room ${suffix}`,
        description: 'Created by the randomized dynamic QA journey. Safe to ignore.',
        topic: 'qa-testing',
      });
    },
  },
];

// A handful of pre-shuffled journeys, one per test, so failures are isolated
// and reproducible per-run rather than one giant test that stops at the
// first failure.
const JOURNEY_COUNT = 4;
const journeys = Array.from({ length: JOURNEY_COUNT }, (_, i) => ({
  id: i + 1,
  actions: shuffle(ACTIONS).slice(0, seededInt(4, ACTIONS.length)),
  startLoggedIn: seededRandFloat() < 0.5,
}));

for (const journey of journeys) {
  test(`random journey #${journey.id} [${journey.startLoggedIn ? 'auth' : 'guest'}]: ${journey.actions.map(a => a.name).join(' -> ')}`, async ({ page }) => {
    const errors = A.watchErrors(page);
    const ctx = { loggedIn: false };

    await A.gotoHome(page);

    if (journey.startLoggedIn) {
      await A.login(page, account.username, account.password);
      ctx.loggedIn = await A.isLoggedIn(page);
    }

    for (const action of journey.actions) {
      await test.step(action.name, async () => {
        await action.fn(page, ctx);
      });
    }

    if (ctx.loggedIn && Math.random() < 0.5) {
      await test.step('logout', async () => {
        await A.logout(page);
      });
    }

    expect(errors, `Unhandled page errors during journey: ${errors.join(' | ')}`).toEqual([]);
  });
}
