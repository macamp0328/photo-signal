/**
 * Shared image processing utilities for scripts
 *
 * This module provides common image processing functions used across
 * multiple diagnostic and analysis scripts.
 */

/**
 * Image processor class providing common CV operations
 */
export class ImageProcessor {
  /**
   * Convert RGBA image to grayscale
   * @param {ImageData} imageData - RGBA image data
   * @returns {Uint8ClampedArray} Grayscale pixel values
   */
  toGrayscale(imageData) {
    const { data, width, height } = imageData;
    const gray = new Uint8ClampedArray(width * height);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    return gray;
  }

  /**
   * Enhance contrast using histogram stretching
   * @param {Uint8ClampedArray} gray - Grayscale image
   * @returns {Uint8ClampedArray} Contrast-enhanced image
   */
  enhanceContrast(gray) {
    const enhanced = new Uint8ClampedArray(gray.length);

    // Find min and max values
    let min = 255;
    let max = 0;
    for (let i = 0; i < gray.length; i++) {
      if (gray[i] < min) min = gray[i];
      if (gray[i] > max) max = gray[i];
    }

    // Stretch histogram
    const range = max - min;
    if (range === 0) return gray; // Avoid division by zero

    for (let i = 0; i < gray.length; i++) {
      enhanced[i] = ((gray[i] - min) * 255) / range;
    }

    return enhanced;
  }

  /**
   * Detect edges using Canny edge detection (simplified)
   * @param {Uint8ClampedArray} gray - Grayscale image
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {number} threshold - Edge detection threshold (default: 100)
   * @returns {Uint8ClampedArray} Binary edge map (0 or 255)
   */
  detectEdges(gray, width, height, threshold = 100) {
    const edges = new Uint8ClampedArray(width * height);

    // Sobel operators
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    // Apply Sobel filter
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        // Convolve with Sobel kernels
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            const pixelValue = gray[idx];

            gx += pixelValue * sobelX[kernelIdx];
            gy += pixelValue * sobelY[kernelIdx];
          }
        }

        // Compute gradient magnitude
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const outIdx = y * width + x;
        edges[outIdx] = magnitude > threshold ? 255 : 0;
      }
    }

    return edges;
  }

  /**
   * Calculate image statistics
   * @param {Uint8ClampedArray} gray - Grayscale image
   * @returns {{mean: number, stdDev: number, min: number, max: number}} Statistics
   */
  calculateStats(gray) {
    let sum = 0;
    let min = 255;
    let max = 0;

    for (let i = 0; i < gray.length; i++) {
      sum += gray[i];
      if (gray[i] < min) min = gray[i];
      if (gray[i] > max) max = gray[i];
    }

    const mean = sum / gray.length;

    let sumSquaredDiff = 0;
    for (let i = 0; i < gray.length; i++) {
      const diff = gray[i] - mean;
      sumSquaredDiff += diff * diff;
    }

    const stdDev = Math.sqrt(sumSquaredDiff / gray.length);

    return { mean, stdDev, min, max };
  }

  /**
   * Count edge pixels
   * @param {Uint8ClampedArray} edges - Binary edge map
   * @returns {number} Count of edge pixels
   */
  countEdgePixels(edges) {
    let count = 0;
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] > 0) count++;
    }
    return count;
  }
}
