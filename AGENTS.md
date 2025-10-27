# Agent Guidelines

This repository contains **FitnaFilter**, a Chrome extension (Manifest V3) that provides content filtering through advanced skin tone detection and comprehensive website blocking using curated blocklists.

## Architecture Overview

### Core Components
- **Background Service Worker** (`src/js/background.js`): Central hub for settings, blocklist processing, and website blocking via webNavigation API
- **Content Scripts** (`src/js/content/`): Modular image processing pipeline with DOM manipulation
- **UI Components**: Popup for quick controls, Options page for comprehensive settings

### Image Processing Pipeline
- **Algorithm**: Multi-color space approach (YCbCr + HSV) for skin detection
- **Processing**: Canvas-based pixel analysis with configurable filter colors
- **Cross-Origin**: Background service worker handles CORS restrictions
- **Performance**: Lazy processing, MutationObserver for dynamic content

### Blocklist System
Categories: **Vice** (always enabled), **Hazard** (configurable), **Distraction** (configurable)
- Source: The Block List Project (community-maintained)
- Processing: Chunked loading for performance
- Storage: chrome.storage.sync for persistence

## Development Standards

- Use **4 spaces** for indentation in both JavaScript and Python files
- Keep line length under **120 characters**
- Use `camelCase` for JavaScript variables and function names
- Add short comments for new functions or complex logic
- When working with blocklists, run `python download_blocklists.py` to fetch latest versions

## Key Technical Patterns

### Storage Strategy
- **chrome.storage.sync**: User preferences, settings, blocklist configurations
- **chrome.storage.local**: Temporary states (pause status, timestamps)
- **Runtime messaging**: Communication between background and content scripts

### Content Script Architecture
- **Main Controller** (`js.js`): Orchestrates all modules and manages global state
- **Suspects** (`Suspects.js`): Tracks filtered elements and their states
- **Eye** (`Eye.js`): Hover icon system for revealing original images
- **ImageProcessing** (`ImageProcessing.js`): Core filtering algorithms

### Cross-Origin Image Handling
1. Content script requests image via `chrome.runtime.sendMessage`
2. Background worker fetches image and returns base64 data
3. Content script creates blob URL for Canvas processing

## Repository Layout

- `src/` contains extension code:
  - `js/` for content scripts, service worker, popup and options
  - `css/` and `images/` for styling and UI assets
  - `blocklists/` for domain lists (one domain per line)
  - `manifest.json` for extension configuration (V3)
- `download_blocklists.py` retrieves latest blocklist files from remote sources

## Development Workflow

```bash
# Update blocklists
python download_blocklists.py

# Load extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode  
# 3. Click "Load unpacked" and select src/ directory
```

## Testing

No automated tests provided. Manual verification required:
1. Load extension as unpacked in Chrome
2. Test basic image filtering on various websites
3. Verify blocklist functionality with known blocked domains
4. Check popup and options page functionality
5. Test cross-origin image handling
6. Verify user controls (Alt+P pause, Alt+Z reveal, etc.)

## Recent Agent Notes (2025-10-28)

- Background `getSettings` now reads fresh sync/local storage on every call, so consumers immediately see toggled values; retain the mirror in `storedSettings`.
- Popup initialization no longer fires redundant `setFilterColor` messages; only actual colour changes trigger a reprocess.
- Content script revokes blob URLs once filtered assets finish loading to prevent session-long memory growth.
- DOM/style bootstrapping, hover polling, rectangle refresh, and iframe readiness all reference the constants declared at the top of `src/js/content/js.js` (`STYLE_POLL_INTERVAL_MS`, `HOVER_POLL_INTERVAL_MS`, `RECT_UPDATE_INTERVAL_MS`, `RECT_TIMEOUT_BASE_MS`, `RECT_TIMEOUT_REPEAT_COUNT`, `IFRAME_POLL_INTERVAL_MS`, `IFRAME_POLL_MAX_ATTEMPTS`, `PATTERN_VARIATIONS`). Adjust those values instead of sprinkling new literals.
- Style injection now uses a 32 ms poll; if you pursue an event-driven approach, remove the corresponding `setInterval` and clear logic.

## AI Agent Development Patterns

### Common Development Tasks
1. **Adding New Blocklist Categories**:
   - Add new `.txt` file to `src/blocklists/`
   - Update category definitions in `src/js/background.js`
   - Add UI controls in `src/js/options.js`
   - Test with `python download_blocklists.py`

2. **Modifying Image Processing**:
   - Core algorithm in `src/js/content/ImageProcessing.js`
   - Color space conversions and threshold adjustments
   - Test with various image types and cross-origin scenarios
   - Update constants in `src/js/content/constants.js`

3. **Adding User Interface Features**:
   - Popup controls: `src/js/popup.js` + `src/popup.htm`
   - Options page: `src/js/options.js` + `src/options.htm`
   - Styling: `src/css/popup.css` or `src/css/options.css`

