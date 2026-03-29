/**
 * Image Processing Utilities for Perceptual Hashing
 *
 * Provides helper functions for image manipulation needed by hashing algorithms.
 */

// ---------------------------------------------------------------------------
// Module-level canvas cache — reused across calls to avoid per-frame DOM
// element creation overhead. JavaScript is single-threaded, so sharing these
// canvases across calls is safe as long as no caller yields the event loop
// between setting canvas dimensions and reading back pixel data. All callers
// in this module follow that contract. Tests that run in parallel processes
// each have their own module scope, so there is no cross-test contamination.
// ---------------------------------------------------------------------------
let _sourceCanvas: HTMLCanvasElement | null = null;
let _sourceCtx: CanvasRenderingContext2D | null = null;
let _targetCanvas: HTMLCanvasElement | null = null;
let _targetCtx: CanvasRenderingContext2D | null = null;

function getSourceCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!_sourceCanvas || !_sourceCtx) {
    _sourceCanvas = document.createElement('canvas');
    _sourceCtx = _sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!_sourceCtx) {
      throw new Error('Failed to get 2D context for source canvas');
    }
  }
  return { canvas: _sourceCanvas, ctx: _sourceCtx };
}

function getTargetCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!_targetCanvas || !_targetCtx) {
    _targetCanvas = document.createElement('canvas');
    _targetCtx = _targetCanvas.getContext('2d', { willReadFrequently: true });
    if (!_targetCtx) {
      throw new Error('Failed to get 2D context for target canvas');
    }
  }
  return { canvas: _targetCanvas, ctx: _targetCtx };
}

/**
 * Resize an ImageData object to specified dimensions
 *
 * @param imageData - Original image data
 * @param width - Target width
 * @param height - Target height
 * @returns Resized ImageData
 */
export function resizeImageData(imageData: ImageData, width: number, height: number): ImageData {
  // Skip resizing if already the correct size (optimization + test compatibility)
  if (imageData.width === width && imageData.height === height) {
    return imageData;
  }

  // Reuse cached canvases to avoid per-call DOM element allocation.
  const { canvas: sourceCanvas, ctx: sourceCtx } = getSourceCanvas();
  sourceCanvas.width = imageData.width;
  sourceCanvas.height = imageData.height;
  sourceCtx.putImageData(imageData, 0, 0);

  const { canvas: targetCanvas, ctx: targetCtx } = getTargetCanvas();
  targetCanvas.width = width;
  targetCanvas.height = height;

  // Draw resized image
  targetCtx.drawImage(sourceCanvas, 0, 0, width, height);

  // Extract and return ImageData
  return targetCtx.getImageData(0, 0, width, height);
}

// ITU-R BT.601 luma coefficients for converting RGB to grayscale
// These weights represent human perception of color brightness
const LUMA_RED = 0.299;
const LUMA_GREEN = 0.587;
const LUMA_BLUE = 0.114;

// Warm-light luma coefficients tuned for stage-lit concert photos.
// Reduces the blue channel weight (0.114 → 0.07) to dampen noise from
// warm-dominant stage lighting (heavy reds/oranges, minimal blue).
// Requires regenerating stored hashes before enabling at runtime —
// mismatched coefficients will silently break recognition.
const WARM_LUMA_RED = 0.35;
const WARM_LUMA_GREEN = 0.58;
const WARM_LUMA_BLUE = 0.07;

/**
 * Convert ImageData to grayscale array using luminance formula
 *
 * Uses ITU-R BT.601 luma coefficients by default. Pass `useWarmLuma = true`
 * to use warm-light coefficients (R: 0.35, G: 0.58, B: 0.07) tuned for
 * stage-lit concert photos. The warm-luma path requires that stored reference
 * hashes were also generated with warm-luma coefficients.
 *
 * Returns a pre-allocated Uint8Array for better memory locality and no boxing overhead.
 *
 * @param imageData - Image data to convert
 * @param useWarmLuma - Use warm-light luma coefficients instead of BT.601
 * @returns Typed array of grayscale values (0-255)
 */
