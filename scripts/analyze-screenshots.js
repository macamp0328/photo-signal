#!/usr/bin/env node

/**
 * Analyze Test Screenshots for Rectangle Detection Issues
 *
 * This script helps diagnose why rectangle detection may not be working
 * on the user's real-world photos by analyzing the test screenshots.
 */

import { createCanvas, loadImage } from 'canvas';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCREENSHOTS_DIR = join(__dirname, '..', 'src', 'test', 'test_real_screenshots');

// Simplified rectangle detection for analysis
class RectangleAnalyzer {
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

    const enhanced = new Uint8ClampedArray(gray.length);
    if (max === min) return gray;

    const range = max - min;
    for (let i = 0; i < gray.length; i++) {
      enhanced[i] = ((gray[i] - min) * 255) / range;
    }

    return enhanced;
  }

  detectEdges(gray, width, height, threshold = 100) {
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
        edges[y * width + x] = magnitude > threshold ? 255 : 0;
      }
    }

    return edges;
  }

  analyzeImageQuality(imageData) {
    const gray = this.toGrayscale(imageData);

    // Calculate average brightness
    let totalBrightness = 0;
    for (let i = 0; i < gray.length; i++) {
      totalBrightness += gray[i];
    }
    const avgBrightness = totalBrightness / gray.length;

    // Calculate contrast (standard deviation)
    let variance = 0;
    for (let i = 0; i < gray.length; i++) {
      variance += Math.pow(gray[i] - avgBrightness, 2);
    }
    const stdDev = Math.sqrt(variance / gray.length);

    // Enhance and detect edges
    const enhanced = this.enhanceContrast(gray);
    const edges = this.detectEdges(enhanced, imageData.width, imageData.height, 100);

    // Count edge pixels
    let edgeCount = 0;
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] === 255) edgeCount++;
    }
    const edgePercentage = (edgeCount / edges.length) * 100;

    return {
      avgBrightness: avgBrightness.toFixed(1),
      contrast: stdDev.toFixed(1),
      edgePercentage: edgePercentage.toFixed(2),
      quality: this.assessQuality(avgBrightness, stdDev, edgePercentage),
    };
  }

  assessQuality(brightness, contrast, edgePercentage) {
    const issues = [];

    if (brightness < 50) {
      issues.push('Too dark');
    } else if (brightness > 200) {
      issues.push('Too bright');
    }

    if (contrast < 30) {
      issues.push('Low contrast');
    }

    if (edgePercentage < 1) {
      issues.push('Very few edges detected');
    } else if (edgePercentage > 15) {
      issues.push('Too many edges (noisy/complex background)');
    }

    return issues.length === 0 ? 'GOOD' : issues.join(', ');
  }
}

async function analyzeScreenshot(imagePath, filename) {
  console.log(`\n📸 ${filename}`);
  console.log('─'.repeat(60));

  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const analyzer = new RectangleAnalyzer();
    const analysis = analyzer.analyzeImageQuality(imageData);

    console.log(`  Resolution: ${image.width}×${image.height}px`);
    console.log(`  Brightness: ${analysis.avgBrightness} / 255 (optimal: 80-180)`);
    console.log(`  Contrast:   ${analysis.contrast} (optimal: >40)`);
    console.log(`  Edges:      ${analysis.edgePercentage}% (optimal: 2-10%)`);
    console.log(`  Quality:    ${analysis.quality}`);

    return analysis;
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n📊 Rectangle Detection Analysis');
  console.log('='.repeat(60));
  console.log('\nAnalyzing real-world screenshots to diagnose detection issues...\n');

  if (!existsSync(SCREENSHOTS_DIR)) {
    console.error(`❌ Screenshots directory not found: ${SCREENSHOTS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(SCREENSHOTS_DIR)
    .filter((f) => f.match(/\.(png|jpg|jpeg)$/i))
    .sort();

  if (files.length === 0) {
    console.error('❌ No image files found in screenshots directory');
    process.exit(1);
  }

  const analyses = [];
  for (const file of files) {
    const path = join(SCREENSHOTS_DIR, file);
    const analysis = await analyzeScreenshot(path, file);
    if (analysis) {
      analyses.push({ file, ...analysis });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Summary');
  console.log('='.repeat(60));

  const goodCount = analyses.filter((a) => a.quality === 'GOOD').length;
  const totalCount = analyses.length;

  console.log(`\nAnalyzed ${totalCount} screenshot(s)`);
  console.log(`  Good quality: ${goodCount}`);
  console.log(`  Issues found: ${totalCount - goodCount}`);

  console.log('\n💡 Recommendations:');
  console.log('─'.repeat(60));
  console.log('1. Ensure good, even lighting on the photo');
  console.log('2. Avoid glare and reflections on the photo surface');
  console.log('3. Place photo on a simple, contrasting background');
  console.log('4. Fill more of the frame with the photo (get closer)');
  console.log('5. Hold the camera steady to avoid motion blur');
  console.log('\n⚠️  IMPORTANT: Photo Recognition Setup');
  console.log('─'.repeat(60));
  console.log("Rectangle detection alone won't identify which concert it is.");
  console.log('You need to generate photo hashes for your printed photos:');
  console.log('');
  console.log('  1. Take a clear photo of each printed concert photo');
  console.log('  2. Save to assets/example-real-photos/');
  console.log('  3. Run: npm run generate-hashes assets/example-real-photos');
  console.log('  4. Copy the generated hashes to public/data.json');
  console.log('  5. Test again in the app');
  console.log('');
  console.log('See README.md for complete setup instructions.');
  console.log('');
}

main().catch(console.error);
