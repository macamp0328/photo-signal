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
  WorkerPerspectiveFrameData,
  WorkerPoint,
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
let sourceCanvas: OffscreenCanvas | null = null;
let sourceCtx: OffscreenCanvasRenderingContext2D | null = null;
let imageDataCanvas: OffscreenCanvas | null = null;
let imageDataCtx: OffscreenCanvasRenderingContext2D | null = null;

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
const MAX_PERSPECTIVE_SOURCE_DIMENSION = 256;

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

function ensureSourceCanvas(width: number, height: number): OffscreenCanvasRenderingContext2D {
  if (!sourceCanvas || !sourceCtx) {
    sourceCanvas = new OffscreenCanvas(width, height);
    sourceCtx = sourceCanvas.getContext('2d', {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D;
    if (!sourceCtx) {
      throw new Error('Failed to get 2D context for source OffscreenCanvas');
    }
  }

  if (sourceCanvas.width !== width || sourceCanvas.height !== height) {
    sourceCanvas.width = width;
    sourceCanvas.height = height;
  }

  return sourceCtx;
}

function ensureImageDataCanvas(width: number, height: number): OffscreenCanvasRenderingContext2D {
  if (!imageDataCanvas || !imageDataCtx) {
    imageDataCanvas = new OffscreenCanvas(width, height);
    imageDataCtx = imageDataCanvas.getContext('2d', {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D;
    if (!imageDataCtx) {
      throw new Error('Failed to get 2D context for image-data OffscreenCanvas');
    }
  }

  if (imageDataCanvas.width !== width || imageDataCanvas.height !== height) {
    imageDataCanvas.width = width;
    imageDataCanvas.height = height;
  }

  return imageDataCtx;
}

function solveLinearSystem8x8(matrix: number[][], rhs: number[]): number[] | null {
  const n = 8;
  const augmented = matrix.map((row, idx) => [...row, rhs[idx]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(augmented[col][col]);

    for (let row = col + 1; row < n; row++) {
      const value = Math.abs(augmented[row][col]);
      if (value > maxAbs) {
        maxAbs = value;
        pivotRow = row;
      }
    }

    if (maxAbs < 1e-10) {
      return null;
    }

    if (pivotRow !== col) {
      const temp = augmented[col];
      augmented[col] = augmented[pivotRow];
      augmented[pivotRow] = temp;
    }

    const pivot = augmented[col][col];
    for (let j = col; j <= n; j++) {
      augmented[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) {
        continue;
      }

      const factor = augmented[row][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  return augmented.map((row) => row[n]);
}

function computeHomography(dst: WorkerPoint[], src: WorkerPoint[]) {
  const matrix: number[][] = [];
  const rhs: number[] = [];

  for (let i = 0; i < 4; i++) {
    const x = dst[i].x;
    const y = dst[i].y;
    const u = src[i].x;
    const v = src[i].y;

    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    rhs.push(u);

    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    rhs.push(v);
  }

  const solved = solveLinearSystem8x8(matrix, rhs);
  if (!solved) {
    return null;
  }

  return {
    h11: solved[0],
    h12: solved[1],
    h13: solved[2],
    h21: solved[3],
    h22: solved[4],
    h23: solved[5],
    h31: solved[6],
    h32: solved[7],
  };
}

function sampleBilinear(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number
): [number, number, number, number] {
  const clampedX = Math.max(0, Math.min(sourceWidth - 1, x));
  const clampedY = Math.max(0, Math.min(sourceHeight - 1, y));

  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(sourceWidth - 1, x0 + 1);
  const y1 = Math.min(sourceHeight - 1, y0 + 1);

  const tx = clampedX - x0;
  const ty = clampedY - y0;

  const idx00 = (y0 * sourceWidth + x0) * 4;
  const idx10 = (y0 * sourceWidth + x1) * 4;
  const idx01 = (y1 * sourceWidth + x0) * 4;
  const idx11 = (y1 * sourceWidth + x1) * 4;

  const channels: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const v00 = source[idx00 + c];
    const v10 = source[idx10 + c];
    const v01 = source[idx01 + c];
    const v11 = source[idx11 + c];

    const top = v00 + (v10 - v00) * tx;
    const bottom = v01 + (v11 - v01) * tx;
    channels[c] = top + (bottom - top) * ty;
  }

  return channels;
}

function isPerspectiveValid(
  perspective: WorkerPerspectiveFrameData | undefined,
  bitmapWidth: number,
  bitmapHeight: number
): perspective is WorkerPerspectiveFrameData {
  if (!perspective) {
    return false;
  }

  if (!perspective.corners || perspective.corners.length !== 4) {
    return false;
  }

  const isWithinBounds = perspective.corners.every(
    (corner) =>
      Number.isFinite(corner.x) &&
      Number.isFinite(corner.y) &&
      corner.x >= 0 &&
      corner.y >= 0 &&
      corner.x <= bitmapWidth &&
      corner.y <= bitmapHeight
  );

  if (!isWithinBounds) {
    return false;
  }

  const [tl, tr, br, bl] = perspective.corners;
  const area = Math.abs(
    (tl.x * tr.y -
      tr.x * tl.y +
      tr.x * br.y -
      br.x * tr.y +
      br.x * bl.y -
      bl.x * br.y +
      bl.x * tl.y -
      tl.x * bl.y) /
      2
  );

  return area >= 64;
}

function warpToAspectImageData(
  sourceImageData: ImageData,
  perspective: WorkerPerspectiveFrameData
): ImageData | null {
  const targetLandscape = perspective.targetAspect === '3:2';
  const destinationWidth = targetLandscape ? 96 : 64;
  const destinationHeight = targetLandscape ? 64 : 96;

  const destinationCorners: WorkerPoint[] = [
    { x: 0, y: 0 },
    { x: destinationWidth - 1, y: 0 },
    { x: destinationWidth - 1, y: destinationHeight - 1 },
    { x: 0, y: destinationHeight - 1 },
  ];

  const homography = computeHomography(destinationCorners, perspective.corners);
  if (!homography) {
    return null;
  }

  const target = new ImageData(destinationWidth, destinationHeight);
  const source = sourceImageData.data;
  const output = target.data;

  for (let y = 0; y < destinationHeight; y++) {
    for (let x = 0; x < destinationWidth; x++) {
      const denominator = homography.h31 * x + homography.h32 * y + 1;
      if (Math.abs(denominator) < 1e-8) {
        continue;
      }

      const sourceX = (homography.h11 * x + homography.h12 * y + homography.h13) / denominator;
      const sourceY = (homography.h21 * x + homography.h22 * y + homography.h23) / denominator;
      const [r, g, b, a] = sampleBilinear(
        source,
        sourceImageData.width,
        sourceImageData.height,
        sourceX,
        sourceY
      );

      const destIdx = (y * destinationWidth + x) * 4;
      output[destIdx] = r;
      output[destIdx + 1] = g;
      output[destIdx + 2] = b;
      output[destIdx + 3] = a;
    }
  }

  return target;
}

function drawImageDataContained(
  destinationCtx: OffscreenCanvasRenderingContext2D,
  destinationCanvas: OffscreenCanvas,
  imageData: ImageData
): void {
  const tempCtx = ensureImageDataCanvas(imageData.width, imageData.height);
  tempCtx.putImageData(imageData, 0, 0);

  const sourceAspect = imageData.width / imageData.height;
  const destinationAspect = destinationCanvas.width / destinationCanvas.height;

  let drawWidth = destinationCanvas.width;
  let drawHeight = destinationCanvas.height;
  let drawX = 0;
  let drawY = 0;

  if (sourceAspect > destinationAspect) {
    drawHeight = destinationCanvas.width / sourceAspect;
    drawY = (destinationCanvas.height - drawHeight) / 2;
  } else {
    drawWidth = destinationCanvas.height * sourceAspect;
    drawX = (destinationCanvas.width - drawWidth) / 2;
  }

  destinationCtx.clearRect(0, 0, destinationCanvas.width, destinationCanvas.height);
  destinationCtx.drawImage(
    imageDataCanvas!,
    0,
    0,
    imageData.width,
    imageData.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
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

function processFrame(
  bitmap: ImageBitmap,
  frameId: number,
  perspective?: WorkerPerspectiveFrameData
): WorkerFrameResult {
  const startMs = performance.now();

  let rectifiedImageData: ImageData | null = null;
  if (isPerspectiveValid(perspective, bitmap.width, bitmap.height)) {
    const sourceScale = Math.min(
      1,
      MAX_PERSPECTIVE_SOURCE_DIMENSION / Math.max(bitmap.width, bitmap.height)
    );
    const sourceWidth = Math.max(1, Math.round(bitmap.width * sourceScale));
    const sourceHeight = Math.max(1, Math.round(bitmap.height * sourceScale));

    const sCtx = ensureSourceCanvas(sourceWidth, sourceHeight);
    sourceCanvas!.width = sourceWidth;
    sourceCanvas!.height = sourceHeight;
    sCtx.drawImage(bitmap, 0, 0, sourceWidth, sourceHeight);

    const scaledPerspective: WorkerPerspectiveFrameData =
      sourceScale < 1
        ? {
            corners: [
              {
                x: Math.max(0, Math.min(sourceWidth, perspective.corners[0].x * sourceScale)),
                y: Math.max(0, Math.min(sourceHeight, perspective.corners[0].y * sourceScale)),
              },
              {
                x: Math.max(0, Math.min(sourceWidth, perspective.corners[1].x * sourceScale)),
                y: Math.max(0, Math.min(sourceHeight, perspective.corners[1].y * sourceScale)),
              },
              {
                x: Math.max(0, Math.min(sourceWidth, perspective.corners[2].x * sourceScale)),
                y: Math.max(0, Math.min(sourceHeight, perspective.corners[2].y * sourceScale)),
              },
              {
                x: Math.max(0, Math.min(sourceWidth, perspective.corners[3].x * sourceScale)),
                y: Math.max(0, Math.min(sourceHeight, perspective.corners[3].y * sourceScale)),
              },
            ],
            targetAspect: perspective.targetAspect,
          }
        : perspective;

    const sourceImageData = sCtx.getImageData(0, 0, sourceWidth, sourceHeight);
    rectifiedImageData = warpToAspectImageData(sourceImageData, scaledPerspective);
  }

  // 1. Draw bitmap at 32×32 for pHash — resizeImageData will short-circuit
  const hCtx = ensureHashCanvas();
  hashCanvas!.width = PHASH_SIZE;
  hashCanvas!.height = PHASH_SIZE;
  if (rectifiedImageData) {
    drawImageDataContained(hCtx, hashCanvas!, rectifiedImageData);
  } else {
    hCtx.drawImage(bitmap, 0, 0, PHASH_SIZE, PHASH_SIZE);
  }
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

        const result = processFrame(msg.bitmap, msg.frameId, msg.perspective);
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