export function toGrayscale(imageData: ImageData, useWarmLuma = false): Uint8Array {
  const pixelCount = imageData.data.length >> 2; // divide by 4
  const grayscale = new Uint8Array(pixelCount);
  const { data } = imageData;

  const r = useWarmLuma ? WARM_LUMA_RED : LUMA_RED;
  const g = useWarmLuma ? WARM_LUMA_GREEN : LUMA_GREEN;
  const b = useWarmLuma ? WARM_LUMA_BLUE : LUMA_BLUE;

  // Process RGBA pixels (4 bytes per pixel)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    grayscale[j] = r * data[i] + g * data[i + 1] + b * data[i + 2];
  }

  return grayscale;
}

/**
 * Convert ImageData to grayscale in-place
 *
 * Modifies the ImageData object to convert all pixels to grayscale
 * using ITU-R BT.601 luma coefficients for perceptually accurate conversion.
 * This is useful for preprocessing camera frames before photo recognition.
 *
 * @param imageData - Image data to convert (modified in-place)
 * @returns The same ImageData object (now grayscale) for chaining
 */
export function convertToGrayscale(imageData: ImageData): ImageData {
  const { data } = imageData;

  // Process RGBA pixels (4 bytes per pixel)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // ITU-R BT.601 luma calculation for perceptual brightness
    const gray = Math.floor(LUMA_RED * r + LUMA_GREEN * g + LUMA_BLUE * b);

    // Set RGB to same value (grayscale), keep alpha unchanged
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    // data[i + 3] is alpha, leave unchanged
  }

  return imageData;
}

/**
 * Convert binary string to hexadecimal string
 *
 * @param binary - Binary string (e.g., "1010")
 * @returns Hexadecimal string (e.g., "a")
 */
export function binaryToHex(binary: string): string {
  let hex = '';

  // Process 4 bits at a time
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.slice(i, i + 4);
    const value = parseInt(chunk, 2);
    hex += value.toString(16);
  }

  return hex;
}

/**
 * Convert hexadecimal string to binary string
 *
 * @param hex - Hexadecimal string
 * @returns Binary string padded to 4 bits per hex digit
 */
export function hexToBinary(hex: string): string {
  let binary = '';

  for (let i = 0; i < hex.length; i++) {
    const value = parseInt(hex[i], 16);
    binary += value.toString(2).padStart(4, '0');
  }

  return binary;
}

/**
 * Compute Laplacian variance of an image to detect blur
 *
 * The Laplacian variance measures the amount of edges in an image.
 * Lower variance indicates a blurrier image (motion blur, out of focus).
 * Higher variance indicates a sharper image with clear edges.
 *
 * Based on the method described in:
 * Pech-Pacheco et al., 2000, "Diatom autofocusing in brightfield microscopy"
 *
 * @param imageData - Image data to analyze
 * @param precomputedGrayscale - Optional pre-computed grayscale array to avoid recomputing
 * @returns Variance value (higher = sharper, lower = blurrier)
 */
export function computeLaplacianVariance(
  imageData: ImageData,
  precomputedGrayscale?: Uint8Array
): number {
  const { width, height } = imageData;
  const grayscale = precomputedGrayscale ?? toGrayscale(imageData);

  // Laplacian kernel (3x3):
  // [ 0  1  0 ]
  // [ 1 -4  1 ]
  // [ 0  1  0 ]
  const laplacianValues: number[] = [];

  // Apply Laplacian filter (skip 1px border to avoid edge cases)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = grayscale[y * width + x];
      const top = grayscale[(y - 1) * width + x];
      const bottom = grayscale[(y + 1) * width + x];
      const left = grayscale[y * width + (x - 1)];
      const right = grayscale[y * width + (x + 1)];

      // Apply Laplacian kernel
      const laplacian = top + bottom + left + right - 4 * center;
      laplacianValues.push(laplacian);
    }
  }

  // Compute variance of Laplacian values
  if (laplacianValues.length === 0) {
    return 0;
  }

  const mean = laplacianValues.reduce((sum, val) => sum + val, 0) / laplacianValues.length;
  const variance =
    laplacianValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / laplacianValues.length;

  return variance;
}

