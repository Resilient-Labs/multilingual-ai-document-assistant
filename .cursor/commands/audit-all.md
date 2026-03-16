---
name: audit-all
description: Orchestrate selected audit roles with fresh Task sub-agents, configurable model tier, and optional --dry-run/--debug validation.
---

# Full Audit Orchestrator

You are an orchestrator. Your job is to configure, spawn, and merge audit workers.

Do not perform the role audits yourself in this main context.

## Invocation

- `/audit-all` -> interactive configuration + execution
- `/audit-all --dry-run` -> interactive configuration + plan preview only (no worker launch)
- `/audit-all --debug` -> execution with full prompt and worker trace logging
- `/audit-all --dry-run --debug` -> preview + debug plan details only

## Role Sources

Each worker must read exactly one role file:

1. Principal Engineer -> `.cursor/commands/audit-principal.md`
2. Security Auditor -> `.cursor/commands/audit-security.md`
3. DevOps Engineer -> `.cursor/commands/audit-devops.md`
4. Accessibility Auditor -> `.cursor/commands/audit-a11y.md`
5. Patterns Auditor -> `.cursor/commands/audit-dry.md`

## Hard Rules

- Use `AskQuestion` for all runtime choices.
- Use `Task` tool sub-agents for all selected roles.
- Max 4 concurrent Task workers at a time.
- Never write inline audit comments into source files in this orchestrator flow.
- Workers write findings to role-specific markdown reports only.
- If you catch yourself writing audit findings directly, stop and switch back to orchestration.

## Phase 0 - Interactive configuration

Use `AskQuestion`:

1. **Roles to run** (multi-select):
   - all
   - principal
   - security
   - devops
   - a11y
   - patterns
2. **Model tier strategy**:
   - recommended defaults (principal/security=default, others=fast)
   - all default
   - all fast
   - custom per role

If custom, ask one follow-up question per selected role:
- model for `<role>`: default or fast

Remind user:
`Default workers inherit the current Cursor model dropdown. Set your preferred primary model before continuing.`

## Phase 1 - Scope detection

- If an active file is clearly provided in context, use that file path as scope.
- Otherwise use full `src/` directory.
- Also capture timestamp key `YYYY-MM-DD-HHmm`.

## Phase 2 - Build worker plan

For each selected role, define:

- `roleName`
- `roleFile`
- `modelTier` (`default` or `fast`)
- `reportPath`: `audit-reports/AUDIT-[timestamp]/individual/[roleSlug].md`
- `debugPromptPath`: `audit-reports/AUDIT-[timestamp]/debug/[roleSlug]-prompt.md` (only when `--debug`)
- `debugExecutionPath`: `audit-reports/AUDIT-[timestamp]/debug/[roleSlug]-execution.md` (only when `--debug`)

Role slugs:
- principal
- security
- devops
- a11y
- patterns

Worker prompt template:

```text
You are an audit worker sub-agent.

Task:
1) Read the role instruction file: [roleFile]
2) Follow that role's audit logic against scope: [scope]
3) Do not edit source files. Do not add inline comments.
4) Produce findings as markdown and save to: [reportPath]
5) Return a concise summary in this format:
   role: [roleName]
   high: [N]
   medium: [N]
   low: [N]
   report: [reportPath]

If debug mode is enabled:
6) Create a worker execution trace at: [debugExecutionPath]
7) In that trace, include:
   - ## Received Context (echo the exact prompt you received)
   - ## Files Read (list each file path touched)
   - ## Execution Steps (ordered decisions/findings)
   - ## Final Output (summary counts and report path)
```

If `--debug` is present, orchestrator must:

1. Ensure `audit-reports/AUDIT-[timestamp]/debug/` exists.
2. Resolve every worker prompt with concrete values (no placeholders).
3. Write each resolved prompt to `[debugPromptPath]`.
4. Print each resolved prompt in chat before launching that worker.

## Phase 3 - Dry-run behavior

If `--dry-run` is present:

- Do not launch any Task workers.
- Print a plan preview with:
  - scope
  - selected roles
  - per-role model tier
  - per-role report path
  - per-role debug prompt path and debug execution path (when `--debug`)
  - concurrency batches (max 4 first, remainder queued)
  - final consolidated report path:
    `audit-reports/AUDIT-[timestamp]/consolidated/CONSOLIDATED.md`
- End with:
  `No workers were launched. Remove --dry-run to execute.`

## Phase 4 - Execute workers

If not dry-run:

1. Ensure run directories exist:
   - `audit-reports/AUDIT-[timestamp]/individual/`
   - `audit-reports/AUDIT-[timestamp]/consolidated/`
2. If `--debug`, ensure `audit-reports/AUDIT-[timestamp]/debug/` exists and write/print resolved worker prompts before each launch.
3. Launch workers in parallel batches with max 4 concurrent.
4. Wait for all workers to finish.
5. Collect worker summaries.

## Phase 5 - Consolidate outputs

Create:
`audit-reports/AUDIT-[timestamp]/consolidated/CONSOLIDATED.md`

Consolidated report sections:

1. Header (date, scope)
2. Executive summary table:
   - Role
   - High
   - Medium
   - Low
   - Status (clean/warn/critical)
3. Top action items (up to 5)
4. Per-role findings (embed or summarize each role report)
5. Files needing immediate attention (deduplicated)
6. Model tiers used per role
7. Worker execution summary (parallel batches and counts)

Also print an in-chat summary table and:
`Sub-agents spawned: [N] | Reports: [list] | Model tiers: [role=tier,...]`

If `--debug`, also print:
`Debug prompt logs: [list] | Debug execution logs: [list]`

## Verification checklist

Working correctly indicators:

- Separate role reports exist in `audit-reports/AUDIT-[timestamp]/individual/`
- Consolidated report exists in `audit-reports/AUDIT-[timestamp]/consolidated/` and references all selected roles
- Debug logs (when `--debug`) exist in `audit-reports/AUDIT-[timestamp]/debug/`
- Worker count equals selected role count
- For 5 roles, output shows two execution batches due to 4-worker concurrency cap

Failure indicator:

- A single in-chat audit with no role-specific report files usually means workers were not launched.
