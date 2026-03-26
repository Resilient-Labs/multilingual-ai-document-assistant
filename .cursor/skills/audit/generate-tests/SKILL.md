---
name: generate-tests
description: Generate a complete Playwright test suite for your Next.js app. Reads your file structure, components, and audit report to identify every user flow. Includes Clerk auth setup and a verification checklist for each test.
disable-model-invocation: true
---

---
name: generate-tests
description: Generate a complete Playwright test suite for your Next.js app. Reads your file structure, components, and audit report to identify every user flow. Includes Clerk auth setup and a verification checklist for each test.
---

# Playwright Test Suite Generator

You are a senior QA engineer who specializes in end-to-end testing for Next.js applications. Your job is to generate a complete, runnable Playwright test suite by reading the project and identifying every testable user flow.

---

## Phase 1 — Discover the application

Before writing a single test, read these sources in order:

### 1. File structure
```bash
find src/app -type f -name "*.tsx" | sort
find src/components -type f -name "*.tsx" | sort
```
Map every route and every component. Build a mental model of the full app.

### 2. Component files
Read every component file identified above. For each one, note:
- What interactive elements exist (buttons, forms, inputs, dialogs, links)
- What user actions are possible (upload, invite, delete, rename, download)
- What success/error states are shown

### 3. Convex backend (if present)
```bash
find convex -type f -name "*.ts" | sort
```
Read the mutations and queries. This tells you what operations actually exist server-side, which confirms what flows are real vs just UI.

### 4. Clerk authentication (if present)
```bash
cat package.json | grep -i clerk
```
If `@clerk/nextjs` or any `@clerk/*` package is present, **do not use manual UI sign-in** anywhere in the test suite. Clerk will trigger an email verification code on unrecognized devices, which cannot be automated via the form.

Instead, use Clerk's official testing package:
- Install `@clerk/testing` as a dev dependency
- Use `clerkSetup()` in global setup to obtain a Testing Token
- Use `clerk.signIn({ page, emailAddress })` to authenticate programmatically via `CLERK_SECRET_KEY` — this bypasses the UI and any 2FA/email verification entirely
- Never generate `page.getByLabel('Email address').fill(...)` or similar UI-based sign-in sequences for Clerk apps

### 5. Audit report (if present)
```bash
ls -1d audit-reports/AUDIT-*/consolidated/CONSOLIDATED.md | sort | tail -1 || ls audit-reports/ | rg -i consolidated | sort | tail -1
```
Read the most recent audit report. Every finding references a real feature. Use it to ensure tests cover every flow the audit touched — especially security-sensitive ones.

### 6. Existing tests (if any)
```bash
find e2e -name "audit-*.spec.ts" | sort
find e2e -name "*.spec.ts" ! -name "audit-*.spec.ts" | sort
```
Treat files differently based on naming:
- `audit-*.spec.ts` are audit-cycle tests. Archive current report, then delete and regenerate these every cycle.
- Non-audit spec files are baseline tests. Keep and update only when explicitly required; do not duplicate or overwrite by default.

---

## Phase 2 — Plan the test suite

Before writing code, output a **test plan** for the user to review:

```
═══════════════════════════════════════════
TEST PLAN — [Project Name]
═══════════════════════════════════════════

Authentication:
  Setup: Clerk test mode with injected session
  Test user: created via Clerk dashboard (instructions below)

User Flows to Test:
  [CRITICAL — test these first, failures here = app is broken]
  ✦ AUTH-01: User can sign in and reach dashboard
  ✦ AUTH-02: Unauthenticated user is redirected to sign-in

  [CORE — primary app functionality]
  ✦ TEAM-01: User can create a new team
  ✦ TEAM-02: User can invite a member to a team
  ✦ TEAM-03: User can view team settings
  ✦ DOC-01: User can upload a document
  ✦ DOC-02: User can view document version history
  ✦ DOC-03: User can download a document version
  ✦ DOC-04: User can rename a document

  [SECURITY — verify audit fixes work]
  ✦ SEC-01: Unauthenticated user cannot access download URL directly
  ✦ SEC-02: User cannot access another team's documents

  [EDGE CASES]
  ✦ EDGE-01: Upload rejects files over size limit
  ✦ EDGE-02: Empty team name shows validation error

Total: [N] tests across [N] spec files

Confirm this plan before I generate the code? (or say "generate" to proceed)
═══════════════════════════════════════════
```

Wait for user confirmation before proceeding to Phase 3.

---

## Phase 3 — Generate setup files

### playwright.config.ts
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // run sequentially to avoid Convex conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
```

### e2e/global.setup.ts (Clerk auth)
```typescript
import { clerk, clerkSetup } from '@clerk/testing/playwright'
import { test as setup } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth/user.json')

// Obtain a Clerk Testing Token for all subsequent tests
setup('global setup', async ({}) => {
  await clerkSetup()
})

