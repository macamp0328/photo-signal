/**
 * Edge Case Accuracy Regression Tests
 *
 * Validates that photo recognition accuracy meets expected thresholds
 * for each edge case category defined in docs/image-recognition-exploratory-analysis.md
 *
 * These tests ensure Phase 1 improvements (sharpness detection, glare guidance,
 * multi-exposure hashing) maintain or improve accuracy as documented in Section 4.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createCanvas, loadImage } from 'canvas';
import { computePHash } from '../algorithms/phash';
import { hammingDistance } from '../algorithms/hamming';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DATA_PATH = join(__dirname, '..', '..', '..', '..', 'assets', 'test-data', 'concerts.json');

interface EdgeCaseMetadata {
  category: string;
  severity: string;
  description: string;
  expectedAccuracy: number;
}

interface Concert {
  id: number;
  band: string;
  imageFile: string;
  photoHash?: string[];
  photoHashes?: {
    phash?: string[];
    dhash?: string[];
  };
  edgeCase?: EdgeCaseMetadata;
}

interface TestData {
  concerts: Concert[];
}

/**
 * Load concert data from test dataset
 */
async function loadTestData(): Promise<TestData> {
  const data = await readFile(TEST_DATA_PATH, 'utf-8');
  return JSON.parse(data);
}

/**
 * Compute hash for an image file
 */
async function computeHashForImage(imagePath: string): Promise<string> {
  const fullPath = join(__dirname, '..', '..', '..', '..', imagePath);
  const image = await loadImage(fullPath);

  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return computePHash(imageData as unknown as ImageData);
}

/**
 * Find best matching hash from reference set
 */
function findBestMatch(
  testHash: string,
  referenceHashes: string[],
  threshold: number = 40
): { distance: number; similarity: number; matches: boolean } {
  let bestDistance = Infinity;

  for (const refHash of referenceHashes) {
    const distance = hammingDistance(testHash, refHash);
    if (distance < bestDistance) {
      bestDistance = distance;
    }
  }

  const similarity = ((256 - bestDistance) / 256) * 100;
  const matches = bestDistance <= threshold;

  return { distance: bestDistance, similarity, matches };
}

