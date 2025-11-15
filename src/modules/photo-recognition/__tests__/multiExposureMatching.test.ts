/**
 * Tests for multi-exposure hash matching logic
 */

import { describe, it, expect } from 'vitest';
import { hammingDistance } from '../algorithms/hamming';

describe('Multi-Exposure Hash Matching', () => {
  describe('getPhotoHashes helper (simulated)', () => {
    it('should handle single hash (backward compatibility)', () => {
      const concert: { photoHash?: string | string[] } = {
        photoHash: 'abc123',
      };

      const getPhotoHashes = (c: typeof concert) => {
        if (!c.photoHash) return [];
        return Array.isArray(c.photoHash) ? c.photoHash : [c.photoHash];
      };

      const hashes = getPhotoHashes(concert);
      expect(hashes).toEqual(['abc123']);
      expect(hashes.length).toBe(1);
    });

    it('should handle multi-exposure hash array', () => {
      const concert: { photoHash?: string | string[] } = {
        photoHash: ['hash_dark', 'hash_normal', 'hash_bright'],
      };

      const getPhotoHashes = (c: typeof concert) => {
        if (!c.photoHash) return [];
        return Array.isArray(c.photoHash) ? c.photoHash : [c.photoHash];
      };

      const hashes = getPhotoHashes(concert);
      expect(hashes).toEqual(['hash_dark', 'hash_normal', 'hash_bright']);
      expect(hashes.length).toBe(3);
    });

    it('should handle missing photoHash', () => {
      const concert: { photoHash?: string | string[] } = {};

      const getPhotoHashes = (c: typeof concert) => {
        if (!c.photoHash) return [];
        return Array.isArray(c.photoHash) ? c.photoHash : [c.photoHash];
      };

      const hashes = getPhotoHashes(concert);
      expect(hashes).toEqual([]);
      expect(hashes.length).toBe(0);
    });
  });

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

    it('should work with single-hash concerts (backward compatibility)', () => {
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

  describe('Hash validation', () => {
    it('should validate concert has at least one hash', () => {
      const hasPhotoHash = (concert: { photoHash?: string | string[] }) => {
        if (typeof concert.photoHash === 'string') {
          return concert.photoHash.length > 0;
        }
        if (Array.isArray(concert.photoHash)) {
          return (
            concert.photoHash.length > 0 &&
            concert.photoHash.every((h) => typeof h === 'string' && h.length > 0)
          );
        }
        return false;
      };

      // Valid single hash
      expect(hasPhotoHash({ photoHash: 'abc123' })).toBe(true);

      // Valid multi-exposure array
      expect(hasPhotoHash({ photoHash: ['hash1', 'hash2', 'hash3'] })).toBe(true);

      // Invalid: empty string
      expect(hasPhotoHash({ photoHash: '' })).toBe(false);

      // Invalid: empty array
      expect(hasPhotoHash({ photoHash: [] })).toBe(false);

      // Invalid: array with empty string
      expect(hasPhotoHash({ photoHash: ['hash1', '', 'hash3'] })).toBe(false);

      // Invalid: missing photoHash
      expect(hasPhotoHash({})).toBe(false);

      // Invalid: null
      expect(hasPhotoHash({ photoHash: null as unknown as string })).toBe(false);
    });
  });
});
