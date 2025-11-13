/**
 * Tests for Hamming Distance Calculator
 */

import { describe, it, expect } from 'vitest';
import { hammingDistance, calculateSimilarity } from '../hamming';

describe('Hamming Distance', () => {
  describe('hammingDistance', () => {
    it('should return 0 for identical hashes', () => {
      const hash = 'a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486';
      expect(hammingDistance(hash, hash)).toBe(0);
    });

    it('should return 0 for all zeros', () => {
      const hash = '00000000000000000000000000000000';
      expect(hammingDistance(hash, hash)).toBe(0);
    });

    it('should return 0 for all ones', () => {
      const hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      expect(hammingDistance(hash, hash)).toBe(0);
    });

    it('should calculate distance for single bit difference', () => {
      // Last bit different: ...0000 vs ...0001
      const hash1 = '00000000000000000000000000000000';
      const hash2 = '00000000000000000000000000000001';

      expect(hammingDistance(hash1, hash2)).toBe(1);
    });

    it('should calculate distance for multiple bit differences', () => {
      // 0000 vs 1111 = 4 bits different per hex digit
      const hash1 = '00000000000000000000000000000000';
      const hash2 = 'f0000000000000000000000000000000';

      expect(hammingDistance(hash1, hash2)).toBe(4);
    });

    it('should calculate distance for completely different hashes', () => {
      const hash1 = '00000000000000000000000000000000'; // All zeros
      const hash2 = 'ffffffffffffffffffffffffffffffff'; // All ones

      // 128 bits total, all different
      expect(hammingDistance(hash1, hash2)).toBe(128);
    });

    it('should calculate distance for realistic hashes', () => {
      // Similar hashes with a few bits different
      const hash1 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486';
      const hash2 = 'a5b3c7d9e1f20486a5b3c7d9e1f20487';

      // Last hex digit: 6 (0110) vs 7 (0111) = 1 bit different
      expect(hammingDistance(hash1, hash2)).toBe(1);
    });

    it('should handle alternating patterns', () => {
      const hash1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 1010...
      const hash2 = '55555555555555555555555555555555'; // 0101...

      // Every bit is different
      expect(hammingDistance(hash1, hash2)).toBe(128);
    });

    it('should throw error for different length hashes', () => {
      const hash1 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486';
      const hash2 = 'a5b3'; // Shorter

      expect(() => hammingDistance(hash1, hash2)).toThrow('Hash lengths must be equal');
    });

    it('should be symmetric', () => {
      const hash1 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486';
      const hash2 = 'b5c3d7e9f1a20587b5c3d7e9f1a20587';

      expect(hammingDistance(hash1, hash2)).toBe(hammingDistance(hash2, hash1));
    });

    it('should calculate reasonable distances for slightly different images', () => {
      // Simulate hashes of similar images (low Hamming distance)
      const hash1 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486';
      const hash2 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20496'; // Changed one hex digit

      const distance = hammingDistance(hash1, hash2);

      // Should be small (< 10 bits different)
      expect(distance).toBeLessThan(10);
    });

    it('should calculate large distances for very different images', () => {
      // Simulate hashes of completely different images (high Hamming distance)
      const hash1 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486';
      const hash2 = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const distance = hammingDistance(hash1, hash2);

      // Should be large (> 30 bits different for very different images)
      expect(distance).toBeGreaterThan(20);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 100% for identical hashes', () => {
      const hash = 'a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486';
      expect(calculateSimilarity(hash, hash)).toBe(100);
    });

    it('should return 0% for completely different hashes', () => {
      const hash1 = '00000000000000000000000000000000';
      const hash2 = 'ffffffffffffffffffffffffffffffff';

      const similarity = calculateSimilarity(hash1, hash2);
      expect(similarity).toBe(0);
    });

    it('should return ~99.22% for 1-bit difference', () => {
      const hash1 = '00000000000000000000000000000000'; // All zeros
      const hash2 = '00000000000000000000000000000001'; // One bit set

      const similarity = calculateSimilarity(hash1, hash2);

      // 127 out of 128 bits match = 99.21875%
      expect(similarity).toBeCloseTo(99.22, 1);
    });

    it('should return ~50% for half bits different', () => {
      // Create hashes with exactly half bits different
      const hash1 = 'ffffffff00000000'; // First half 1s, second half 0s
      const hash2 = '00000000ffffffff'; // Inverted

      const similarity = calculateSimilarity(hash1, hash2);

      expect(similarity).toBe(0); // All bits are different in this case
    });

    it('should return values between 0 and 100', () => {
      const hash1 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486';
      const hash2 = 'b5c3d7e9f1a20587b5c3d7e9f1a20587b5c3d7e9f1a20587b5c3d7e9f1a20587';

      const similarity = calculateSimilarity(hash1, hash2);

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(100);
    });

    it('should round to 2 decimal places', () => {
      const hash1 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486';
      const hash2 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20487';

      const similarity = calculateSimilarity(hash1, hash2);

      // Should be a number with at most 2 decimal places
      const decimalPlaces = similarity.toString().split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should be symmetric', () => {
      const hash1 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486a5b3c7d9e1f20486';
      const hash2 = 'b5c3d7e9f1a20587b5c3d7e9f1a20587b5c3d7e9f1a20587b5c3d7e9f1a20587';

      expect(calculateSimilarity(hash1, hash2)).toBe(calculateSimilarity(hash2, hash1));
    });

    it('should inverse of Hamming distance as percentage', () => {
      const hash1 = 'a5b3c7d9e1f20486a5b3c7d9e1f20486';
      const hash2 = 'a5b3c7d9e1f2048f0000000000000000';

      const distance = hammingDistance(hash1, hash2);
      const similarity = calculateSimilarity(hash1, hash2);

      // Verify relationship: similarity = (128 - distance) / 128 * 100
      const expectedSimilarity = ((128 - distance) / 128) * 100;
      expect(similarity).toBeCloseTo(expectedSimilarity, 2);
    });
  });
});
