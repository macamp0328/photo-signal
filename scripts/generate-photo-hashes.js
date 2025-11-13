#!/usr/bin/env node

/* eslint-env node */

/**
 * Photo Hash Generator Script
 *
 * Generates dHash values for test images in assets/test-images/
 * Uses the same dHash algorithm as the photo recognition module
 *
 * Usage:
 *   node scripts/generate-photo-hashes.js
 *   npm run generate-hashes (if npm script is added)
 */

import { createCanvas, loadImage } from 'canvas';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __dirname = dirname(fileURLToPath(import.meta.url));

// ========================================
// dHash Algorithm Implementation
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

// ========================================
// Main Script
// ========================================

async function generateHashes() {
  const testImagesDir = join(__dirname, '../assets/test-images');

  console.log('📸 Photo Hash Generator\n');
  console.log(`Scanning directory: ${testImagesDir}\n`);

  try {
    // Read all files in the test images directory
    const files = await readdir(testImagesDir);

    // Filter for image files
    const imageFiles = files.filter((file) => /\.(jpg|jpeg|png|webp)$/i.test(file)).sort();

    if (imageFiles.length === 0) {
      console.log('❌ No image files found in test-images directory');
      process.exit(1);
    }

    console.log(`Found ${imageFiles.length} image(s):\n`);

    const results = [];

    // Process each image
    for (const filename of imageFiles) {
      const imagePath = join(testImagesDir, filename);

      try {
        // Load image
        const image = await loadImage(imagePath);

        // Create canvas and get ImageData
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Compute hash
        const hash = computeDHash(imageData);

        // Store result
        results.push({
          file: filename,
          photoHash: hash,
          dimensions: `${image.width} × ${image.height} px`,
        });

        console.log(`✓ ${filename}`);
        console.log(`  Hash: ${hash}`);
        console.log(`  Size: ${image.width} × ${image.height} px\n`);
      } catch (error) {
        console.error(`❌ Failed to process ${filename}:`, error.message);
      }
    }

    // Output results
    console.log('━'.repeat(60));
    console.log('\n📋 JSON Output (for concerts.json):\n');

    const jsonOutput = results.map((r) => ({
      file: r.file,
      photoHash: r.photoHash,
    }));

    console.log(JSON.stringify(jsonOutput, null, 2));

    console.log('\n━'.repeat(60));
    console.log('\n✅ Hash generation complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Copy the photoHash values from the JSON output above');
    console.log('   2. Add them to the corresponding concerts in assets/test-data/concerts.json');
    console.log('   3. Match concert-1.jpg → concert id:1, concert-2.jpg → id:2, etc.\n');
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
