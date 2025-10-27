# FitnaFilter – Re-evaluated Review  
Date: 2025‑10‑25 (post-fix follow-up)

## Summary
- Major regressions from the previous pass have been resolved: blocklist checks now walk subdomains, the popup no longer re-filters pages on open, cross-origin fetches propagate errors, and settings reads return fresh data.
- Blob URLs for filtered images/backgrounds are revoked promptly, addressing the prior memory-leak concern.
- No new high- or medium-severity issues were uncovered during this follow-up review; remaining items are minor polish or future enhancements.
- Automated test coverage is still absent, so manual QA remains critical before release.

## Confirmed Issues

### High Severity
- None observed after the recent fixes.

### Medium Severity
- None outstanding; previously flagged items have been remediated.

### Low Severity / Nice-to-haves
- **Aggressive polling remains** – The 1 ms interval that hides the body until styles are injected (`src/js/content/js.js:139`) still exists. Switching to a more measured cadence (e.g., `requestAnimationFrame`) would reduce needless wake-ups.
- **Settings coupling** – `ImageProcessing` routines continue to reference the outer-scoped `settings` object (`src/js/content/ImageProcessing.js:145`). Passing explicit parameters would make the pipeline easier to unit-test when tests arrive.
- **Magic numbers** – Hard-coded retry/poll thresholds (for example, `pollNum == 500` in `src/js/content/js.js:416`) could be lifted into named constants for readability.
- **Undo affordance** – The eyedropper “undo” hook remains a TODO in `src/js/content/Eye.js:85`. Not a bug, but worth tracking.

## Clarifications
- The `Suspects` collection prunes disconnected nodes via `pruneDisconnected`, and the new cleanup routine in `ProcessWin` tears down observers between runs, so earlier worries about unbounded growth are no longer applicable.
- `findElementByUuid` already uses `querySelector`, so no further optimization was required there.

## Recommended Next Steps
1. Add lightweight automated tests (even smoke tests around settings propagation and blocklist matching) to reduce regression risk.
2. Consider dialing back the 1 ms polling loop and promoting magic numbers to constants as part of general refactoring.
3. Prioritise UX polish items such as the optional undo behaviour when bandwidth permits.
