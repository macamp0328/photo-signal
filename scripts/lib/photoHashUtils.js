#!/usr/bin/env node

import { createCanvas, loadImage } from 'canvas';

// ---------------------------------------------------------------------------
// Exposure variant configuration
// ---------------------------------------------------------------------------

/**
 * Default gamma values used to generate multi-exposure pHash variants.
 *
 * Five variants cover the realistic range of "phone camera pointing at a
 * printed photo under varying ambient light":
 *
 *   2.0  — very dark (dim bar, candlelight)
 *   1.4  — slightly dark
 *   1.0  — reference exposure (no adjustment)
 *   0.7  — slightly bright (well-lit room / daylight)
 *   0.5  — very bright (direct sunlight, overexposed)
 *
 * Gamma adjustment (`pixel/255)^gamma * 255`) is physically more accurate
 * than a linear brightness offset because:
 *   - It preserves shadow/highlight detail that a linear ±delta clips to 0/255.
 *   - It models how phone camera auto-exposure and ambient light actually
 *     affect perceived brightness (logarithmic / power-law, not additive).
 *
 * @type {number[]}
 */
export const DEFAULT_GAMMA_VARIANTS = [2.0, 1.4, 1.0, 0.7, 0.5];

/**
 * Default small-angle rotation variants (degrees) used to improve tolerance
 * for slight handheld camera tilt/rotation during recognition.
 *
 * @type {number[]}
 */
export const DEFAULT_ROTATION_VARIANTS = [-8, 8];

/**
 * Maximum Hamming distance (in bits) considered near-duplicate when pruning
 * perceptual hash variants (pHash and dHash). 1 is conservative and keeps
 * most diversity.
 *
 * @type {number}
 */
export const DEFAULT_NEAR_DUP_HAMMING_THRESHOLD = 1;

/**
 * Legacy linear exposure offsets — kept so callers that explicitly pass
 * these continue to work.  New code should use DEFAULT_GAMMA_VARIANTS.
 *
 * @deprecated Use DEFAULT_GAMMA_VARIANTS instead.
 */
export const DEFAULT_EXPOSURE_OFFSETS = [-50, 0, 50];

const POPCOUNT_NIBBLE = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

function normalizeRotationAngles(angles = DEFAULT_ROTATION_VARIANTS) {
  if (!Array.isArray(angles)) {
    return [];
  }

  const deduped = [];
  const seen = new Set();

  for (const angle of angles) {
    const parsed = Number(angle);
    if (!Number.isFinite(parsed)) {
      continue;
    }

    const normalized = Math.round(parsed * 100) / 100;
    if (normalized === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function normalizeDedupThreshold(threshold = DEFAULT_NEAR_DUP_HAMMING_THRESHOLD) {
  const parsed = Number(threshold);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_NEAR_DUP_HAMMING_THRESHOLD;
  }
  return Math.max(0, Math.floor(parsed));
}

// ---------------------------------------------------------------------------
// Internal image-processing helpers
// ---------------------------------------------------------------------------

const DCT_SIZE = 32;
const DCT_LOW_FREQ_SIZE = 8;

/**
 * Precomputed cosine lookup table for the DCT-II basis functions.
 * COS_TABLE[u * DCT_SIZE + x] = cos((2x+1)*u*π / (2*DCT_SIZE))
 * Matches the browser runtime exactly so script-generated hashes are
 * bit-for-bit identical to hashes computed by the browser on the same image.
 */
const COS_TABLE = new Float64Array(DCT_SIZE * DCT_SIZE);
for (let u = 0; u < DCT_SIZE; u++) {
  for (let x = 0; x < DCT_SIZE; x++) {
    COS_TABLE[u * DCT_SIZE + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * DCT_SIZE));
  }
}

/** DCT-II orthonormal scale factors: 1/√2 for u=0, 1 otherwise. */
const ALPHA = new Float64Array(DCT_SIZE);
for (let i = 0; i < DCT_SIZE; i++) {
  ALPHA[i] = i === 0 ? 1 / Math.sqrt(2) : 1;
}

function resizeImageData(imageData, width, height) {
  if (imageData.width === width && imageData.height === height) {
    return imageData;
  }

  const sourceCanvas = createCanvas(imageData.width, imageData.height);
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  sourceCtx.putImageData(imageData, 0, 0);

  const targetCanvas = createCanvas(width, height);
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  targetCtx.drawImage(sourceCanvas, 0, 0, width, height);

  return targetCtx.getImageData(0, 0, width, height);
}

function toGrayscale(imageData) {
  const grayscale = [];
  const { data } = imageData;
  const LUMA_RED = 0.299;
  const LUMA_GREEN = 0.587;
  const LUMA_BLUE = 0.114;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = Math.floor(LUMA_RED * r + LUMA_GREEN * g + LUMA_BLUE * b);
    grayscale.push(luma);
  }

  return grayscale;
}

