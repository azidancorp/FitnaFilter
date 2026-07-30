# FitnaFilter Codebase Audit and Ground-Up V2 Rebuild

**Audit performed:** 29 July 2026  
**Report saved:** 30 July 2026  
**Audited revision:** `e3aa3b4` (`Polish extension popup layout`)

## Executive verdict

FitnaFilter should be rebuilt as a v2 alongside the existing extension. The present core should not be
incrementally modernised in place.

This does not mean every recent fix was wasted. Several are useful and should become behavioral requirements
and regression tests. The problem is architectural: the extension still assumes persistent background state,
performs synchronous full-resolution image work in page contexts, mutates host-page media sources, and uses
reactive navigation redirects. Those assumptions conflict with Manifest V3 lifecycle, performance, security,
accessibility, and release expectations.

The recommended strategy is:

1. Freeze v1 except for critical containment fixes.
2. Preserve the product identity, settings concepts, visual assets, blocklist taxonomy, and proven security
   invariants.
3. Replace the lifecycle/state layer, navigation engine, image-processing pipeline, message protocol, blocklist
   delivery, tests, and release system.
4. Build v2 in parallel and retire v1 only after measured parity and a rollback-capable release.

## Audit scope and repository state

- The extension runtime, popup, options, blocklists, website, downloader, historical QA artifacts, repository
  history, and live website deployment were reviewed.
- The audited branch was seven commits ahead of `origin/master`.
- The only working-tree changes were pre-existing deletions under `WebsiteAuditFitnaFilter/`; they were preserved.
- No source changes, commits, deployments, dependency installations, or browser-profile changes were made during
  the audit.
- All JavaScript passed syntax checks.
- The manifest JSON and downloader Python parsed successfully.
- `node extension/scripts/check_background_fetch_guard.js` passed.
- `git diff --check` passed.
- There is no package manager, typed build, linter, formatter, CI workflow, general unit suite, or reproducible E2E
  suite. The VM fetch/blocklist guard is the only current executable regression test.
- At audit time, `fitnafilter.com`, `www.fitnafilter.com`, and `fitnafilter.pages.dev` returned identical content and
  matched `origin/master`, not the seven newer local commits.
- Live unknown paths, `/privacy`, `/sitemap.xml`, and `/.well-known/security.txt` all returned the approximately
  73 KB homepage with status `200`.

## Useful work already present

The recent modernisation attempts produced several pieces worth retaining as requirements:

- The privileged cross-origin image fetch validates protocols and local/private targets, omits credentials and
  referrers, rejects redirects, enforces an image MIME type, times out, and caps encoded size
  (`extension/js/background.js:1123`).
- Settings reads now consult fresh storage (`extension/js/background.js:618`).
- Filtered blob URLs are cleaned up (`extension/js/content/domManipulation.js:949`).
- Suspect deduplication now uses a `WeakSet` (`extension/js/content/Suspects.js:7`). Earlier notes describing an
  O(n) `indexOf` lookup are stale.
- The reveal/undo eye interaction is conceptually useful.
- Recent responsive-image lifecycle fixes should become regression scenarios.
- The popup, options page, and website contain useful reduced-motion, focus-visible, and forced-colour work.

These should generally be carried forward as behavior and tests rather than copied line-for-line.

## Principal findings

### 1. Navigation blocking is not reliable Manifest V3 enforcement

The service worker begins an asynchronous settings read before starting blocklist loading
(`extension/js/background.js:686`). The navigation listener (`extension/js/background.js:1197`) can run while:

- `blocklistLoadPromise` is still `null`;
- the in-memory domain map is empty;
- no warm-up recheck is scheduled.

This creates a cold-start fail-open race for the navigation that wakes the worker.

Even after loading, `webNavigation.onBeforeNavigate` is observational. FitnaFilter reacts by calling
`tabs.update()` (`extension/js/background.js:410`) after the original navigation has begun; it does not cancel the
request. Chrome describes `webNavigation` as navigation-status notifications. The supported network-enforcement
mechanism is Declarative Net Request (DNR).