4. **Implementing New Exclusion Logic**:
   - Background processing: `src/js/background.js`
   - Content script integration: `src/js/content/js.js`
   - Storage management via chrome.storage APIs

### Debugging and Troubleshooting
- **Content Scripts**: Use browser DevTools Console on target pages
- **Background Worker**: Debug via chrome://extensions/ > service worker
- **Storage Issues**: Monitor chrome.storage in DevTools Application tab
- **CORS Problems**: Check background worker's image fetching logic
- **Performance**: Profile Canvas operations and MutationObserver events

### Extension API Patterns
- **Message Passing**: Always use `chrome.runtime.sendMessage` for cross-context communication
- **Storage Persistence**: Use `chrome.storage.sync` for user settings, `chrome.storage.local` for temporary state
- **Tab Management**: Leverage `chrome.tabs` API for per-tab exclusions
- **Web Navigation**: Use `chrome.webNavigation.onBeforeNavigate` for domain blocking

## Performance Considerations

- Only process images above size thresholds (configurable)
- Use efficient color space conversions for skin detection
- Implement chunked processing for large blocklists
- Cache processed elements to avoid reprocessing
- Use MutationObserver for dynamic content detection
- Optimize Canvas operations for large images
- Minimize DOM manipulation during processing

## Detailed Implementation Notes

### Service Worker (`src/js/background.js`)
- Maintains an in-memory `storedSettings` mirror of values saved in `chrome.storage.sync` and `chrome.storage.local`.
- Responds to runtime messages for exclusion management, pause toggles, filter color updates, and per-tab controls.
- Loads blocklists by importing `content/DomainFilter.js`, calling `fetchAndProcessBlocklist`, and keeping a `Set` (`blockedDomains`) plus a `Map` (`domainToBlocklistMap`) so blocked domains resolve back to their source lists.
- Intercepts primary-frame navigations through `chrome.webNavigation.onBeforeNavigate`; when the hostname matches a blocked domain the tab is redirected to a contextual Quran verse chosen by `getContextualRedirectUrl`.
- Handles cross-origin image fetching by responding to `fetchAndReadImage` messages, retrieving binary data with `fetch`, converting to a data URL, and returning it to the content script.

### Blocklist Utilities (`src/js/content/DomainFilter.js`)
- Declares `BLOCKLISTS`, grouping lists into `vice`, `hazard`, and `distraction` categories with metadata used by the Options UI.
- Provides `processBlocklist` to scan local `.txt` files (supports `0.0.0.0 domain` rows and simple domain rows), chunking work to avoid long blocking loops when loading the large Porn list (~500k entries).
- Supplies Quran verse mappings for contextual redirects and exposes `getContextualRedirectUrl`.

### Content Script Runtime (`src/js/content/js.js` et al.)
- Entry point `ProcessWin` orchestrates image discovery, mutation observation, and hover-eye behaviour for each frame.
- A hidden canvas tagged `CANVAS_GLOBAL_ID` lives in the page to transform pixels. `processDomImage` and `processBackgroundImage` fetch image data (via the background worker when needed), then call `applyImageFilters`.
- `ImageProcessing.js` carries the HSV + YCbCr detection pipeline (`filterSkinColor`). Skin pixels are recoloured using the current `settings.filterColor` (white / black / grey) before generating an object URL through `canvasBlobify`.
- `Suspects.js` tracks nodes currently under management; `MouseController.js` and `Eye.js` coordinate hover hints and Alt+Z / Alt+A shortcuts for toggling visibility.
- `ImagesDisplayer.js` centralises "show all" behaviour so the background can unhide everything when the user pauses filtering.
- Lazy-loaded `<img>` elements and CSS backgrounds are reprocessed when their sources update, aided by mutation observers and cached bounding rectangles.

### UI Surfaces
- **Popup (`src/popup.htm`, `src/js/popup.js`)** exposes quick actions: toggling pause/exclusions, reloading, grabbing the current URL, and switching filter colours. Filter colour changes notify both storage (via the service worker) and active tabs (`updateFilterColor`).
- **Options (`src/options.htm`, `src/js/options.js`)** presents two columns: image filtering settings (eye icon, facial features removal, max safe size, pause timeout, exclusion list with optional free-text editing) and blocklist toggles split by category. Vice lists render as checked + disabled, while hazard/distraction lists stay user-toggleable.
- Styling resides in `src/css/popup.css` and `src/css/options.css`; assets are served through `web_accessible_resources`.

### Storage Layout
- `chrome.storage.sync` keys: `urlList` (JSON string array), `isNoEye`, `isNoFaceFeatures`, `maxSafe`, `autoUnpause`, `autoUnpauseTimeout`, `blocklistSettings` (JSON map of enabled flags), `filterColor`.
- `chrome.storage.local` keys: `isPaused`, `pausedTime`; these drive temporary pause state and auto-unpause timing.

