#!/usr/bin/env node

/**
 * Recognition Accuracy Test Script
 *
 * Tests each photo recognition algorithm (dHash, pHash, ORB) against reference images
 * to determine which algorithms actually work for the real use case: pointing a phone
 * camera at a printed photo and identifying it.
 *
 * This is a basic sanity test - if an algorithm can't even match the original reference
 * photo against its own stored hash, it definitely won't work with a camera.
 *
 * Usage:
 *   node scripts/recognition-accuracy-test.js
 *
 * Output:
 *   - Per-concert test results
 *   - Timing data for each algorithm
 *   - Summary table showing accuracy and speed
 *   - Recommendations on which algorithms to keep/remove
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, '..', 'public', 'data.json');

// Algorithm implementations (converted from TS to inline JS)
function resizeImageData(imageData, targetWidth, targetHeight) {
  const canvas = createCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');

  // Create temporary canvas with original image
  const srcCanvas = createCanvas(imageData.width, imageData.height);
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.putImageData(imageData, 0, 0);

  // Draw resized
  ctx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);
  return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

function toGrayscale(imageData) {
  const grayscale = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    // Luminance formula
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    grayscale.push(gray);
  }
  return grayscale;
}

function binaryToHex(binary) {
  let hex = '';
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.slice(i, i + 4);
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex;
}

function hexToBinary(hex) {
  let binary = '';
  for (let i = 0; i < hex.length; i++) {
    binary += parseInt(hex[i], 16).toString(2).padStart(4, '0');
  }
  return binary;
}

function hammingDistance(hash1, hash2) {
  if (hash1.length !== hash2.length) {
    throw new Error('Hash lengths must be equal');
  }

  const binary1 = hexToBinary(hash1);
  const binary2 = hexToBinary(hash2);

  let distance = 0;
  for (let i = 0; i < binary1.length; i++) {
    if (binary1[i] !== binary2[i]) {
      distance++;
    }
  }
  return distance;
}

function computeDHash(imageData) {
  // Resize to 17x8
  const resized = resizeImageData(imageData, 17, 8);
  const grayscale = toGrayscale(resized);

  let binaryHash = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 16; col++) {
      const currentIndex = row * 17 + col;
      const nextIndex = currentIndex + 1;
      const currentPixel = grayscale[currentIndex];
      const nextPixel = grayscale[nextIndex];
      binaryHash += currentPixel > nextPixel ? '1' : '0';
    }
  }

  return binaryToHex(binaryHash);
}

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

function computePHash(imageData) {
  // Resize to 32x32
  const resized = resizeImageData(imageData, 32, 32);
  const grayscaleArray = toGrayscale(resized);

  // Convert to 2D matrix
  const matrix = [];
  for (let i = 0; i < 32; i++) {
    matrix[i] = grayscaleArray.slice(i * 32, (i + 1) * 32);
  }

  // Compute DCT
  const dct = computeDCT(matrix, 32);

  // Extract low-frequency coefficients (top-left 8x8, skip DC)
  const lowFreq = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      if (u === 0 && v === 0) continue; // Skip DC component
      lowFreq.push(dct[u][v]);
    }
  }

  // Compute median
  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Generate hash
  let binaryHash = '';
  for (const coeff of lowFreq) {
    binaryHash += coeff > median ? '1' : '0';
  }

  return binaryToHex(binaryHash);
}

// Load and process image
async function loadImageData(imagePath) {
  const fullPath = join(__dirname, '..', imagePath);
  const image = await loadImage(fullPath);

  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Test a single algorithm
async function testAlgorithm(concert, imageData, algorithm, concerts) {
  const startTime = performance.now();
  let hash;
  let distance;
  let bestMatch = null;
  let bestDistance = Infinity;

  if (algorithm === 'dhash' || algorithm === 'phash') {
    // Compute hash
    hash = algorithm === 'dhash' ? computeDHash(imageData) : computePHash(imageData);

    // Find best match among all concerts
    for (const testConcert of concerts) {
      const hashes = testConcert.photoHashes?.[algorithm];
      if (!hashes || hashes.length === 0) continue;

      // Compare against all exposure variants
      for (const refHash of hashes) {
        const dist = hammingDistance(hash, refHash);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestMatch = testConcert;
        }
      }
    }

    distance = bestDistance;
  } else if (algorithm === 'orb') {
    // For ORB, we'd need to extract features and match
    // This is more complex, so we'll skip for now
    // and just check if ORB features exist
    const endTime = performance.now();
    return {
      algorithm: 'orb',
      success: false,
      error: 'ORB matching not implemented in test script',
      executionTime: endTime - startTime,
    };
  }

  const endTime = performance.now();
  const executionTime = endTime - startTime;

  // Determine if it's a correct match
  const isCorrect = bestMatch && bestMatch.id === concert.id;
  const isWrongMatch = bestMatch && bestMatch.id !== concert.id;
  const isNoMatch = !bestMatch;

  // Calculate similarity percentage
  const maxDistance = algorithm === 'dhash' ? 128 : 64;
  const similarity = ((maxDistance - distance) / maxDistance) * 100;

  return {
    algorithm,
    success: isCorrect,
    hash,
    distance,
    similarity: similarity.toFixed(1),
    matchedConcert: bestMatch ? bestMatch.band : null,
    expectedConcert: concert.band,
    isCorrect,
    isWrongMatch,
    isNoMatch,
    executionTime,
  };
}

// Main test runner
async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       Photo Recognition Algorithm Accuracy Test              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Load concert data
  console.log('Loading concert data from public/data.json...');
  const dataJson = await readFile(DATA_PATH, 'utf-8');
  const data = JSON.parse(dataJson);
  const concerts = data.concerts;

  console.log(`Loaded ${concerts.length} concerts\n`);

  // Filter concerts that have image files
  const testableConcerts = concerts.filter((c) => c.imageFile);
  console.log(`Found ${testableConcerts.length} concerts with image files\n`);

  // Track results
  const results = {
    dhash: { correct: 0, wrong: 0, noMatch: 0, times: [] },
    phash: { correct: 0, wrong: 0, noMatch: 0, times: [] },
    orb: { correct: 0, wrong: 0, noMatch: 0, times: [] },
  };

  // Test each concert
  for (let i = 0; i < testableConcerts.length; i++) {
    const concert = testableConcerts[i];
    console.log(`\n[${i + 1}/${testableConcerts.length}] Testing: ${concert.band}`);
    console.log('─'.repeat(60));

    try {
      // Load image
      const imageData = await loadImageData(concert.imageFile);
      console.log(`  Image: ${concert.imageFile}`);
      console.log(`  Size: ${imageData.width}x${imageData.height}px`);

      // Test dHash
      if (concert.photoHashes?.dhash) {
        const result = await testAlgorithm(concert, imageData, 'dhash', concerts);
        console.log(
          `  dHash: ${result.success ? '✓' : '✗'} ${result.matchedConcert || 'NO MATCH'} (distance: ${result.distance}, ${result.similarity}% similar, ${result.executionTime.toFixed(2)}ms)`
        );
        if (result.isCorrect) results.dhash.correct++;
        else if (result.isWrongMatch) results.dhash.wrong++;
        else results.dhash.noMatch++;
        results.dhash.times.push(result.executionTime);
      } else {
        console.log(`  dHash: SKIPPED (no stored hashes)`);
      }

      // Test pHash
      if (concert.photoHashes?.phash) {
        const result = await testAlgorithm(concert, imageData, 'phash', concerts);
        console.log(
          `  pHash: ${result.success ? '✓' : '✗'} ${result.matchedConcert || 'NO MATCH'} (distance: ${result.distance}, ${result.similarity}% similar, ${result.executionTime.toFixed(2)}ms)`
        );
        if (result.isCorrect) results.phash.correct++;
        else if (result.isWrongMatch) results.phash.wrong++;
        else results.phash.noMatch++;
        results.phash.times.push(result.executionTime);
      } else {
        console.log(`  pHash: SKIPPED (no stored hashes)`);
      }

      // Test ORB (placeholder)
      if (concert.orbFeatures) {
        console.log(`  ORB: SKIPPED (matching not implemented in test script)`);
      } else {
        console.log(`  ORB: SKIPPED (no stored features)`);
      }
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
    }
  }

  // Print summary
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        SUMMARY                                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const algorithms = ['dhash', 'phash'];
  for (const algo of algorithms) {
    const { correct, wrong, noMatch, times } = results[algo];
    const total = correct + wrong + noMatch;

    if (total === 0) {
      console.log(`${algo.toUpperCase()}: No tests run\n`);
      continue;
    }

    const accuracy = ((correct / total) * 100).toFixed(1);
    const avgTime =
      times.length > 0 ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2) : 0;
    const minTime = times.length > 0 ? Math.min(...times).toFixed(2) : 0;
    const maxTime = times.length > 0 ? Math.max(...times).toFixed(2) : 0;

    console.log(`${algo.toUpperCase()}:`);
    console.log(`  Accuracy: ${accuracy}% (${correct}/${total})`);
    console.log(`    ✓ Correct matches: ${correct}`);
    console.log(`    ✗ Wrong matches: ${wrong}`);
    console.log(`    ∅ No matches: ${noMatch}`);
    console.log(`  Speed: ${avgTime}ms avg (${minTime}ms min, ${maxTime}ms max)`);
    console.log('');
  }

  // Recommendations
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                     RECOMMENDATIONS                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const dhashAccuracy =
    results.dhash.correct / (results.dhash.correct + results.dhash.wrong + results.dhash.noMatch) ||
    0;
  const phashAccuracy =
    results.phash.correct / (results.phash.correct + results.phash.wrong + results.phash.noMatch) ||
    0;

  const dhashAvgTime =
    results.dhash.times.length > 0
      ? results.dhash.times.reduce((a, b) => a + b, 0) / results.dhash.times.length
      : 0;
  const phashAvgTime =
    results.phash.times.length > 0
      ? results.phash.times.reduce((a, b) => a + b, 0) / results.phash.times.length
      : 0;

  console.log('Based on this basic sanity test:\n');

  // Accuracy analysis
  if (dhashAccuracy < 0.5 && phashAccuracy < 0.5) {
    console.log('⚠️  CRITICAL: Both algorithms have <50% accuracy on reference images!');
    console.log('   This indicates a fundamental problem with the stored hashes.');
    console.log('   Recommendation: Regenerate ALL reference hashes from actual photos.\n');
  } else if (dhashAccuracy < 0.8 || phashAccuracy < 0.8) {
    console.log('⚠️  WARNING: At least one algorithm has <80% accuracy.');
    console.log('   This is concerning for a basic sanity test with reference images.');
    console.log('   Consider regenerating hashes for failed matches.\n');
  }

  // Speed comparison
  console.log('Speed:');
  if (dhashAvgTime > 0 && phashAvgTime > 0) {
    console.log(
      `  dHash is ${(phashAvgTime / dhashAvgTime).toFixed(1)}x faster than pHash (${dhashAvgTime.toFixed(2)}ms vs ${phashAvgTime.toFixed(2)}ms)`
    );
  }
  console.log('  QR codes typically scan in <200ms for comparison\n');

  // Algorithm recommendations
  console.log('Keep/Remove Recommendations:\n');

  if (dhashAccuracy >= 0.9 && phashAccuracy >= 0.9) {
    console.log('✓ KEEP DHASH: High accuracy (>90%), fastest algorithm');
    console.log('✓ KEEP PHASH: High accuracy (>90%), more robust to variations');
    console.log('? EVALUATE ORB: Not tested in this script, but likely slowest');
    console.log('  Recommendation: Keep dHash as primary, pHash as fallback');
  } else if (dhashAccuracy >= 0.8 && phashAccuracy >= 0.8) {
    console.log('✓ KEEP DHASH: Good accuracy (>80%), fastest algorithm');
    console.log('✓ KEEP PHASH: Good accuracy (>80%), more robust to variations');
    console.log('? EVALUATE ORB: Consider for difficult cases');
    console.log('  Recommendation: Use pHash as primary for better robustness');
  } else if (phashAccuracy > dhashAccuracy && phashAccuracy >= 0.7) {
    console.log('✗ CONSIDER REMOVING DHASH: Lower accuracy than pHash');
    console.log('✓ KEEP PHASH: Better accuracy, worth the performance cost');
    console.log('? EVALUATE ORB: May be needed for robustness');
    console.log('  Recommendation: Use pHash as primary, consider ORB for fallback');
  } else if (dhashAccuracy > phashAccuracy && dhashAccuracy >= 0.7) {
    console.log('✓ KEEP DHASH: Better accuracy, faster performance');
    console.log('✗ CONSIDER REMOVING PHASH: Lower accuracy, slower');
    console.log('? EVALUATE ORB: May be needed for robustness');
    console.log('  Recommendation: Use dHash as primary');
  } else {
    console.log('⚠️  Both algorithms show poor accuracy (<70%)');
    console.log('  Recommendation: Regenerate hashes and retest');
    console.log('  Consider implementing ORB testing in this script');
  }

  console.log('\n');
  console.log('NOTE: This is a basic sanity test using reference images.');
  console.log('Real-world camera testing may show different results due to:');
  console.log('  - Camera angle variations');
  console.log('  - Lighting conditions');
  console.log('  - Print quality and surface (matte vs glossy)');
  console.log('  - Distance from camera');
  console.log('  - Motion blur and focus issues\n');
}

// Run the tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