- [Chrome Web Navigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)
- [Chrome content filtering](https://developer.chrome.com/docs/extensions/develop/concepts/content-filtering)

Chrome can terminate an idle extension worker after roughly 30 seconds, discarding all globals. A million-domain
in-memory map therefore cannot be authoritative state.

- [Chrome service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)

### 2. “Always-on” Vice blocking is not always on

Before consulting the blocklist, `redirectBlockedNavigation()` returns early for:

- global image-filter pause;
- per-tab pause;
- permanent image exceptions;
- per-tab exceptions.

The coupling is visible at `extension/js/background.js:417` and contradicts “Vice Blocking (Always On)” in
`extension/options.html:171`.

V2 needs two independent policy domains:

1. Visual media filtering.
2. Domain/network protection.

Their pause state, exceptions, permissions, storage, and UI must be separated deliberately.

### 3. Strict image mode fails open

Strict and placeholder modes initially hide candidate media, but processing failure ultimately restores and shows
the original:

- Direct filtering failure falls through to the privileged fetch route, then reveals on another failure
  (`extension/js/content/domManipulation.js:646`).
- Background filtering restores the original on failure
  (`extension/js/content/domManipulation.js:697`).

Failures include CORS, authenticated assets, MIME rejection, the 10 MiB encoded-size limit, canvas tainting, decode
failure, output failure, and unsupported URLs.

That behavior may be suitable for a progressive mode. It is not fail-closed strict behavior. Strict-mode failure
should leave an accessible cover with an explicit user-controlled reveal action.

### 4. Large classes of visual content bypass filtering

Confirmed examples include:

- Both rendered dimensions must exceed the threshold. A 1,000×20 image is treated as safe because one dimension is
  small.
- The decision uses rendered dimensions rather than decoded pixel area.
- There is no `ResizeObserver`, so an initially small responsive image may later grow without processing.
- There is no viewport gating or `IntersectionObserver` in the extension.
- A hard-coded tag list omits custom elements and many elements that can carry backgrounds.
- The body, Shadow DOM, pseudo-elements, SVG-contained imagery, canvas, video frames, CSS masks, and image-set
  sources are unsupported or only incidentally handled.
- CSS `data:` and page-owned `blob:` backgrounds are rejected.
- Multi-layer background parsing uses brittle string splitting and can corrupt the final CSS value around
  `extension/js/content/js.js:755`.
- A changed background can remain marked processed and therefore be skipped.
- Source changes retain stale “original” state, so reveal can restore an older image rather than the latest source.

The website’s “sees every image” and “before it fully renders” statements are not supportable against this
implementation.

### 5. The image engine is intrinsically expensive

For each candidate image, the current implementation:

1. Creates a natural-resolution canvas.
2. Draws the whole image.
3. Copies all pixels through `getImageData`.
4. Runs the colour-space loop synchronously on the page’s main thread.
5. Writes all pixels back.
6. Encodes a lossless PNG.

The path begins at `extension/js/content/ImageProcessing.js:53`, scans at line 96, and PNG-encodes at line 218.

It has no:

- decoded-width, height, or total-pixel cap;
- downsampled analysis;
- tiling;
- bounded concurrency;
- backpressure;
- cancellation;
- worker;
- byte-budgeted cache.

The surrounding runtime adds whole-document mutation observation, hover polling, rectangle polling, iframe
polling, repeated timeouts, and synchronous layout reads. It also hides the entire body with opacity zero during
boot (`extension/js/content/js.js:207`), producing a flash of invisible content and a failure mode where page
content remains hidden.

### 6. Source and settings lifecycle has multiple races

Confirmed problems include:

- Eye “undo” can start filtering twice.
- Source changes clear only part of the previous element state.
- Reprocessing can retain old event-handler closures while preventing new handlers from attaching.
- Iframe polling timers are not all owned by controller cleanup.
- Global pause only sends “show images” to the active tab.
- Filter-colour changes reprocess only the active tab.
- Options changes write storage while existing content scripts retain cached settings and do not reconcile via
  `storage.onChanged`.
- Per-tab pause and exception state is held in service-worker arrays (`extension/js/background.js:1`) and disappears
  when the worker is terminated.
- Auto-unpause is opportunistic: it runs only when settings are read or navigation occurs. It has no durable alarm
  or broadcast.
- Several setters acknowledge success before persistence completes (`extension/js/background.js:945`).

### 7. Exception matching and sync storage are unsafe for growth

Permanent exceptions use arbitrary URL substring matching (`extension/js/background.js:235`). An exception such as
`example.com` can also match:

- `notexample.com`;
- a path containing that text;
- a query parameter containing that text.

Exceptions should compile into explicit exact-origin, hostname/subdomain, or URL-prefix rules.

The exception list and per-host display-mode map are each stored as one JSON string. Chrome currently gives
`storage.sync` roughly 100 KB total and 8 KB per item. An unbounded exception list can therefore fail while total
quota remains.

- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

Concurrent read-modify-write operations can lose updates, and multiple storage failures are ignored.

### 8. Raw blocklists cannot remain a worker-global JavaScript map

The packaged blocklist data contains:

- 23 text files;
- 2,148,464 total lines;
- 63,412,587 raw bytes;
- approximately 1,661,922 unique domains across all lists;
- approximately 961,431 unique domains in the mandatory Vice lists alone.

Runtime loading calls `response.text()`, `split('\n')`, and then constructs a large JavaScript `Map`
(`extension/js/content/DomainFilter.js:272`). This temporarily holds several representations of the same data and
must be repeated after worker termination or category changes.

Additional issues:

- A single failed list rejects the entire refresh.
- Overlapping domains retain only the last category, which can produce the wrong contextual redirect.
- Every category toggle reparses all enabled lists.
- List headers claim one-day expiration, while the large checked-out snapshots have May 2025 timestamps and were
  merely moved into `extension/` in 2026.
- The downloader uses mutable latest URLs, undeclared `requests`, and no revision pin, digest, provenance, schema
  validation, or whole-set atomicity.
- It catches partial failures and still prints that all blocklists were saved
  (`extension/download_blocklists.py:52`).

The upstream Block List Project has moved to a newer v2 workflow. A modern integration should consume pinned,
per-category domain data instead of treating mutable downloads as trusted build inputs.

- [Block List Project](https://github.com/blocklistproject/Lists)

### 9. The privileged fetch bridge is improved but still needs redesign

The recent hardening should be retained as a security specification. However, the bridge still lets an untrusted
page-side content script ask the worker to fetch arbitrary public image URLs under `<all_urls>` permission.

Residual risks include:

- public DNS names resolving to private addresses;
- no per-tab or global rate/concurrency limit;
- no decoded-dimension cap;
- duplicate `cache: no-store` downloads;
- conversion of as much as 10 MiB into a base64 data URL;
- copying that result through JSON messaging and back into page-side processing.

Chrome explicitly warns against exposing a privileged “fetch any URL” endpoint to content scripts and says
content-script messages must be treated as less trustworthy.

- [Chrome cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Chrome messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

V2 should process privileged results in an extension-owned compute context and return only the filtered mask or
result, not raw source bytes to page-controlled execution.

### 10. The current detector does not detect explicit content

The engine classifies fixed RGB, YCbCr, and HSV ranges. It does not recognize:

- people;
- poses;
- clothing;
- sexual context;
- explicit imagery;
- faces or facial features.

Consequences include false positives on skin-coloured objects and false negatives across lighting, colour grading,
compression, illustration, and human skin tones.

The “remove face features” setting merely bypasses one cheap RGB precondition
(`extension/js/content/ImageProcessing.js:106`). It is not face detection.

Additional confirmed semantic damage:

- Matching translucent pixels are forced fully opaque (`extension/js/content/ImageProcessing.js:183`).
- Animated images become static PNGs.
- PNG output can be much larger than JPEG or WebP input.

The product must first define what it means:

- If the policy is “cover all visible human skin,” a human/body-skin segmentation model may be the primary engine.
- If the policy is “cover sexualized or explicit imagery,” the correct sequence is semantic classification followed
  by segmentation to localize the cover.

MediaPipe’s Image Segmenter can produce human-region masks and should run in a worker on the web. It is not an
explicit-content classifier, and its person models have documented lighting, occlusion, and evaluation
limitations.

- [MediaPipe Image Segmenter](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js)

### 11. Accessibility remains incomplete

Examples include:

- The page eye is a mouse-only 16 px `div` without focus, a name, button semantics, or pressed state
  (`extension/js/content/Eye.js:22`).
- Exception deletion is a clickable `span` (`extension/js/options.js:266`).
- The generated free-text textarea lacks a label.
- Several settings rely on colour or title text.
- Content-script shortcuts use deprecated `keyCode`, have no browser command registration, and can collide with
  page or operating-system shortcuts.
- Popup vertical overflow is forcibly hidden.

Native controls, keyboard parity, visible focus, live status regions, accessible names, and `chrome.commands`
should be architectural requirements rather than retrofits.

### 12. The website and repository are not release-ready

#### Licensing and provenance

The website calls FitnaFilter “open source” and “MIT-spirited,” but the repository has no root `LICENSE`, `NOTICE`,
or third-party provenance inventory. Without a license, default copyright restrictions apply.

- [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)

Because this is inherited code, a new licence should not simply be placed over the entire tree. Before public
release:

1. Audit ownership of inherited code and assets.
2. Obtain permission or clean-room replace uncertain portions.
3. Select an appropriate licence.
4. Record blocklist and model licences separately.

#### Privacy statements

The site says every pixel remains on-device and that the only network calls are those the page already makes
(`website/home.html:715` and line 968).

That wording conflicts with:

- extension-initiated background image refetches;
- settings transmitted through Chrome Sync;
- external Quran redirects;
- Google Fonts requests from the website.

This does not prove telemetry, but the absolute statements are inaccurate. Chrome Web Store disclosure rules
require an honest description of locally handled and synchronized user data.

- [Chrome disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)

#### Website correctness

- `index.html` and `home.html` are byte-identical.
- Three public hosts serve duplicate content without a canonical host.
- No real 404, robots, sitemap, privacy page, or security contact exists.
- Cloudflare’s missing-404 behavior causes homepage `200` responses for arbitrary paths.
- The resulting live `/robots.txt` is approximately 75 KB because Cloudflare-managed rules are prepended to the
  homepage fallback.
- `[data-reveal]` content starts invisible (`website/home.css:737`), so JavaScript failure leaves substantial
  content hidden.
- Mobile navigation and then header actions disappear without a replacement menu.
- Slider semantics, selected-state announcements, contrast, skip navigation, and no-JavaScript behavior need work.
- `_headers` has useful `nosniff`, referrer, and permissions headers but no CSP, framing protection, or
  source-controlled HSTS policy (`website/_headers:1`).

- [Cloudflare Pages routing](https://developers.cloudflare.com/pages/configuration/serving-pages/)

## Ground-up architecture

```text
Build time
┌──────────────────┐
│ pinned blocklists│
└────────┬─────────┘
         ▼
normalize ─ validate ─ deduplicate ─ provenance manifest
         │
         ├── DNR category rulesets
         └── reviewable counts, hashes and release metadata

Runtime
popup/options ─ typed protocol ─ MV3 coordinator
                                      ├── storage
                                      ├── alarms
                                      ├── permissions
                                      └── DNR state

web document ─ candidate CSS ─ observers ─ bounded queue
                                             │
                                             ▼
                              worker/offscreen compute host
                                ├── decode/downsample
                                ├── heuristic gate
                                ├── semantic classifier
                                └── segmentation/mask
                                             │
                                             ▼
                               extension-owned visual overlay
```

## Repository and build system

Recommended foundation:

- A `pnpm` workspace.
- Strict TypeScript.
- WXT for extension entry points, manifests, multi-browser builds, and development ergonomics.
- Vanilla TypeScript or small web components for popup and options; React is unnecessary at the current UI
  complexity.
- Astro or another static generator for the website, with hydration limited to the interactive demonstration.
- Generated product metadata shared between extension, site, manifests, release notes, and tests.
- Pinned Node and package-manager versions with lockfiles.
- Packaged local JavaScript, WASM, and models only; MV3 prohibits remotely hosted executable code.

- [WXT](https://wxt.dev/)
- [Chrome remote-code policy](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)

Suggested layout:

```text
apps/
    extension/
    site/
packages/
    product-config/
    protocol/
    settings/
    vision/
    blocklist-compiler/
tests/
    extension-e2e/
    site-e2e/
    vision-benchmarks/
    fixtures/
docs/
    architecture/
    threat-model.md
    privacy-data-flow.md
    blocklist-policy.md
    release-process.md
```

## Manifest V3 coordinator

The service worker should be thin and restart-safe:

- Register every event listener synchronously at module top level.
- Use a versioned, idempotent initialization promise.
- Treat storage and DNR as authoritative; globals are caches only.
- Use discriminated, runtime-validated messages.
- Reject unknown message fields and types.
- Validate sender tab, document, frame, URL, origin, and permission state for privileged operations.
- Store compact preferences in `storage.sync`.
- Store larger metadata and durable global pause state in `storage.local`.
- Store per-tab and document transient state in `storage.session`.
- Use `chrome.alarms` for exact resume deadlines.
- Reconcile all open contexts through `storage.onChanged`.

## Permission model

Offer three explicit visual-filtering modes:

1. **This page:** `activeTab` and programmatic injection.
2. **Selected sites:** optional site-specific host permissions.
3. **Every site:** an explicit optional `<all_urls>` grant during onboarding.

Automatic all-site image inspection cannot be automatic and permissionless simultaneously. Chrome recommends
optional host permissions where practical.

- [Chrome permission guidance](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)

Network protection can operate independently through DNR.

## Network blocking

Use category-specific static DNR rulesets:

- `vice`
- `hazard`
- `distraction`

Then:

- Enable or disable categories with `updateEnabledRulesets()`.
- Use higher-priority dynamic `allow` rules for permanent exceptions.
- Use session `allowAllRequests` rules scoped to tab IDs for per-tab pauses.
- Redirect to an extension-owned blocked page explaining the category and offering “allow once,” “allow
  permanently,” and an explicit Quran link.
- Use `webNavigation` only for optional UI enrichment, never enforcement.

Current Chrome guarantees at least 30,000 static rules, permits 100 declared and 50 enabled static rulesets, 30,000
safe dynamic rules, and 5,000 session rules. `requestDomains` can contain multiple domains and matches subdomains,
but Chrome publishes no practical maximum array size.

- [Chrome DNR limits](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)

Before selecting the final backend, build a packed-extension experiment with the real approximately 961,000-domain
mandatory dataset and measure:

- installation and indexing time;
- browser startup;
- indexed ruleset size;
- matching correctness;
- enable/disable latency;
- browser memory;
- Chrome, Edge, and Brave compatibility.

If large chunked `requestDomains` rulesets are not robust, explicitly choose between:

- a curated high-confidence browser list;
- a separate DNS or managed-policy companion for full coverage;
- an opt-in reputation service with a documented privacy tradeoff.

Do not quietly fall back to an after-the-fact `webNavigation` redirect while describing it as equivalent blocking.

## Visual filtering engine

The new content controller should:

- Install candidate-media cover CSS at `document_start`.
- Never hide the entire body.
- Use `MutationObserver` only for relevant source and style changes.
- Use `IntersectionObserver` to prioritize visible media.
- Use `ResizeObserver` for responsive size changes.
- Maintain element state in a `WeakMap`:
  `{ source, generation, status, abortController, overlay }`.
- Batch mutations and layout work.
- Limit processing to one or two concurrent jobs per tab.
- Cancel jobs on source change, disconnection, navigation, or settings changes.
- Enforce encoded byte, decoded dimension, pixel, time, and memory limits.
- Downsample before classification.
- Process through a packaged worker or a Chrome offscreen document hosting a worker.

`chrome.offscreen` provides a hidden extension document, while `OffscreenCanvas` supports worker-side raster work.

- [Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- [MDN OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)

Preserve the page’s original `src`, `srcset`, `<picture>` sources, styles, load events, and accessibility tree.
Render a mask or cover through an isolated extension-owned Shadow DOM overlay. Reveal should toggle the overlay
instead of repeatedly rewriting host-page media sources.

Canvas, video, animation, Shadow DOM, pseudo-elements, authenticated media, and unsupported sources need explicit
product behavior rather than accidental bypass.

## Detection pipeline

If the objective is explicit-content protection:

1. Downsample.
2. Run a cheap colour or texture heuristic as a gate.
3. Run a local semantic classifier.
4. If above threshold, run human-region segmentation.
5. Render the selected mask.
6. Apply a configurable uncertainty policy:
   - strict cover;
   - placeholder;
   - progressive reveal.

The existing HSV and YCbCr logic can remain as a low-cost gate or compatibility fallback, not as the primary
meaning of “explicit.”

The evaluation corpus should cover:

- diverse skin tones;
- low light, high light, and backlighting;
- compression and colour grading;
- cartoons and art;
- medicine and sports;
- swimwear;
- crowds and partial bodies;
- skin-coloured objects;
- transparency and animation;
- false-colour imagery.

Track precision, recall, false-positive rate, p50 and p95 latency, peak decoded memory, and subgroup results. Browser
functional tests cannot substitute for a computer-vision benchmark.

## Privacy, security, and store viability

Create an explicit data-flow inventory covering:

- page and media URLs read;
- source images fetched;
- image data processed;
- settings synchronized;
- exceptions stored;
- block events;
- external navigation;
- diagnostics, if ever added.

Keep telemetry off by default. If added later, make it opt-in and exclude URLs and image content.

The Chrome Web Store expects a narrow, understandable purpose and narrow permissions. Image transformation plus a
23-category network blocker may still fit a single “online content protection” purpose, but it creates review and
consent risk. Prototype whether the blocker remains an optional module or becomes a separately distributed
companion.

- [Chrome Web Store quality guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines/)

## Testing and release system

Every pull request should require:

- Type checking, linting, formatting, and deterministic builds.
- Unit tests for settings, migrations, messages, colour conversion, masks, URL matching, domain normalization,
  internationalized domains, and DNR priorities.
- Property and fuzz tests for blocklist input, URLs, privileged messages, and source churn.
- Integration tests for rejected storage writes, sync quotas, concurrent changes, alarms, and extension updates.
- Persistent-Chromium E2E tests for dynamic images, `srcset`, `<picture>`, backgrounds, iframes, CORS, strict
  failures, SPA/BFCache behavior, permissions, pause/exceptions, and DNR redirects.
- Tests that explicitly terminate the service worker and repeat operations.
- Performance and leak budgets on mutation-heavy pages.
- A separate vision-quality benchmark suite.
- Website tests with JavaScript disabled, mobile widths, keyboard navigation, reduced motion, high contrast, real
  404s, canonical URLs, CSP, and privacy links.
- Testing the final ZIP, not only the source tree.

Chrome documents explicit service-worker termination testing:

- [Chrome worker-termination testing](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer)

Release from a clean tagged commit and produce:

- a deterministic extension ZIP;
- SHA-256 checksums;
- an SBOM and licence inventory;
- blocklist and model provenance manifests;
- release notes and changelog;
- a GitHub release;
- a Cloudflare preview;
- post-deployment hash and routing verification;
- staged Chrome Web Store publication.

## Keep versus replace

| Keep as requirements or assets | Replace |
|---|---|
| Product identity and visual assets | Worker-global state architecture |
| Filter-colour preference | `webNavigation` enforcement |
| Strict, placeholder, and progressive concepts | Raw runtime blocklist parsing |
| Vice, Hazard, and Distraction taxonomy | `js.js` polling/controller design |
| Popup/options information architecture | Source-swapping `domManipulation.js` pipeline |
| Fetch-guard security invariants and test | Base64 JSON image round-trips |
| `WeakSet` deduplication concept | Full-resolution main-thread scan as primary engine |
| Blob and resource cleanup behavior | Stringly typed messages and unversioned storage |
| Reduced-motion, focus, and forced-colour work | Manual website and release workflow |
| Historical QA scenarios | Historical machine-specific QA harness |

## Recommended migration order

1. **Freeze v1 architecture.** Accept only critical containment fixes. Do not add ML, DNR, TypeScript, or more
   source-mutation logic directly to the old globals.
2. **Resolve product and legal truth.** Define “skin” versus “explicit,” separate visual and network policies,
   audit inherited licensing, document data flows, and correct website claims.
3. **Create reproducible foundations.** Add the workspace, lockfiles, strict TypeScript, schemas, protocol,
   generated manifests, CI, and deterministic artifacts.
4. **Run architectural spikes.**
   - Full-scale DNR indexing.
   - Content worker versus offscreen compute host.
   - Overlay correctness on responsive media.
   - Candidate classifier and segmenter quality and size.
   - Permission onboarding.
5. **Build the restart-safe state layer.** Implement storage, alarms, migrations, permission modes, typed messages,
   and worker-termination tests.
6. **Implement DNR blocking and the validated blocklist compiler.**
7. **Implement the bounded visual pipeline and evaluated model.**
8. **Migrate UI and settings, then run parity, security, performance, and accessibility testing.**
9. **Repair and deploy the website through the new release workflow.**
10. **Retire v1 only after measured parity and a rollback-capable release.**

## Immediate next artifact

The first implementation artifact should be a checked-in v2 architecture and threat-model specification plus
four bounded prototypes:

1. DNR at the real list scale.
2. Worker versus offscreen computation.
3. A non-destructive overlay across responsive media.
4. Candidate classifier and segmentation quality.

Starting with another broad refactor of `background.js` or `js.js` would spend effort in the wrong architectural
layer.