function binaryToHex(binary) {
  let hex = '';
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.slice(i, i + 4);
    const value = parseInt(chunk, 2);
    hex += value.toString(16);
  }
  return hex;
}

// ---------------------------------------------------------------------------
// Hash algorithms
// ---------------------------------------------------------------------------

export function computeDHash(imageData) {
  const resized = resizeImageData(imageData, 17, 8);
  const grayscale = toGrayscale(resized);
  let binaryHash = '';

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 16; col++) {
      const currentIndex = row * 17 + col;
      const nextIndex = currentIndex + 1;
      const currentPixel = grayscale[currentIndex];
      const nextPixel = grayscale[nextIndex];
      binaryHash += currentPixel > nextPixel ? '1' : '0';
    }
  }

  return binaryToHex(binaryHash);
}

/**
 * Compute pHash using a separable 2D DCT with a precomputed cosine lookup
 * table.  This is mathematically equivalent to the naive 2D DCT but uses
 * O(n³) multiply-adds instead of O(n⁴), and avoids all Math.cos() calls.
 *
 * The implementation mirrors the browser runtime (src/modules/photo-recognition/
 * algorithms/phash.ts) so that script-generated reference hashes and
 * browser-computed query hashes are computed identically.
 */
export function computePHash(imageData) {
  const resized = resizeImageData(imageData, DCT_SIZE, DCT_SIZE);
  const grayscale = toGrayscale(resized);

  // Step 1: 1D DCT along each row, keeping only DCT_LOW_FREQ_SIZE components.
  // intermediate[x * DCT_LOW_FREQ_SIZE + v]
  //   = Σ_y grayscale[x * DCT_SIZE + y] * COS_TABLE[v * DCT_SIZE + y]
  const intermediate = new Float64Array(DCT_SIZE * DCT_LOW_FREQ_SIZE);
  for (let x = 0; x < DCT_SIZE; x++) {
    const rowOffset = x * DCT_SIZE;
    const outRowOffset = x * DCT_LOW_FREQ_SIZE;
    for (let v = 0; v < DCT_LOW_FREQ_SIZE; v++) {
      let sum = 0;
      const cosVOffset = v * DCT_SIZE;
      for (let y = 0; y < DCT_SIZE; y++) {
        sum += grayscale[rowOffset + y] * COS_TABLE[cosVOffset + y];
      }
      intermediate[outRowOffset + v] = sum;
    }
  }

  // Step 2: 1D DCT along each column, keeping only DCT_LOW_FREQ_SIZE rows.
  // Inline median computation into lowFreq array.
  const lowFreq = [];
  for (let u = 0; u < DCT_LOW_FREQ_SIZE; u++) {
    const alphaU = ALPHA[u];
    const cosUOffset = u * DCT_SIZE;
    for (let v = 0; v < DCT_LOW_FREQ_SIZE; v++) {
      if (u === 0 && v === 0) continue; // Skip DC component
      let sum = 0;
      for (let x = 0; x < DCT_SIZE; x++) {
        sum += intermediate[x * DCT_LOW_FREQ_SIZE + v] * COS_TABLE[cosUOffset + x];
      }
      lowFreq.push((alphaU * ALPHA[v] * sum) / 2);
    }
  }

  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let binaryHash = '';
  for (const coeff of lowFreq) {
    binaryHash += coeff > median ? '1' : '0';
  }

  return binaryToHex(binaryHash);
}

// ---------------------------------------------------------------------------
// Exposure simulation
// ---------------------------------------------------------------------------

/**
 * Adjust image brightness with a linear offset (legacy / deprecated).
 *
 * Clips each RGB channel to [0, 255] after adding delta.  Does not preserve
 * highlight/shadow detail at the extremes — prefer adjustGamma for new code.
 *
 * @param {ImageData} imageData
 * @param {number} delta  Value to add to each R/G/B channel (positive = brighter)
 * @returns {ImageData}
 */
