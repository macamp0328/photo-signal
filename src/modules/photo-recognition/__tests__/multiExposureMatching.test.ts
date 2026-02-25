/**
 * Tests for multi-exposure hash matching logic
 */

import { describe, it, expect } from 'vitest';
import { hammingDistance } from '../algorithms/hamming';

describe('Multi-Exposure Hash Matching', () => {
  describe('Multi-exposure matching logic', () => {
    it('should find best match across multiple exposure variants', () => {
      // Simulate a concert with 3 exposure hashes
      const referenceHashes = [
        '0000000000000000000000000000ffff', // dark
        '00000000000000000000000000ffffff', // normal
        '000000000000000000000000ffffffff', // bright
      ];

      // Frame hash that closely matches the "bright" variant
      const frameHash = '000000000000000000000000fffffffe';

      // Find best match across all variants
      let bestDistance = Infinity;
      let matchedIndex = -1;

      for (let i = 0; i < referenceHashes.length; i++) {
        const distance = hammingDistance(frameHash, referenceHashes[i]);
        if (distance < bestDistance) {
          bestDistance = distance;
          matchedIndex = i;
        }
      }

      // Should match the bright variant (index 2) with minimal distance
      expect(matchedIndex).toBe(2);
      expect(bestDistance).toBeLessThan(10); // Very close match
    });

    it('should work with single-hash concerts', () => {
      const referenceHashes = ['00000000000000000000000000ffffff']; // single hash
      const frameHash = '00000000000000000000000000fffffe'; // close match

      let bestDistance = Infinity;
      let matchedIndex = -1;

      for (let i = 0; i < referenceHashes.length; i++) {
        const distance = hammingDistance(frameHash, referenceHashes[i]);
        if (distance < bestDistance) {
          bestDistance = distance;
          matchedIndex = i;
        }
      }

      expect(matchedIndex).toBe(0);
      expect(bestDistance).toBeLessThan(10);
    });

    it('should choose the exposure variant with minimum distance', () => {
      const referenceHashes = [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaa0000', // dark: different
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaa00ff', // normal: somewhat close
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // bright: exact match
      ];

      const frameHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

      const distances = referenceHashes.map((hash) => hammingDistance(frameHash, hash));

      const bestDistance = Math.min(...distances);
      const matchedIndex = distances.indexOf(bestDistance);

      expect(matchedIndex).toBe(2); // bright variant is exact match
      expect(bestDistance).toBe(0); // exact match has 0 distance
    });

    it('should handle poor lighting conditions by trying all variants', () => {
      // Simulates underexposed frame matching dark variant better
      const referenceHashes = [
        'ffff0000ffff0000ffff0000ffff0000', // dark
        'ffff00ffffff00ffffff00ffffff00ff', // normal
        'ffffffffffffffffffffffffffffffff', // bright
      ];

      const underexposedFrame = 'ffff0000ffff0000ffff0000ffff00ff'; // Close to dark

      const distances = referenceHashes.map((hash) => hammingDistance(underexposedFrame, hash));
      const bestDistance = Math.min(...distances);
      const matchedIndex = distances.indexOf(bestDistance);

      // Should match dark variant best
      expect(matchedIndex).toBe(0);
      expect(bestDistance).toBeLessThan(distances[1]); // Better than normal
      expect(bestDistance).toBeLessThan(distances[2]); // Better than bright
    });
  });
});
