# Plan: Optimize Photo Recognition Speed

## Problem

Recognition is slow enough that users aren't confident the app will work. Given two key facts:

1. **Zero mis-recognitions ever** — accuracy is already perfect
2. **Images are always 4x6/6x4** — fixed, known aspect ratio

The system is over-cautious. We should trade excess accuracy margin for speed.

## Root Causes of Perceived Slowness

### 1. Quality filtering rejects valid frames, delaying recognition

When `bestMatch.distance > 8`, the system runs blur/glare/lighting checks. If any fail, the frame is **discarded entirely** — resetting all match tracking and forcing the pipeline to start over. With zero mis-recognitions, these rejections are false negatives that waste time.

### 2. Redundant grayscale conversions (4× per frame!)

Quality filtering calls `toGrayscale()` **four separate times** on the same frame:

- `computeLaplacianVariance()` → `toGrayscale()`
- `detectGlare()` → `toGrayscale()`
- `calculateAverageBrightness()` → `toGrayscale()`
- `detectPoorLighting()` → `calculateAverageBrightness()` → `toGrayscale()`

Plus once more in `computePHash()`. That's **5 full-frame grayscale conversions** per frame.

### 3. Frame captured at full resolution, then thrown away

The framed region is captured at full camera resolution (e.g., 600×400+ pixels), all pixel data extracted via `getImageData()`, then `computePHash()` immediately resizes to 32×32. The intermediate large ImageData is wasted work.

### 4. `resizeImageData()` creates 2 new canvas DOM elements every frame

`document.createElement('canvas')` is called twice per pHash computation — expensive DOM operations in a hot loop.

### 5. Confirmation takes too long

- `INSTANT_DISTANCE_THRESHOLD = 5` — only 8% of the distance range gets instant confirmation
- `CONSECUTIVE_MATCHES_FOR_INSTANT_CONFIRM = 2` — needs 2 frames at 80ms tracking = 160ms minimum
- `DEFAULT_RECOGNITION_DELAY = 300ms` — fallback dwell time adds 300ms
- `DEFAULT_CHECK_INTERVAL = 180ms` — at idle, only 5.5 fps; first match takes 180ms just to start

### 6. `toGrayscale()` returns boxed `number[]` instead of typed array

Pushing to a JS array with boxing overhead is slower than pre-allocated `Uint8Array`.

---

## Changes

### Change 1: Capture frames at reduced resolution for hashing

**File:** `src/modules/photo-recognition/usePhotoRecognition.ts` (lines 606–622)

Instead of capturing the framed region at full camera resolution, draw it directly to a small canvas (e.g., 64×64). The browser's canvas `drawImage()` handles downscaling with hardware acceleration, and `computePHash()` will resize 64×64→32×32 which is nearly free. This eliminates extracting hundreds of thousands of pixels just to throw them away.

- Set canvas to 64×64 (or a small intermediate size) before `drawImage()`
- `getImageData()` then returns only 4,096 pixels instead of potentially 200,000+

**Impact:** ~10-50× fewer pixels to extract and process per frame.

### Change 2: Raise quality gating threshold to skip quality checks for all matches

**File:** `src/modules/photo-recognition/usePhotoRecognition.ts` (line 77)

Change `QUALITY_GATING_DISTANCE_THRESHOLD` from `8` to `12` (matching the similarity threshold). Since we've never had a mis-recognition, quality checks only cause false rejections. Any match within the similarity threshold should skip quality filtering entirely.

**Impact:** Eliminates the most expensive per-frame operations (Laplacian convolution, glare scan, brightness calc) for all matching frames.

### Change 3: Fix redundant grayscale conversions in quality utils

**File:** `src/modules/photo-recognition/algorithms/utils.ts`

Even though Change 2 reduces how often quality checks run, fix the underlying inefficiency for non-matching frames:

- Add a `computeFrameQuality()` function that computes grayscale once and passes it to all three checks
- Update `computeLaplacianVariance`, `detectGlare`, `calculateAverageBrightness` to accept an optional pre-computed grayscale array
- Update `processQualityFilters` in `usePhotoRecognition.ts` to use the combined function

**Impact:** 4× reduction in grayscale conversion work when quality checks do run.

### Change 4: Reuse canvas elements in `resizeImageData()`

**File:** `src/modules/photo-recognition/algorithms/utils.ts` (lines 15–48)

Cache the source and target canvas elements at module scope instead of creating new DOM elements on every call.

**Impact:** Eliminates 2 DOM element creations per frame.

### Change 5: Use `Uint8Array` for grayscale data

**File:** `src/modules/photo-recognition/algorithms/utils.ts` (lines 64–80)

Replace `number[]` return type with `Uint8Array`. Pre-allocate the array and use index assignment instead of `push()`.

**Impact:** Better memory locality, no boxing overhead, faster iteration in DCT.

### Change 6: Speed up confirmation thresholds

**File:** `src/modules/photo-recognition/usePhotoRecognition.ts`

Tune thresholds given perfect accuracy track record:

- `INSTANT_DISTANCE_THRESHOLD`: 5 → 8 (matches within ~88% similarity confirm instantly)
- `DEFAULT_CHECK_INTERVAL`: 180 → 120ms (8.3 fps idle instead of 5.5 fps)
- `DEFAULT_RECOGNITION_DELAY`: 300 → 200ms (faster fallback confirmation)

These are conservative changes — the instant threshold is still well within the 12-distance similarity threshold, and the reduced delay still debounces accidental camera sweeps.

**Impact:** Fastest path to confirmation drops from ~360ms to ~120ms. Fallback path drops from ~480ms to ~320ms.

### Change 7: Optimize pHash to avoid intermediate string allocations

**File:** `src/modules/photo-recognition/algorithms/phash.ts` (lines 142–149)

Replace the binary string concatenation + `binaryToHex()` conversion with direct hex computation from the coefficient comparisons. Build the hex string directly using nibble-at-a-time logic instead of building a 63-char binary string first.

**Impact:** Eliminates string allocations and a conversion pass in the hot path.

---

## Order of Implementation

1. Change 6 (thresholds) — simplest, biggest user-perceived impact
2. Change 2 (quality gating) — one-line change, large impact
3. Change 1 (reduced capture resolution) — moderate complexity, large impact
4. Change 4 (reuse canvases) — small change, good impact
5. Change 5 (typed array grayscale) — moderate change, good impact
6. Change 3 (combined quality function) — moderate complexity, safety net
7. Change 7 (pHash string optimization) — small impact, nice cleanup

## Testing Strategy

- All existing tests must continue to pass (pHash values should not change since algorithm is unchanged, just implementation details)
- Run `npm run pre-commit` before committing
- Changes 5 and 7 affect pHash internals — verify hash output hasn't changed via existing algorithm tests
