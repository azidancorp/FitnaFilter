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

