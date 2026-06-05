# FitnaFilter Website Performance Review

Audit date: 2026-06-05

Reviewed property: `fitnafilter.com`

Inspected build: `/home/azidan/AQL/FitnaFilter/website/home.html`

Method: local static-server review, Brave remote debugging on `127.0.0.1:9222`, source inspection of `website/home.html`, `website/home.css`, and `website/home.js`, asset-size review, resource timing inspection, responsive screenshot capture, live-domain `curl` checks, and parallel read-only review of HTML/network, CSS/rendering, JS/runtime, and UX trade-off areas.

## Executive Summary

The local FitnaFilter homepage has a strong first impression. The hero is clear, product-specific, and visually distinctive: a privacy-first browser extension that filters explicit imagery, blocks harmful domains, and redirects users toward better choices. The design language is confident and memorable, and the first viewport communicates the product well on both desktop and mobile.

The main issue is not weak design. It is that the page is carrying a heavy decorative performance load. The homepage currently ships a 2.06 MB hero image, requests a broad Google Fonts set, embeds a large inline SVG logo sprite, animates a full-viewport canvas background, and keeps multiple decorative motion systems alive at once. Much of this can be improved without changing the visible output.

The other important issue is deployment readiness: as checked on 2026-06-05, `https://fitnafilter.com` returned Cloudflare `522`, while `http://fitnafilter.com` redirected to `www.fitnafilter.com`, which served a Sedo/parking-style page. That means the live domain is not yet serving the local homepage build reviewed here.

Overall grade for the local homepage build: **B**

The page is visually strong and strategically coherent, but performance polish and launch-domain configuration need attention before public release.

## Summary Counts

| Category | Count | Meaning |
|---|---:|---|
| Launch blocker | 1 | Live-domain issue preventing the reviewed homepage from being served at `fitnafilter.com`. |
| Free Lunch | 8 | Exact same visible output, lower network/runtime/rendering cost. |
| Minor Changes | 6 | Small visual or timing changes that are likely worth it. |
| Major Changes | 3 | Larger design or architecture changes that should be considered later. |

## Scope and Current Status

### Live domain status

- `https://fitnafilter.com` returned Cloudflare `522`.
- `http://fitnafilter.com` redirected via Namecheap URL forwarding to `http://www.fitnafilter.com/`.
- `http://www.fitnafilter.com/` returned a parking-style page with title text similar to `fitnafilter.com - fitnafilter Resources and Information`.

This should be treated separately from the local performance audit. The local homepage can be optimized, but the domain must first point to the intended hosting target with working HTTPS.

### Local asset inventory

| Asset | Raw size |
|---|---:|
| `website/hero_art.png` | 2,061,023 bytes |
| `website/home.html` | 76,468 bytes |
| `website/home.css` | 61,813 bytes |
| `website/home.js` | 26,971 bytes |

Additional observations:

- Inline SVG sprite block: about 30.5 KB raw.
- Google Fonts request: 6 families and a wide weight set; live CSS expanded to about 38.8 KB and 69 `@font-face` rules during the browser run.
- Runtime DOM after initialization: 835 elements.
- Decorative generated elements: 9 hero drift chips, 21 portal chips, 9 playground tiles, and 12 ayah cards after marquee cloning.
- The full-viewport canvas measured `1440 x 900` on the desktop capture and `390 x 844` on the mobile capture.

## Findings by Priority

### Launch Blocker

1. **The public domain is not serving the reviewed homepage**
   - Evidence: `https://fitnafilter.com` returned Cloudflare `522`; `www.fitnafilter.com` served a parked page.
   - Impact: visitors will not see the FitnaFilter homepage, and search engines/social previews will index or cache the wrong experience.
   - Recommendation: point the apex and `www` DNS records to the intended host, configure HTTPS, remove parking/forwarding, and re-test `https://fitnafilter.com`, `https://www.fitnafilter.com`, `http://fitnafilter.com`, and `http://www.fitnafilter.com`.

### Free Lunch: Same Output, More Efficient

