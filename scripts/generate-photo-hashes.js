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

import { readdir, stat } from 'fs/promises';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';
import {
  loadImageData,
  createExposureVariants,
  computeDHash,
  computePHash,
  DEFAULT_EXPOSURE_OFFSETS,
} from './lib/photoHashUtils.js';

// Get current directory
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_IMAGE_DIR = resolve(__dirname, '../assets/test-images');

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
  console.log(
    `Hash size: ${algorithm === 'phash' ? '64-bit (16 hex chars)' : '128-bit (32 hex chars)'}`
  );
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
        const imageData = await loadImageData(absolutePath);
        const { width, height } = imageData;
        const exposureVariants = createExposureVariants(imageData, DEFAULT_EXPOSURE_OFFSETS);
        const exposureLabels = ['dark', 'normal', 'bright'];
        const hashes = exposureVariants.map((variant) => computeHash(variant));

        results.push({
          file: displayPath,
          hashes,
          dimensions: `${width} × ${height} px`,
        });

        console.log(`✓ ${displayPath}`);
        hashes.forEach((hash, idx) => {
          const label = exposureLabels[idx] ?? `variant ${idx + 1}`;
          console.log(`  Hash (${label}): ${hash}`);
        });
        console.log(`  Size: ${width} × ${height} px\n`);
      } catch (error) {
        console.error(`❌ Failed to process ${displayPath}:`, error.message);
      }
    }

    console.log('━'.repeat(60));
    console.log(`\n📋 JSON Output (for concerts.json) - ${hashType} hashes:\n`);

    const jsonOutput = results.map((r) => {
      const photoHashes = {
        [algorithm]: r.hashes,
      };

      const entry = {
        file: r.file,
        photoHashes,
        photoHash: r.hashes, // Always include legacy field for backward compatibility
      };

      return entry;
    });

    console.log(JSON.stringify(jsonOutput, null, 2));

    console.log('\n━'.repeat(60));
    console.log(`\n✅ ${hashType} hash generation complete!`);
    console.log('\n💡 Next steps:');
    console.log(`   1. Merge the JSON block above into assets/test-data/concerts.json`);
    console.log('   2. Ensure concert file paths line up with the generated hashes');
    console.log(
      `   3. Use hashAlgorithm: '${algorithm}' option in usePhotoRecognition to enable ${hashType}\n`
    );
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
