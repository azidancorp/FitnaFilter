# Agent Guidelines

This repository contains **FitnaFilter**, a Chrome extension that filters human skin tones and blocks unsafe sites. When modifying the project keep these rules in mind.

## Development

- Use **4 spaces** for indentation in both JavaScript and Python files.
- Keep line length under **120 characters**.
- Use `camelCase` for JavaScript variables and function names.
- Add short comments for new functions or complex logic.
- When working with blocklists, run `python download_blocklists.py` to fetch the latest versions.

## Repository Layout

- `src/` contains extension code:
  - `js/` for content scripts, the service worker and the popup.
  - `css/` and `images/` for styling assets.
  - `blocklists/` for domain lists.
- `download_blocklists.py` retrieves the latest blocklist files.

## Testing

No automated tests are provided. Please verify that the extension loads in Chrome using `Load unpacked` and check basic functionality when you change scripts.

