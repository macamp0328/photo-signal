#!/usr/bin/env node

/* eslint-env node */

/**
 * Photo Hash Generator Script
 *
 * Generates dHash or pHash values for test images in assets/test-images/
 * Uses the same algorithms as the photo recognition module
 *
 * Usage:
 *   node scripts/generate-photo-hashes.js [--algorithm dhash|phash] [paths...]
 *   npm run generate-hashes (uses default dhash)
 *   npm run generate-hashes -- --algorithm phash
 *
 * Examples:
 *   node scripts/generate-photo-hashes.js --algorithm phash assets/test-images/
 *   node scripts/generate-photo-hashes.js --algorithm dhash image1.jpg image2.png
 */

import { createCanvas, loadImage } from 'canvas';
import { readdir, stat } from 'fs/promises';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_IMAGE_DIR = resolve(__dirname, '../assets/test-images');

// ========================================
// Hash Algorithm Implementations
// (Same as in src/modules/photo-recognition/algorithms/)
// ========================================

/**
 * Resize ImageData to specified dimensions
 */
function resizeImageData(imageData, width, height) {
  const sourceCanvas = createCanvas(imageData.width, imageData.height);
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  sourceCtx.putImageData(imageData, 0, 0);

  const targetCanvas = createCanvas(width, height);
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  targetCtx.drawImage(sourceCanvas, 0, 0, width, height);

  return targetCtx.getImageData(0, 0, width, height);
}

/**
 * Convert ImageData to grayscale array
 */
function toGrayscale(imageData) {
  const grayscale = [];
  const { data } = imageData;

  // ITU-R BT.601 luma coefficients
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

/**
 * Convert binary string to hexadecimal
 */
function binaryToHex(binary) {
  let hex = '';
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.slice(i, i + 4);
    const value = parseInt(chunk, 2);
    hex += value.toString(16);
  }
  return hex;
}

/**
 * Compute dHash (Difference Hash) of an image
 */
function computeDHash(imageData) {
  // Step 1: Resize to 17x8 pixels
  const resized = resizeImageData(imageData, 17, 8);

  // Step 2: Convert to grayscale
  const grayscale = toGrayscale(resized);

  // Step 3: Compute horizontal gradient
  let binaryHash = '';

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 16; col++) {
      const currentIndex = row * 17 + col;
      const nextIndex = currentIndex + 1;

      const currentPixel = grayscale[currentIndex];
      const nextPixel = grayscale[nextIndex];

      // Set bit to 1 if left pixel is brighter than right pixel
      binaryHash += currentPixel > nextPixel ? '1' : '0';
    }
  }

  // Step 4: Convert binary string to hexadecimal
  return binaryToHex(binaryHash);
}

/**
 * Compute 2D Discrete Cosine Transform (DCT) on a matrix
 */
function computeDCT(matrix, size) {
  const dct = Array(size)
    .fill(0)
    .map(() => Array(size).fill(0));

  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;

      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const cosU = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size));
          const cosV = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
          sum += matrix[x][y] * cosU * cosV;
        }
      }

      const alphaU = u === 0 ? 1 / Math.sqrt(2) : 1;
      const alphaV = v === 0 ? 1 / Math.sqrt(2) : 1;
      dct[u][v] = (alphaU * alphaV * sum) / 2;
    }
  }

  return dct;
}

/**
 * Compute pHash (Perceptual Hash) of an image using DCT
 */
function computePHash(imageData) {
  // Step 1: Resize to 32x32 pixels
  const resized = resizeImageData(imageData, 32, 32);

  // Step 2: Convert to grayscale
  const grayscaleArray = toGrayscale(resized);

  // Convert 1D array to 2D matrix
  const matrix = [];
  for (let i = 0; i < 32; i++) {
    matrix[i] = grayscaleArray.slice(i * 32, (i + 1) * 32);
  }

  // Step 3: Compute DCT
  const dct = computeDCT(matrix, 32);

  // Step 4: Extract low-frequency coefficients (top-left 8x8)
  const lowFreq = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      // Skip DC component (0,0)
      if (u === 0 && v === 0) {
        continue;
      }
      lowFreq.push(dct[u][v]);
    }
  }

  // Step 5: Compute median
  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Step 6: Generate 64-bit hash
  let binaryHash = '';
  for (const coeff of lowFreq) {
    binaryHash += coeff > median ? '1' : '0';
  }

  return binaryToHex(binaryHash);
}

/**
 * Adjust image brightness to simulate different exposure levels
 */
function adjustBrightness(imageData, factor) {
  const { width, height, data } = imageData;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const adjusted = ctx.createImageData(width, height);

  for (let i = 0; i < data.length; i += 4) {
    // Adjust RGB channels, keep alpha unchanged
    adjusted.data[i] = Math.max(0, Math.min(255, data[i] + factor)); // R
    adjusted.data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + factor)); // G
    adjusted.data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + factor)); // B
    adjusted.data[i + 3] = data[i + 3]; // A (unchanged)
  }

  return adjusted;
}

