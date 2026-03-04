/**
 * Recognition Web Worker
 *
 * Handles the compute-heavy portion of the photo recognition pipeline:
 *   1. ImageBitmap → ImageData conversion (via OffscreenCanvas)
 *   2. pHash computation (32×32 DCT)
 *   3. Hamming distance matching against the hash database
 *   4. Frame quality metrics (sharpness, glare, lighting) when needed
 *
 * All imported algorithm functions (computePHash, hammingDistance, etc.) are
 * pure or use only OffscreenCanvas — no DOM dependencies.
 */

import { computePHash } from './algorithms/phash';
import { hammingDistance } from './algorithms/hamming';
import { computeAllQualityMetrics } from './algorithms/utils';
import type {
  MainToWorkerMessage,
  WorkerFrameResult,
  WorkerHashEntry,
  WorkerMatchResult,
  WorkerRecognitionConfig,
  WorkerToMainMessage,
} from './worker-protocol';

// ---------------------------------------------------------------------------
// Worker state
// ---------------------------------------------------------------------------

let hashEntries: WorkerHashEntry[] = [];
let config: WorkerRecognitionConfig | null = null;

/**
 * Reusable OffscreenCanvas instances — allocated once, resized per-frame.
 * The 2D context is requested with `willReadFrequently` to hint that
 * getImageData() is called on every frame.
 */
let hashCanvas: OffscreenCanvas | null = null;
let hashCtx: OffscreenCanvasRenderingContext2D | null = null;
let qualityCanvas: OffscreenCanvas | null = null;
let qualityCtx: OffscreenCanvasRenderingContext2D | null = null;

/**
 * pHash internal DCT size — MUST equal phash.ts `DCT_SIZE` (currently 32).
 *
 * The worker draws the incoming bitmap at exactly PHASH_SIZE × PHASH_SIZE and
 * passes the resulting ImageData directly to `computePHash`. Inside
 * `computePHash`, `resizeImageData` detects that the input already matches the
 * target size and returns early — avoiding the `document.createElement('canvas')`
 * call that would throw in a Worker context.
 *
 * If PHASH_SIZE ever diverges from phash.ts `DCT_SIZE`, that short-circuit no
 * longer fires and the worker will crash. Consider importing DCT_SIZE directly
 * if phash.ts ever exports it as a named constant.
 */
const PHASH_SIZE = 32;

/** Quality capture size — match usePhotoRecognition QUALITY_CAPTURE_SIZE. */
const QUALITY_SIZE = 128;

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