### Messaging Overview
- `getSettings`: requested by content scripts and popup; returns pause/exclusion flags plus display settings.
- `urlListAdd` / `urlListRemove` / `setUrlList` / `getUrlList`: maintain the exclusion list.
- `excludeForTab`, `pause`, `pauseForTab`: manage per-tab overrides stored in background-only arrays.
- `setNoEye`, `setNoFaceFeatures`, `setAutoUnpause`, `setAutoUnpauseTimeout`, `setMaxSafe`, `setFilterColor`: persist user preferences.
- `getBlocklists`, `toggleBlocklist`: sync Options UI toggles with `BLOCKLISTS`.
- `showImages`, `updateFilterColor`, `fetchAndReadImage`: coordinate runtime behaviour between popup, content scripts, and service worker.

### Utilities and Assets
- `download_blocklists.py` refreshes the local copies of Block List Project text files. Run before packaging to capture the latest domains.
- Design assets (`eye.png`, `undo.png`, various pattern sprites) live under `src/images/`.
- Example filtered output and GIMP source files (`eye.xcf`, `filter.xcf`) are stored at the repo root for reference.

## Known Limitations Observed

- Style bootstrapping still relies on polling (`STYLE_POLL_INTERVAL_MS`), so we keep checking until `document.head` exists. Investigate event-driven hooks if you need further CPU savings.
- Iframe readiness waits on a polling loop (`IFRAME_POLL_INTERVAL_MS`, `IFRAME_POLL_MAX_ATTEMPTS`); very slow embeds may still slip past the 5 s budget.
- The hover-eye “undo” affordance is still unimplemented (`src/js/content/Eye.js`), and related UI copy references a non-existent button.
- `Suspects` now has `pruneDisconnected()` to clean up disconnected elements (`Suspects.js:7-17`), but still uses O(n) `indexOf` for duplicate detection (`Suspects.js:39`).


### High Priority Issues (Open)
1. **Canvas Error Handling** (`ImageProcessing.js:114-173`)
   - No try-catch for tainted canvas or CORS errors in canvas operations
   - Uncaught exceptions possible when calling `getContext()`, `drawImage()`, `getImageData()`, or `putImageData()`
   - **Fix**: Wrap canvas operations in try-catch with fallback
   - **Status**: Still open as of 2025-10-28

### Medium Priority Optimizations (Still Open)
1. **Settings Tight Coupling** (`ImageProcessing.js:95`)
   - `isSkinPixel` depends on global `settings` variable
   - Reduces reusability and testability
   - **Fix**: Pass `settings.isNoFaceFeatures` as parameter

2. **Linear Search in Suspects** (`Suspects.js:39`)
   - O(n) lookup using `indexOf` in addSuspect function
   - Performance degradation with many images
   - **Fix**: Use WeakSet or Set for O(1) duplicate detection
   - Note: `pruneDisconnected()` added but doesn't address the O(n) search

3. **Opacity Flash** (`js.js:182`)
   - Sets `body` opacity to 0 during initial processing
   - Creates Flash of Invisible Content (FOIC)
   - **Fix**: Consider progressive rendering or skeleton loading


### Code Quality Weaknesses
- ❌ No automated tests (unit, integration, or E2E)
- ⚠️ Polling loops still drive style injection and iframe readiness; the cadence now lives in `STYLE_POLL_INTERVAL_MS` and `IFRAME_POLL_INTERVAL_MS` but could move to event-driven triggers.
- ⚠️ Incomplete undo feature (commented out in Eye.js:85-94)
- ⚠️ Memory leak potential: Suspects list has `pruneDisconnected()` to remove disconnected elements, but still uses O(n) linear search (see Medium Priority Optimization #2)

### Performance Insights
**Image Processing**:
- For 1920×1080 image: ~8.3M array accesses, ~4.1M color space conversions
- Canvas context uses `willReadFrequently: true` optimization
- Opportunity: Lookup tables or SIMD for pixel processing

**Memory Footprint**:
- Blocklists: ~10 MB for 500K domains in Set
- Per filtered image: ~350 bytes + blob data
- No cleanup when elements removed from DOM → potential memory leak in SPAs

**DOM Operations**:
- MutationObserver properly configured for dynamic content
- Rectangle caching reduces getBoundingClientRect() calls
- Event delegation used correctly for delete buttons


### Testing Recommendations
1. Add unit tests for color space conversions (RGB→YCbCr, RGB→HSV)
2. Add unit tests for skin pixel detection algorithm
3. Add integration tests for blocklist processing
4. Add E2E tests for image filtering workflow
5. Add performance benchmarks for pixel processing

### Future Enhancement Ideas
1. **Progressive Rendering**: Replace opacity:0 with skeleton screens
2. **Performance Monitoring**: Add Performance API measurements for slow ops
3. **WebAssembly**: Compile pixel processing to WASM for 2-10× speedup
4. **Settings Export/Import**: Allow backup/restore of configurations
5. **Whitelist Mode**: Inverse blocklist for parental control