// ========================================
// Main Script
// ========================================

async function collectImageFiles(targets) {
  const imageEntries = [];

  const uniquePaths = new Set();

  for (const target of targets) {
    const resolvedTarget = resolve(process.cwd(), target);

    let targetStat;
    try {
      targetStat = await stat(resolvedTarget);
    } catch {
      console.warn(`⚠️  Skipping missing path: ${target}`);
      continue;
    }

    if (targetStat.isDirectory()) {
      const files = await readdir(resolvedTarget);
      for (const file of files) {
        const entryPath = join(resolvedTarget, file);
        if (!/\.(jpg|jpeg|png|webp)$/i.test(file)) {
          continue;
        }
        if (uniquePaths.has(entryPath)) {
          continue;
        }
        uniquePaths.add(entryPath);
        imageEntries.push({
          absolutePath: entryPath,
          displayPath: relative(process.cwd(), entryPath) || file,
        });
      }
    } else if (targetStat.isFile()) {
      if (!/\.(jpg|jpeg|png|webp)$/i.test(resolvedTarget)) {
        console.warn(`⚠️  Skipping non-image file: ${target}`);
        continue;
      }
      if (uniquePaths.has(resolvedTarget)) {
        continue;
      }
      uniquePaths.add(resolvedTarget);
      imageEntries.push({
        absolutePath: resolvedTarget,
        displayPath: relative(process.cwd(), resolvedTarget) || target,
      });
    } else {
      console.warn(`⚠️  Skipping unsupported path: ${target}`);
    }
  }

  return imageEntries.sort((a, b) => a.displayPath.localeCompare(b.displayPath));
}

async function generateHashes() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  let algorithm = 'dhash'; // default
  const imagePaths = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--algorithm' && i + 1 < args.length) {
      algorithm = args[i + 1].toLowerCase();
      if (algorithm !== 'dhash' && algorithm !== 'phash') {
        console.error(`❌ Invalid algorithm: ${algorithm}. Must be 'dhash' or 'phash'.`);
        process.exit(1);
      }
      i++; // skip next arg
    } else {
      imagePaths.push(args[i]);
    }
  }

  const targets = imagePaths.length > 0 ? imagePaths : [DEFAULT_IMAGE_DIR];
  const computeHash = algorithm === 'phash' ? computePHash : computeDHash;
  const hashType = algorithm.toUpperCase();

  console.log('📸 Photo Hash Generator\n');
  console.log(`Algorithm: ${hashType}`);
  console.log(`Hash size: ${algorithm === 'phash' ? '64-bit (16 hex chars)' : '128-bit (32 hex chars)'}`);
  console.log('Targets:');
  targets.forEach((target) => console.log(`  • ${target}`));
  console.log('');

  try {
    const imageFiles = await collectImageFiles(targets);

    if (imageFiles.length === 0) {
      console.log('❌ No image files found for the provided targets');
      process.exit(1);
    }

    console.log(`Found ${imageFiles.length} image(s):\n`);

    const results = [];

    for (const { absolutePath, displayPath } of imageFiles) {
      try {
        const image = await loadImage(absolutePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Generate multi-exposure hashes for lighting robustness
        // Dark (-50), Normal (0), Bright (+50) exposure adjustments
        const darkImageData = adjustBrightness(imageData, -50);
        const normalImageData = imageData; // Original
        const brightImageData = adjustBrightness(imageData, 50);

        const darkHash = computeHash(darkImageData);
        const normalHash = computeHash(normalImageData);
        const brightHash = computeHash(brightImageData);

        results.push({
          file: displayPath,
          photoHash: [darkHash, normalHash, brightHash],
          dimensions: `${image.width} × ${image.height} px`,
        });

        console.log(`✓ ${displayPath}`);
        console.log(`  Hash (dark):   ${darkHash}`);
        console.log(`  Hash (normal): ${normalHash}`);
        console.log(`  Hash (bright): ${brightHash}`);
        console.log(`  Size: ${image.width} × ${image.height} px\n`);
      } catch (error) {
        console.error(`❌ Failed to process ${displayPath}:`, error.message);
      }
    }

    console.log('━'.repeat(60));
    console.log(`\n📋 JSON Output (for concerts.json) - ${hashType} hashes:\n`);

    const jsonOutput = results.map((r) => ({
      file: r.file,
      photoHash: r.photoHash,
    }));

    console.log(JSON.stringify(jsonOutput, null, 2));

    console.log('\n━'.repeat(60));
    console.log(`\n✅ ${hashType} hash generation complete!`);
    console.log('\n💡 Next steps:');
    console.log('   1. Copy the photoHash values from the JSON output above');
    console.log('   2. Add them to the corresponding concerts in assets/test-data/concerts.json');
    console.log(`   3. Match files to concert entries as needed`);
    console.log(`   4. Use hashAlgorithm: '${algorithm}' option in usePhotoRecognition to enable ${hashType}\n`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
generateHashes().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
