# QA Playwright Suite - research.duvindu.org

Automated QA tests for https://research.duvindu.org/

## 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

## 2. Run the tests

```bash
npm test
```

Or run a specific part:

```bash
npm run test:critical   # core flows (login, register, search, rooms, logout)
npm run test:dynamic    # randomized, broad-coverage journeys
```

Tests run in a visible browser window by default.

## 3. View the report

```bash
npm run report
```

## Notes

- Test account lives in `fixtures/account.json`.
- A known site bug (`Cannot read properties of null`) is expected to fail the JS-error checks until fixed.
