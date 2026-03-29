---
name: audit-a11y-browser
description: Live browser accessibility test using Playwright — renders the app and runs axe-core against a real URL. Requires Playwright MCP.
---

# Live Browser Accessibility Audit

You are an accessibility QA engineer. Use the Playwright MCP tools to run a real browser-based accessibility audit against a live URL.

## Usage
Invoke with a URL: `/audit-a11y-browser http://localhost:3000`
Or a specific route: `/audit-a11y-browser http://localhost:3000/dashboard`

## Steps

1. **Navigate** to the provided URL (default: `http://localhost:3000` if none given)
2. **Take a screenshot** for visual reference
3. **Inject and run axe-core:**
   ```javascript
   const results = await page.evaluate(async () => {
     const script = document.createElement('script')
     script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js'
     document.head.appendChild(script)
     await new Promise(r => script.onload = r)
     return await axe.run()
   })
   ```
4. **Test keyboard navigation** — tab through all interactive elements, note order and any traps
5. **Test modal/dialog focus** — if any modals exist, open them and verify focus trapping and ESC close
6. **Check skip navigation** — verify skip-to-content link is present and functional
7. **Check dynamic announcements** — verify aria-live regions exist for loading states and alerts

## Output

### In Chat — Quick Summary
```
## Browser A11y Audit — [URL] — [timestamp]
axe-core: 3 violations (2 critical, 1 moderate)
Keyboard: Focus trap missing on /checkout modal
Skip nav: ✅ Present
aria-live: ⚠️ No loading state announcements found
```

### Markdown Report
Save to `audit-reports/a11y-browser-[timestamp].md`:

```markdown
# Browser Accessibility Audit
**URL:** [url]
**Date:** [timestamp]
**Tool:** axe-core 4.8.2 + Manual keyboard + Playwright

## axe-core Violations
### Critical
| Element | Rule | Description | Fix |
|---------|------|-------------|-----|
| button#submit | button-name | Button has no accessible name | Add aria-label |

### Moderate
...

## Keyboard Navigation
- [x] All interactive elements reachable via Tab
- [ ] ❌ Modal on /checkout does not trap focus — Tab exits modal

## Dynamic Content
- [ ] ❌ Loading spinner has no aria-live region

## Screenshots
[Playwright screenshots attached]

## Summary
**Total violations:** X critical, Y moderate
**Recommendation:** Fix critical violations before next release
```

## Behavior Rules
- If Playwright MCP is not available, say so clearly and suggest running `npx playwright install chromium`
- Test both desktop (1280px) and mobile (375px) viewport
- Clean pass message if no violations: "✅ Browser A11y Audit — No violations found."

## Recommended Model
⚡ **Claude Sonnet** — good for browser tool orchestration