export function adjustBrightness(imageData, delta) {
  const { width, height, data } = imageData;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const adjusted = ctx.createImageData(width, height);

  for (let i = 0; i < data.length; i += 4) {
    adjusted.data[i] = Math.max(0, Math.min(255, data[i] + delta));
    adjusted.data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + delta));
    adjusted.data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + delta));
    adjusted.data[i + 3] = data[i + 3];
  }

  return adjusted;
}

/**
 * Adjust image brightness using a gamma power curve.
 *
 * Applies `output = round((input / 255) ^ gamma * 255)` per RGB channel.
 *
 *   gamma < 1  → brightens  (e.g. 0.5 simulates phone overexposure / sunlight)
 *   gamma = 1  → no change
 *   gamma > 1  → darkens    (e.g. 2.0 simulates dim ambient / dark venue)
 *
 * Unlike a linear offset, gamma adjustment preserves detail in shadows and
 * highlights (no clipping at extremes) and models how camera exposure
 * compensation and ambient light actually affect image brightness.
 *
 * @param {ImageData} imageData
 * @param {number} gamma  Power-curve exponent (positive number)
 * @returns {ImageData}
 */
export function adjustGamma(imageData, gamma) {
  const { width, height, data } = imageData;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const adjusted = ctx.createImageData(width, height);

  // Build a 256-entry lookup table so we only compute Math.pow once per level.
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(Math.pow(i / 255, gamma) * 255);
  }

  for (let i = 0; i < data.length; i += 4) {
    adjusted.data[i] = lut[data[i]];
    adjusted.data[i + 1] = lut[data[i + 1]];
    adjusted.data[i + 2] = lut[data[i + 2]];
    adjusted.data[i + 3] = data[i + 3];
  }

  return adjusted;
}

/**
 * Rotate an image around its center while preserving original canvas size.
 *
 * @param {ImageData} imageData
 * @param {number} angleDegrees
 * @returns {ImageData}
 */
export function rotateImageData(imageData, angleDegrees) {
  if (!Number.isFinite(angleDegrees) || angleDegrees === 0) {
    return imageData;
  }

  const { width, height } = imageData;
  const sourceCanvas = createCanvas(width, height);
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  sourceCtx.putImageData(imageData, 0, 0);

  const targetCanvas = createCanvas(width, height);
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  targetCtx.fillStyle = '#000';
  targetCtx.fillRect(0, 0, width, height);
  targetCtx.translate(width / 2, height / 2);
  targetCtx.rotate((angleDegrees * Math.PI) / 180);
  targetCtx.drawImage(sourceCanvas, -width / 2, -height / 2, width, height);

  return targetCtx.getImageData(0, 0, width, height);
}

/**
 * Compute bitwise Hamming distance for same-length hexadecimal strings.
 *
 * @param {string} leftHex
 * @param {string} rightHex
 * @returns {number}
 */
export function hammingDistanceHex(leftHex, rightHex) {
  if (leftHex.length !== rightHex.length) {
    return Number.POSITIVE_INFINITY;
  }

  let distance = 0;
  for (let i = 0; i < leftHex.length; i++) {
    const leftNibble = parseInt(leftHex[i], 16);
    const rightNibble = parseInt(rightHex[i], 16);
    if (Number.isNaN(leftNibble) || Number.isNaN(rightNibble)) {
      return Number.POSITIVE_INFINITY;
    }
    distance += POPCOUNT_NIBBLE[leftNibble ^ rightNibble];
  }

  return distance;
}

/**
 * Deduplicate pHash variants by exact match and near-duplicate Hamming distance.
 * Keeps first-seen order for deterministic outputs.
 *
 * @param {string[]} hashes
 * @param {number} maxDistance
 * @returns {string[]}
 */