1. **Trim the Google Fonts request**
   - Files: `website/home.html:11`, `website/home.css:32-36`, Arabic text usage at `website/home.css:1397`.
   - Current state: the page requests `Sora`, `Inter`, `Instrument Serif`, `JetBrains Mono`, `Noto Naskh Arabic`, and `Amiri Quran`, with multiple weights.
   - Why it matters: the font CSS expands into many `@font-face` rules and additional font downloads.
   - Recommendation: remove unused `Instrument Serif`, avoid fetching `Amiri Quran` if it is only a fallback, and request only actually used weights.

2. **Losslessly optimize the hero image**
   - Files: `website/home.html:12`, `website/home.css:308`.
   - Current state: the preloaded CSS hero background is a 2.06 MB PNG.
   - Recommendation: run lossless PNG recompression and consider lossless WebP with PNG fallback. This keeps the same visible image while reducing transfer size.

3. **Skip canvas edge-glow scanning when the pointer is inactive**
   - Files: `website/home.js:575-620`, especially the edge loop around `website/home.js:587`.
   - Current state: the decorative tessellation canvas still enters the edge-highlight loop even when the pointer sentinel is offscreen.
   - Recommendation: short-circuit the pointer glow loop unless the pointer is active and inside the viewport. Keep the base path and dots unchanged.

4. **Pause the canvas animation when the document is hidden**
   - Files: `website/home.js:575-620`, `website/home.js:697`.
   - Current state: the canvas uses continuous `requestAnimationFrame` while motion is enabled.
   - Recommendation: use `visibilitychange` to stop rAF work in background tabs and resume on return. Visible output is unchanged.

5. **Convert layout-affecting animations to transform-based animations**
   - Files: `website/home.css:991-1005`, `website/home.css:800-805`, `website/home.css:278-282`.
   - Current state: portal chips animate `left`, the scroll progress bar updates `width`, and nav underline hover transitions `width`.
   - Recommendation: use `transform: translate3d(...)` for chip travel and `transform: scaleX(...)` for the progress bar and underline. The visual effect can match the current page while avoiding per-frame layout work.

6. **Tighten scroll and drag hot paths**
   - Files: `website/home.js:11-13`, `website/home.js:176-183`, `website/home.js:97-112`.
   - Current state: sticky nav and scroll progress are separate scroll handlers; the before/after slider reads layout on every pointer move and listens globally even when not dragging.
   - Recommendation: combine scroll work in one rAF-scheduled handler, cache scroll maximum on resize, cache the slider rect per drag, and attach pointermove only during active drag.

7. **Reduce repeated DOM parsing and querying**
   - Files: `website/home.js:36-40`, `website/home.js:321-329`, `website/home.js:362`, `website/home.js:456`.
   - Current state: counters parse dataset values repeatedly; playground sorting and DOM querying are repeated in a small interactive area; tile segment generation can be repeated on resize.
   - Recommendation: pre-parse counter metadata, precompute ranked playground tiles, cache swatch/toggle node lists, and cache `tileSegments()` by tile size.

8. **Remove dead or no-op CSS**
   - Files: `website/home.css:586`, `website/home.css:607`, `website/home.css:1072-1073`, breakpoint blocks around `website/home.css:727` and `website/home.css:1510`.
   - Current state: selectors such as `.feature-grid`, `.card--wide`, and empty playground-level rules do not affect the current page.
   - Recommendation: remove dead selectors and merge duplicated breakpoint blocks for a small parse/rule-match win.

## Minor Changes: Small Output Changes, Likely Worth It

1. **Use lossy WebP or AVIF for the hero**
   - File: `website/home.css:308`.
   - Why it matters: a high-quality lossy image could reduce the hero from megabytes to a small fraction of the current size.
   - Trade-off: pixels change slightly, so this belongs below the exact-output optimizations.