/**
 * Detect glare in an image by checking for blown-out pixels
 *
 * Glare (specular reflections) causes pixels to be blown out to near-white values.
 * This function detects when a significant portion of the image is affected by glare.
 *
 * @param imageData - Image data to analyze
 * @param threshold - Brightness threshold for blown-out pixels (0-255), default 250
 * @param percentageThreshold - Percentage of image that must be blown out to trigger detection (0-100), default 20
 * @param precomputedGrayscale - Optional pre-computed grayscale array to avoid recomputing
 * @returns Object with glare detection results
 */
export function detectGlare(
  imageData: ImageData,
  threshold: number = 250,
  percentageThreshold: number = 20,
  precomputedGrayscale?: Uint8Array
): { hasGlare: boolean; glarePercentage: number } {
  const grayscale = precomputedGrayscale ?? toGrayscale(imageData);
  let blownOutPixels = 0;
  const totalPixels = grayscale.length;

  // Count pixels whose luminance is above threshold.
  // This is more robust for monochrome prints under warm/cool lighting casts.
  for (let i = 0; i < grayscale.length; i += 1) {
    if (grayscale[i] > threshold) {
      blownOutPixels++;
    }
  }

  const glarePercentage = (blownOutPixels / totalPixels) * 100;
  const hasGlare = glarePercentage > percentageThreshold;

  return { hasGlare, glarePercentage };
}

/**
 * Adjust image brightness to simulate different exposure levels
 *
 * Used for generating multi-exposure reference hashes.
 * Positive factor brightens, negative factor darkens.
 *
 * @param imageData - Image data to adjust
 * @param factor - Brightness adjustment factor (-100 to +100)
 * @returns New ImageData with adjusted brightness
 */
export function adjustBrightness(imageData: ImageData, factor: number): ImageData {
  const { width, height, data } = imageData;
  const adjusted = new ImageData(width, height);

  for (let i = 0; i < data.length; i += 4) {
    // Adjust RGB channels, keep alpha unchanged
    adjusted.data[i] = Math.max(0, Math.min(255, data[i] + factor)); // R
    adjusted.data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + factor)); // G
    adjusted.data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + factor)); // B
    adjusted.data[i + 3] = data[i + 3]; // A (unchanged)
  }

  return adjusted;
}

/**
 * Calculate average brightness of an image
 *
 * Used for detecting poor lighting conditions (underexposure/overexposure).
 *
 * @param imageData - Image data to analyze
 * @param precomputedGrayscale - Optional pre-computed grayscale array to avoid recomputing
 * @returns Average brightness value (0-255)
 */
export function calculateAverageBrightness(
  imageData: ImageData,
  precomputedGrayscale?: Uint8Array
): number {
  const grayscale = precomputedGrayscale ?? toGrayscale(imageData);
  if (grayscale.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < grayscale.length; i++) {
    sum += grayscale[i];
  }
  return sum / grayscale.length;
}

/**
 * Detect poor lighting conditions
 *
 * Checks for underexposure (too dark) or overexposure (too bright).
 *
 * @param imageData - Image data to analyze
 * @param minBrightness - Minimum acceptable average brightness (default 50)
 * @param maxBrightness - Maximum acceptable average brightness (default 220)
 * @param precomputedGrayscale - Optional pre-computed grayscale array to avoid recomputing
 * @returns Object indicating if lighting is poor and the type
 */
export function detectPoorLighting(
  imageData: ImageData,
  minBrightness: number = 50,
  maxBrightness: number = 220,
  precomputedGrayscale?: Uint8Array
): {
  hasPoorLighting: boolean;
  averageBrightness: number;
  type: 'underexposed' | 'overexposed' | 'ok';
} {
  const averageBrightness = calculateAverageBrightness(imageData, precomputedGrayscale);

  if (averageBrightness < minBrightness) {
    return {
      hasPoorLighting: true,
      averageBrightness,
      type: 'underexposed',
    };
  }

  if (averageBrightness > maxBrightness) {
    return {
      hasPoorLighting: true,
      averageBrightness,
      type: 'overexposed',
    };
  }

  return {
    hasPoorLighting: false,
    averageBrightness,
    type: 'ok',
  };
}