describe('Edge Case Accuracy Regression Tests', () => {
  let testData: TestData;
  let edgeCases: Concert[];

  beforeAll(async () => {
    testData = await loadTestData();
    // Filter to only edge case entries (IDs 13-24)
    edgeCases = testData.concerts.filter((concert) => concert.edgeCase !== undefined);
  });

  describe('Dataset Validation', () => {
    it('should load edge case test data', () => {
      expect(testData).toBeDefined();
      expect(testData.concerts).toBeInstanceOf(Array);
      expect(edgeCases.length).toBeGreaterThan(0);
    });

    it('should have 12 edge case entries', () => {
      expect(edgeCases).toHaveLength(12);
    });

    it('should have edge cases for all categories', () => {
      const categories = new Set(edgeCases.map((c) => c.edgeCase!.category));
      expect(categories).toContain('motion-blur');
      expect(categories).toContain('glare');
      expect(categories).toContain('poor-lighting');
      expect(categories).toContain('angle');
      expect(categories).toContain('combined');
    });

    it('should have reference hashes for all edge cases', () => {
      edgeCases.forEach((concert) => {
        const hashes = concert.photoHashes?.phash || concert.photoHash;
        expect(hashes).toBeDefined();
        expect(Array.isArray(hashes)).toBe(true);
        expect(hashes!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Motion Blur Category', () => {
    it('should meet accuracy threshold for light motion blur (≥80%)', async () => {
      const lightBlur = edgeCases.find(
        (c) => c.edgeCase?.category === 'motion-blur' && c.edgeCase?.severity === 'light'
      );
      expect(lightBlur).toBeDefined();

      const testHash = await computeHashForImage(lightBlur!.imageFile);
      const referenceHashes = lightBlur!.photoHashes?.phash || lightBlur!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      expect(result.matches).toBe(true);
      expect(result.similarity).toBeGreaterThanOrEqual(lightBlur!.edgeCase!.expectedAccuracy * 100);
    });

    it('should meet accuracy threshold for moderate motion blur (≥60%)', async () => {
      const moderateBlur = edgeCases.find(
        (c) => c.edgeCase?.category === 'motion-blur' && c.edgeCase?.severity === 'moderate'
      );
      expect(moderateBlur).toBeDefined();

      const testHash = await computeHashForImage(moderateBlur!.imageFile);
      const referenceHashes = moderateBlur!.photoHashes?.phash || moderateBlur!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      // For moderate blur, we expect lower accuracy but still some recognition capability
      expect(result.similarity).toBeGreaterThanOrEqual(
        moderateBlur!.edgeCase!.expectedAccuracy * 100
      );
    });

    it('should attempt recognition for heavy motion blur (≥40%)', async () => {
      const heavyBlur = edgeCases.find(
        (c) => c.edgeCase?.category === 'motion-blur' && c.edgeCase?.severity === 'heavy'
      );
      expect(heavyBlur).toBeDefined();

      const testHash = await computeHashForImage(heavyBlur!.imageFile);
      const referenceHashes = heavyBlur!.photoHashes?.phash || heavyBlur!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      // Heavy blur is very challenging - we expect low similarity but testing infrastructure is working
      expect(result.similarity).toBeGreaterThanOrEqual(heavyBlur!.edgeCase!.expectedAccuracy * 100);
    });
  });

  describe('Glare Category', () => {
    it('should meet accuracy threshold for light glare (≥85%)', async () => {
      const lightGlare = edgeCases.find(
        (c) => c.edgeCase?.category === 'glare' && c.edgeCase?.severity === 'light'
      );
      expect(lightGlare).toBeDefined();

      const testHash = await computeHashForImage(lightGlare!.imageFile);
      const referenceHashes = lightGlare!.photoHashes?.phash || lightGlare!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      expect(result.matches).toBe(true);
      expect(result.similarity).toBeGreaterThanOrEqual(lightGlare!.edgeCase!.expectedAccuracy * 100);
    });

    it('should meet accuracy threshold for moderate glare (≥70%)', async () => {
      const moderateGlare = edgeCases.find(
        (c) => c.edgeCase?.category === 'glare' && c.edgeCase?.severity === 'moderate'
      );
      expect(moderateGlare).toBeDefined();

      const testHash = await computeHashForImage(moderateGlare!.imageFile);
      const referenceHashes = moderateGlare!.photoHashes?.phash || moderateGlare!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      expect(result.similarity).toBeGreaterThanOrEqual(
        moderateGlare!.edgeCase!.expectedAccuracy * 100
      );
    });

    it('should meet accuracy threshold for heavy glare (≥70%)', async () => {
      const heavyGlare = edgeCases.find(
        (c) => c.edgeCase?.category === 'glare' && c.edgeCase?.severity === 'heavy'
      );
      expect(heavyGlare).toBeDefined();

      const testHash = await computeHashForImage(heavyGlare!.imageFile);
      const referenceHashes = heavyGlare!.photoHashes?.phash || heavyGlare!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      expect(result.similarity).toBeGreaterThanOrEqual(heavyGlare!.edgeCase!.expectedAccuracy * 100);
    });
  });

  describe('Lighting Category', () => {
    it('should meet accuracy threshold for low-light conditions (≥75%)', async () => {
      const lowLight = edgeCases.find((c) => c.edgeCase?.category === 'poor-lighting');
      expect(lowLight).toBeDefined();

      const testHash = await computeHashForImage(lowLight!.imageFile);
      const referenceHashes = lowLight!.photoHashes?.phash || lowLight!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      expect(result.similarity).toBeGreaterThanOrEqual(lowLight!.edgeCase!.expectedAccuracy * 100);
    });
  });

  describe('Angle Category', () => {
    it('should meet accuracy threshold for 15-degree angle (≥85%)', async () => {
      const angle15 = edgeCases.find(
        (c) => c.edgeCase?.category === 'angle' && c.edgeCase?.severity === 'light'
      );
      expect(angle15).toBeDefined();

      const testHash = await computeHashForImage(angle15!.imageFile);
      const referenceHashes = angle15!.photoHashes?.phash || angle15!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      expect(result.matches).toBe(true);
      expect(result.similarity).toBeGreaterThanOrEqual(angle15!.edgeCase!.expectedAccuracy * 100);
    });

    it('should meet accuracy threshold for 30-degree angle (≥70%)', async () => {
      const angle30 = edgeCases.find(
        (c) => c.edgeCase?.category === 'angle' && c.edgeCase?.severity === 'moderate'
      );
      expect(angle30).toBeDefined();

      const testHash = await computeHashForImage(angle30!.imageFile);
      const referenceHashes = angle30!.photoHashes?.phash || angle30!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      expect(result.similarity).toBeGreaterThanOrEqual(angle30!.edgeCase!.expectedAccuracy * 100);
    });

    it('should meet accuracy threshold for 45-degree angle (≥50%)', async () => {
      const angle45 = edgeCases.find(
        (c) => c.edgeCase?.category === 'angle' && c.edgeCase?.severity === 'severe'
      );
      expect(angle45).toBeDefined();

      const testHash = await computeHashForImage(angle45!.imageFile);
      const referenceHashes = angle45!.photoHashes?.phash || angle45!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      expect(result.similarity).toBeGreaterThanOrEqual(angle45!.edgeCase!.expectedAccuracy * 100);
    });
  });

  describe('Combined Edge Cases', () => {
    it('should meet accuracy threshold for blur + glare combination (≥60%)', async () => {
      const combined = edgeCases.find(
        (c) =>
          c.edgeCase?.category === 'combined' && c.band.includes('Blur + Glare')
      );
      expect(combined).toBeDefined();

      const testHash = await computeHashForImage(combined!.imageFile);
      const referenceHashes = combined!.photoHashes?.phash || combined!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      expect(result.similarity).toBeGreaterThanOrEqual(combined!.edgeCase!.expectedAccuracy * 100);
    });

    it('should meet accuracy threshold for angle + low light combination (≥60%)', async () => {
      const combined = edgeCases.find(
        (c) =>
          c.edgeCase?.category === 'combined' && c.band.includes('Angle + Low Light')
      );
      expect(combined).toBeDefined();

      const testHash = await computeHashForImage(combined!.imageFile);
      const referenceHashes = combined!.photoHashes?.phash || combined!.photoHash!;
      const result = findBestMatch(testHash, referenceHashes);

      expect(result.similarity).toBeGreaterThanOrEqual(combined!.edgeCase!.expectedAccuracy * 100);
    });
  });

  describe('Overall Edge Case Performance', () => {
    it('should maintain average accuracy above baseline across all edge cases', async () => {
      const results = await Promise.all(
        edgeCases.map(async (concert) => {
          const testHash = await computeHashForImage(concert.imageFile);
          const referenceHashes = concert.photoHashes?.phash || concert.photoHash!;
          const result = findBestMatch(testHash, referenceHashes);
          return {
            concert: concert.band,
            category: concert.edgeCase!.category,
            expectedAccuracy: concert.edgeCase!.expectedAccuracy,
            actualSimilarity: result.similarity / 100,
            meetsThreshold: result.similarity >= concert.edgeCase!.expectedAccuracy * 100,
          };
        })
      );

      // Calculate average accuracy
      const avgAccuracy = results.reduce((sum, r) => sum + r.actualSimilarity, 0) / results.length;

      // Log detailed results for debugging
      console.log('\n📊 Edge Case Performance Summary:');
      console.log('━'.repeat(80));
      results.forEach((r) => {
        const status = r.meetsThreshold ? '✓' : '✗';
        console.log(
          `${status} ${r.concert.padEnd(45)} ${(r.actualSimilarity * 100).toFixed(1)}% (target: ${(r.expectedAccuracy * 100).toFixed(0)}%)`
        );
      });
      console.log('━'.repeat(80));
      console.log(`Average Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);

      const passedCount = results.filter((r) => r.meetsThreshold).length;
      const passRate = (passedCount / results.length) * 100;
      console.log(`Pass Rate: ${passRate.toFixed(0)}% (${passedCount}/${results.length})`);
      console.log('━'.repeat(80) + '\n');

      // At least 75% of edge cases should meet their individual thresholds
      expect(passRate).toBeGreaterThanOrEqual(75);

      // Overall average accuracy should be above 65% (baseline from exploratory analysis Section 4)
      expect(avgAccuracy).toBeGreaterThanOrEqual(0.65);
    });
  });
});
