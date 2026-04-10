# FitnaFilter Playwright QA Report

Date: 2026-04-10

Extension under test: `src/manifest.json` version `1.2.1`

Fixture URLs:
- `http://127.0.0.1:8123/index.html`
- `http://127.0.0.1:8124/skin.svg`

Artifacts:
- Inventory: [inventory.json](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/inventory.json)
- Raw results: [results.json](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/results.json)
- Corrected summary: [summary.json](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/summary.json)
- Pixel samples: [pixel-samples.txt](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/pixel-samples.txt)
- Screenshots folder: [screenshots](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots)

## Overall Result

Passed coverage:
- Inline, cross-origin, and lazy-loaded image filtering
- Eye reveal and undo toggle on hovered inline images
- `Alt+P` pause shortcut
- Options page persistence and blocklist rendering
- Popup show-images, grab-URL, add-URL, and exclusion toggles
- Vice, hazard, and distraction blocklist redirects

Reproducible failures:
- Current-tab refresh/reprocess does not happen after popup color changes or unpause
- `Alt+Z` does not reveal hovered inline images
- CSS background handling is broken for both SVG and PNG backgrounds

## Evidence Highlights

Image filtering proof:
- Control image stays skin-toned in [content-inline-control.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/content-inline-control.png): center pixel `#F4D2C0`
- Filtered inline image in [content-inline-filtered.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/content-inline-filtered.png): center pixel `#7F7F7F`
- Eye reveal returns original in [content-inline-restored.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/content-inline-restored.png): center pixel `#F4D2C0`
- Eye undo re-filters in [content-inline-refiltered.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/content-inline-refiltered.png): center pixel `#7F7F7F`

Popup proof:
- Initial popup harness state: [popup-initial.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/popup-initial.png)
- Grab URL populated the live fixture tab URL: [popup-grab-url.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/popup-grab-url.png)
- Show Images revealed the filtered image: [popup-show-images.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/popup-show-images.png)
- Exclusion toggles turned the live tab back to the original image: [popup-exclusions-on.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/popup-exclusions-on.png)

Background proof:
- Expected SVG background without extension: [background-svg-control.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/background-svg-control.png)
- Actual SVG background with extension: [background-svg-failure.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/background-svg-failure.png)
- Expected PNG background without extension: [background-png-control.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/background-png-control.png)
- Actual PNG background with extension: [background-png-failure.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/background-png-failure.png)
- Pixel samples show both extension-handled background screenshots turned white: `#FFFFFF` in [pixel-samples.txt](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/pixel-samples.txt)

Blocklist proof:
- Vice redirect: [blocklist-vice-redirect.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/blocklist-vice-redirect.png) landed on `https://quran.com/17:32`
- Hazard redirect: [blocklist-hazard-redirect.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/blocklist-hazard-redirect.png) landed on `https://quran.com/2:286`
- Distraction redirect: [blocklist-distraction-redirect.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/blocklist-distraction-redirect.png) landed on `https://quran.com/62:9`

## Findings

### 1. Current-tab refresh is broken after popup actions

What I did:
- Started from a grey-filtered inline image.
- Clicked the popup white filter button.
- Then separately toggled global pause on and off through the popup.

What happened:
- The popup UI switched to white in [popup-filter-white-ui.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/popup-filter-white-ui.png), but the live content image in [popup-filter-white-failure.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/popup-filter-white-failure.png) stayed `grey50`.
- After unpausing, the image in [popup-unpause-failure.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/popup-unpause-failure.png) remained skin-toned instead of being re-filtered.

Likely code hotspots:
- [src/js/content/js.js#L80](/home/azidan/AQL/FitnaFilter/src/js/content/js.js#L80)
- [src/js/content/js.js#L123](/home/azidan/AQL/FitnaFilter/src/js/content/js.js#L123)
- [src/js/content/js.js#L774](/home/azidan/AQL/FitnaFilter/src/js/content/js.js#L774)

### 2. `Alt+Z` does not reveal hovered inline images

What I did:
- Hovered the filtered inline image.
- Pressed `Alt+Z`.

What happened:
- The image in [content-alt-z-after.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/content-alt-z-after.png) stayed filtered with a grey center pixel.
- `Alt+P` still worked in [content-alt-p-paused.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/content-alt-p-paused.png), so this appears specific to `Alt+Z`.

Likely cause:
- [src/js/content/js.js#L285](/home/azidan/AQL/FitnaFilter/src/js/content/js.js#L285) calls `doElement(...)` for `Alt+Z`, which reprocesses instead of revealing.

### 3. CSS backgrounds turn white instead of rendering correctly

What I did:
- Compared SVG and PNG CSS backgrounds with and without the extension.
- Pressed `Alt+A` on the extension-loaded fixture.

What happened:
- The no-extension controls are skin-toned in [background-svg-control.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/background-svg-control.png) and [background-png-control.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/background-png-control.png).
- The extension versions in [background-svg-failure.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/background-svg-failure.png) and [background-png-failure.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/background-png-failure.png) are white.
- `Alt+A` did not restore the original background in [content-alt-a-after.png](/home/azidan/AQL/FitnaFilter/qa/evidence/playwright-2026-04-10/screenshots/content-alt-a-after.png).

Likely code hotspots:
- [src/js/content/domManipulation.js#L493](/home/azidan/AQL/FitnaFilter/src/js/content/domManipulation.js#L493)
- [src/js/content/domManipulation.js#L566](/home/azidan/AQL/FitnaFilter/src/js/content/domManipulation.js#L566)
- [src/js/content/js.js#L774](/home/azidan/AQL/FitnaFilter/src/js/content/js.js#L774)

## Notes

- The popup evidence uses a harnessed `popup.html` tab that forces `chrome.tabs.query({ active: true, currentWindow: true })` to return the live fixture tab. This exercises the same popup script logic against a real content tab, but it is not the browser-toolbar shell itself.
- Hazard-off and distraction-off checks did not redirect. Both navigations instead fell through to browser error pages because the chosen test hostnames no longer resolved, which still confirms the redirect only happens when those lists are enabled.
