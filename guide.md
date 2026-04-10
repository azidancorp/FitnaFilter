# FitnaFilter: Complete Technical Guide

> **Version**: 1.2.1 | **Platform**: Chrome Extension (Manifest V3)
> **Purpose**: A content-filtering browser extension that detects and masks skin-toned pixels in images, and blocks harmful/distracting websites by redirecting to Quran verses.

---

## Table of Contents

1. [What FitnaFilter Does](#1-what-fitnafilter-does)
2. [Architecture Overview](#2-architecture-overview)
3. [Installation & Development Setup](#3-installation--development-setup)
4. [File-by-File Deep Dive](#4-file-by-file-deep-dive)
5. [The Image Filtering Pipeline](#5-the-image-filtering-pipeline)
6. [The Website Blocking System](#6-the-website-blocking-system)
7. [Storage & State Management](#7-storage--state-management)
8. [Message Passing Protocol](#8-message-passing-protocol)
9. [User Controls & Keyboard Shortcuts](#9-user-controls--keyboard-shortcuts)
10. [The Exclusion System](#10-the-exclusion-system)
11. [The Eye (Hover Reveal) System](#11-the-eye-hover-reveal-system)
12. [Cross-Origin Image Handling](#12-cross-origin-image-handling)
13. [Content Script Lifecycle](#13-content-script-lifecycle)
14. [Popup UI](#14-popup-ui)
15. [Options Page](#15-options-page)
16. [Blocklist Management](#16-blocklist-management)
17. [Constants & Configuration](#17-constants--configuration)
18. [CSS & Theming](#18-css--theming)
19. [How to Modify & Extend](#19-how-to-modify--extend)
20. [Testing Methodology](#20-testing-methodology)
21. [Glossary](#21-glossary)

---

## 1. What FitnaFilter Does

FitnaFilter has **two independent protection systems**:

### Image Filtering (Content Scripts)
Every webpage you visit gets its images analyzed pixel-by-pixel. The extension:
1. Finds all `<img>` elements and CSS `background-image` properties
2. Draws each image onto a hidden `<canvas>`
3. Converts every pixel from RGB to both **YCbCr** and **HSV** color spaces
4. Checks if the pixel falls within human skin tone ranges
5. Replaces skin pixels with a solid color (white, black, or grey)
6. Swaps the original image source with the filtered version

### Website Blocking (Background Service Worker)
The extension maintains blocklists of harmful domains organized into three categories:
- **Vice** (always on): porn, drugs, gambling, abuse, vaping
- **Hazard** (toggleable): malware, phishing, fraud, scam, crypto, ransomware, redirect, tracking
- **Distraction** (toggleable): YouTube, TikTok, Facebook, Twitter, ads, torrents, piracy, Fortnite, WhatsApp, Smart TV

When you navigate to a blocked domain, the tab is redirected to a **contextually relevant Quran verse** on quran.com. For example, gambling sites redirect to Surah Al-Ma'idah 5:90 ("O you who believe! Intoxicants and gambling...").

---

## 2. Architecture Overview

```
+-----------------------------------------------------------+
|                     Chrome Browser                          |
+-----------------------------------------------------------+
|                                                             |
|  +------------------+    +----------------------------+     |
|  | Background       |    | Content Scripts            |     |
|  | Service Worker   |    | (injected into every page) |     |
|  | (background.js)  |    |                            |     |
|  |                  |    | constants.js               |     |
|  | - Settings mgmt  |<-->| ImageProcessing.js         |     |
|  | - URL list ops   |    | domManipulation.js         |     |
|  | - Blocklist load |    | MouseController.js         |     |
|  | - CORS proxy     |    | Suspects.js                |     |
|  | - Nav intercept  |    | Eye.js                     |     |
|  +------------------+    | ImagesDisplayer.js         |     |
|          ^               | js.js (main controller)    |     |
|          |               +----------------------------+     |
|          v                                                  |
|  +------------------+    +----------------------------+     |
|  | Popup            |    | Options Page               |     |
|  | (popup.js)       |    | (options.js)               |     |
|  | - Quick controls |    | - Full settings            |     |
|  | - Filter color   |    | - Blocklist toggles        |     |
|  | - Pause/exclude  |    | - Exclusion list editor    |     |
|  +------------------+    +----------------------------+     |
|                                                             |
|  +------------------------------------------------------+  |
|  | Shared: DomainFilter.js (blocklist data & utilities)  |  |
|  +------------------------------------------------------+  |
+-----------------------------------------------------------+
```

### Execution Contexts

| Context | File(s) | Lifecycle | Access |
|---------|---------|-----------|--------|
| **Background Service Worker** | `background.js`, imports `DomainFilter.js` | Event-driven MV3 worker (can be suspended between events) | Full Chrome APIs, no DOM |
| **Content Scripts** | All files in `content/` | Per-page, injected at `document_start` | Page DOM, limited Chrome APIs |
| **Popup** | `popup.js` + `popup.html` | Opens/closes with popup click | Own DOM, Chrome APIs via messages |
| **Options Page** | `options.js` + `options.html` | Opens as regular tab | Own DOM, Chrome APIs via messages |

---

## 3. Installation & Development Setup

### Loading as Unpacked Extension
1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `src/` directory (NOT the repo root)
5. The extension icon appears in the toolbar

### Updating Blocklists
```bash
python download_blocklists.py
```
This fetches the latest domain lists from [The Block List Project](https://blocklistproject.github.io/Lists/). Each list is a `.txt` file with one domain per line (sometimes prefixed with `0.0.0.0`).

### Project Structure
```
FitnaFilter/
├── src/                          # Extension root (load this in Chrome)
│   ├── manifest.json             # Extension configuration (MV3)
│   ├── popup.html                # Popup UI
│   ├── options.html              # Options page UI
│   ├── js/
│   │   ├── background.js         # Service worker (563 lines)
│   │   ├── popup.js              # Popup logic (281 lines)
│   │   ├── options.js            # Options logic (393 lines)
│   │   └── content/              # Content scripts (injected into pages)
│   │       ├── constants.js      # Shared constants (94 lines)
│   │       ├── ImageProcessing.js # Skin detection algorithm (246 lines)
│   │       ├── domManipulation.js # DOM helpers & image processing (677 lines)
│   │       ├── js.js             # Main controller (933 lines)
│   │       ├── Suspects.js       # Tracked elements list (101 lines)
│   │       ├── Eye.js            # Hover reveal icon (153 lines)
│   │       ├── MouseController.js # Mouse state tracking (153 lines)
│   │       ├── ImagesDisplayer.js # Show-all toggle (99 lines)
│   │       └── DomainFilter.js   # Blocklist data & processing (322 lines)
│   ├── css/
│   │   ├── popup.css             # Popup glassmorphism theme
│   │   └── options.css           # Options glassmorphism theme
│   ├── images/                   # Icons and UI assets
│   │   ├── icon.png, icon16/48/128/512.png
│   │   ├── icon-d.png            # Disabled/inactive icon
│   │   ├── eye.png               # Hover reveal icon
│   │   └── undo.png              # Re-filter icon
│   └── blocklists/               # Domain block lists (~3.8M lines total)
│       ├── porn.txt              # Largest: ~500K domains
│       ├── ads.txt, abuse.txt, etc.
│       └── ... (26 .txt files; 23 used at runtime)
├── download_blocklists.py        # Blocklist updater script
├── CLAUDE.md / AGENTS.md         # AI agent instructions
├── eye.xcf, filter.xcf           # GIMP source files for icons
└── README.md
```

---

## 4. File-by-File Deep Dive

### `src/manifest.json`
The extension manifest declares:
- **Manifest V3** format (Chrome's current extension standard)
- **Service worker**: `js/background.js` (not a persistent background page)
- **Content scripts**: All 8 files in `js/content/` injected into `<all_urls>` at `document_start` in `all_frames`
- **Permissions**: `activeTab`, `storage`, `webNavigation`
- **Host permissions**: `<all_urls>` (needed for cross-origin image fetching)
- **Web-accessible resources**: `eye.png`, `undo.png`, and all blocklist `.txt` files

### `src/js/background.js` (563 lines)
The central hub. Key responsibilities:

**Settings Management (lines 1-71)**:
- `DEFAULT_SETTINGS` object defines all defaults
- `getSettings()` reads fresh values from `chrome.storage.sync` (user prefs) and `chrome.storage.local` (temporary state like pause)
- Uses `== 1` comparison because Chrome storage stores booleans as `1`/`0`
- `storedSettings` is an in-memory mirror updated on every `getSettings()` call

**Tab State Management (lines 87-99)**:
- `excludeForTabList` and `pauseForTabList` are in-memory arrays (NOT persisted to storage)
- `pruneTabState()` cleans up when tabs close or get replaced
- Per-tab exclusions are lost on service worker restart

**URL Helpers (lines 101-180)**:
- `getDomain(url)` extracts domain via regex
- `getHostname(url)` handles edge cases like IPv6 brackets, view-source: prefix
- `isLocalhostHostname()` checks for `localhost`, `127.0.0.1`, `::1`, `.localhost`
- `isLocalFileUrl()` checks for `file:` and `filesystem:` protocols

**Message Handler (lines 185-488)**:
The massive `chrome.runtime.onMessage` switch handles ALL inter-context communication. Every case returns `true` to keep the message channel open for async responses. Key messages:
- `getSettings` - Returns computed settings including exclusion state for the requesting tab
- `urlListAdd/Remove/Set/Get` - CRUD operations on the exclusion URL list
- `excludeForTab` - Per-tab domain exclusion toggle
- `pause/pauseForTab` - Global and per-tab pause
- `set*` messages - Persist individual settings
- `getBlocklists/toggleBlocklist` - Blocklist configuration
- `fetchAndReadImage` - CORS proxy (fetches image as blob, converts to data URL, returns to content script)

**Navigation Interception (lines 508-563)**:
- Listens to `chrome.webNavigation.onBeforeNavigate`
- Only intercepts main frame (`frameId === 0`)
- `findMatchingBlockedDomain()` walks hostname labels (e.g., checks `sub.example.com`, then `example.com`, then `com`)
- Redirects blocked tabs using `chrome.tabs.update`

### `src/js/content/constants.js` (94 lines)
Defines all string constants used as DOM attributes and JS object properties:
- `CANVAS_GLOBAL_ID` = `'skf-canvas-global'` - The hidden canvas used for pixel processing
- `ATTR_UUID` = `'skf-uuid'` - Custom attribute set on processed elements
- `ATTR_RECTANGLE` = `'skf-rectangle'` - Cached bounding rect stored as JS property
- `IS_PROCESSED`, `IS_HIDDEN`, `IS_TOGGLED`, `IS_REVEALED` - State flags
- `HAS_HOVER`, `HAS_HOVER_VISUAL`, `HAS_MOUSE_LISTENERS` etc. - Event state flags
- `CSS_CLASS_HIDE` = `'skf-hide'` - CSS class for `opacity: 0 !important`

These constants prevent typo bugs and make the state machine explicit.

### `src/js/content/ImageProcessing.js` (246 lines)
The core skin detection algorithm.

**Color Space Thresholds (lines 8-11)**:
```
YCbCr: Cb in [85, 128], Cr in [142, 180)
HSV:   Hue in [0, 32], Saturation >= 15%
RGB:   R > 95, G > 40, B > 20 (unless isNoFaceFeatures is on)
```

**`rgbToYCbCr(r, g, b)`** (lines 20-26):
Standard ITU-R BT.601 conversion. Returns `{y, cb, cr}`.

**`rgbToHsv(r, g, b)`** (lines 36-77):
Manual HSV conversion (not using built-in). Returns degrees/percentages.

**`isSkinPixel(r, g, b, hue, saturation, cb, cr)`** (lines 90-96):
The decision function. ALL conditions must be true:
1. Hue between 0-32 degrees (warm tones)
2. Saturation >= 15% (not grey)
3. Cb between 85-128 (blue chrominance range)
4. Cr between 142-180 (red chrominance range)
5. Unless `isNoFaceFeatures` is on: R>95, G>40, B>20

The `isNoFaceFeatures` flag removes the RGB constraint, catching more pixels (eyes, lips, etc. that might be darker).

**`filterSkinColor(imgElement, uuid, canvas)`** (lines 114-200):
1. Draws the image onto the canvas
2. Gets pixel data via `getImageData()`
3. Iterates every pixel (4 values per pixel: RGBA)
4. For each skin pixel, replaces RGB with the filter color
5. Puts modified data back, converts canvas to blob URL via `canvasBlobify()`
6. On error, falls back to the original image source and resets canvas dimensions

**`canvasBlobify(canvas)`** (lines 208-223):
Converts canvas to PNG blob, then to an object URL via `URL.createObjectURL()`.

**`applyImageFilters(imgElement, uuid, canvas)`** (lines 242-246):
Passthrough wrapper intended for future multi-step processing pipelines.

### `src/js/content/domManipulation.js` (677 lines)
The largest content script. Utility functions for DOM manipulation and image processing orchestration.

**Style Management (lines 17-43)**:
- `addHeadStyle()` / `removeHeadStyle()` - Inject/remove `<style>` elements into page head
- Used to hide the page body (`opacity: 0`) during initial processing

**CSS Class Management (lines 91-218)**:
Multiple helper functions for adding/removing classes. Note: Uses string concatenation (`className += ' ' + name`) rather than `classList` API - this is legacy code.

**`handleListeners()`** (lines 143-155):
Generic add/remove event listener handler with a flag to prevent duplicate registration.

**`hideElement()` / `showElement()`** (lines 248-250):
Toggle `CSS_CLASS_HIDE` class which sets `opacity: 0 !important`.

**`handleSourceOfImage()`** (lines 273-293):
The src/srcset swap mechanism:
- **Toggle ON**: Saves original `src` and `srcset` to `oldsrc`/`oldsrcset`, clears `srcset`
- **Toggle OFF**: Restores originals, revokes blob URLs

**Image Processing Functions**:

`processDomImage(domElement, canvas)` (lines 375-397):
1. If not yet handled, calls `handleSourceOfImage` to save originals
2. Tries direct canvas filtering via `filterImageElement()`
3. On CORS/canvas failure (or JWT-protected images), falls back to `fetchAndReadImage()` which proxies through the background service worker

`processBackgroundImage(domElement, url, suffix, canvas)` (lines 420-428):
For CSS `background-image` elements. Always uses the background proxy since CSS background URLs are commonly cross-origin.

`fetchAndReadImage(url)` (lines 442-461):
Sends a message to the background service worker to fetch the image. The background worker returns a data URL, which is loaded into an `Image` object.

`filterImageElement(imgElement, uuid, canvas)` (lines 542-581):
After filtering, finds the DOM element by UUID and swaps its `src` to the filtered blob URL. On load, it unhides the element and marks it processed.

`filterImageElementAsBackground(imgElement, uuid, canvas, suffix)` (lines 479-525):
Same but for background images. Sets `style.backgroundImage` to the filtered blob URL, preserving any gradient suffix.

`guid()` (lines 650-658):
Generates pseudo-random UUIDs using `Math.random()`. Not cryptographically secure but sufficient for element identification.

### `src/js/content/js.js` (933 lines)
The main controller that orchestrates everything.

**Global State (lines 1-36)**:
- `extensionUrl` - Base URL of the extension
- `blankImg` - 1x1 transparent GIF data URL
- `tagList` - 26 HTML tags that can hold images (IMG, DIV, SPAN, A, VIDEO, etc.)
- `settings` - Received from background on startup
- Timing constants: `STYLE_POLL_INTERVAL_MS` (32ms), `HOVER_POLL_INTERVAL_MS` (250ms), etc.

**Startup Sequence (lines 70-93)**:
1. `DOMContentLoaded` listener creates the hidden canvas and sets `contentLoaded = true`
2. Immediately sends `getSettings` to background
3. If active (not paused/excluded), calls `ProcessWin(window, contentLoaded)`
4. Sets the extension icon to active/inactive

**`ProcessWin(win, winContentLoaded)`** (lines 124-933):
The core factory function. Creates a new processing instance per window/iframe.

Internal components:
- `mSuspects` - `Suspects()` instance tracking filtered elements
- `mEye` - `Eye()` instance for hover reveal
- `mMouseController` - `MouseController()` instance
- `mObserver` - `MutationObserver` instance
- `mHeadStyles` - Map of injected styles

**`setEverythingUp()`** (lines 146-231):
1. If DOM is ready, calls `start()`. Otherwise registers `DOMContentLoaded` listener
2. Starts a polling loop (`STYLE_POLL_INTERVAL_MS = 32ms`) to inject CSS as soon as `document.head` exists
3. Injects `opacity: 0` on body to prevent image flash before processing
4. Sets up keyboard shortcuts and scroll listener
5. Creates `skfShowImages()` function on the window for cross-frame show-all

**`start()`** (lines 271-391):
1. Guards against bodyless iframes
2. Skips processing if the page is just a single image (user wants to see it)
3. Calls `doElements(body, false)` to process all existing elements
4. Removes the `opacity: 0` style (page becomes visible)
5. Attaches Eye to `document.body`
6. Creates `MutationObserver` watching for:
   - `class` attribute changes (lazy loading detection)
   - `style` attribute changes (background-image updates)
   - `childList` additions (new elements)
7. Starts mouse position check interval (250ms)
8. Starts rectangle update interval (3000ms)
9. Processes existing iframes

**`doElement()`** (lines 456-642):
Called with `this` = the DOM element. Two branches:

*For `<IMG>` tags*:
1. Adds UUID and `wiz-to-process` class
2. Adds to suspects list
3. Handles blob URLs specially (no load event)
4. Attaches load event listeners for reprocessing
5. If complete: checks dimensions vs `maxSafe` threshold
6. Large images get hidden, source swapped, and processed
7. Small images below threshold are simply hidden (not filtered)
8. `<picture><source>` children are handled too

*For other tags (backgrounds)*:
1. Checks `getComputedStyle` for `background-image`
2. Extracts URL from CSS `url()` value
3. Preserves gradient suffixes
4. Processes via `processBackgroundImage()`

**`checkMousePosition()`** (lines 646-697):
Called every 250ms. Finds which suspect element is under the mouse cursor and toggles hover visual (eye icon).

**`showElement()`** (lines 703-732):
Reveals the original unfiltered image. Unhides, restores src/srcset, marks as `IS_REVEALED`.

**`filterElement()`** (lines 739-768):
Re-applies filter to a revealed element. Resets state flags and triggers reprocessing.

**`cleanup()`** (lines 886-930):
Tears down all intervals, observers, listeners, and styles. Called before reprocessing or on show-all.

### `src/js/content/Suspects.js` (101 lines)
Tracks all DOM elements that have been processed or are being processed.

- `mList` - Plain array of DOM element references
- `pruneDisconnected()` - Removes elements no longer in the DOM (calls `releaseFilteredResources` to free blob URLs)
- `addSuspect()` - Prunes, checks connectivity, deduplicates via `indexOf()` (O(n) - known issue), caches bounding rect
- `updateSuspectsRectangles()` - Refreshes all cached bounding rects
- `findSuspectsUnderMouse()` - Returns elements whose cached rect contains the mouse position, preferring smaller/background elements

### `src/js/content/Eye.js` (153 lines)
The hover reveal icon that appears when mousing over filtered images.

- Creates a 16x16 fixed-position `<div>` with the eye icon as background
- `setAnchor()` - Binds click handler with **toggle behavior**: first click reveals original (shows undo icon), second click re-filters (shows eye icon)
- `mCurrentMode` tracks `'reveal'` vs `'undo'` state
- `position()` - Places eye at top-right corner of element, clamped to viewport
- `attachTo(body)` / `detach()` - Adds/removes from DOM

### `src/js/content/MouseController.js` (153 lines)
Simple state manager for mouse tracking.

- Listens to `mousemove` on the document
- Tracks: `mMoved` (flag), `mEvent` (last MouseEvent), `mElement` (currently hovered element)
- Provides getters/setters used by `ProcessWin.checkMousePosition()`

### `src/js/content/ImagesDisplayer.js` (99 lines)
Manages the "show all images" functionality.

- `mShowAll` flag - Once true, all filtering stops
- `mIframes` - List of tracked iframe elements
- `showImages()` - Sets flag, changes icon to inactive, calls `skfShowImages()` on window and all tracked iframes
- `pruneDisconnected()` - Removes disconnected iframe references

### `src/js/content/DomainFilter.js` (322 lines)
Shared blocklist utility module imported by the background worker via `importScripts()`. It is not injected into web pages as a content script.

**Quran Verse Mappings (lines 5-78)**:
Maps blocklist category names to specific Quran verse references. Each category has 2 verses, one chosen randomly on redirect. Example:
- `gambling` -> `2:219` or `5:90`
- `porn` -> `24:30`, `24:31`, or `17:32`
- `default` -> `2:286` or `94:5`

**`BLOCKLISTS` object (lines 87-231)**:
Defines all 20 blocklists with:
- `url` - Chrome extension URL to the local `.txt` file
- `enabled` - Default on/off state
- `description` - Human-readable name
- `category` - `'vice'`, `'hazard'`, or `'distraction'`

Vice lists are always enabled. Hazard and distraction lists are toggleable.

**`processBlocklist()`** (lines 241-293):
Parses a blocklist file:
- Skips comments (`#`) and empty lines
- Handles `0.0.0.0 domain` format and plain domain format
- Validates domains contain a dot
- Normalizes to lowercase
- Uses chunked processing (yields every 1000 lines via `setTimeout(r, 0)`) to avoid blocking the service worker

**`fetchAndProcessBlocklist()`** (lines 300-322):
Clears and rebuilds the entire blocked domain set from all enabled lists.

### `src/js/popup.js` (281 lines)
Controls the popup window opened by clicking the extension icon.

**Initialization (lines 201-281)**:
1. Queries for the active tab
2. Sends `getSettings` to background with the tab info
3. Sets up all event listeners for controls

**Features**:
- Show Images button - Sends `showImages` to active tab
- Reload Tab button - Reloads and closes popup
- Exclude Domain toggle - Adds/removes current domain from URL list
- Exclude This Tab toggle - Per-tab exclusion
- Pause Globally / Pause This Tab toggles
- Filter Color buttons (white/black/grey) - Changes pixel replacement color
- Custom URL input + Add/Grab URL buttons
- Status indicator (Active/Paused dot)
- Version display from manifest

**Filter Color Logic (lines 102-158)**:
`setFilterColor()` avoids redundant messages. Only dispatches to background + active tab when the color actually changes. The `broadcast: false` option during initialization prevents a message storm on popup open.

### `src/js/options.js` (393 lines)
Controls the full options page.

**Settings Panel**:
- No Eye checkbox - Hides the hover reveal icon
- No Face Features checkbox - Removes the RGB constraint from skin detection
- Max Safe pixels input - Images smaller than this threshold are left unfiltered and visible
- Auto Unpause checkbox + timeout input - After pausing, auto-resume after N minutes
- Exclude Localhost checkbox - Skips filtering on localhost/127.0.0.1/file://

**Exclusion List**:
- Add exception form
- Delete buttons with event delegation
- Free Text mode - Edits the entire list as a textarea (one URL per line)

**Blocklist Panel**:
- Loads blocklist metadata from background via `getBlocklists`
- Vice items: always checked, always disabled (enforced)
- Hazard items: off by default, toggleable
- Distraction items: toggleable, off by default
- Each toggle sends `toggleBlocklist` to background which rebuilds the domain set

---

## 5. The Image Filtering Pipeline

### Step-by-Step Flow

```
Page loads
    |
    v
Content scripts injected (document_start)
    |
    v
getSettings from background
    |
    v
ProcessWin(window) called
    |
    v
Inject opacity:0 on body (prevent flash)
    |
    v
DOMContentLoaded fires
    |
    v
Create hidden <canvas> in body
    |
    v
start() called
    |
    v
doElements(body) scans all elements
    |
    v
For each <IMG> with width/height > maxSafe:
    |-- Save original src/srcset
    |-- Hide element (opacity: 0)
    |-- processDomImage()
    |       |
    |       v
    |   Try drawing to canvas directly
    |       |-- Success: filterSkinColor()
    |       |-- CORS Error: fetchAndReadImage() via background proxy
    |       |               |
    |       |               v
    |       |           background.js fetches image as blob
    |       |           converts to data URL
    |       |           returns to content script
    |       |           load into Image object
    |       |               |
    |       |               v
    |       |           filterSkinColor()
    |       v
    |   For each pixel:
    |       RGB -> YCbCr conversion
    |       RGB -> HSV conversion
    |       isSkinPixel() check
    |       If skin: replace with filter color
    |       |
    |       v
    |   canvas.toBlob() -> URL.createObjectURL()
    |       |
    |       v
    |   Set element.src = blobURL
    |   On load: unhide element, mark as processed
    |
    v
For each non-IMG with background-image > maxSafe:
    |-- Extract URL from background-image CSS
    |-- fetchAndReadImage() via background proxy
    |-- filterSkinColor()
    |-- Set element.style.backgroundImage = blobURL
    |
    v
Remove opacity:0 from body (page becomes visible)
    |
    v
MutationObserver watches for new/changed elements
    |-- New nodes -> doElements()
    |-- Class changes (lazy load) -> doElements()  
    |-- Style changes (background-image) -> doElement()
    |-- New iframes -> doIframe() -> ProcessWin()
```

### The Skin Detection Algorithm

The algorithm is based on the paper:
> Djamila Dahmani, Mehdi Cheref, Slimane Larabi, "Zero-sum game theory model for segmenting skin regions", Image and Vision Computing, Volume 99, 2020.

It uses a **dual color space approach**:

**YCbCr Space** (chrominance-based):
- Cb (blue chrominance): 85-128
- Cr (red chrominance): 142-180
- This captures the chrominance signature of skin regardless of brightness

**HSV Space** (perceptual):
- Hue: 0-32 degrees (warm orange/red tones)
- Saturation: >= 15% (excludes greys)

**RGB Space** (additional constraint when face features mode is off):
- R > 95, G > 40, B > 20
- This eliminates very dark pixels that might have skin-like chrominance

A pixel must pass **ALL** checks to be classified as skin.

### Filter Colors
When a pixel is classified as skin, it's replaced with:
- **Grey** (default): RGB(127, 127, 127)
- **White**: RGB(255, 255, 255)
- **Black**: RGB(0, 0, 0)

The alpha channel is always set to 255 (fully opaque).

### Performance Characteristics
For a 1920x1080 image:
- 2,073,600 pixels to process
- Each pixel requires: 2 color space conversions + 7 comparisons
- Total: ~8.3M array accesses, ~4.1M floating-point multiplications
- Canvas `getImageData`/`putImageData` are the main bottleneck
- The `willReadFrequently: true` hint on the canvas context helps Chrome optimize

---

## 6. The Website Blocking System

### How It Works
1. On startup, `fetchAndProcessBlocklist()` loads all enabled blocklist `.txt` files
2. Each domain is added to a `Set` (for O(1) lookup) and a `Map` (domain -> blocklist name)
3. `chrome.webNavigation.onBeforeNavigate` fires before every navigation
4. For main frame navigations (`frameId === 0`) on `http`/`https` URLs, when the extension is not paused or excluded for that tab:
   - Extract hostname from URL
   - Walk hostname labels: check `sub.example.com`, then `example.com`, then `com`
   - If any match exists in `blockedDomains` Set:
     - Look up which blocklist the domain belongs to
     - Pick a random relevant Quran verse
     - Redirect tab to `https://quran.com/{verse}` via `chrome.tabs.update`

### Blocklist Format
```
# Comment lines start with #
0.0.0.0 example.com
0.0.0.0 bad-site.org
just-a-domain.com
```
Both `0.0.0.0 domain` and plain domain formats are supported.

### Contextual Redirects
Many blocklist categories map to specific Quran verses. Categories without an explicit mapping fall back to the default verses:
- **Gambling** sites -> verses about intoxicants and gambling
- **Porn** sites -> verses about lowering gaze
- **Fraud/Scam** sites -> verses about consuming wealth unjustly
- **Distraction** sites -> verses about time and loss

---

## 7. Storage & State Management

### chrome.storage.sync (Persisted, synced across devices)
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `urlList` | JSON string (array) | `'[]'` | Excluded URLs/domains |
| `isNoEye` | `0`/`1` | `0` | Hide eye icon on hover |
| `isNoFaceFeatures` | `0`/`1` | `0` | Remove RGB constraint |
| `maxSafe` | number | `32` | Max "safe" image dimension (px) |
| `autoUnpause` | `0`/`1` | `1` | Auto-resume after pause |
| `autoUnpauseTimeout` | number | `15` | Minutes before auto-resume |
| `filterColor` | string | `'grey'` | `'white'`, `'black'`, or `'grey'` |
| `blocklistSettings` | JSON string (object) | `null` | Map of blocklist name -> enabled |
| `excludeLocalhost` | `0`/`1` | `1` | Skip filtering on localhost |

**Important**: `chrome.storage.sync` has a **102,400 byte** quota and 8,192 bytes per item. The `urlList` and `blocklistSettings` are JSON-stringified to fit.

### chrome.storage.local (Persisted, device-local)
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `isPaused` | `0`/`1` | `0` | Global pause state |
| `pausedTime` | number (Unix seconds) | `null` | When pause was activated |

### In-Memory State (Background Worker)
| Variable | Type | Description |
|----------|------|-------------|
| `storedSettings` | object | Mirror of all settings |
| `excludeForTabList` | array of `{tabId, domain}` | Per-tab domain exclusions |
| `pauseForTabList` | array of tab IDs | Per-tab pause state |
| `blockedDomains` | Set | All blocked domains |
| `domainToBlocklistMap` | Map | domain -> blocklist name |

**Critical**: `excludeForTabList` and `pauseForTabList` are **in-memory only**. They're lost when the service worker restarts. Chrome may terminate the worker at any time.

### In-Memory State (Content Scripts)
| Variable | Type | Description |
|----------|------|-------------|
| `settings` | object | Received from background on page load |
| `mSuspects` | Suspects instance | Tracked elements |
| `mHeadStyles` | object | Injected `<style>` references |
| Per-element properties | various | `IS_PROCESSED`, `IS_REVEALED`, `ATTR_RECTANGLE`, etc. |

---

## 8. Message Passing Protocol

All communication uses `chrome.runtime.sendMessage()` with a `{r: 'command', ...params}` format.

### Content Script -> Background

| Message | Params | Response | Description |
|---------|--------|----------|-------------|
| `getSettings` | `{tab?}` | Settings object | Get computed settings for tab |
| `setColorIcon` | `{toggle}` | - | Set active/inactive toolbar icon |
| `urlListAdd` | `{url, domainOnly?}` | boolean | Add URL to exclusion list |
| `urlListRemove` | `{exactUrl?, url?, domainOnly?, index?}` | boolean | Remove by exact stored entry or index |
| `fetchAndReadImage` | `{url}` | `{success, dataUrl?, error?}` | CORS proxy for images with requester-aware private-network restrictions |

### Popup -> Background

| Message | Params | Response | Description |
|---------|--------|----------|-------------|
| `getSettings` | `{tab}` | Settings object | Get settings with tab context |
| `pause` | `{toggle}` | boolean | Global pause toggle |
| `pauseForTab` | `{tabId, toggle}` | boolean | Per-tab pause |
| `excludeForTab` | `{tab, toggle}` | boolean | Per-tab exclusion |
| `setFilterColor` | `{color}` | boolean | Change filter color |
| `urlListAdd` | `{url}` | boolean | Add custom URL |

### Popup -> Content Script (via `chrome.tabs.sendMessage`)

| Message | Description |
|---------|-------------|
| `showImages` | Trigger show-all mode |
| `updateFilterColor` | Apply new filter color live |

### Options -> Background

| Message | Params | Response | Description |
|---------|--------|----------|-------------|
| `setNoEye` | `{toggle}` | boolean | Toggle eye icon |
| `setNoFaceFeatures` | `{toggle}` | boolean | Toggle face features |
| `setMaxSafe` | `{maxSafe}` | boolean | Set max safe dimension |
| `setAutoUnpause` | `{toggle}` | boolean | Toggle auto-unpause |
| `setAutoUnpauseTimeout` | `{autoUnpauseTimeout}` | boolean | Set timeout |
| `getBlocklists` | - | Object | Get all blocklist info |
| `toggleBlocklist` | `{name, enabled}` | boolean | Toggle a blocklist |
| `getUrlList` | - | Array | Get exclusion list |
| `setUrlList` | `{urlList}` | boolean | Replace entire list |
| `setExcludeLocalhost` | `{toggle}` | boolean | Toggle localhost exclusion |

---

## 9. User Controls & Keyboard Shortcuts

### Keyboard Shortcuts (Active Tab)
| Shortcut | Action | Condition |
|----------|--------|-----------|
| `Alt+P` | Pause filtering globally | Not already paused |
| `Alt+Z` | Reveal original image | Mouse over a filtered `<img>` |
| `Alt+A` | Reveal original background | Mouse over a filtered background |

### Popup Controls
- **Show Images**: Reveals all filtered images on the current tab
- **Reload Tab**: Reloads and closes popup
- **Filter Color**: Switch between white/black/grey replacement
- **Exclude Domain**: Add/remove current domain from exclusion list
- **Exclude This Tab**: Exclude just this tab (in-memory, temporary)
- **Pause Globally**: Pause all filtering
- **Pause This Tab**: Pause just this tab (in-memory, temporary)
- **Add URL**: Manually add an exclusion pattern
- **Grab URL**: Copy current tab URL into input

### Options Page Controls
- **Don't show the Eye**: Hide hover reveal icon
- **Remove face features**: More aggressive skin detection
- **Maximum Safe pixels**: Threshold below which images are simply hidden
- **Auto unpause**: Resume filtering after timeout
- **Exclude localhost**: Skip localhost/127.0.0.1/file:// URLs
- **Exclusion list**: URL patterns to skip
- **Blocklist toggles**: Enable/disable specific domain lists

---

## 10. The Exclusion System

There are **four layers** of exclusion, checked in order:

### Layer 1: Localhost Exclusion
If `excludeLocalhost` is enabled and the URL is:
- `localhost`, `127.0.0.1`, `::1`, or `*.localhost`
- `file://` or `filesystem://` protocol

Result: `isExcluded = true`, filtering skipped.

### Layer 2: User URL List
The `urlList` is an array of lowercase strings. For each entry, the extension checks if the current URL **contains** the entry (substring match).

**Blacklist Mode** (`isBlackList`):
- The background logic still supports this flag internally.
- There is currently no UI that exposes or changes it directly.

### Layer 3: Per-Tab Exclusion
`excludeForTabList` entries match `{tabId, domain}`. In-memory only.

### Layer 4: Per-Tab Pause
`pauseForTabList` contains tab IDs. In-memory only.

### Auto-Unpause
When pausing globally, `pausedTime` is stored as Unix seconds. On each settings evaluation, if `autoUnpause` is enabled and `pausedTime + (timeout * 60) < now`, the pause is automatically lifted.

---

## 11. The Eye (Hover Reveal) System

When the mouse hovers over a filtered element:

1. `checkMousePosition()` runs every 250ms
2. Finds the smallest suspect element under the cursor
3. Calls `toggleHover(element, true)` which calls `toggleHoverVisual()`
4. If `isNoEye` is false:
   - Eye icon is positioned at the element's top-right corner
   - Eye is shown with 50% opacity
   - `setAnchor()` binds click handler with toggle behavior

### Toggle Behavior
- **First click**: Eye icon changes to undo icon, original image revealed
- **Second click**: Undo icon changes back to eye, filter re-applied

### Auto-hide
After 2500ms without mouse activity, the hover visual is automatically hidden via `ATTR_CLEAR_HOVER_VISUAL_TIMER`.

### Element State Flow
```
Normal (filtered) --[hover]--> Eye visible --[click]--> Revealed (undo icon)
                                                            |
                                            [click] <-------+
                                              |
                                              v
                                        Re-filtered (eye icon)
```

---

## 12. Cross-Origin Image Handling

Web pages often load images from different domains (CDNs, external services). The browser's Same-Origin Policy prevents content scripts from reading pixel data of cross-origin images drawn on canvas.

### The Solution
FitnaFilter uses the **background service worker as a CORS proxy**:

1. Content script tries to draw image directly on canvas
2. If `getImageData()` throws (tainted canvas), it catches the error
3. Sends `fetchAndReadImage` message to background with the image URL
4. Background worker's `fetch()` is not restricted by page-level canvas CORS in the same way (it has `<all_urls>` host permission)
5. Background fetches the image as a blob, converts to data URL via `FileReader`
6. Returns the data URL to the content script
7. Content script creates a new `Image` from the data URL (now same-origin)
8. Draws and processes normally

### JWT/Token Images
Some images (like Outlook Web App attachments) have JWT tokens in their URLs (`=eyJ`). These are detected and always routed through the background proxy (line 383 of `domManipulation.js`).

---

## 13. Content Script Lifecycle

### Injection
The 7 files listed under `content_scripts` are injected into **every page** at `document_start` in **all frames**. The injection order in `manifest.json` matters:

1. `constants.js` - Constants (no dependencies)
2. `ImageProcessing.js` - Algorithm (uses constants, `settings` global)
3. `domManipulation.js` - DOM utilities (uses constants)
4. `MouseController.js` - Mouse tracking (standalone)
5. `Suspects.js` - Element tracking (uses constants, `releaseFilteredResources`)
6. `Eye.js` - Hover icon (uses constants)
7. `ImagesDisplayer.js` - Show-all (standalone)
8. `js.js` - Main controller (uses everything above)

### Timing
- Scripts run at `document_start` (before DOM is ready)
- They register `DOMContentLoaded` listeners for DOM-dependent work
- The `getSettings` message is sent immediately (async)
- There's a race between `DOMContentLoaded` and the settings response
- `ProcessWin` handles both orderings via the `mContentLoaded` flag

### Cleanup
When the user pauses, shows all images, or changes filter color:
- `cleanupExistingProcess()` calls the stored `cleanup` function
- All intervals, observers, and listeners are removed
- Head styles are removed
- For reprocessing, a new `ProcessWin()` is created

### Memory Management
- Blob URLs are tracked on elements so old resources can be revoked during replacement, reveal, and cleanup
- `releaseFilteredResources()` revokes both foreground and background blob URLs
- `Suspects.pruneDisconnected()` cleans up references to removed DOM elements
- `ImagesDisplayer.pruneDisconnected()` cleans up iframe references

---

## 14. Popup UI

The popup is a compact window (340px wide) with a dark glassmorphism theme.

### Sections
1. **Header**: Logo (inline SVG), title "FitnaFilter", subtitle "Purified Browsing"
2. **Quick Links**: Settings (opens options), GitHub link
3. **Quick Actions**: Show Images, Reload Tab
4. **Filter Color**: Three color swatches (white/black/grey) with active indicator
5. **Exclusions**: Domain toggle, Tab toggle
6. **Pause Filtering**: Global toggle, Tab toggle
7. **Custom URL**: Text input, Add URL, Grab URL buttons
8. **Footer**: Status indicator (green dot = active, red = paused), version

### Visual Features
- Animated gradient background
- Glassmorphism blur effects
- Ripple click animations on buttons
- Animated header sweep
- Toggle switches with glow effects

---

## 15. Options Page

A full-page settings interface with two-column layout.

### Left Column: Image Filtering
- Display and timing settings
- Image filtering exclusions with URL list management
- Free Text mode for bulk editing

### Right Column: Website Blocking
- Vice (always on, disabled checkboxes)
- Hazards (toggleable, orange theme)
- Distractions (toggleable, yellow theme)

### Visual Features
- Same glassmorphism theme as popup
- Animated background orbs
- Color-coded blocklist categories
- Loading spinner for blocklist data
- Responsive layout (stacks on mobile)

---

## 16. Blocklist Management

### Categories and Defaults

| Category | Lists | Default | UI |
|----------|-------|---------|-----|
| **Vice** | abuse, drugs, gambling, porn, vaping | Always ON | Checked + Disabled |
| **Hazard** | crypto, fraud, malware, phishing, ransomware, redirect, scam, tracking | OFF | Toggleable |
| **Distraction** | ads, facebook, fortnite, piracy, smarttv, tiktok, torrent, twitter, whatsapp, youtube | OFF | Toggleable |

### Blocklist Sizes (approximate)
The porn list is by far the largest at ~500K domains. The repository currently carries ~3.86 million blocklist lines total, including a few downloaded files that are not used at runtime.

### Processing
- Lists are fetched from local extension files (not remote URLs at runtime)
- Each line is parsed: skip comments, handle `0.0.0.0` prefix, validate domain has a dot
- Domains are lowercased and added to a `Set` for O(1) lookup
- Processing yields every 1000 lines to avoid blocking the event loop
- When a blocklist is toggled, the worker rebuilds the enabled collections and then swaps them in atomically

### Updating
Run `python download_blocklists.py` to fetch the latest lists from The Block List Project. This currently downloads 26 files with a 1-second delay between requests.

---

## 17. Constants & Configuration

### Processing Constants (in `js.js`)
| Constant | Value | Purpose |
|----------|-------|---------|
| `STYLE_POLL_INTERVAL_MS` | 32ms | How often to try injecting head styles |
| `HOVER_POLL_INTERVAL_MS` | 250ms | Mouse position check frequency |
| `RECT_UPDATE_INTERVAL_MS` | 3000ms | Bounding rect refresh frequency |
| `RECT_TIMEOUT_BASE_MS` | 1500ms | Initial rect update timeout |
| `RECT_TIMEOUT_REPEAT_COUNT` | 3 | Number of initial rect updates |
| `IFRAME_POLL_INTERVAL_MS` | 50ms | Iframe readiness check frequency |
| `IFRAME_POLL_MAX_ATTEMPTS` | 100 | Max iframe polls (= 5s timeout) |

### Skin Detection Thresholds (in `ImageProcessing.js`)
| Constant | Value | Color Space |
|----------|-------|-------------|
| `HUE_MIN` | 0 | HSV |
| `HUE_MAX` | 32 | HSV |
| `SAT_MIN` | 15 | HSV |
| `CB_MIN` | 85 | YCbCr |
| `CB_MAX` | 128 | YCbCr |
| `CR_MIN` | 142 | YCbCr |
| `CR_MAX` | 180 | YCbCr |

### Element Tag List
26 HTML tags are checked for images: `IMG`, `DIV`, `SPAN`, `A`, `UL`, `LI`, `TD`, `H1`-`H6`, `I`, `STRONG`, `B`, `BIG`, `BUTTON`, `CENTER`, `SECTION`, `TABLE`, `FIGURE`, `ASIDE`, `HEADER`, `VIDEO`, `P`, `ARTICLE`.

---

## 18. CSS & Theming

Both the popup and options page use a **Glassmorphism Ultra** dark theme with purple accent colors.

### Design System
```css
--bg-dark: #0a0a0c;
--purple-primary: #bf00ff;
--purple-light: #d966ff;
--text-primary: #f5f5fa;
--success: #00d9a5;      /* Active status */
--danger: #ff4757;        /* Paused status */
--red-primary: #ff4d6a;   /* Vice category */
--orange-primary: #ff9f43; /* Hazard category */
--yellow-primary: #ffd93d; /* Distraction category */
```

### Animations
- `gradientShift` - Animated background gradient
- `headerGradient` - Popup header animation
- `headerSweep` - Light sweep across header
- `logoPulse` / `logoFloat` - Logo breathing animation
- `containerIn` - Entrance animation
- `fadeInUp` - Staggered settings group appearance
- `spin` - Loading spinner
- `pulse` - Status dot pulsing
- `checkIn` - Checkbox check animation
- `ripple` - Button click ripple
- `orbFloat` - Background orb movement (options page)

---

## 19. How to Modify & Extend

### Adding a New Blocklist
1. Add the `.txt` file to `src/blocklists/`
2. In `src/js/content/DomainFilter.js`:
   - Add entry to `BLOCKLISTS` object with `url`, `enabled`, `description`, `category`
   - Add verse mapping to `VERSE_MAPPINGS` if needed
3. Update `download_blocklists.py` if it's from Block List Project
4. The options page auto-discovers new lists via `getBlocklists`

### Changing Skin Detection Sensitivity
Edit thresholds in `src/js/content/ImageProcessing.js`:
- **More aggressive** (catch more skin): Widen ranges (e.g., `HUE_MAX = 40`, `SAT_MIN = 10`)
- **Less aggressive** (fewer false positives): Narrow ranges
- **Remove face features**: Toggle `isNoFaceFeatures` to bypass RGB check

### Adding a New Filter Color
1. In `ImageProcessing.js` `filterSkinColor()`: Add a new `case` in the switch
2. In `background.js` `setFilterColor`: Add to `validColors` array
3. In `popup.js`: Add button and event listener
4. In `popup.html`: Add button element
5. In `popup.css`: Add button style

### Adding a New Setting
1. Add default to `DEFAULT_SETTINGS` in `background.js`
2. Add storage read in `getSettings()`
3. Add message handler case (e.g., `setNewSetting`)
4. Add UI control in `options.html` / `options.js`
5. Read in content script via `getSettings` response

### Adding a New Message Type
1. Add `case` to the `switch` in `background.js` message listener
2. Always `sendResponse()` and keep `return true` at the end
3. Send from content script/popup via `chrome.runtime.sendMessage({r: 'newMessage', ...})`

---

## 20. Testing Methodology

There are **no automated tests**. All testing is manual.

### Test Checklist
1. **Basic Filtering**: Load a page with images, verify skin-toned areas are replaced
2. **Cross-Origin**: Test on sites with CDN-hosted images (e.g., social media)
3. **Background Images**: Check sites using CSS `background-image` extensively
4. **Size Threshold**: Verify images below `maxSafe` are hidden (not filtered)
5. **Eye Icon**: Hover over filtered image, verify eye appears, click to reveal, click to re-filter
6. **Keyboard Shortcuts**: Alt+P (pause), Alt+Z (reveal img), Alt+A (reveal bg)
7. **Popup Controls**: Test all toggles, verify they take effect immediately
8. **Filter Color**: Switch colors, verify existing filtered images update
9. **Exclusion List**: Add/remove URLs, verify filtering stops/starts
10. **Per-Tab Controls**: Exclude/pause tab, verify only that tab is affected
11. **Auto-Unpause**: Pause, wait for timeout, verify auto-resume
12. **Blocklist**: Enable a distraction list (e.g., YouTube), navigate to youtube.com, verify redirect
13. **Quran Redirect**: Check that redirects go to relevant verses
14. **Iframe Support**: Test on pages with iframes (e.g., embedded content)
15. **Lazy Loading**: Test on sites with lazy-loaded images (infinite scroll)
16. **SPA Navigation**: Test on single-page apps (Gmail, Twitter) with dynamic content
17. **Options Page**: Verify all settings persist across browser restart
18. **Memory**: Check DevTools for blob URL leaks during extended browsing

---

## 21. Glossary

| Term | Meaning |
|------|---------|
| **Fitna** | Arabic word meaning "temptation" or "trial" - the types of content this extension filters |
| **Suspect** | A DOM element that has been identified as potentially containing a filterable image |
| **Eye** | The hover icon that lets you reveal/re-filter individual images |
| **MaxSafe** | Pixel dimension threshold; images with both width AND height below this are simply hidden |
| **Filter Color** | The solid color that replaces detected skin pixels (white/black/grey) |
| **Blocklist** | A text file containing domains to block, one per line |
| **Vice** | Blocklist category for inherently harmful content (always blocked) |
| **Hazard** | Blocklist category for security threats (user-toggleable) |
| **Distraction** | Blocklist category for time-wasting sites (user-toggleable) |
| **CORS Proxy** | The background service worker acts as a proxy to fetch cross-origin images |
| **Blob URL** | Temporary URL created from in-memory binary data via `URL.createObjectURL()` |
| **YCbCr** | Color space separating luminance (Y) from chrominance (Cb, Cr) |
| **HSV** | Hue-Saturation-Value color space, more intuitive for color classification |
| **`skf-*`** | Prefix used for all custom attributes and flags ("skf" = skin filter) |
| **ProcessWin** | The main factory function that creates a filtering instance for a window/iframe |
| **Glassmorphism** | The frosted-glass UI design style used in popup and options |
| **MutationObserver** | Browser API for watching DOM changes; used to catch dynamically added images |
| **Service Worker** | The background script in MV3; can be terminated by Chrome at any time |
| **`importScripts()`** | Service worker method to load additional JS files (used for DomainFilter.js) |
