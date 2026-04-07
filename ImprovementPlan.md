• Goal State

  - FitnaFilter supports hybrid detection: (1) fast heuristic skin metrics/masks and (2) ML-based NSFW classification (and optionally
    localization), with clear user modes.
  - FitnaFilter supports multiple effects: pixel replacement (current), whole-image blur, selective blur (mask/boxes), pixelation, and “smart
    filters” (feathering, edge smoothing, face/hands focus).
  - FitnaFilter is efficient by design: visibility-aware processing, downsample-first decisioning, bounded concurrency, aggressive caching, and
    minimal main-thread jank.
  - ML runs locally using open weights bundled with the extension (no proprietary HaramBlur models; their src/mdls/ is explicitly not reusable).

  High-Level Roadmap (Hand-Off Ready)

  - Milestone 1: Effects system + blur (no ML) + UI toggles
  - Milestone 2: Performance overhaul of current pipeline (still heuristic)
  - Milestone 3: Offscreen “Detection/Render Service” + port-based queue + caching
  - Milestone 4: ML NSFW classifier integration + hybrid decision rules
  - Milestone 5: Localization (person boxes or segmentation) + selective blur
  - Milestone 6: “Smart filters” polish + QA harness + optional video track

  Target Architecture (Proposed)

  - Keep existing FitnaFilter modules and refactor around a new “pipeline core”:
      - Content script (per frame): discovers candidates + applies results to DOM (still owns Eye, Suspects, ImagesDisplayer).
      - Background service worker: settings, exclusions, cross-origin fetch fallback, and (new) offscreen lifecycle management.
      - Offscreen document (new): runs ML models, heavy image decode/resize, optional render-to-bytes (blurred output), persistent cache.
  - New core modules (names are suggestions):
      - FitnaFilter/src/js/content/PipelineController.js (new): queue, caching, scheduling, and “ask offscreen for decision/render”.
      - FitnaFilter/src/js/content/Effects.js (new): applies CSS blur and/or replaces src/background-image with blob URLs.
      - FitnaFilter/src/js/content/ImageProcessing.js (existing): becomes a pure library (computeSkinMask, computeSkinRatio, applyMaskEffect)
        with settings passed in (no global settings dependency).
      - FitnaFilter/src/js/offscreen/offscreen.html + FitnaFilter/src/js/offscreen/offscreen.js (new): ML init, detection queue, cache, optional
        rendering.

  Data Flow (Images)

  - Step A (discover): existing ProcessWin (FitnaFilter/src/js/content/js.js) keeps scanning <img> + CSS backgrounds and watching mutations.
  - Step B (resolve source): for each candidate build a WorkItem:
      - elementUuid (existing skf-uuid)
      - kind: img | background
      - source: currentSrc/src for <img>, parsed URL(s) + suffix for backgrounds
      - dimensions: naturalWidth/Height + display size
      - originType: http(s) | data: | blob: | file: (handle separately)
  - Step C (cheap gating in content script):
      - Skip if excluded/paused (existing logic).
      - Skip if too small (existing maxSafe behavior, but rename semantics—see Settings).
      - Use IntersectionObserver to delay offscreen work until visible/near-viewport.
  - Step D (offscreen request via port):
      - Content script sends detectImage request to offscreen (not one-off sendMessage; use a long-lived port like HaramBlur for throughput).
  - Step E (offscreen decision):
      - Offscreen fetches/decodes image (or uses provided bytes), downscales, runs detectors, returns a decision:
          - decision: SAFE | NSFW | MODESTY_TRIGGERED | ERROR
          - scores: nsfwScore, skinRatio, per-class probs (optional)
          - localization: boxes and/or mask metadata (optional)
          - rendered: optional bytes for “rewrite image” mode
  - Step F (apply):
      - Content script applies effect:
          - Fast mode: CSS class blur/pixelate (no rewriting).
          - Strong mode: replace img.src / background URL with blob: built in page context from returned bytes; store original for reveal.

  Hybrid Detection Strategy (Both Skin + ML)

  - Introduce a user-facing mode enum (stored in chrome.storage.sync):
      - mode = "modesty": act primarily on skin metrics/masks
      - mode = "nsfw": act primarily on ML NSFW classifier
      - mode = "hybrid": combine with explicit rules (below)
  - Recommended hybrid rules (tunable):
      - Compute skinRatioEstimate cheaply (downsample + sampling grid).
      - Run nsfwScore (ML classifier) if:
          - mode is nsfw or hybrid, AND
          - image size is above a minimum (e.g., 96px), AND
          - not already cached
      - Decide:
          - If nsfwScore >= nsfwThresholdHigh: block (NSFW)
          - Else if mode == modesty: block if skinRatio >= skinThreshold
          - Else if mode == hybrid:
              - Block if nsfwScore >= nsfwThresholdMid
              - Or block if (skinRatio >= skinThresholdHigh AND nsfwScore >= nsfwThresholdLow) (catches “suggestive but not porn”)
              - Or allow if nsfwScore <= nsfwSafeThreshold even when skin is high (reduces false positives for normal photos)
  - Localization escalation (optional but powerful):
      - If decision is “block” and user selected “selective blur”, run second-stage localization:
          - Person boxes (COCO-SSD) OR person segmentation (MediaPipe Selfie Segmentation)
          - Then apply skin mask only inside person region to reduce beige/wood false positives.

  Effects / Filters (Pluggable, Extendable)

  - Define an “effect pipeline” that can operate with:
      - No mask (whole-image effects)
      - A binary/soft mask (skin/person segmentation)
      - Bounding boxes (person detector, future nude-part detector)
  - Effects to implement (in priority order):
      - pixelReplace (existing): keep for low-end devices and “hard censor” style
      - cssBlur (new, fastest): apply filter: blur(px) grayscale(...) via class; easy, but weaker against user tampering
      - canvasBlurWhole (new): render-blurred output and replace image data (stronger)
      - canvasBlurMasked (new): blur only masked pixels, feather edges
      - pixelateWhole / pixelateMasked (new): downscale-upscale effect, cheaper than blur for huge images
      - patternOverlay (new): overlay repeated texture (similar to censorship patterns) for “strong modesty” UX
  - Key algorithm notes for masked blur:
      - Create blurred version once (ctx.filter = 'blur(...)') on an offscreen canvas.
      - Composite blurred overlay onto original using a mask canvas (destination-in) with feathered alpha.
      - Feathering: blur/dilate mask edges so transitions aren’t harsh (“smart filter” feel).

  Performance Plan (Concrete Tactics)

  - Candidate selection:
      - Add IntersectionObserver to process only visible/near-visible elements; fall back when unsupported.
      - Avoid processing the same element repeatedly: store lastProcessedKey on the element (URL + size + settings hash).
  - Heuristic skin detection efficiency:
      - Add computeSkinRatioEstimate(imageData, sampleStep):
          - Sample every Nth pixel (e.g., 4–12 depending on downsample size).
          - Early exit if ratio exceeds threshold (“already needs block”) or if max possible remaining can’t reach threshold.
      - Only compute a full-resolution mask when needed:
          - if ratioEstimate < skinThresholdLow: skip mask
          - if ratioEstimate >= skinThresholdHigh: compute mask but at moderate resolution
  - Scheduling:
      - Use requestIdleCallback (with timeout) or chunked processing loops to avoid long blocking loops.
      - Bounded concurrency:
          - In content scripts: max 1–2 in-flight offscreen requests per frame.
          - In offscreen: max N decode tasks + max M inference tasks (separate queues).
  - Caching (biggest win):
      - Content-script cache: per element + per URL, short-lived (in-memory).
      - Offscreen cache: LRU keyed by normalized URL + dimensions + settingsKey (similar concept to HaramBlur):
          - Normalize URLs by stripping utm_*, fbclid, timestamps, etc.
          - Persist recent results in IndexedDB (optional but recommended once ML is in).
  - Decode/resample strategy:
      - Prefer createImageBitmap(blob) in offscreen for decode (fast, off-main-thread).
      - Use OffscreenCanvas for resizing and to avoid DOM canvas overhead.
  - Memory hygiene:
      - Keep FitnaFilter’s existing object URL revocation pattern.
      - Avoid base64 data: unless necessary; prefer transferring ArrayBuffer and creating a page-origin blob: URL in the content script.

  Offscreen + ML Plan (MV3-Compatible)

  - Manifest changes (FitnaFilter/src/manifest.json):
      - Add "offscreen" permission.
      - Add an offscreen document entry point managed by background (not a static manifest key; MV3 uses chrome.offscreen.createDocument).
      - Add CSP updates if needed by the chosen ML runtime (TFJS WASM often needs wasm-unsafe-eval; plan for this explicitly).
  - Background responsibilities (FitnaFilter/src/js/background.js):
      - Create/recreate offscreen document on demand and on errors.
      - Own a “detector readiness” state and respond to content scripts if offscreen is unavailable (fallback to heuristic-only).
      - Optionally centralize cross-origin fetch if offscreen fetch hits CORS edge cases (keep your current fetchAndReadImage as fallback).
  - Offscreen responsibilities (new):
      - Load ML models from local extension paths (recommended) under something like FitnaFilter/src/models/....
      - Warm up models at startup (one dummy inference).
      - Provide a port listener chrome.runtime.onConnect:
          - name: "fitna-img-det-port"
          - Handle detectImage messages.
      - Maintain:
          - Decode queue
          - Inference queue
          - Render queue (if “strong mode”)
          - LRU + optional IndexedDB persistence
  - Recommended ML baseline (open weights):
      - nsfwjs (TFJS) for classification: simple integration, good-enough baseline.
      - Later: person localization via @tensorflow-models/coco-ssd (boxes) or MediaPipe Selfie Segmentation (mask).
      - Keep ML optional and user-toggleable; default to privacy-preserving “local models only”.

  Settings + UI Plan (Detailed)

  - Add/rename settings (stored in chrome.storage.sync):
      - filterMode: "modesty" | "nsfw" | "hybrid"
      - effectMode: "pixelReplace" | "cssBlur" | "canvasBlurWhole" | "canvasBlurMasked" | "pixelate" | "pattern"
      - blurAmount: number (e.g., 5–40)
      - grayscale: boolean
      - skinThreshold: number (0–1) for mask triggers
      - nsfwThreshold: number (0–1) + optional high/low thresholds for hybrid
      - mlEnabled: boolean
      - mlModel: string (model id/version)
      - localizationEnabled: boolean (person boxes/mask)
      - localizationMode: "personBoxes" | "personMask" | "skinInsidePerson"
      - Keep existing: urlList, isNoEye, isNoFaceFeatures, pause settings
  - Update Options UI (FitnaFilter/src/options.html, FitnaFilter/src/js/options.js):
      - New section “Detection Mode”: modesty/nsfw/hybrid
      - New section “Blocking Style”: effectMode + blurAmount + grayscale
      - New section “ML”: enable ML, choose model, show local-only notice, show warmup status
      - New section “Advanced”: thresholds, caching toggle, “debug overlay” toggle
  - Update Popup (FitnaFilter/src/popup.html, FitnaFilter/src/js/popup.js):
      - Quick toggles: Mode, ML on/off, Effect: fast/strong
      - Keep “Show Images” but consider adding optional “Require confirm/password” later if you want harder bypass.

  Build/Packaging Options (Pick One Up Front)

  - Option A (minimal tooling): drop prebuilt JS bundles for TFJS/nsfwjs into FitnaFilter/src/js/vendor/ and load them in offscreen via <script>
    tags.
      - Pros: fastest to ship
      - Cons: large files, manual updates, harder to tree-shake
  - Option B (recommended modernization): introduce a small build (Vite/esbuild) that outputs dist/ and copies src/manifest.json, HTML, models,
    assets.
      - Pros: manageable dependencies, easier model/version upgrades, cleaner module code
      - Cons: adds build step + repo complexity

  Testing + Benchmarking Plan

  - Add a “debug mode” (local storage flag) that logs per-image timings and cache hits.
  - Manual test matrix:
      - Images: tiny icons, large photos, blurred backgrounds, multiple CSS backgrounds, lazy-loaded images, blob: images, data: images, cross-
        origin images without CORS headers.
      - Pages: infinite scroll, heavy DOM mutation (social feeds), iframes (same-origin + cross-origin).
  - Correctness metrics (for ML track):
      - False positive rate on normal photos
      - False negative rate on explicit images
      - “Time to first block” on first page load
      - CPU time per image (median/p95), memory growth over 5–10 minutes
  - Performance acceptance targets (example):
      - No main-thread long task > 50ms attributable to filtering on typical pages
      - Cache hit rate > 60% on scroll-back scenarios
      - ML inference under ~50–100ms per image on common hardware (varies by backend)

  Milestone Breakdown (Ticket-Level)

  - Milestone 1: Effects + Blur (Heuristic Only)
      - Ticket: Refactor ImageProcessing.js to accept settings as args (remove implicit global dependency).
      - Ticket: Add effectMode + blurAmount plumbing in background/settings messages.
      - Ticket: Implement cssBlur application (class + injected style) for <img> and background elements.
      - Ticket: Implement canvasBlurWhole output path (render + replace).
      - Ticket: Update Eye reveal/restore to work across all effect modes.
      - Acceptance: user can switch between pixelReplace and blur without breaking reveal/undo.
  - Milestone 2: Performance Overhaul (Still No ML)
      - Ticket: Add IntersectionObserver gating for processing.
      - Ticket: Add per-element lastProcessedKey to avoid redundant work.
      - Ticket: Implement computeSkinRatioEstimate + early exit; only full processing when needed.
      - Ticket: Add bounded in-page queue + idle scheduling (replace “process everything immediately” behavior).
      - Acceptance: heavy pages no longer “flash blank” or stall; CPU drops noticeably.
  - Milestone 3: Offscreen Detection/Render Service
      - Ticket: Add offscreen doc creation in background.js and health checks/recreate logic.
      - Ticket: Define port protocol (fitna-img-det-port) with request ids and reconnection behavior.
      - Ticket: Move heavy render (canvas blur) into offscreen (optional at first); content script becomes “apply results”.
      - Ticket: Implement LRU cache in offscreen + URL normalization.
      - Acceptance: repeated images reuse cached decisions; offscreen survives restarts.
  - Milestone 4: ML NSFW Classifier + Hybrid Mode
      - Ticket: Bundle chosen open model(s) locally and load in offscreen.
      - Ticket: Add ML enable toggle + strictness thresholds in settings/UI.
      - Ticket: Implement hybrid decision rules (documented, testable).
      - Ticket: Add “fail-open vs fail-closed” behavior choice (default fail-open for usability).
      - Acceptance: ML blocks obvious NSFW images; false positives are lower than skin-only mode.
  - Milestone 5: Localization + Selective Blur
      - Ticket: Add person boxes (COCO-SSD) OR person mask (Selfie Segmentation).
      - Ticket: Add selective blur renderer using boxes/mask; option to restrict skin mask to person region.
      - Ticket: Add optional debug overlay (draw boxes/mask) for tuning.
      - Acceptance: selective blur reduces over-blocking of beige/skin-like backgrounds while still blocking people.
  - Milestone 6: Smart Filters + Polish
      - Ticket: Feathered masks, dilation/erosion options, edge smoothing presets.
      - Ticket: Better handling of complex CSS backgrounds (preserve suffixes—keep your current advantage).
      - Ticket: Add “model versioning” and optional offline update mechanism (only if you want it).
      - Acceptance: effects look clean, minimal artifacts, stable over long browsing sessions.

  Risks / Decisions Needed Early

  - Whether to adopt a build system (strongly affects ML integration effort).
  - Whether “strong mode” must rewrite image bytes (harder bypass, more bandwidth/memory) or CSS-only blur is acceptable.
  - Choice of localization approach (boxes vs segmentation) and its licensing/packaging constraints.
  - Default UX posture: strict (more blocking) vs balanced (fewer false positives).

  If you tell me your preference for (1) build system yes/no and (2) which open NSFW model family you’re leaning toward, I can turn this into a
  concrete folder/file skeleton plan (exact new files, exact message shapes, exact settings keys) matching your current code style.