function ensureHashCanvas(): OffscreenCanvasRenderingContext2D {
  if (!hashCanvas || !hashCtx) {
    hashCanvas = new OffscreenCanvas(PHASH_SIZE, PHASH_SIZE);
    hashCtx = hashCanvas.getContext('2d', {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D;
    if (!hashCtx) {
      throw new Error('Failed to get 2D context for hash OffscreenCanvas');
    }
  }
  return hashCtx;
}

function ensureQualityCanvas(): OffscreenCanvasRenderingContext2D {
  if (!qualityCanvas || !qualityCtx) {
    qualityCanvas = new OffscreenCanvas(QUALITY_SIZE, QUALITY_SIZE);
    qualityCtx = qualityCanvas.getContext('2d', {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D;
    if (!qualityCtx) {
      throw new Error('Failed to get 2D context for quality OffscreenCanvas');
    }
  }
  return qualityCtx;
}

// ---------------------------------------------------------------------------
// Matching — worker-local variant of findBestMatches using concertId
// ---------------------------------------------------------------------------

interface WorkerMatchCandidate {
  concertId: number;
  distance: number;
}

function findBestMatches(
  currentHash: string,
  entries: ReadonlyArray<WorkerHashEntry>
): { bestMatch: WorkerMatchCandidate | null; secondBestMatch: WorkerMatchCandidate | null } {
  let bestMatch: WorkerMatchCandidate | null = null;
  let secondBestMatch: WorkerMatchCandidate | null = null;

  for (const { hash, concertId } of entries) {
    const distance = hammingDistance(currentHash, hash);
    if (!bestMatch || distance < bestMatch.distance) {
      if (bestMatch && bestMatch.concertId !== concertId) {
        secondBestMatch = bestMatch;
      }
      bestMatch = { concertId, distance };
    } else if (
      concertId !== bestMatch.concertId &&
      (!secondBestMatch || distance < secondBestMatch.distance)
    ) {
      secondBestMatch = { concertId, distance };
    }
  }

  return { bestMatch, secondBestMatch };
}

// ---------------------------------------------------------------------------
// Frame processing
// ---------------------------------------------------------------------------

function processFrame(bitmap: ImageBitmap, frameId: number): WorkerFrameResult {
  const startMs = performance.now();

  // 1. Draw bitmap at 32×32 for pHash — resizeImageData will short-circuit
  const hCtx = ensureHashCanvas();
  hashCanvas!.width = PHASH_SIZE;
  hashCanvas!.height = PHASH_SIZE;
  hCtx.drawImage(bitmap, 0, 0, PHASH_SIZE, PHASH_SIZE);
  const hashImageData = hCtx.getImageData(0, 0, PHASH_SIZE, PHASH_SIZE);

  // 2. Compute pHash (resize is a no-op since input is already 32×32)
  const hash = computePHash(hashImageData);

  // 3. Find best matches
  const { bestMatch, secondBestMatch } = findBestMatches(hash, hashEntries);

  // 4. Determine if quality checks are needed, mirroring the main-thread condition:
  //    shouldRunQualityCheck = !bestMatch || !activeMatch || distance > gatingThreshold
  //
  // We replicate the active-match decision here so quality always runs for
  // ambiguous candidates (within threshold but failing margin / tie checks) —
  // same as the inline pipeline.
  const cfg = config!;
  const isWithinThreshold = !!bestMatch && bestMatch.distance <= cfg.similarityThreshold;
  let activeMatchExists = false;
  if (isWithinThreshold) {
    const bestMargin =
      bestMatch && secondBestMatch ? secondBestMatch.distance - bestMatch.distance : null;
    const marginBoost =
      bestMatch && bestMatch.distance >= Math.max(cfg.similarityThreshold - 1, 0) ? 1 : 0;
    const effectiveMarginRequired = cfg.matchMarginThreshold + marginBoost;
    const hasSufficientMargin = bestMargin === null || bestMargin >= effectiveMarginRequired;
    const isExactCrossConcertTie =
      secondBestMatch !== null && bestMatch!.distance === secondBestMatch.distance;
    activeMatchExists = hasSufficientMargin && !isExactCrossConcertTie;
  }
  const shouldRunQuality =
    !bestMatch || !activeMatchExists || bestMatch.distance > cfg.qualityGatingDistanceThreshold;

  let quality: WorkerFrameResult['quality'] = null;

  if (shouldRunQuality) {
    // Draw bitmap at 128×128 for quality metrics
    const qCtx = ensureQualityCanvas();
    qualityCanvas!.width = QUALITY_SIZE;
    qualityCanvas!.height = QUALITY_SIZE;
    qCtx.drawImage(bitmap, 0, 0, QUALITY_SIZE, QUALITY_SIZE);
    const qualityImageData = qCtx.getImageData(0, 0, QUALITY_SIZE, QUALITY_SIZE);

    const metrics = computeAllQualityMetrics(
      qualityImageData,
      cfg.quality.sharpnessThreshold,
      cfg.quality.glareThreshold,
      cfg.quality.glarePercentageThreshold,
      cfg.quality.minBrightness,
      cfg.quality.maxBrightness
    );

    quality = metrics;
  }

  // 5. Release bitmap memory
  bitmap.close();

  const toResult = (m: WorkerMatchCandidate | null): WorkerMatchResult | null =>
    m ? { concertId: m.concertId, distance: m.distance } : null;

  return {
    type: 'result',
    frameId,
    hash,
    bestMatch: toResult(bestMatch),
    secondBestMatch: toResult(secondBestMatch),
    quality,
    processingMs: performance.now() - startMs,
  };
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'init': {
        hashEntries = msg.hashEntries;
        config = msg.config;

        // Pre-allocate canvases
        ensureHashCanvas();
        ensureQualityCanvas();

        const ready: WorkerToMainMessage = {
          type: 'ready',
          hashCount: hashEntries.length,
        };
        self.postMessage(ready);
        break;
      }

      case 'config-update': {
        config = msg.config;
        break;
      }

      case 'frame': {
        if (!config || hashEntries.length === 0) {
          const error: WorkerToMainMessage = {
            type: 'error',
            message: 'Worker not initialized — cannot process frame',
            frameId: msg.frameId,
          };
          self.postMessage(error);
          return;
        }

        const result = processFrame(msg.bitmap, msg.frameId);
        self.postMessage(result);
        break;
      }
    }
  } catch (err) {
    const error: WorkerToMainMessage = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      frameId: msg.type === 'frame' ? msg.frameId : undefined,
    };
    self.postMessage(error);
  }
};
