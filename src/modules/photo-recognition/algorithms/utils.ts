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
export function resizeImageData(
  imageData: ImageData,
  width: number,
  height: number
): ImageData {
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
    const luma = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
    grayscale.push(luma);
  }

  return grayscale;
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