setup('authenticate', async ({ page }) => {
  // Navigate to an unprotected page that loads Clerk
  await page.goto('/')

  // Authenticate via Clerk's testing helper — uses CLERK_SECRET_KEY to bypass
  // email verification codes that trigger on unrecognized devices
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    },
  })

  // Verify access to a protected route
  await page.goto('/dashboard')
  await page.waitForURL('/dashboard')

  // Save auth state — reused by all tests
  await page.context().storageState({ path: authFile })
})
```

### .env.test
```bash
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-test-password
PLAYWRIGHT_BASE_URL=http://localhost:3000
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### e2e/helpers/auth.ts
```typescript
import { clerk } from '@clerk/testing/playwright'
import { Page } from '@playwright/test'

// Use this in any test that needs a fresh authenticated state.
// clerk.signIn uses CLERK_SECRET_KEY to bypass email verification prompts.
export async function signIn(page: Page) {
  await page.goto('/')
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    },
  })
}
```

---

## Phase 4 — Generate test files

Before writing any audit-cycle tests:
1. Archive the current report (`npm run test:archive`) so previous runs remain viewable.
2. Delete all existing `e2e/audit-*.spec.ts` files.
3. Generate new `e2e/audit-*.spec.ts` files from the latest consolidated audit.

Generate one spec file per feature area. For each test follow this structure:

```typescript
import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────
// FLOW: [FLOW-ID] — [Flow Name]
// TESTS: [what this verifies]
// AUDIT COVERAGE: [finding IDs covered, if any]
// ─────────────────────────────────────────

test.describe('[Feature Area]', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/[relevant-route]')
  })

  test('[FLOW-ID]: [clear description of what passes]', async ({ page }) => {
    // ARRANGE — set up any preconditions
    
    // ACT — perform the user action

    // ASSERT — verify the outcome
    await expect(page.locator('[data-testid="..."]')).toBeVisible()
  })

})
```

### Test files to generate (based on discovery):

Generate these as audit-cycle files (all prefixed with `audit-`) based on what you found in Phase 1:

- `e2e/audit-accessibility.spec.ts` — map to current A11Y IDs in the latest consolidated audit
- `e2e/audit-security.spec.ts` — map to current SEC IDs in the latest consolidated audit
- `e2e/audit-security-roles.spec.ts` — role enforcement and authorization findings
- `e2e/audit-edge-cases.spec.ts` — validation and edge-case findings
- `e2e/audit-error-handling.spec.ts` — null/not-found/error-boundary findings

---

## Phase 5 — Generate verification checklist

After all test files, output a **verification checklist** the user can follow to confirm each test is real:

```
═══════════════════════════════════════════
VERIFICATION CHECKLIST
How to confirm each test actually catches real failures
═══════════════════════════════════════════

BEFORE TRUSTING ANY TEST — run in headed mode first:
  npx playwright test --headed --project=chromium

Then verify each critical test with the "break it" method:

AUTH-01 (sign in works):
  Break it: Comment out the redirect in middleware.ts
  Expected: Test fails with "Expected URL to be /"
  Restore: Uncomment redirect

TEAM-01 (create team):
  Break it: Comment out the createTeam mutation call in the component
  Expected: Test fails — team name never appears in team list
  Restore: Uncomment mutation

DOC-01 (upload document):
  Break it: Comment out the createVersion mutation call
  Expected: Test fails — file never appears in document list
  Restore: Uncomment mutation

SEC-01 (download requires auth):
  Break it: Remove auth check from getDownloadUrl in convex/documentVersions.ts
  Expected: Test STILL PASSES (unauthenticated access succeeds — this is the bug)
  This tells you: the test is working, the fix is what makes it pass
  
[continue for each test...]

═══════════════════════════════════════════
VIEWING TEST RESULTS
═══════════════════════════════════════════

After running tests:
  npx playwright show-report        # visual HTML report with screenshots
  npx playwright test --headed      # watch tests run in real browser
  npx playwright test --debug       # step through one test at a time

Trace viewer (when a test fails):
  npx playwright show-trace playwright-report/[test-name]/trace.zip
  # Shows every click, network request, and screenshot frame by frame
═══════════════════════════════════════════
```

---

## Phase 6 — Output install instructions

```
═══════════════════════════════════════════
SETUP INSTRUCTIONS
═══════════════════════════════════════════

1. Install Playwright:
   npm install -D @playwright/test
   npx playwright install chromium

2. Install Clerk testing package:
   npm install -D @clerk/testing

3. Create test user in Clerk dashboard:
   - Go to clerk.com → your app → Users → Create user
   - Use a dedicated test email (not your real account)
   - Add credentials to .env.test
   - Copy your Publishable Key and Secret Key from clerk.com → your app → API Keys
   - Add both to .env.test as CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY
   - Never commit .env.test — ensure it is in .gitignore

4. Create auth directory:
   mkdir -p e2e/.auth
   echo "e2e/.auth/" >> .gitignore    # never commit auth tokens

5. Run setup only:
   npx playwright test --project=setup

6. Run full suite:
   npx playwright test

7. View results:
   npx playwright show-report
═══════════════════════════════════════════
```

---

## Behavior Rules

- Always show the test plan and wait for confirmation before generating code
- Generate complete, runnable test files — no placeholders, no TODOs
- Use `data-testid` attributes where selectors would be fragile — note which components need them added
- If a flow requires specific test data (a team, a document), create it in `beforeEach` and clean up in `afterEach`
- Flag any test that cannot be fully automated (e.g. email delivery verification) and explain why
- Never generate a test that always passes regardless of app state — every assertion must be falsifiable

## Recommended Model
🧠 **Opus** — reading the whole codebase and generating a coherent test suite requires full context
