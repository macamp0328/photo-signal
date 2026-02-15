/**
 * Image Processing Utilities for Perceptual Hashing
 *
 * Provides helper functions for image manipulation needed by hashing algorithms.
 */

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

  // Create canvas with original image
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = imageData.width;
  sourceCanvas.height = imageData.height;
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });

  if (!sourceCtx) {
    throw new Error('Failed to get 2D context for source canvas');
  }

  sourceCtx.putImageData(imageData, 0, 0);

  // Create target canvas with desired size
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = width;
  targetCanvas.height = height;
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });

  if (!targetCtx) {
    throw new Error('Failed to get 2D context for target canvas');
  }

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

/**
 * Convert ImageData to grayscale array using luminance formula
 *
 * Uses ITU-R BT.601 luma coefficients for perceptually accurate grayscale conversion
 *
 * @param imageData - Image data to convert
 * @returns Array of grayscale values (0-255)
 */
export function toGrayscale(imageData: ImageData): number[] {
  const grayscale: number[] = [];
  const { data } = imageData;

  // Process RGBA pixels (4 bytes per pixel)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // ITU-R BT.601 luma calculation for perceptual brightness
    const luma = Math.floor(LUMA_RED * r + LUMA_GREEN * g + LUMA_BLUE * b);
    grayscale.push(luma);
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
 * @returns Variance value (higher = sharper, lower = blurrier)
 */
export function computeLaplacianVariance(imageData: ImageData): number {
  const { width, height } = imageData;
  const grayscale = toGrayscale(imageData);

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
 * @returns Object with glare detection results
 */
export function detectGlare(
  imageData: ImageData,
  threshold: number = 250,
  percentageThreshold: number = 20
): { hasGlare: boolean; glarePercentage: number } {
  const { data } = imageData;
  let blownOutPixels = 0;
  const totalPixels = data.length / 4; // Each pixel has 4 values (RGBA)

  // Count pixels where all RGB channels are above threshold
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Check if all channels are blown out (near white)
    if (r > threshold && g > threshold && b > threshold) {
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
 * @returns Average brightness value (0-255)
 */
export function calculateAverageBrightness(imageData: ImageData): number {
  const grayscale = toGrayscale(imageData);
  if (grayscale.length === 0) {
    return 0;
  }

  const sum = grayscale.reduce((acc, val) => acc + val, 0);
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
 * @returns Object indicating if lighting is poor and the type
 */
export function detectPoorLighting(
  imageData: ImageData,
  minBrightness: number = 50,
  maxBrightness: number = 220
): {
  hasPoorLighting: boolean;
  averageBrightness: number;
  type: 'underexposed' | 'overexposed' | 'ok';
} {
  const averageBrightness = calculateAverageBrightness(imageData);

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