/**
 * Adaptive quality thresholds derived from ambient conditions.
 *
 * In darker environments (e.g., bathroom lighting), this widens acceptable
 * brightness/glare ranges to reduce false negatives while still rejecting
 * extreme poor-quality frames.
 */
export interface AdaptiveQualityThresholds {
  minBrightness: number;
  maxBrightness: number;
  glarePercentageThreshold: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export function calculateAdaptiveQualityThresholds(
  minBrightness: number,
  maxBrightness: number,
  glarePercentageThreshold: number,
  ambientBrightness: number | null,
  ambientGlarePercentage: number | null
): AdaptiveQualityThresholds {
  if (ambientBrightness === null) {
    return {
      minBrightness,
      maxBrightness,
      glarePercentageThreshold,
    };
  }

  const midpoint = (minBrightness + maxBrightness) / 2;
  const brightnessDelta = ambientBrightness - midpoint;

  // Shift thresholds toward ambient while keeping conservative floors/ceilings.
  const adjustedMinBrightness = clamp(
    minBrightness + brightnessDelta * 0.35,
    20,
    minBrightness + 30
  );
  const adjustedMaxBrightness = clamp(
    maxBrightness + brightnessDelta * 0.35,
    maxBrightness - 30,
    245
  );

  // In darker scenes, tolerate a bit more localized glare and sensor noise.
  const glareFromDarkness = Math.max(0, (160 - ambientBrightness) / 8);
  const glareFromHistory = ambientGlarePercentage !== null ? ambientGlarePercentage * 0.2 : 0;
  const adjustedGlarePercentageThreshold = clamp(
    glarePercentageThreshold + glareFromDarkness + glareFromHistory,
    glarePercentageThreshold,
    40
  );

  return {
    minBrightness: adjustedMinBrightness,
    maxBrightness: adjustedMaxBrightness,
    glarePercentageThreshold: adjustedGlarePercentageThreshold,
  };
}

/**
 * Run all three quality checks (sharpness, glare, lighting) with a single
 * grayscale conversion pass instead of four separate ones.
 *
 * @param imageData - Frame to analyse
 * @param sharpnessThreshold - Minimum Laplacian variance for a sharp frame
 * @param glareThreshold - Per-pixel brightness above which a pixel is "blown out"
 * @param glarePercentageThreshold - % of blown-out pixels that constitutes glare
 * @param minBrightness - Lower bound for acceptable average brightness
 * @param maxBrightness - Upper bound for acceptable average brightness
 */
export function computeAllQualityMetrics(
  imageData: ImageData,
  sharpnessThreshold: number,
  glareThreshold: number,
  glarePercentageThreshold: number,
  minBrightness: number,
  maxBrightness: number
): {
  sharpness: number;
  isSharp: boolean;
  glarePercentage: number;
  hasGlare: boolean;
  averageBrightness: number;
  hasPoorLighting: boolean;
  lightingType: 'underexposed' | 'overexposed' | 'ok';
} {
  // Single grayscale pass shared by all three checks.
  const grayscale = toGrayscale(imageData);

  const sharpness = computeLaplacianVariance(imageData, grayscale);
  const { glarePercentage, hasGlare } = detectGlare(
    imageData,
    glareThreshold,
    glarePercentageThreshold,
    grayscale
  );
  const {
    averageBrightness,
    hasPoorLighting,
    type: lightingType,
  } = detectPoorLighting(imageData, minBrightness, maxBrightness, grayscale);

  return {
    sharpness,
    isSharp: sharpness >= sharpnessThreshold,
    glarePercentage,
    hasGlare,
    averageBrightness,
    hasPoorLighting,
    lightingType,
  };
}
