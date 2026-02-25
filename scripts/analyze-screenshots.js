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
import { ImageProcessor } from './lib/image-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCREENSHOTS_DIR = join(__dirname, '..', 'src', 'test', 'test_real_screenshots');

// Simplified rectangle detection for analysis
// Uses shared ImageProcessor utilities
class RectangleAnalyzer {
  constructor() {
    this.processor = new ImageProcessor();
  }

  analyzeImage(imageData) {
    const gray = this.processor.toGrayscale(imageData);
    const stats = this.processor.calculateStats(gray);
    const enhanced = this.processor.enhanceContrast(gray);
    const edges = this.processor.detectEdges(enhanced, imageData.width, imageData.height);
    const edgeCount = this.processor.countEdgePixels(edges);
    const edgePercentage = (edgeCount / (imageData.width * imageData.height)) * 100;

    return { stats, edgePercentage };
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
    const { stats, edgePercentage } = analyzer.analyzeImage(imageData);

    console.log(`  Resolution: ${image.width}×${image.height}px`);
    console.log(`  Brightness: ${stats.mean.toFixed(1)} / 255 (optimal: 80-180)`);
    console.log(`  Contrast:   ${stats.stdDev.toFixed(1)} (optimal: >40)`);
    console.log(`  Edges:      ${edgePercentage.toFixed(2)}% (optimal: 2-10%)`);

    const quality = analyzer.assessQuality(stats.mean, stats.stdDev, edgePercentage);
    console.log(`  Quality:    ${quality}`);

    return {
      avgBrightness: stats.mean.toFixed(1),
      contrast: stats.stdDev.toFixed(1),
      edgePercentage: edgePercentage.toFixed(2),
      quality,
    };
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
  console.log('  3. Run: npm run hashes:paths -- --paths assets/example-real-photos');
  console.log('  4. Copy the generated hashes to public/data.recognition.v2.json');
  console.log('  5. Test again in the app');
  console.log('');
  console.log('See README.md for complete setup instructions.');
  console.log('');
}

main().catch(console.error);
