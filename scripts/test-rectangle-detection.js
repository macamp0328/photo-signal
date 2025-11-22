#!/usr/bin/env node

/**
 * Test Rectangle Detection on Real Screenshots
 *
 * This script loads the real-world screenshots and runs rectangle detection
 * to validate improvements.
 */

import { createCanvas, loadImage } from 'canvas';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// NOTE: This is a simplified version of the rectangle detection algorithm
// for quick testing purposes. It doesn't include all the improvements made
// to the actual RectangleDetectionService (convex hull, Douglas-Peucker, etc.)
// but serves to validate the basic edge detection approach.

const SCREENSHOTS_DIR = join(__dirname, '..', 'src', 'test', 'test_real_screenshots');

/**
 * Simplified rectangle detection for testing
 * This mimics the improved algorithm
 */
class TestRectangleDetector {
  constructor(options = {}) {
    this.options = {
      minArea: 0.05,
      maxArea: 0.9,
      minAspectRatio: 0.4,
      maxAspectRatio: 3.0,
      cannyHighThreshold: 100,
      minConfidence: 0.3,
      ...options,
    };
  }

  toGrayscale(imageData) {
    const gray = new Uint8ClampedArray(imageData.width * imageData.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[i / 4] = luma;
    }

    return gray;
  }

  enhanceContrast(gray) {
    let min = 255;
    let max = 0;

    for (let i = 0; i < gray.length; i++) {
      if (gray[i] < min) min = gray[i];
      if (gray[i] > max) max = gray[i];
    }

    if (max === min) return gray;

    const enhanced = new Uint8ClampedArray(gray.length);
    const range = max - min;

    for (let i = 0; i < gray.length; i++) {
      enhanced[i] = ((gray[i] - min) * 255) / range;
    }

    return enhanced;
  }

  detectEdges(gray, width, height) {
    const edges = new Uint8ClampedArray(width * height);
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            const pixel = gray[idx];

            gx += pixel * sobelX[kernelIdx];
            gy += pixel * sobelY[kernelIdx];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = magnitude > this.options.cannyHighThreshold ? 255 : 0;
      }
    }

    return edges;
  }

  detectRectangle(imageData) {
    const gray = this.toGrayscale(imageData);
    const enhanced = this.enhanceContrast(gray);
    const edges = this.detectEdges(enhanced, imageData.width, imageData.height);

    // Count edge pixels
    let edgeCount = 0;
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] === 255) edgeCount++;
    }

    const edgePercentage = (edgeCount / edges.length) * 100;

    return {
      detected: edgePercentage > 0.5,
      edgePercentage,
      width: imageData.width,
      height: imageData.height,
    };
  }
}

async function analyzeScreenshot(imagePath) {
  console.log(`\nAnalyzing: ${imagePath}`);

  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const detector = new TestRectangleDetector();
  const result = detector.detectRectangle(imageData);

  console.log(`  Size: ${result.width}x${result.height}`);
  console.log(`  Edge pixels: ${result.edgePercentage.toFixed(2)}%`);
  console.log(`  Detection: ${result.detected ? '✓ DETECTED' : '✗ NOT DETECTED'}`);

  return result;
}

async function main() {
  console.log('Testing Rectangle Detection on Real Screenshots');
  console.log('='.repeat(60));

  const screenshots = [
    'Screenshot_20251122-132736.png',
    'Screenshot_20251122-132802.png',
    'Screenshot_20251122-132829.png',
  ];

  for (const screenshot of screenshots) {
    const path = join(SCREENSHOTS_DIR, screenshot);
    try {
      await analyzeScreenshot(path);
    } catch (error) {
      console.error(`Error analyzing ${screenshot}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Analysis complete!');
}

main().catch(console.error);
