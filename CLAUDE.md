# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FitnaFilter is a Chrome extension (Manifest V3) that provides content filtering for a "purified browsing experience" through two main mechanisms:
1. **Image Filtering**: Advanced skin tone detection and filtering using pixel analysis
2. **Website Blocking**: Domain-based blocking using curated blocklists from The Block List Project

## Development Commands

This is a pure JavaScript extension with no build system. Development workflow:

```bash
# Update blocklists from remote sources
python download_blocklists.py

# Load extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked" and select the src/ directory
```

## Coding Standards

- Use **4 spaces** for indentation in both JavaScript and Python files
- Keep line length under **120 characters**
- Use `camelCase` for JavaScript variables and function names
- Add short comments for new functions or complex logic
- When working with blocklists, run `python download_blocklists.py` to fetch latest versions

## Architecture

### Core Components
- **Background Service Worker** (`src/js/background.js`): Settings management, blocklist processing, website blocking via webNavigation API
- **Content Scripts** (`src/js/content/`): Image processing pipeline, DOM manipulation, user interactions
- **UI Components**: Popup (`src/js/popup.js`) for quick controls, Options page (`src/js/options.js`) for comprehensive settings

### Image Processing Pipeline
Located in `src/js/content/ImageProcessing.js`:
1. Canvas-based pixel analysis using YCbCr and HSV color spaces
2. Skin detection algorithm with configurable thresholds
3. Pixel replacement with user-selected filter colors (white/black/grey)
4. Cross-origin image handling via background service worker

### Content Script Architecture
- **Main Controller** (`js.js`): Orchestrates all content script modules
- **Suspects** (`Suspects.js`): Tracks filtered elements and their states
- **Eye** (`Eye.js`): Hover icon system for revealing/re-filtering original images (toggle mode)
- **MouseController** (`MouseController.js`): Mouse interaction handling
- **ImagesDisplayer** (`ImagesDisplayer.js`): Image visibility management
- **domManipulation** (`domManipulation.js`): DOM manipulation helpers, image processing functions (`processDomImage`, `processBackgroundImage`, `filterImageElement`)

### Storage Strategy
- **chrome.storage.sync**: User preferences, settings, blocklist configurations
- **chrome.storage.local**: Temporary states (pause status, timestamps)
- Runtime messaging for communication between components

### Blocklist System
Organized in `src/blocklists/` with categories:
- **Vice** (always enabled): abuse, drugs, gambling, porn, vaping
- **Hazard** (configurable): crypto, fraud, malware, phishing, ransomware, redirect, scam, tracking
- **Distraction** (configurable): ads, facebook, fortnite, piracy, smarttv, tiktok, torrent, twitter, whatsapp, youtube

## Key Technical Details

### Skin Detection Algorithm Specifics
- **YCbCr color space**: Cb (85-128) and Cr (142-180) ranges for skin detection
- **HSV color space**: Hue (0-32°) and Saturation (>15%) ranges for additional validation
- **Optional RGB verification**: Enhanced face feature detection for accuracy
- **Configurable thresholds**: User-adjustable sensitivity and filter colors

### Cross-Origin Image Handling
Content scripts cannot directly access cross-origin images due to CORS. The background service worker acts as a proxy:
1. Content script requests image via `chrome.runtime.sendMessage`
2. Background worker fetches image and returns base64 data
3. Content script creates blob URL for Canvas processing

### Performance Considerations
- Only processes images above size thresholds (configurable)
- Uses MutationObserver for dynamic content detection
- Chunked processing for large blocklists
- Element caching to prevent reprocessing
- Lazy loading and processing strategies

### User Controls
- **Global shortcuts**: Alt+P (pause), Alt+Z (reveal images), Alt+A (reveal backgrounds)
- **Per-tab exclusions**: Temporary or permanent domain/URL whitelisting
- **Filter customization**: Color selection, sensitivity settings, auto-unpause timers
- **Management features**: Domain/URL whitelist, auto-unpause timers

## AI Agent Development Guidelines

### Common Modification Patterns
When modifying the extension, focus on these key areas:
- **Image Processing**: Modify `src/js/content/ImageProcessing.js` for algorithm changes
- **Blocklist Management**: Update `src/js/background.js` for new categories or sources
- **User Interface**: Edit `src/js/popup.js` or `src/js/options.js` for UI changes
- **Content Script Logic**: Modify `src/js/content/js.js` for main processing flow

### Debugging Approach
1. Use Chrome DevTools Console for content script debugging
2. Check Background Service Worker in chrome://extensions/
3. Monitor chrome.storage changes in DevTools Application tab
4. Test image processing with various image types and sizes
5. Verify CORS handling with cross-origin images

### Extension APIs to Understand
- `chrome.storage.sync/local`: Persistent and temporary data storage
- `chrome.runtime.sendMessage`: Communication between scripts
- `chrome.webNavigation.onBeforeNavigate`: Website blocking interception
- `chrome.tabs`: Tab management and exclusion system

## Testing and Verification

No automated tests provided. Manual verification required:
1. Load extension as unpacked in Chrome
2. Test basic image filtering on various websites
3. Verify blocklist functionality with known blocked domains
4. Check popup and options page functionality
5. Test cross-origin image handling
6. Verify user controls (Alt+P pause, Alt+Z reveal, etc.)
7. Test exclusion system with domains and URLs
8. Verify auto-unpause functionality

## File Structure Notes
- `src/manifest.json`: Extension configuration (V3)
- `src/js/content/constants.js`: Shared constants and feature flags
- `src/js/content/domManipulation.js`: DOM manipulation helpers and image processing functions
- `src/css/`: Styling for popup and options UI
- `src/images/`: Extension icons and UI assets
- `src/blocklists/`: Text files with blocked domains (one per line)