# How to use the audit & testing skills

These live under `.cursor/skills/audit/`. Each folder contains a `SKILL.md` with the full workflow.

They are **not** meant to auto-run on every message: their front matter includes `disable-model-invocation: true`, so you trigger them explicitly.

## How to run a skill in Cursor

1. **Ask in plain language** — e.g. “Run the security audit skill on `app/api/foo/route.ts`” or “Use the generate-tests skill.” The agent can read the matching `SKILL.md` when you name it.
2. **Attach or @ the file** — Open `SKILL.md` or mention its path so the agent loads the instructions.
3. **Composer / Agent skills UI** — If your Cursor build lists project skills, pick the one you want (names match the folder: `audit-security`, `generate-tests`, etc.).

Below is a short map of **what each skill is for** and **what to say** to use it.

---

## `audit-all` — full multi-role audit orchestrator

**Purpose:** Configure and run several audits in parallel (principal, security, devops, a11y, patterns) via sub-agents, then merge reports under `audit-reports/`.

**When to use:** You want a structured audit pass with separate markdown reports and an optional consolidated summary.

**How to invoke:** Ask to run the **audit-all** skill. You can add flags as described inside the skill: `--dry-run`, `--debug` (or say “dry run only” / “with debug logs”).

**Note:** Workers read the other role skills in this same folder (paths are set in `audit-all/SKILL.md`).

---

## `audit-principal` — principal engineer review

**Purpose:** Architecture, React/Next patterns, code quality, tech debt — medium severity and above.

**When to use:** Reviewing a file or selection before merge, or getting a senior-level pass on structure and maintainability.

**How to invoke:** “Run **audit-principal** on [file path]” or attach the file and ask for a principal engineer audit per the skill.

---

## `audit-security` — security audit

**Purpose:** OWASP-oriented checklist (access control, injection, secrets, auth, Next.js/Node specifics).

**When to use:** Any change touching auth, APIs, uploads, or sensitive data.

**How to invoke:** “Run **audit-security** on [file or scope].”

**Tip:** The skill recommends a capable model for deeper analysis.

---

## `audit-devops` — DevOps / production readiness

**Purpose:** Logging, resilience, env config, scaling signals, deployment hygiene, Next.js ops concerns.

**When to use:** Before release, or when touching infra-related code, APIs, or error handling.

**How to invoke:** “Run **audit-devops** on [file or directory].”

---

## `audit-a11y` — accessibility (code review)

**Purpose:** WCAG 2.1 AA–style checklist on component/source code (ARIA, keyboard, semantics, etc.).

**When to use:** UI components, forms, modals, navigation.

**How to invoke:** “Run **audit-a11y** on [component file].”

---

## `audit-a11y-browser` — live browser a11y check

**Purpose:** Drive a real browser (Playwright MCP), run axe-core, keyboard checks, modals, skip links.

**When to use:** You have a running app URL and want violations from a real render, not just static code review.

**How to invoke:** “Run **audit-a11y-browser** against `http://localhost:3000`” (or another URL). Requires Playwright MCP available to the agent.

---

## `audit-dry` — DRY and patterns

**Purpose:** Duplication, hooks, extractions, shared utils, constants, types.

**When to use:** Refactors, large files, or repeated patterns across the codebase.

**How to invoke:** “Run **audit-dry** on [file].”

---

## `generate-tests` — Playwright suite generator

**Purpose:** Discover routes/components, plan E2E coverage (including Clerk testing patterns), generate Playwright config and specs aligned with audits.

**When to use:** Bootstrapping or refreshing E2E tests; after a big audit cycle.

**How to invoke:** “Use **generate-tests**” and let the agent follow the phased plan in the skill (discovery → test plan → generated files).

---

## `debug-tests` — failing Playwright debugger

**Purpose:** Orchestrated loop: run tests, classify failures, delegate fixes to workers, optional `--dry-run` / `--debug`.

**When to use:** CI or local Playwright failures you want fixed in a structured, retrying workflow.

**How to invoke:** “Run **debug-tests**” and specify interactive vs auto, retries, etc., as the skill describes.

---

## Folder layout

```
.cursor/skills/audit/
├── how-to-use-these-skills.md   ← this file
├── audit-all/
├── audit-principal/
├── audit-security/
├── audit-devops/
├── audit-a11y/
├── audit-a11y-browser/
├── audit-dry/
├── generate-tests/
└── debug-tests/
```

Each named folder contains exactly one `SKILL.md` with the authoritative steps, checklists, and output formats.