2. **Reduce decorative blended layers on low-power/mobile contexts**
   - Files: `website/home.css:121-129`, `website/home.css:809-815`, `website/home.css:258-260`.
   - Current state: the page uses a full-screen blended canvas, a fixed pointer glow, and a fixed backdrop-filter nav.
   - Recommendation: disable or simplify the cursor glow and blended canvas on mobile/low-power modes, and consider replacing the nav blur with a solid translucent background.

3. **Pause offscreen decorative motion**
   - Files: `website/home.js:200-235`, `website/home.css:847-891`, `website/home.css:900-1015`, `website/home.css:1355-1365`.
   - Current state: hero drift chips, portal chips, marquee rows, and ayah rail animation add constant visual work.
   - Recommendation: start these systems only when their section is near viewport, or pause them when far offscreen.

4. **Remove or simplify low-value pointer effects**
   - Files: `website/home.js:65-77`, `website/home.js:80-88`, `website/home.js:186-197`.
   - Current state: hero parallax, card spotlight tracking, and pointer glow are subtle but keep pointer work active.
   - Recommendation: keep the hero image and core brand signal, but remove or gate the pointer flourishes.

5. **Choose either hero drift chips or the marquee**
   - Files: `website/home.html:504`, `website/home.html:547-563`.
   - Current state: both communicate a similar "blocked domains moving through the system" idea.
   - Recommendation: keep the one with stronger brand value and remove the other if the page needs to feel calmer.

6. **Tighten reduced-motion handling**
   - File: `website/home.css:790-793`.
   - Current state: animation durations are compressed, but many decorative layers still exist.
   - Recommendation: hide or freeze `.cursor-glow`, `.hero__drift`, `.portal__chip`, `.content-pattern`, and marquee-like rails for reduced-motion users.

## Major Changes: Larger Design Decisions

1. **Replace the animated canvas background**
   - Files: `website/home.html:31`, `website/home.js:378-697`.
   - Benefit: largest CPU and battery improvement.
   - Cost: removes the interactive tessellation atmosphere, which is one of the page's more distinctive visual traits.

2. **Convert the CSS hero background to a responsive `<picture>` / `<img>` system**
   - Files: `website/home.html:500-504`, `website/home.css:302-330`.
   - Benefit: better responsive image selection and browser priority handling.
   - Cost: structural rewrite with stacking, overlay, and parallax QA risk.

3. **Merge the playground and before/after demo**
   - Files: `website/home.html:662-744`, `website/home.js:91-143`, `website/home.js:293-375`.
   - Benefit: removes an entire visual block and some interaction code.
   - Cost: changes content strategy. The page currently benefits from having both an interactive control demo and a simple before/after metaphor.

## Recommended Implementation Order

1. Fix live-domain routing and HTTPS so the right site is served.
2. Trim fonts and losslessly optimize hero assets.
3. Add canvas hidden-tab pause and inactive-pointer short-circuit.
4. Convert `left` and `width` animations to transform-based equivalents.
5. Consolidate scroll handlers and slider pointer handling.
6. Remove dead CSS and strip unused SVG export metadata.
7. Re-test desktop and mobile screenshots for no visible regressions.
8. Decide whether to adopt lossy hero formats and reduced decorative motion.

## Evidence Register

| Ref | File | Description |
|---|---|---|
| E1 | `evidence/01-local-home-desktop-hero.png` | Desktop hero screenshot of the inspected local homepage. |
| E2 | `evidence/02-local-home-mobile-hero.png` | Mobile hero screenshot at 390px width. |
| E3 | `evidence/03-local-home-desktop-page-top.png` | Full-width top-page capture used as visual context for the local build. |
| E4 | `evidence/capture-summary.json` | Browser-side DOM and decorative-element counts captured through Brave/CDP. |

## Closing Assessment

FitnaFilter's homepage is already stronger than a generic extension landing page. It has a distinctive hero, clear value proposition, strong privacy framing, and product-specific interaction demos. The optimization work should therefore preserve the brand signal rather than flattening the site.

The best first pass is conservative: keep the page looking the same, but cut obvious network and runtime waste. After that, decide how much decorative motion is worth keeping on mobile and lower-power contexts.

