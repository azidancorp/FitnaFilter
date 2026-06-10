# FitnaFilter Stretched Image Investigation

Date: 2026-06-10

## Root Cause

Filtered responsive images could be generated from the wrong bitmap.

The old flow cleared `img.srcset` and `<picture><source srcset>` before canvas filtering. For responsive images, the browser had often selected a wide `currentSrc` while the fallback `img.src` was a different crop or aspect ratio. Clearing the responsive candidates before drawing caused the image element to fall back to `img.src`, so FitnaFilter rasterized the fallback and then placed that blob into the original layout box.

The visible failure was an aspect-ratio mismatch: a tall filtered blob, such as `400x800`, rendered inside a wide box, such as `360x180`.

## Fix

- Keep the browser-selected `currentSrc` in place while canvas filtering runs.
- Use `currentSrc || src` for the background-fetch fallback path.
- Clear `srcset` and `<picture>` sources only after the filtered blob has been produced and is ready to be assigned.
- Restore `<picture>` sources on filtered-blob load failure.

## Verification

Runner:

```bash
node qa/evidence/stretch-investigation-2026-06-10/run-cdp-repro.js
```

Artifacts:

- `control.png`: browser rendering without the unpacked extension.
- `extension.png`: browser rendering with the unpacked extension.
- `results.json`: collected `currentSrc`, natural dimensions, rendered dimensions, and aspect ratios.

Fixed-state highlights from `results.json`:

| Case | Control natural | Filtered natural | Rendered | Aspect |
| --- | --- | --- | --- | --- |
| `picture-fixed` | `800x400` | `800x400` | `360x180` | `2 -> 2` |
| `srcset-fixed` | `360x180` | `360x180` | `360x180` | `2 -> 2` |
| `picture-auto` | `800x400` | `800x400` | `360x180` | `2 -> 2` |
| `cross-picture-fixed` | `800x400` | `800x400` | `360x180` | `2 -> 2` |
| `cross-srcset-fixed` | `360x180` | `800x400` | `360x180` | `2 -> 2` |

`plain-tall` intentionally remains a distorted control case because the page itself forces a tall source into a wide fixed box.
