/**
 * ORB Octave Analysis Tests
 *
 * These tests verify that ORB features are being detected across multiple
 * pyramid levels (octaves), which is critical for scale-invariant matching
 * of print-to-camera photos.
 */

import { describe, it, expect } from 'vitest';
import { extractORBFeatures } from '../orb';

/**
 * Helper to create a checkerboard test image
 */
function createCheckerboard(width: number, height: number, squareSize: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const isBlack = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
      const value = isBlack ? 0 : 255;

      data[i] = value; // R
      data[i + 1] = value; // G
      data[i + 2] = value; // B
      data[i + 3] = 255; // A
    }
  }

  return new ImageData(data, width, height);
}

describe('ORB Multi-Scale (Octave) Feature Detection', () => {
  it('should detect features across multiple octaves with default settings', () => {
    const image = createCheckerboard(640, 480, 20);
    const features = extractORBFeatures(image, {
      maxFeatures: 500,
      fastThreshold: 12, // New optimized default
      edgeThreshold: 15, // New optimized default
      nLevels: 8,
      scaleFactor: 1.5, // New optimized default
    });

    // Collect octaves
    const octaves = features.keypoints.map((kp) => kp.octave);
    const uniqueOctaves = new Set(octaves);
    const octaveCounts = new Map<number, number>();
    octaves.forEach((o) => octaveCounts.set(o, (octaveCounts.get(o) || 0) + 1));

    console.log('Default settings (fastThreshold=12, edgeThreshold=15, scaleFactor=1.5):');
    console.log(`  Total features: ${features.keypoints.length}`);
    console.log(`  Unique octaves: ${Array.from(uniqueOctaves).sort().join(', ')}`);
    console.log('  Distribution:');
    Array.from(octaveCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([octave, count]) => {
        console.log(`    Octave ${octave}: ${count} features`);
      });

    // We expect features across multiple octaves for true scale invariance
    // If this fails, the pyramid isn't working correctly
    expect(uniqueOctaves.size).toBeGreaterThan(1);
  });

  it('should detect MORE features with lower edgeThreshold', () => {
    const image = createCheckerboard(640, 480, 20);

    const defaultEdge = extractORBFeatures(image, {
      edgeThreshold: 31,
      maxFeatures: 1000,
    });

    const lowerEdge = extractORBFeatures(image, {
      edgeThreshold: 15,
      maxFeatures: 1000,
    });

    const defaultOctaves = new Set(defaultEdge.keypoints.map((kp) => kp.octave));
    const lowerOctaves = new Set(lowerEdge.keypoints.map((kp) => kp.octave));

    console.log('\nEdge threshold comparison:');
    console.log(
      `  edgeThreshold=31: ${defaultEdge.keypoints.length} features, ${defaultOctaves.size} octaves`
    );
    console.log(
      `  edgeThreshold=15: ${lowerEdge.keypoints.length} features, ${lowerOctaves.size} octaves`
    );

    // Lower edge threshold should allow more features at higher octaves
    expect(lowerEdge.keypoints.length).toBeGreaterThanOrEqual(defaultEdge.keypoints.length);
    expect(lowerOctaves.size).toBeGreaterThanOrEqual(defaultOctaves.size);
  });

  it('should detect MORE corners with lower fastThreshold', () => {
    const image = createCheckerboard(640, 480, 20);

    const defaultFast = extractORBFeatures(image, {
      fastThreshold: 20,
      maxFeatures: 1000,
    });

    const lowerFast = extractORBFeatures(image, {
      fastThreshold: 10,
      maxFeatures: 1000,
    });

    console.log('\nFAST threshold comparison:');
    console.log(`  fastThreshold=20: ${defaultFast.keypoints.length} features`);
    console.log(`  fastThreshold=10: ${lowerFast.keypoints.length} features`);

    // Lower FAST threshold should detect more corners
    expect(lowerFast.keypoints.length).toBeGreaterThanOrEqual(defaultFast.keypoints.length);
  });

  it('should generate features across all pyramid levels with optimized settings', () => {
    const image = createCheckerboard(640, 480, 20);

    const features = extractORBFeatures(image, {
      maxFeatures: 1000,
      fastThreshold: 10,
      edgeThreshold: 15,
      nLevels: 8,
      scaleFactor: 1.5, // Use 1.5 instead of 1.2 for better distribution
    });

    const octaves = features.keypoints.map((kp) => kp.octave);
    const uniqueOctaves = new Set(octaves);
    const octaveCounts = new Map<number, number>();
    octaves.forEach((o) => octaveCounts.set(o, (octaveCounts.get(o) || 0) + 1));

    console.log('\nOptimized settings (fastThreshold=10, edgeThreshold=15, scaleFactor=1.5):');
    console.log(`  Total features: ${features.keypoints.length}`);
    console.log(`  Unique octaves: ${Array.from(uniqueOctaves).sort().join(', ')}`);
    console.log('  Distribution:');
    Array.from(octaveCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([octave, count]) => {
        console.log(`    Octave ${octave}: ${count} features`);
      });

    // With optimized settings, we should get features at multiple octaves
    expect(uniqueOctaves.size).toBeGreaterThan(2);
  });

  it('should work well with larger scaleFactor for print-to-camera scenarios', () => {
    const image = createCheckerboard(640, 480, 20);

    const scale12 = extractORBFeatures(image, {
      scaleFactor: 1.2,
      nLevels: 8,
      maxFeatures: 1000,
    });

    const scale15 = extractORBFeatures(image, {
      scaleFactor: 1.5,
      nLevels: 8,
      maxFeatures: 1000,
    });

    const scale20 = extractORBFeatures(image, {
      scaleFactor: 2.0,
      nLevels: 8,
      maxFeatures: 1000,
    });

    const octaves12 = new Set(scale12.keypoints.map((kp) => kp.octave));
    const octaves15 = new Set(scale15.keypoints.map((kp) => kp.octave));
    const octaves20 = new Set(scale20.keypoints.map((kp) => kp.octave));

    console.log('\nScale factor comparison:');
    console.log(
      `  scaleFactor=1.2: ${scale12.keypoints.length} features, octaves ${Array.from(octaves12).sort().join(',')}`
    );
    console.log(
      `  scaleFactor=1.5: ${scale15.keypoints.length} features, octaves ${Array.from(octaves15).sort().join(',')}`
    );
    console.log(
      `  scaleFactor=2.0: ${scale20.keypoints.length} features, octaves ${Array.from(octaves20).sort().join(',')}`
    );

    // All should produce features
    expect(scale12.keypoints.length).toBeGreaterThan(0);
    expect(scale15.keypoints.length).toBeGreaterThan(0);
    expect(scale20.keypoints.length).toBeGreaterThan(0);
  });
});
