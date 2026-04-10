# FitnaFilter: Issues, Weaknesses & Improvement Plan

> Generated from comprehensive static analysis of the entire codebase.
> Organized by severity, with actionable fix suggestions for each finding.

---

## Table of Contents

- [Critical Bugs](#critical-bugs)
- [High-Severity Issues](#high-severity-issues)
- [Medium-Severity Issues](#medium-severity-issues)
- [Low-Severity Issues](#low-severity-issues)
- [Performance Optimizations](#performance-optimizations)
- [Architecture Improvements](#architecture-improvements)
- [UX & Accessibility](#ux--accessibility)
- [Dead Code & Cleanup](#dead-code--cleanup)
- [Priority Implementation Roadmap](#priority-implementation-roadmap)

---

## Critical Bugs

### 1. Background-image failure recovery still needed follow-through
- **Previous issue**: post-fetch failures in the async background-image filtering path could bypass the local recovery branch and leave the original background hidden.
- **Current status**: Fixed in the current tree by returning the `filterImageElementAsBackground(...)` promise from `processBackgroundImage()` so the local `.catch(...)` covers both fetch and filtering failures.

### 2. Shared Canvas Race Condition (Corrupted Images)
- **Current status**: Already fixed. `filterSkinColor()` now uses a per-call working canvas instead of mutating the shared page canvas.

### 3. SSRF via Unrestricted `fetchAndReadImage`
- **Current status**: Partially fixed and tightened further. Public pages are blocked from triggering private/local fetches, while private/local tabs may still fetch their own private assets for filtering fallback.

### 4. Blocklist TOCTOU Race (Bypass During Reload)
- **File**: `src/js/content/DomainFilter.js:300-304`, `src/js/background.js:509-537`
- **Impact**: Toggling any blocklist temporarily disables ALL blocking while lists reload (~seconds for 500K entries)
- **Root Cause**: `fetchAndProcessBlocklist()` calls `blockedDomains.clear()` then asynchronously re-populates
- **Fix**: Build new collections, then swap atomically:
```js
async function fetchAndProcessBlocklist() {
    const newBlockedDomains = new Set();
    const newDomainMap = new Map();
    // ... load into new collections ...
    blockedDomains = newBlockedDomains;       // atomic swap
    domainToBlocklistMap = newDomainMap;       // atomic swap
}
```
(Change `const` to `let` for these variables at lines 23-24.)

---

## High-Severity Issues

### 5. Per-Pixel Object Allocation in Hot Loop
- **File**: `src/js/content/ImageProcessing.js:138-156`
- **Impact**: ~4M short-lived objects created per 1080p image, causing GC pressure and jank
- **Root Cause**: `rgbToYCbCr()` and `rgbToHsv()` return new objects per pixel
- **Fix**: Inline the math directly in the loop, computing only needed components:
```js
for (let i = 0; i < pixelData.length; i += 4) {
    const r = pixelData[i], g = pixelData[i+1], b = pixelData[i+2];
    
    // Inline YCbCr (only cb and cr needed, y is unused)
    const cb = 128 + (-0.169 * r) + (-0.331 * g) + (0.5 * b);
    const cr = 128 + (0.5 * r) + (-0.419 * g) + (-0.081 * b);
    
    // Early exit: check cheap YCbCr first
    if (cb < CB_MIN || cb > CB_MAX || cr < CR_MIN || cr >= CR_MAX) continue;
    
    // Only compute HSV if YCbCr passes (saves 60-80% of HSV calculations)
    // ... inline HSV computation ...
    
    if (isSkin) { pixelData[i] = replR; pixelData[i+1] = replG; pixelData[i+2] = replB; }
}
```

### 6. `urlListRemove` Deletes Wrong Entries (Substring Match Bug)
- **Current status**: Already fixed. Removal now uses normalized exact entries or explicit index removal.

### 7. Double Blob URL Revocation
- **File**: `src/js/content/domManipulation.js:485-515, 625-641`
- **Impact**: Intermittently broken/blank images when elements reprocess quickly
- **Root Cause**: Blob URLs are revoked in `onload` callbacks AND in `releaseFilteredResources()`. If an element is reprocessed before `onload` fires, the URL is revoked while the browser is still loading it.
- **Fix**: Only revoke in `releaseFilteredResources()`, not in `onload`. Track current URL and skip revocation if it's already been replaced.

### 8. Blocklist Memory: ~114MB for Vice Lists Alone
- **File**: `src/js/background.js:23-24`, `src/js/content/DomainFilter.js:241-293`
- **Impact**: Service worker uses excessive memory, risks termination by Chrome
- **Root Cause**: ~960K domains stored in both a `Set` AND a `Map` (duplicate storage). Each domain string ~60 bytes.
- **Fix (immediate)**: Remove `blockedDomains` Set, use `domainToBlocklistMap.has()` for lookups:
```js
// Remove: let blockedDomains = new Set();
// Change findMatchingBlockedDomain to use domainToBlocklistMap.has()
```
- **Fix (ideal)**: Migrate to `chrome.declarativeNetRequest` API which handles millions of rules natively with near-zero memory.

### 9. `getSettings` Does 2 Storage Reads Per Call
- **File**: `src/js/background.js:27-71`
- **Impact**: 40+ storage reads on page load (20 iframes x 2 reads each)
- **Root Cause**: Every `getSettings` call reads from `chrome.storage.sync` and `chrome.storage.local` instead of using the in-memory `storedSettings`
- **Fix**: Return `storedSettings` directly. Use `chrome.storage.onChanged` to keep it in sync:
```js
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') { /* update storedSettings */ }
    if (area === 'local') { /* update pause state */ }
});
```

### 10. `doIframe` Checks Wrong Document Body
- **File**: `src/js/content/js.js:432`
- **Impact**: Iframes may not be processed, or processing starts before iframe DOM is ready
- **Root Cause**: Polls `mDoc.body` (parent document) instead of `win.document.body` (iframe document)
- **Fix**: `if (win.document && win.document.body)` instead of `if (mDoc.body)`

### 11. Content Scripts Injected on ALL URLs
- **File**: `src/manifest.json:24-39`
- **Impact**: 8 scripts loaded and `getSettings` message sent on every page, every frame, even when paused/excluded
- **Fix**: Add `exclude_matches` or switch to programmatic injection:
```json
"content_scripts": [{
    "exclude_matches": ["chrome://*", "chrome-extension://*", "about:*", "devtools://*"],
    // ...
}]
```

### 12. No JSON Parse Error Handling
- **File**: `src/js/background.js:41, 52, 269, 288, 310`
- **Impact**: Corrupted storage data makes the extension non-functional
- **Fix**: Wrap all `JSON.parse()` in try-catch with defaults.

---

## Medium-Severity Issues

### 13. CSS Selector Injection via UUID
- **File**: `src/js/content/domManipulation.js:599`
- **Impact**: A malicious page could craft `skf-uuid` attributes to cause `querySelector` to match wrong elements
- **Fix**: Use `CSS.escape(uuid)` or maintain a `Map<uuid, Element>` for O(1) lookup (also fixes performance).

### 14. `isSkinPixel` and `filterSkinColor` Reference Global `settings`
- **File**: `src/js/content/ImageProcessing.js:95, 158`
- **Impact**: Null dereference if settings not yet loaded; partial color inconsistency if settings change mid-processing
- **Fix**: Pass `isNoFaceFeatures` and `filterColor` as parameters. Pre-compute replacement RGB values before the pixel loop.

### 15. `RegExp.$1` Deprecated and Unreliable
- **File**: `src/js/content/js.js:533-534`
- **Impact**: Image titles could be wrong if another script runs a regex between `match()` and `RegExp.$1`
- **Fix**: `const m = this.src.match(/([-\w]+)(\.[\w]+)?$/i); if (m) this.title = m[1];`

### 16. MutationObserver Regex Null Dereference
- **File**: `src/js/content/js.js:336`
- **Impact**: Content script crashes if background-image URL has unusual format
- **Fix**: Store `exec()` result and null-check before accessing `[1]`.

### 17. `removeCssClass` Uses Fragile Regex
- **File**: `src/js/content/domManipulation.js:106-112`
- **Impact**: May fail to remove classes containing special characters
- **Fix**: Use `element.classList.remove(className)`.

### 18. O(n) Linear Search in `Suspects.addSuspect`
- **File**: `src/js/content/Suspects.js:39`
- **Impact**: O(n^2) aggregate on image-heavy pages
- **Fix**: Add a `WeakSet` for O(1) deduplication:
```js
const mSet = new WeakSet();
function addSuspect(domElement) {
    if (!domElement || !domElement.isConnected || mSet.has(domElement)) return;
    mSet.add(domElement);
    mList.push(domElement);
    domElement[ATTR_RECTANGLE] = domElement.getBoundingClientRect();
}
```

### 19. `findElementByUuid` Does Full DOM Search Per Image
- **File**: `src/js/content/domManipulation.js:599`
- **Impact**: O(n) per image, O(n^2) total for pages with many images
- **Fix**: Maintain a `Map<uuid, Element>` populated in `addRandomWizUuid()`.

### 20. `updateSuspectsRectangles` Forces Layout Reflow Every 3 Seconds
- **File**: `src/js/content/Suspects.js:48-52`, `src/js/content/js.js:370-372`
- **Impact**: Periodic jank on pages with hundreds of filtered elements
- **Fix**: Use `IntersectionObserver` to only track visible elements. Update rectangles lazily.

### 21. No Duplicate Check in `urlListAdd`
- **File**: `src/js/background.js:270`
- **Impact**: Exclusion list fills with duplicates
- **Fix**: `if (!list.includes(url)) list.push(url);`

### 22. `chrome.storage.sync` Quota Not Checked
- **File**: `src/js/background.js:183, 271, 295, 327, 494-505`
- **Impact**: URL list stops persisting silently after ~8KB
- **Fix**: Check `chrome.runtime.lastError` after set operations. Show user warning. Consider `chrome.storage.local` for large data.

### 23. Blocklist Reload on Every Single Toggle
- **File**: `src/js/background.js:443-449`
- **Impact**: Toggling a 241-entry list triggers reloading a 500K-entry list
- **Fix**: Implement incremental add/remove instead of full rebuild.

### 24. `window === top` Throws in Cross-Origin Iframes
- **File**: `src/js/content/ImagesDisplayer.js:58`
- **Impact**: `showImages()` could throw, leaving images hidden permanently
- **Fix**: Wrap in try-catch like the existing `inIframe()` function.

### 25. Blocklist Files Publicly Accessible (Extension Fingerprinting)
- **File**: `src/manifest.json:48-53`
- **Impact**: Any website can detect FitnaFilter is installed by probing `chrome-extension://<id>/blocklists/porn.txt`
- **Fix**: Remove `blocklists/*.txt` from `web_accessible_resources`. The service worker already has access.

### 26. `doElement` Relies on `this` Binding
- **File**: `src/js/content/js.js:456-641`
- **Impact**: Fragile pattern; calling without `.call()` silently breaks
- **Fix**: Refactor to take `domElement` as a parameter.

### 27. `processImage` Uses `document` Instead of `mDoc`
- **File**: `src/js/content/js.js:448`
- **Impact**: Iframe processing uses parent's canvas (race condition)
- **Fix**: Use `mDoc.getElementById(CANVAS_GLOBAL_ID)` or create per-ProcessWin canvas.

### 28. No Input Validation on URL Exclusion List
- **File**: `src/js/background.js:262-283`
- **Impact**: Adding "e" excludes every URL containing "e" (all of them)
- **Fix**: Validate minimum length, check for valid domain/URL format.

---

## Low-Severity Issues

### 29. `saveUrlList()` Function Never Called (Dead Code)
- **File**: `src/js/background.js:182-184`

### 30. `addHeadScript()` Function Never Called (Dead Code)
- **File**: `src/js/content/domManipulation.js:66-79`

### 31. `style.type = 'text/css'` Unnecessary in HTML5
- **File**: `src/js/content/domManipulation.js:19`

### 32. Duplicate CSS Class Functions
- **File**: `src/js/content/domManipulation.js:91-93, 198-218`
- `addCssClass`/`removeCssClass` and `addClassToStyle`/`removeClassFromStyle` are identical pairs.

### 33. `autoUnpauseTimeout` Value of 0 Falls Through to Default
- **File**: `src/js/background.js:46`
- **Root Cause**: `+value || DEFAULT` treats 0 as falsy
- **Fix**: `syncResult.autoUnpauseTimeout !== null ? +syncResult.autoUnpauseTimeout : DEFAULT`

### 34. Loose Equality (`==`) for Tab ID Comparisons
- **File**: `src/js/background.js:352`
- **Fix**: Use `===` consistently.

### 35. `guid()` Uses Weak `Math.random()`
- **File**: `src/js/content/domManipulation.js:650-658`
- **Fix**: Use `crypto.randomUUID()`.

### 36. `maxSafe` Input Type is `text` Not `number`
- **File**: `src/options.html:81`
- **Fix**: `<input type="number" min="1" max="1000" id="max-safe" />`

### 37. `onMessage` Listener Always Returns `true`
- **File**: `src/js/background.js:487`
- **Fix**: Only return `true` for async cases.

### 38. `'use strict'` Only in ImageProcessing.js
- All other content scripts run in sloppy mode, masking bugs like #1.

### 39. Unused Blocklist Files Inflate Extension Size
- **Files**: `src/blocklists/everything.txt` (~1.6M lines), `src/blocklists/basic.txt`, `src/blocklists/adobe.txt`
- These are downloaded by `download_blocklists.py` but never referenced in code.
- **Fix**: Remove from `src/blocklists/` or exclude from the extension package.

### 40. `PATTERN_VARIATIONS` Referenced in Docs but Doesn't Exist
- **File**: `CLAUDE.md` references it, but the constant is not defined anywhere.

### 41. Hover Visual Timeout Uses Magic Number
- **File**: `src/js/content/js.js:839`
- `2500` should be a named constant like the other timing values.

### 42. Missing `prefers-reduced-motion` Support
- **Files**: `src/css/popup.css`, `src/css/options.css`
- Multiple infinite CSS animations run continuously (battery drain).
- **Fix**: Add `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`

### 43. No `aria-label` on Color Filter Buttons
- **File**: `src/popup.html:83-85`
- Screen readers can't identify the purpose of color buttons.

### 44. Missing `forced-colors` / High-Contrast Support
- **Files**: `src/css/popup.css`, `src/css/options.css`

### 45. Options Script in `<head>` Without `defer`
- **File**: `src/options.html:10`
- Blocks HTML parsing. Move to end of `<body>` or add `defer`.

### 46. Per-Tab State Lost on Service Worker Restart
- **Files**: `src/js/background.js:1-2`
- `excludeForTabList` and `pauseForTabList` are in-memory only.
- MV3 service workers can be terminated at any time.
- **Fix**: Consider persisting to `chrome.storage.session` (MV3 API).

### 47. Video Filtering Unimplemented
- **File**: `src/js/content/js.js:568-573`
- TODO comment from original code. `VIDEO` tag is in `tagList` but isn't handled as video.

### 48. Several Blocklist Categories Lack Specific Quran Verses
- **File**: `src/js/content/DomainFilter.js`
- `smarttv`, `redirect`, `tracking`, `ads`, `piracy`, `torrent`, `crypto` all fall back to default verses.

---

## Performance Optimizations

### Quick Wins (Immediate Impact, Low Effort)

| # | Optimization | File | Est. Impact |
|---|-------------|------|-------------|
| P1 | Inline pixel math, eliminate function calls/objects | ImageProcessing.js | **50-70% faster** image processing |
| P2 | Early-exit YCbCr before computing HSV | ImageProcessing.js | **20-40% fewer** HSV calculations |
| P3 | Pre-compute filter RGB values before loop | ImageProcessing.js | Eliminates per-pixel switch |
| P4 | Remove duplicate `blockedDomains` Set | background.js | **~50%** less blocklist memory |
| P5 | Return `storedSettings` directly, use `onChanged` | background.js | **Eliminates** 40+ storage reads/page |
| P6 | Add `WeakSet` for suspect deduplication | Suspects.js | O(1) vs O(n) per add |
| P7 | Reduce tag list to common background-image tags | js.js | Fewer `querySelectorAll` matches |

### Medium-Term Optimizations

| # | Optimization | File | Est. Impact |
|---|-------------|------|-------------|
| P8 | Use `IntersectionObserver` for rectangle updates | Suspects.js, js.js | Eliminates periodic reflow |
| P9 | Create per-call canvas (or use queue) | ImageProcessing.js | Eliminates race condition + corruption |
| P10 | Stream blocklist parsing instead of `split('\n')` | DomainFilter.js | Avoids 500K string array spike |
| P11 | Debounce MutationObserver with `requestAnimationFrame` | js.js | Fewer redundant `doElements` calls |
| P12 | Use `attributeFilter: ['class', 'style']` | js.js | Reduces mutation noise |

### Long-Term Optimizations

| # | Optimization | Description | Est. Impact |
|---|-------------|-------------|-------------|
| P13 | Migrate to `declarativeNetRequest` API | Replace in-memory blocklist with Chrome's native rule engine | **~100MB** memory savings, instant lookups |
| P14 | WebAssembly pixel processing | Compile skin detection to WASM | **2-10x** faster processing |
| P15 | `OffscreenCanvas` for processing | Move canvas work off main thread | Eliminates UI jank |
| P16 | Programmatic content script injection | Only inject when extension is active for the tab | Eliminates overhead on excluded pages |
| P17 | Pre-computed lookup table for skin classification | 256^3 entries mapped to boolean | O(1) per pixel, no math |

---

## Architecture Improvements

### Module System
The codebase uses no module system. All content scripts share a global scope via `manifest.json` injection order. This causes:
- Implicit global variables (bug #1)
- Tight coupling between all modules
- No ability to tree-shake or bundle
- Load-order dependencies

**Recommendation**: Use a bundler (esbuild, Rollup) to create a single content script bundle from ES modules. This enables `'use strict'` everywhere, proper scoping, and dead code elimination.

### State Management
Settings are fetched once per page load and cached in a global `settings` variable. Changes require reloading the page.

**Recommendation**: Use `chrome.storage.onChanged` in content scripts to react to settings changes in real-time without page reload.

### Testing Infrastructure
There are zero automated tests. The pixel processing algorithm, URL matching, and blocklist parsing are all pure functions that are highly testable.

**Recommendation**: Add unit tests for:
1. `rgbToYCbCr()` and `rgbToHsv()` (known test vectors)
2. `isSkinPixel()` (boundary conditions)
3. `findMatchingBlockedDomain()` (subdomain walking)
4. `processBlocklist()` (format parsing)
5. URL exclusion matching logic
6. `getSettings()` computation (auto-unpause, exclusion layers)

---

## UX & Accessibility

| Issue | Fix |
|-------|-----|
| Page goes blank (`opacity: 0`) during processing | Hide individual images only, or use skeleton/blur |
| No feedback when storage quota exceeded | Show toast/notification |
| Color buttons lack screen reader labels | Add `aria-label` |
| No `prefers-reduced-motion` | Disable animations for motion-sensitive users |
| No high-contrast mode | Add `@media (forced-colors: active)` rules |
| Filter color change requires page reload to see effect on already-filtered images | Already works via `updateFilterColor` message |
| No confirmation before clearing all exclusions | Add confirmation dialog |

---

## Dead Code & Cleanup

| Item | File | Action |
|------|------|--------|
| `saveUrlList()` | background.js:182-184 | Remove |
| `addHeadScript()` | domManipulation.js:66-79 | Remove |
| `addClassToStyle()` / `removeClassFromStyle()` | domManipulation.js:198-218 | Merge with `addCssClass`/`removeCssClass` |
| `style.type = 'text/css'` | domManipulation.js:19 | Remove |
| `everything.txt` (1.6M lines) | blocklists/ | Remove from extension |
| `basic.txt` | blocklists/ | Remove from extension |
| `adobe.txt` | blocklists/ | Remove from extension |
| `PATTERN_VARIATIONS` reference | CLAUDE.md | Remove from docs |
| Video filtering TODO | js.js:568-573 | Remove `VIDEO` from tagList or implement |

---

## Priority Implementation Roadmap

### Phase 1: Critical Bug Fixes (Do First)
*Estimated effort: 1-2 hours*

1. **Add `let` to `bgImgSuffix`** (js.js:595) - 1 character fix, prevents data corruption
2. **Fix shared canvas race condition** (ImageProcessing.js) - Create per-call canvas
3. **Atomic blocklist swap** (DomainFilter.js) - Build new Set/Map then swap
4. **URL validation in fetchAndReadImage** (background.js) - Block private IPs
5. **Fix `urlListRemove` substring matching** (background.js:291) - Use exact match
6. **Wrap JSON.parse in try-catch** (background.js) - 5 locations

### Phase 2: High-Impact Performance (Do Second)
*Estimated effort: 3-4 hours*

7. **Inline pixel processing math** (ImageProcessing.js) - Eliminate 4M objects/image
8. **Add early-exit in skin detection** - Skip HSV when YCbCr fails
9. **Remove duplicate blockedDomains Set** (background.js) - Use Map only
10. **Cache settings with onChanged listener** (background.js) - Eliminate storage reads
11. **Fix doIframe body check** (js.js:432)

### Phase 3: Code Quality (Do Third)
*Estimated effort: 2-3 hours*

12. **Add `'use strict'` to all content scripts**
13. **Replace className manipulation with classList API**
14. **Fix RegExp.$1 usage** (js.js:533)
15. **Add null checks for MutationObserver regex** (js.js:336)
16. **Add WeakSet for suspect deduplication** (Suspects.js)
17. **Remove dead code** (saveUrlList, addHeadScript, duplicate functions)
18. **Remove unused blocklist files** (everything.txt, basic.txt, adobe.txt)

### Phase 4: Architecture (Longer Term)
*Estimated effort: 1-2 days*

19. **Remove blocklists from web_accessible_resources**
20. **Add exclude_matches for chrome:// URLs in manifest**
21. **Refactor doElement to use parameter instead of this**
22. **Implement UUID Map for O(1) element lookup**
23. **Use IntersectionObserver for rectangle updates**
24. **Add input validation for URL exclusion list**
25. **Add prefers-reduced-motion CSS support**
26. **Add aria-labels to interactive elements**
27. **Persist per-tab state to chrome.storage.session**

### Phase 5: Major Upgrades (When Ready)
*Estimated effort: 1-2 weeks*

28. **Migrate to declarativeNetRequest API** for blocklist enforcement
29. **Add bundler (esbuild) with ES modules**
30. **Add unit test suite** (Vitest or Jest)
31. **Explore WebAssembly for pixel processing**
32. **Explore OffscreenCanvas for non-blocking processing**