export function dedupeNearDuplicateHashes(
  hashes,
  maxDistance = DEFAULT_NEAR_DUP_HAMMING_THRESHOLD
) {
  const normalizedThreshold = normalizeDedupThreshold(maxDistance);
  const deduped = [];

  for (const hash of hashes) {
    if (typeof hash !== 'string' || hash.length === 0) {
      continue;
    }

    let isDuplicate = false;
    for (const existing of deduped) {
      const distance = hammingDistanceHex(hash, existing);
      if (distance <= normalizedThreshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      deduped.push(hash);
    }
  }

  return deduped;
}

function appendNonDuplicateCandidates(baseHashes, candidates, maxDistance) {
  const normalizedThreshold = normalizeDedupThreshold(maxDistance);
  const merged = [...baseHashes];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length === 0) {
      continue;
    }

    let isDuplicate = false;
    for (const existing of merged) {
      const distance = hammingDistanceHex(candidate, existing);
      if (distance <= normalizedThreshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      merged.push(candidate);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Variant generation
// ---------------------------------------------------------------------------

/**
 * Create gamma-adjusted exposure variants of an image.
 *
 * @param {ImageData} imageData
 * @param {number[]} gammas  Array of gamma exponents (default: DEFAULT_GAMMA_VARIANTS)
 * @returns {ImageData[]}
 */
export function createExposureVariants(imageData, gammas = DEFAULT_GAMMA_VARIANTS) {
  return gammas.map((gamma) => {
    if (gamma === 1.0) {
      return imageData;
    }
    return adjustGamma(imageData, gamma);
  });
}

/**
 * Build image variants by applying optional small-angle rotations on top of
 * each exposure variant.
 *
 * Order is deterministic: base exposure (0°) first, then configured angles.
 *
 * @param {ImageData} imageData
 * @param {number[]} gammas
 * @param {number[]} rotationAngles
 * @returns {ImageData[]}
 */
export function createExposureAndRotationVariants(
  imageData,
  gammas = DEFAULT_GAMMA_VARIANTS,
  rotationAngles = DEFAULT_ROTATION_VARIANTS
) {
  const exposures = createExposureVariants(imageData, gammas);
  const normalizedAngles = normalizeRotationAngles(rotationAngles);
  const variants = [];

  for (const exposureVariant of exposures) {
    variants.push(exposureVariant);
    for (const angle of normalizedAngles) {
      variants.push(rotateImageData(exposureVariant, angle));
    }
  }

  return variants;
}

/**
 * Generate pHash (and dHash) variants for multiple gamma-adjusted exposures.
 *
 * @param {ImageData} imageData
 * @param {number[]} gammas  Array of gamma exponents (default: DEFAULT_GAMMA_VARIANTS)
 * @returns {{ phash: string[], dhash: string[] }}
 */
export function generateHashVariants(imageData, gammas = DEFAULT_GAMMA_VARIANTS, options = {}) {
  const exposureVariants = createExposureVariants(imageData, gammas);
  const phashInputs = exposureVariants.map((variant) =>
    resizeImageData(variant, DCT_SIZE, DCT_SIZE)
  );
  const dhashInputs = exposureVariants.map((variant) => resizeImageData(variant, 17, 8));

  const dedupThreshold = options.nearDupHammingThreshold ?? DEFAULT_NEAR_DUP_HAMMING_THRESHOLD;
  const basePHashes = dedupeNearDuplicateHashes(
    phashInputs.map((variant) => computePHash(variant)),
    dedupThreshold
  );
  const baseDHashes = dedupeNearDuplicateHashes(
    dhashInputs.map((variant) => computeDHash(variant)),
    dedupThreshold
  );

  const rotationAngles = normalizeRotationAngles(
    options.rotationAngles ?? DEFAULT_ROTATION_VARIANTS
  );
  const rotatedPHashInputs = [];
  for (const phashInput of phashInputs) {
    for (const angle of rotationAngles) {
      rotatedPHashInputs.push(rotateImageData(phashInput, angle));
    }
  }

  const rotatedDHashInputs = [];
  for (const dhashInput of dhashInputs) {
    for (const angle of rotationAngles) {
      rotatedDHashInputs.push(rotateImageData(dhashInput, angle));
    }
  }

  const rotatedPHashes = rotatedPHashInputs.map((variant) => computePHash(variant));
  const rotatedDHashes = rotatedDHashInputs.map((variant) => computeDHash(variant));

  return {
    phash: appendNonDuplicateCandidates(basePHashes, rotatedPHashes, dedupThreshold),
    dhash: appendNonDuplicateCandidates(baseDHashes, rotatedDHashes, dedupThreshold),
  };
}

/**
 * Load an image from disk and generate hash variants.
 *
 * @param {string} imagePath
 * @param {number[]} gammas
 * @returns {Promise<{ phash: string[], dhash: string[] }>}
 */
export async function generateHashesForFile(
  imagePath,
  gammas = DEFAULT_GAMMA_VARIANTS,
  options = {}
) {
  const imageData = await loadImageData(imagePath);
  return generateHashVariants(imageData, gammas, options);
}

// ---------------------------------------------------------------------------
// Crop-based partial photo recognition
// ---------------------------------------------------------------------------

/**
 * Named crop sub-regions used for partial-photo recognition.
 * Each region is defined as fractional offsets from the image origin.
 * Matches CropRegionKey in src/types/index.ts.
 *
 * Center crops cover the case where the user is too close (edges fall outside
 * the camera frame). Corner crops cover off-center framing.
 *
 * @type {Record<string, { xOffset: number, yOffset: number, w: number, h: number }>}
 */
export const CROP_REGIONS = {
  'center-80': { xOffset: 0.1, yOffset: 0.1, w: 0.8, h: 0.8 },
  'center-60': { xOffset: 0.2, yOffset: 0.2, w: 0.6, h: 0.6 },
  'center-50': { xOffset: 0.25, yOffset: 0.25, w: 0.5, h: 0.5 },
  'top-left-70': { xOffset: 0.0, yOffset: 0.0, w: 0.7, h: 0.7 },
  'top-right-70': { xOffset: 0.3, yOffset: 0.0, w: 0.7, h: 0.7 },
  'bottom-left-70': { xOffset: 0.0, yOffset: 0.3, w: 0.7, h: 0.7 },
  'bottom-right-70': { xOffset: 0.3, yOffset: 0.3, w: 0.7, h: 0.7 },
};

/**
 * Extract a named crop region from ImageData.
 *
 * @param {ImageData} imageData  Full-resolution source image
 * @param {string} regionKey  Key from CROP_REGIONS
 * @returns {ImageData}  Cropped sub-region as a new ImageData
 */
export function extractCrop(imageData, regionKey) {
  const region = CROP_REGIONS[regionKey];
  if (!region) throw new Error(`Unknown crop region: ${regionKey}`);

  const { width: srcW, height: srcH } = imageData;
  const cropX = Math.round(region.xOffset * srcW);
  const cropY = Math.round(region.yOffset * srcH);
  const cropW = Math.round(region.w * srcW);
  const cropH = Math.round(region.h * srcH);

  const srcCanvas = createCanvas(srcW, srcH);
  srcCanvas.getContext('2d', { willReadFrequently: true }).putImageData(imageData, 0, 0);

  const dst = createCanvas(cropW, cropH);
  dst
    .getContext('2d', { willReadFrequently: true })
    .drawImage(srcCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return dst.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cropW, cropH);
}

/**
 * Generate gamma-variant pHashes for all named crop regions of an image.
 *
 * @param {ImageData} imageData  Full-resolution source image
 * @param {number[]} gammas  Array of gamma exponents (default: DEFAULT_GAMMA_VARIANTS)
 * @returns {Record<string, string[]>}  Map of cropRegionKey -> array of pHash hex strings
 */
export function generateCropHashVariants(imageData, gammas = DEFAULT_GAMMA_VARIANTS, options = {}) {
  const result = {};
  const rotationAngles = normalizeRotationAngles(
    options.rotationAngles ?? DEFAULT_ROTATION_VARIANTS
  );
  const nearDupHammingThreshold =
    options.nearDupHammingThreshold ?? DEFAULT_NEAR_DUP_HAMMING_THRESHOLD;

  for (const regionKey of Object.keys(CROP_REGIONS)) {
    const cropped = extractCrop(imageData, regionKey);
    const exposureVariants = createExposureVariants(cropped, gammas);
    const phashInputs = exposureVariants.map((variant) =>
      resizeImageData(variant, DCT_SIZE, DCT_SIZE)
    );
    const baseHashes = dedupeNearDuplicateHashes(
      phashInputs.map((variant) => computePHash(variant)),
      nearDupHammingThreshold
    );

    const rotatedHashes = [];
    for (const phashInput of phashInputs) {
      for (const angle of rotationAngles) {
        rotatedHashes.push(computePHash(rotateImageData(phashInput, angle)));
      }
    }

    result[regionKey] = appendNonDuplicateCandidates(
      baseHashes,
      rotatedHashes,
      nearDupHammingThreshold
    );
  }
  return result;
}

export async function loadImageData(imagePath) {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
