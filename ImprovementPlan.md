# FitnaFilter Unified Improvement Plan

> This is the canonical superset document merged from the former `ImprovementPlan.md` and
> `newimprovements.md`.
>
> It combines the long-term architecture and product roadmap with the current remaining backlog and
> audit findings.
>
> Fixed items were removed from the audit section on 2026-05-10, so the backlog below focuses on
> work that is still open.

---

## Table of Contents

- [Goal State](#goal-state)
- [High-Level Roadmap](#high-level-roadmap)
- [Target Architecture](#target-architecture)
- [Data Flow (Images)](#data-flow-images)
- [Hybrid Detection Strategy](#hybrid-detection-strategy-both-skin--ml)
- [Effects / Filters](#effects--filters-pluggable-extendable)
- [Performance Plan](#performance-plan-concrete-tactics)
- [Offscreen + ML Plan](#offscreen--ml-plan-mv3-compatible)
- [Settings + UI Plan](#settings--ui-plan-detailed)
- [Build / Packaging Options](#build--packaging-options-pick-one-up-front)
- [Testing + Benchmarking Plan](#testing--benchmarking-plan)
- [Milestone Breakdown](#milestone-breakdown-ticket-level)
- [Risks / Decisions Needed Early](#risks--decisions-needed-early)
- [Current-State Audit and Remaining Backlog](#current-state-audit-and-remaining-backlog)
- [Critical Bugs](#critical-bugs)
- [High-Severity Issues](#high-severity-issues)
- [Medium-Severity Issues](#medium-severity-issues)
- [Low-Severity Issues](#low-severity-issues)
- [Backlog Performance Optimizations](#backlog-performance-optimizations)
- [Backlog Architecture Improvements](#backlog-architecture-improvements)
- [UX & Accessibility](#ux--accessibility)
- [Dead Code & Cleanup](#dead-code--cleanup)
- [Priority Implementation Roadmap](#priority-implementation-roadmap)

---

## Goal State

- FitnaFilter supports hybrid detection: (1) fast heuristic skin metrics/masks and (2) ML-based
  NSFW classification (and optionally localization), with clear user modes.
- FitnaFilter supports multiple effects: pixel replacement (current), whole-image blur, selective
  blur (mask/boxes), pixelation, and "smart filters" (feathering, edge smoothing, face/hands
  focus).
- FitnaFilter is efficient by design: visibility-aware processing, downsample-first decisioning,
  bounded concurrency, aggressive caching, and minimal main-thread jank.
- ML runs locally using open weights bundled with the extension (no proprietary HaramBlur models;
  their `src/mdls/` is explicitly not reusable).

## High-Level Roadmap

- Milestone 1: Effects system + blur (no ML) + UI toggles
- Milestone 2: Performance overhaul of current pipeline (still heuristic)
- Milestone 3: Offscreen "Detection/Render Service" + port-based queue + caching
- Milestone 4: ML NSFW classifier integration + hybrid decision rules
- Milestone 5: Localization (person boxes or segmentation) + selective blur
- Milestone 6: "Smart filters" polish + QA harness + optional video track

## Target Architecture

- Keep existing FitnaFilter modules and refactor around a new "pipeline core":
  - Content script (per frame): discovers candidates + applies results to DOM (still owns Eye,
    Suspects, ImagesDisplayer).
  - Background service worker: settings, exclusions, cross-origin fetch fallback, and new
    offscreen lifecycle management.
  - Offscreen document (new): runs ML models, heavy image decode/resize, optional render-to-bytes
    (blurred output), persistent cache.
- New core modules (names are suggestions):
  - `FitnaFilter/src/js/content/PipelineController.js` (new): queue, caching, scheduling, and "ask
    offscreen for decision/render".
  - `FitnaFilter/src/js/content/Effects.js` (new): applies CSS blur and/or replaces
    `src/background-image` with blob URLs.
  - `FitnaFilter/src/js/content/ImageProcessing.js` (existing): expand it into a fuller library
    (`computeSkinMask`, `computeSkinRatio`, `applyMaskEffect`).
  - `FitnaFilter/src/js/offscreen/offscreen.html` + `FitnaFilter/src/js/offscreen/offscreen.js`
    (new): ML init, detection queue, cache, optional rendering.

## Data Flow (Images)

- Step A (discover): existing `ProcessWin` (`FitnaFilter/src/js/content/js.js`) keeps scanning
  `<img>` + CSS backgrounds and watching mutations.
- Step B (resolve source): for each candidate build a WorkItem:
  - `elementUuid` (existing `skf-uuid`)
  - `kind`: `img | background`
  - `source`: `currentSrc/src` for `<img>`, parsed URL(s) + suffix for backgrounds
  - `dimensions`: `naturalWidth/Height` + display size
  - `originType`: `http(s) | data: | blob: | file:` (handle separately)
- Step C (cheap gating in content script):
  - Skip if excluded/paused (existing logic).
  - Skip if too small (existing `maxSafe` behavior, but rename semantics; see settings section).
  - Use `IntersectionObserver` to delay offscreen work until visible/near-viewport.
- Step D (offscreen request via port):
  - Content script sends `detectImage` request to offscreen (not one-off `sendMessage`; use a
    long-lived port like HaramBlur for throughput).
- Step E (offscreen decision):
  - Offscreen fetches/decodes image (or uses provided bytes), downscales, runs detectors, returns a
    decision:
    - `decision`: `SAFE | NSFW | MODESTY_TRIGGERED | ERROR`
    - `scores`: `nsfwScore`, `skinRatio`, per-class probs (optional)
    - `localization`: boxes and/or mask metadata (optional)
    - `rendered`: optional bytes for "rewrite image" mode
- Step F (apply):
  - Content script applies effect:
    - Fast mode: CSS class blur/pixelate (no rewriting).
    - Strong mode: replace `img.src` / background URL with `blob:` built in page context from
      returned bytes; store original for reveal.

## Hybrid Detection Strategy (Both Skin + ML)

- Introduce a user-facing mode enum (stored in `chrome.storage.sync`):
  - `mode = "modesty"`: act primarily on skin metrics/masks
  - `mode = "nsfw"`: act primarily on ML NSFW classifier
  - `mode = "hybrid"`: combine with explicit rules (below)
- Recommended hybrid rules (tunable):
  - Compute `skinRatioEstimate` cheaply (downsample + sampling grid).
  - Run `nsfwScore` (ML classifier) if:
    - mode is `nsfw` or `hybrid`, and
    - image size is above a minimum (for example, 96px), and
    - not already cached
  - Decide:
    - If `nsfwScore >= nsfwThresholdHigh`: block (NSFW)
    - Else if mode == `modesty`: block if `skinRatio >= skinThreshold`
    - Else if mode == `hybrid`:
      - Block if `nsfwScore >= nsfwThresholdMid`
      - Or block if `skinRatio >= skinThresholdHigh` and `nsfwScore >= nsfwThresholdLow`
        (catches "suggestive but not porn")
      - Or allow if `nsfwScore <= nsfwSafeThreshold` even when skin is high (reduces false
        positives for normal photos)
- Localization escalation (optional but powerful):
  - If decision is "block" and user selected "selective blur", run second-stage localization:
    - Person boxes (`COCO-SSD`) or person segmentation (`MediaPipe Selfie Segmentation`)
    - Then apply skin mask only inside person region to reduce beige/wood false positives

## Effects / Filters (Pluggable, Extendable)

- Define an "effect pipeline" that can operate with:
  - No mask (whole-image effects)
  - A binary/soft mask (skin/person segmentation)
  - Bounding boxes (person detector, future nude-part detector)
- Effects to implement (in priority order):
  - `pixelReplace` (existing): keep for low-end devices and "hard censor" style
  - `cssBlur` (new, fastest): apply `filter: blur(px) grayscale(...)` via class; easy, but weaker
    against user tampering
  - `canvasBlurWhole` (new): render-blurred output and replace image data (stronger)
  - `canvasBlurMasked` (new): blur only masked pixels, feather edges
  - `pixelateWhole / pixelateMasked` (new): downscale-upscale effect, cheaper than blur for huge
    images
  - `patternOverlay` (new): overlay repeated texture (similar to censorship patterns) for "strong
    modesty" UX
- Key algorithm notes for masked blur:
  - Create blurred version once (`ctx.filter = 'blur(...)'`) on an offscreen canvas.
  - Composite blurred overlay onto original using a mask canvas (`destination-in`) with feathered
    alpha.
  - Feathering: blur/dilate mask edges so transitions are not harsh ("smart filter" feel).

## Performance Plan (Concrete Tactics)

- Candidate selection:
  - Add `IntersectionObserver` to process only visible/near-visible elements; fall back when
    unsupported.
  - Avoid processing the same element repeatedly: store `lastProcessedKey` on the element
    (`URL + size + settings hash`).
- Heuristic skin detection efficiency:
  - Add `computeSkinRatioEstimate(imageData, sampleStep)`:
    - Sample every Nth pixel (for example, 4-12 depending on downsample size).
    - Early exit if ratio exceeds threshold ("already needs block") or if max possible remaining
      cannot reach threshold.
  - Only compute a full-resolution mask when needed:
    - if `ratioEstimate < skinThresholdLow`: skip mask
    - if `ratioEstimate >= skinThresholdHigh`: compute mask but at moderate resolution
- Scheduling:
  - Use `requestIdleCallback` (with timeout) or chunked processing loops to avoid long blocking
    loops.
  - Bounded concurrency:
    - In content scripts: max 1-2 in-flight offscreen requests per frame
    - In offscreen: max N decode tasks + max M inference tasks (separate queues)
- Caching (biggest win):
  - Content-script cache: per element + per URL, short-lived (in-memory)
  - Offscreen cache: LRU keyed by normalized URL + dimensions + `settingsKey` (similar concept to
    HaramBlur):
    - Normalize URLs by stripping `utm_*`, `fbclid`, timestamps, and similar noise
    - Persist recent results in IndexedDB (optional but recommended once ML is in)
- Decode/resample strategy:
  - Prefer `createImageBitmap(blob)` in offscreen for decode (fast, off-main-thread).
  - Use `OffscreenCanvas` for resizing and to avoid DOM canvas overhead.
- Memory hygiene:
  - Keep FitnaFilter's existing object URL revocation pattern.
  - Avoid base64 data unless necessary; prefer transferring `ArrayBuffer` and creating a page-origin
    `blob:` URL in the content script.

## Offscreen + ML Plan (MV3-Compatible)

- Manifest changes (`FitnaFilter/src/manifest.json`):
  - Add `"offscreen"` permission.
  - Add an offscreen document entry point managed by background (not a static manifest key; MV3
    uses `chrome.offscreen.createDocument`).
  - Add CSP updates if needed by the chosen ML runtime (`TFJS WASM` often needs
    `wasm-unsafe-eval`; plan for this explicitly).
- Background responsibilities (`FitnaFilter/src/js/background.js`):
  - Create/recreate offscreen document on demand and on errors.
  - Own a "detector readiness" state and respond to content scripts if offscreen is unavailable
    (fallback to heuristic-only).
  - Optionally centralize cross-origin fetch if offscreen fetch hits CORS edge cases (keep current
    `fetchAndReadImage` as fallback).
- Offscreen responsibilities (new):
  - Load ML models from local extension paths (recommended) under something like
    `FitnaFilter/src/models/...`.
  - Warm up models at startup (one dummy inference).
  - Provide a port listener `chrome.runtime.onConnect`:
    - `name: "fitna-img-det-port"`
    - Handle `detectImage` messages
  - Maintain:
    - Decode queue
    - Inference queue
    - Render queue (if "strong mode")
    - LRU + optional IndexedDB persistence
- Recommended ML baseline (open weights):
  - `nsfwjs` (`TFJS`) for classification: simple integration, good-enough baseline
  - Later: person localization via `@tensorflow-models/coco-ssd` (boxes) or `MediaPipe Selfie
    Segmentation` (mask)
  - Keep ML optional and user-toggleable; default to privacy-preserving "local models only"

## Settings + UI Plan (Detailed)

- Add/rename settings (stored in `chrome.storage.sync`):
  - `filterMode: "modesty" | "nsfw" | "hybrid"`
  - `effectMode: "pixelReplace" | "cssBlur" | "canvasBlurWhole" | "canvasBlurMasked" | "pixelate" | "pattern"`
  - `blurAmount: number` (for example, 5-40)
  - `grayscale: boolean`
  - `skinThreshold: number` (0-1) for mask triggers
  - `nsfwThreshold: number` (0-1) + optional high/low thresholds for hybrid
  - `mlEnabled: boolean`
  - `mlModel: string` (model id/version)
  - `localizationEnabled: boolean` (person boxes/mask)
  - `localizationMode: "personBoxes" | "personMask" | "skinInsidePerson"`
  - Keep existing: `urlList`, `isNoEye`, `isNoFaceFeatures`, pause settings
- Update Options UI (`FitnaFilter/src/options.html`, `FitnaFilter/src/js/options.js`):
  - New section "Detection Mode": `modesty / nsfw / hybrid`
  - New section "Blocking Style": `effectMode + blurAmount + grayscale`
  - New section "ML": enable ML, choose model, show local-only notice, show warmup status
  - New section "Advanced": thresholds, caching toggle, debug overlay toggle
- Update Popup (`FitnaFilter/src/popup.html`, `FitnaFilter/src/js/popup.js`):
  - Quick toggles: mode, ML on/off, effect fast/strong
  - Keep "Show Images" but consider adding optional "Require confirm/password" later if you want
    harder bypass

## Build / Packaging Options (Pick One Up Front)

- Option A (minimal tooling): drop prebuilt JS bundles for `TFJS/nsfwjs` into
  `FitnaFilter/src/js/vendor/` and load them in offscreen via `<script>` tags.
  - Pros: fastest to ship
  - Cons: large files, manual updates, harder to tree-shake
- Option B (recommended modernization): introduce a small build (`Vite/esbuild`) that outputs
  `dist/` and copies `src/manifest.json`, HTML, models, and assets.
  - Pros: manageable dependencies, easier model/version upgrades, cleaner module code
  - Cons: adds build step + repo complexity

## Testing + Benchmarking Plan

- Add a "debug mode" (`local storage` flag) that logs per-image timings and cache hits.
- Manual test matrix:
  - Images: tiny icons, large photos, blurred backgrounds, multiple CSS backgrounds, lazy-loaded
    images, `blob:` images, `data:` images, cross-origin images without CORS headers
  - Pages: infinite scroll, heavy DOM mutation (social feeds), iframes (same-origin + cross-origin)
- Correctness metrics (for ML track):
  - False positive rate on normal photos
  - False negative rate on explicit images
  - "Time to first block" on first page load
  - CPU time per image (median/p95), memory growth over 5-10 minutes
- Performance acceptance targets (example):
  - No main-thread long task > 50ms attributable to filtering on typical pages
  - Cache hit rate > 60% on scroll-back scenarios
  - ML inference under ~50-100ms per image on common hardware (varies by backend)

## Milestone Breakdown (Ticket-Level)

- Milestone 1: Effects + Blur (Heuristic Only)
  - Ticket: Add `effectMode` + `blurAmount` plumbing in background/settings messages.
  - Ticket: Implement `cssBlur` application (class + injected style) for `<img>` and background
    elements.
  - Ticket: Implement `canvasBlurWhole` output path (render + replace).
  - Ticket: Update Eye reveal/restore to work across all effect modes.
  - Acceptance: user can switch between `pixelReplace` and blur without breaking reveal/undo.
- Milestone 2: Performance Overhaul (Still No ML)
  - Ticket: Add `IntersectionObserver` gating for processing.
  - Ticket: Add per-element `lastProcessedKey` to avoid redundant work.
  - Ticket: Implement `computeSkinRatioEstimate` + early exit; only full processing when needed.
  - Ticket: Add bounded in-page queue + idle scheduling (replace "process everything immediately"
    behavior).
  - Acceptance: heavy pages no longer "flash blank" or stall; CPU drops noticeably.
- Milestone 3: Offscreen Detection/Render Service
  - Ticket: Add offscreen doc creation in `background.js` and health checks/recreate logic.
  - Ticket: Define port protocol (`fitna-img-det-port`) with request ids and reconnection behavior.
  - Ticket: Move heavy render (canvas blur) into offscreen (optional at first); content script
    becomes "apply results".
  - Ticket: Implement LRU cache in offscreen + URL normalization.
  - Acceptance: repeated images reuse cached decisions; offscreen survives restarts.
- Milestone 4: ML NSFW Classifier + Hybrid Mode
  - Ticket: Bundle chosen open model(s) locally and load in offscreen.
  - Ticket: Add ML enable toggle + strictness thresholds in settings/UI.
  - Ticket: Implement hybrid decision rules (documented, testable).
  - Ticket: Add "fail-open vs fail-closed" behavior choice (default fail-open for usability).
  - Acceptance: ML blocks obvious NSFW images; false positives are lower than skin-only mode.
- Milestone 5: Localization + Selective Blur
  - Ticket: Add person boxes (`COCO-SSD`) or person mask (`Selfie Segmentation`).
  - Ticket: Add selective blur renderer using boxes/mask; option to restrict skin mask to person
    region.
  - Ticket: Add optional debug overlay (draw boxes/mask) for tuning.
  - Acceptance: selective blur reduces over-blocking of beige/skin-like backgrounds while still
    blocking people.
- Milestone 6: Smart Filters + Polish
  - Ticket: Feathered masks, dilation/erosion options, edge smoothing presets.
  - Ticket: Better handling of complex CSS backgrounds (preserve suffixes; keep the current
    advantage).
  - Ticket: Add model versioning and optional offline update mechanism (only if you want it).
  - Acceptance: effects look clean, minimal artifacts, stable over long browsing sessions.

## Risks / Decisions Needed Early

- Whether to adopt a build system (strongly affects ML integration effort).
- Whether "strong mode" must rewrite image bytes (harder bypass, more bandwidth/memory) or CSS-only
  blur is acceptable.
- Choice of localization approach (boxes vs segmentation) and its licensing/packaging constraints.
- Default UX posture: strict (more blocking) vs balanced (fewer false positives).

If you tell me your preference for (1) build system yes/no and (2) which open NSFW model family
you are leaning toward, this can be turned into a concrete folder/file skeleton plan (exact new
files, exact message shapes, exact settings keys) matching the current code style.

---

## Current-State Audit and Remaining Backlog

> Generated from comprehensive static analysis of the current codebase.
>
> Fixed items were removed on 2026-05-10 so this section tracks remaining work only.

## Critical Bugs

### 1. SSRF via Partially Restricted `fetchAndReadImage`

- **File**: `src/js/background.js:685-719`
- **Current status**: Hardened, but not eliminated. Public pages are blocked from triggering
  private/local fetches, while private/local tabs may still fetch their own private assets for
  filtering fallback.
- **Impact**: This is much safer than before, but it still leaves sensitive fetch behavior in a
  high-trust message path.
- **Remaining work**: Decide whether that private/local fallback is still worth the risk, or
  further narrow it with stricter origin and protocol checks.

## High-Severity Issues

### 2. Per-Pixel Object Allocation in Hot Loop

- **File**: `src/js/content/ImageProcessing.js:155-180`
- **Impact**: ~4M short-lived objects created per 1080p image, causing GC pressure and jank
- **Root Cause**: `rgbToYCbCr()` and `rgbToHsv()` return new objects per pixel
- **Fix**: Inline the math directly in the loop, computing only needed components:

```js
for (let i = 0; i < pixelData.length; i += 4) {
    const r = pixelData[i], g = pixelData[i + 1], b = pixelData[i + 2];

    const cb = 128 + (-0.169 * r) + (-0.331 * g) + (0.5 * b);
    const cr = 128 + (0.5 * r) + (-0.419 * g) + (-0.081 * b);

    if (cb < CB_MIN || cb > CB_MAX || cr < CR_MIN || cr >= CR_MAX) continue;

    // Only compute HSV if YCbCr passes.
    // ... inline HSV computation ...
}
```

### 3. Double Blob URL Revocation

- **File**: `src/js/content/domManipulation.js:672-714, 770-785`
- **Impact**: Intermittently broken or blank images when elements reprocess quickly
- **Root Cause**: Blob URLs are still revoked in image `onload` paths and also in
  `releaseFilteredResources()`. If an element is reprocessed before the original `onload` fires,
  the browser can lose the URL while it is still loading.
- **Fix**: Consolidate revocation ownership in one place and only revoke URLs that are no longer
  the active asset for that element.

### 4. `getSettings` Does 2 Storage Reads Per Call

- **File**: `src/js/background.js:284-333`
- **Impact**: Many repeated sync/local storage reads on page load, especially with multiple frames
- **Root Cause**: Every `getSettings` call rereads storage instead of serving the in-memory mirror
- **Fix**: Return `storedSettings` directly and keep it synchronized with
  `chrome.storage.onChanged`

### 5. Content Scripts Injected on ALL URLs

- **File**: `src/manifest.json:24-39`
- **Impact**: 8 scripts load on every page and every frame, even when filtering is not useful or
  should never run
- **Fix**: Add `exclude_matches` or switch to programmatic injection

## Medium-Severity Issues

### 6. `findElementByUuid` Does Full DOM Search Per Image

- **File**: `src/js/content/domManipulation.js:738-745`
- **Impact**: O(n) per image, O(n^2) total for pages with many images
- **Fix**: Maintain a `Map<uuid, Element>` populated in `addRandomWizUuid()`

### 7. `updateSuspectsRectangles` Forces Layout Reflow Every 3 Seconds

- **File**: `src/js/content/Suspects.js:55-59`, `src/js/content/js.js:424-438`
- **Impact**: Periodic jank on pages with hundreds of filtered elements
- **Fix**: Use `IntersectionObserver` to only track visible elements and update rectangles lazily

### 8. `chrome.storage.sync` Quota Not Checked

- **File**: `src/js/background.js`
- **Impact**: URL list or settings writes can fail silently after quota limits are reached
- **Fix**: Check `chrome.runtime.lastError` after writes, surface an error to the user, and
  consider `chrome.storage.local` for larger data

### 9. Blocklist Reload on Every Single Toggle

- **File**: `src/js/background.js:669-680`
- **Impact**: Toggling a small list still rebuilds the entire blocklist state
- **Fix**: Implement incremental add/remove instead of full rebuild

### 10. `doElement` Relies on `this` Binding

- **File**: `src/js/content/js.js:456-725`
- **Impact**: Fragile pattern; calling without `.call()` silently breaks
- **Fix**: Refactor to take `domElement` as a parameter

### 11. No Strong Validation on URL Exclusion Entries

- **File**: `src/js/background.js:43-62`, `src/js/background.js:466-544`
- **Impact**: The current normalization is better than before, but broad substring entries can
  still create surprising exclusions
- **Fix**: Validate for real domain or URL formats instead of accepting arbitrary 3+ character
  strings

## Low-Severity Issues

### 12. `saveUrlList()` Function Never Called (Dead Code)

- **File**: `src/js/background.js:444-446`

### 13. `addHeadScript()` Function Never Called (Dead Code)

- **File**: `src/js/content/domManipulation.js:68-81`

### 14. `style.type = 'text/css'` Unnecessary in HTML5

- **File**: `src/js/content/domManipulation.js:19-24`

### 15. Duplicate CSS Class Helper Layers

- **File**: `src/js/content/domManipulation.js:93-124`, `src/js/content/domManipulation.js:210-223`
- `addClassToStyle()` / `removeClassFromStyle()` now just proxy to `addCssClass()` /
  `removeCssClass()`

### 16. Loose Equality (`==`) Still Used in Background Settings Logic

- **File**: `src/js/background.js`
- **Fix**: Use `===` consistently unless loose coercion is intentional and documented

### 17. `onMessage` Listener Always Returns `true`

- **File**: `src/js/background.js:447-724`
- **Fix**: Only return `true` for async message paths that actually need the channel kept open

### 18. `DomainFilter.js` Still Lacks `'use strict'`

- **File**: `src/js/content/DomainFilter.js`
- Most content scripts now opt into strict mode, but this file still runs without it

### 19. Unused Blocklist Files Inflate Extension Size

- **Files**: `src/blocklists/everything.txt`, `src/blocklists/basic.txt`, `src/blocklists/adobe.txt`
- These are downloaded but not referenced by the running extension

### 20. Per-Tab State Lost on Service Worker Restart

- **Files**: `src/js/background.js:1-2`
- `excludeForTabList` and `pauseForTabList` are in-memory only
- **Fix**: Consider persisting to `chrome.storage.session`

### 21. Video Filtering Unimplemented

- **File**: `src/js/content/js.js:12-21`, `src/js/content/js.js:638-643`
- `VIDEO` is in `tagList`, but there is still no video-specific handling

### 22. Several Blocklist Categories Lack Specific Quran Verses

- **File**: `src/js/content/DomainFilter.js`
- `smarttv`, `redirect`, `tracking`, `ads`, `piracy`, `torrent`, and `crypto` still fall back to
  default verses

## Backlog Performance Optimizations

### Quick Wins (Immediate Impact, Low Effort)

| # | Optimization | File | Est. Impact |
|---|-------------|------|-------------|
| P1 | Inline pixel math, eliminate per-pixel object creation | ImageProcessing.js | **50-70% faster** image processing |
| P2 | Early-exit YCbCr before computing HSV | ImageProcessing.js | **20-40% fewer** HSV calculations |
| P3 | Return `storedSettings` directly and sync with `onChanged` | background.js | **Eliminates** repeated storage reads |
| P4 | Reduce `tagList` to common background-image tags | js.js | Fewer `querySelectorAll` matches |

### Medium-Term Optimizations

| # | Optimization | File | Est. Impact |
|---|-------------|------|-------------|
| P5 | Use `IntersectionObserver` for rectangle updates | Suspects.js, js.js | Eliminates periodic reflow |
| P6 | Stream blocklist parsing instead of `split('\\n')` | DomainFilter.js | Avoids 500K string array spike |
| P7 | Debounce MutationObserver work with `requestAnimationFrame` | js.js | Fewer redundant `doElements` calls |
| P8 | Revisit `attributeFilter` scope for lower mutation noise | js.js | Reduces observer churn |

### Long-Term Optimizations

| # | Optimization | Description | Est. Impact |
|---|-------------|-------------|-------------|
| P9 | Migrate to `declarativeNetRequest` API | Replace in-memory blocklist logic with Chrome's native rule engine | **~100MB** memory savings |
| P10 | WebAssembly pixel processing | Compile skin detection to WASM | **2-10x** faster processing |
| P11 | `OffscreenCanvas` for processing | Move canvas work off main thread | Eliminates UI jank |
| P12 | Programmatic content script injection | Only inject when filtering is active for the tab | Eliminates avoidable overhead |
| P13 | Pre-computed lookup table for skin classification | Replace repeated math with lookups | O(1) per pixel |

## Backlog Architecture Improvements

### Module System

The codebase still relies on manifest injection order and shared globals across content scripts. This
causes:

- Tight coupling between modules
- Load-order dependencies
- No tree-shaking or bundling boundary
- Shared mutable state that is harder to reason about

**Recommendation**: Use a bundler (`esbuild`, `Rollup`, or `Vite`) to emit a single content-script
bundle from ES modules.

### State Management

Some settings changes are pushed at runtime, but the extension still depends heavily on a global
`settings` object and repeated `getSettings()` round-trips.

**Recommendation**: Move more runtime state onto storage-backed listeners or a clearer in-page state
store so fewer behaviors depend on full re-fetches.

### Testing Infrastructure

There are zero automated tests. The pixel processing algorithm, URL matching, and blocklist parsing
are all pure functions that are highly testable.

**Recommendation**: Add unit tests for:

1. `rgbToYCbCr()` and `rgbToHsv()` (known test vectors)
2. `isSkinPixel()` (boundary conditions)
3. `findMatchingBlockedDomain()` (subdomain walking)
4. `processBlocklist()` (format parsing)
5. URL exclusion matching logic
6. `getSettings()` computation (auto-unpause, exclusion layers)

## UX & Accessibility

| Issue | Fix |
|-------|-----|
| Page goes blank (`opacity: 0`) during processing | Hide individual images only, or use progressive rendering |
| No feedback when storage quota is exceeded | Show a toast, inline warning, or notification |
| No confirmation before clearing all exclusions | Add a confirmation dialog |

## Dead Code & Cleanup

| Item | File | Action |
|------|------|--------|
| `saveUrlList()` | background.js | Remove |
| `addHeadScript()` | domManipulation.js | Remove |
| `addClassToStyle()` / `removeClassFromStyle()` | domManipulation.js | Collapse into one helper layer |
| `style.type = 'text/css'` | domManipulation.js | Remove |
| `everything.txt` / `basic.txt` / `adobe.txt` | blocklists/ | Remove from extension package |
| Video filtering TODO | js.js | Remove `VIDEO` from `tagList` or implement handling |

## Priority Implementation Roadmap

### Phase 1: High-Risk Runtime Work

*Estimated effort: 3-4 hours*

1. Finish hardening `fetchAndReadImage()` private-network behavior.
2. Resolve the remaining blob URL revocation race in `domManipulation.js`.
3. Inline pixel processing math and add cheap early exits in `ImageProcessing.js`.
4. Stop rereading storage in every `getSettings()` call.

### Phase 2: Performance and Scalability

*Estimated effort: 3-4 hours*

1. Replace UUID-based full DOM lookups with a direct element map.
2. Replace periodic rectangle refreshes with `IntersectionObserver` or lazy updates.
3. Avoid rebuilding all blocklists when a single toggle changes.
4. Narrow content-script injection scope in `manifest.json`.
5. Add quota-aware error handling for `chrome.storage.sync` writes.

### Phase 3: Code Quality and Cleanup

*Estimated effort: 2-3 hours*

1. Tighten validation for URL exclusion entries.
2. Persist per-tab pause and exclusion state with `chrome.storage.session`.
3. Remove dead code and duplicate helper layers.
4. Finish strict-mode cleanup in remaining content files.
5. Decide whether to remove `VIDEO` from `tagList` or implement video filtering.

### Phase 4: Major Upgrades

*Estimated effort: 1-2 weeks*

1. Migrate blocklist enforcement to `declarativeNetRequest`.
2. Add a bundler with ES module boundaries.
3. Add a unit test suite.
4. Explore WebAssembly for hot pixel processing.
5. Explore `OffscreenCanvas` for non-blocking rendering.
