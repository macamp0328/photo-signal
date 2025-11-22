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
import { ImageProcessor } from './lib/image-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// NOTE: This is a simplified version of the rectangle detection algorithm
// for quick testing purposes. It doesn't include all the improvements made
// to the actual RectangleDetectionService (convex hull, Douglas-Peucker, etc.)
// but serves to validate the basic edge detection approach.

const SCREENSHOTS_DIR = join(__dirname, '..', 'src', 'test', 'test_real_screenshots');

/**
 * Simplified rectangle detection for testing
 * Uses shared ImageProcessor utilities
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
    this.processor = new ImageProcessor();
  }

  detectRectangle(imageData) {
    const gray = this.processor.toGrayscale(imageData);
    const enhanced = this.processor.enhanceContrast(gray);
    const edges = this.processor.detectEdges(
      enhanced,
      imageData.width,
      imageData.height,
      this.options.cannyHighThreshold
    );

    // Count edge pixels
    const edgeCount = this.processor.countEdgePixels(edges);
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
