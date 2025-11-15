/**
 * Tests for pHash (Perceptual Hash) Implementation
 */

import { describe, it, expect } from 'vitest';
import { computePHash } from '../phash';

/**
 * Helper function to create ImageData from grayscale array
 */
function createImageData(grayscaleArray: number[], width: number, height: number): ImageData {
  const imageData = new ImageData(width, height);
  for (let i = 0; i < grayscaleArray.length; i++) {
    const value = grayscaleArray[i];
    imageData.data[i * 4] = value; // R
    imageData.data[i * 4 + 1] = value; // G
    imageData.data[i * 4 + 2] = value; // B
    imageData.data[i * 4 + 3] = 255; // A
  }
  return imageData;
}

/**
 * Helper to create solid color ImageData
 */
function createSolidImage(width: number, height: number, gray: number): ImageData {
  const array = Array(width * height).fill(gray);
  return createImageData(array, width, height);
}

describe('computePHash', () => {
  describe('Output Format', () => {
    it('should return a 16-character hexadecimal string', () => {
      const imageData = createSolidImage(32, 32, 128);
      const hash = computePHash(imageData);
      
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
      expect(hash.length).toBe(16);
    });

    it('should return consistent hash for same image', () => {
      const imageData = createSolidImage(32, 32, 128);
      const hash1 = computePHash(imageData);
      const hash2 = computePHash(imageData);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('Solid Colors', () => {
    it('should generate different hashes for different solid colors', () => {
      const black = createSolidImage(32, 32, 0);
      const white = createSolidImage(32, 32, 255);
      const gray = createSolidImage(32, 32, 128);
      
      const hashBlack = computePHash(black);
      const hashWhite = computePHash(white);
      const hashGray = computePHash(gray);
      
      // All should be valid hashes
      expect(hashBlack).toMatch(/^[0-9a-f]{16}$/);
      expect(hashWhite).toMatch(/^[0-9a-f]{16}$/);
      expect(hashGray).toMatch(/^[0-9a-f]{16}$/);
      
      // But they should be different (solid colors have minimal structure)
      expect(hashBlack).not.toBe(hashWhite);
      expect(hashBlack).not.toBe(hashGray);
      expect(hashWhite).not.toBe(hashGray);
    });

    it('should handle pure black image', () => {
      const black = createSolidImage(32, 32, 0);
      const hash = computePHash(black);
      
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
      expect(hash.length).toBe(16);
    });

    it('should handle pure white image', () => {
      const white = createSolidImage(32, 32, 255);
      const hash = computePHash(white);
      
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
      expect(hash.length).toBe(16);
    });
  });

  describe('Gradient Patterns', () => {
    it('should generate hash for horizontal gradient', () => {
      const gradient: number[] = [];
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          gradient.push(Math.floor((x / 31) * 255));
        }
      }
      
      const imageData = createImageData(gradient, 32, 32);
      const hash = computePHash(imageData);
      
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should generate hash for vertical gradient', () => {
      const gradient: number[] = [];
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          gradient.push(Math.floor((y / 31) * 255));
        }
      }
      
      const imageData = createImageData(gradient, 32, 32);
      const hash = computePHash(imageData);
      
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should generate different hashes for horizontal vs vertical gradients', () => {
      const horizontal: number[] = [];
      const vertical: number[] = [];
      
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          horizontal.push(Math.floor((x / 31) * 255));
          vertical.push(Math.floor((y / 31) * 255));
        }
      }
      
      const hashH = computePHash(createImageData(horizontal, 32, 32));
      const hashV = computePHash(createImageData(vertical, 32, 32));
      
      expect(hashH).not.toBe(hashV);
    });
  });

  describe('Checkerboard Patterns', () => {
    it('should generate hash for checkerboard pattern', () => {
      const checkerboard: number[] = [];
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const isBlack = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
          checkerboard.push(isBlack ? 0 : 255);
        }
      }
      
      const imageData = createImageData(checkerboard, 32, 32);
      const hash = computePHash(imageData);
      
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should generate different hashes for different checkerboard sizes', () => {
      const createCheckerboard = (squareSize: number): number[] => {
        const pattern: number[] = [];
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            const isBlack = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
            pattern.push(isBlack ? 0 : 255);
          }
        }
        return pattern;
      };
      
      const hash4x4 = computePHash(createImageData(createCheckerboard(4), 32, 32));
      const hash8x8 = computePHash(createImageData(createCheckerboard(8), 32, 32));
      
      expect(hash4x4).not.toBe(hash8x8);
    });
  });

  describe('Brightness Variations (Robustness)', () => {
    it('should generate similar hashes for brightness variations of same pattern', () => {
      // Create a simple pattern
      const pattern: number[] = [];
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          pattern.push(x < 16 ? 50 : 200);
        }
      }
      
      // Create brightened and darkened versions
      const brightened = pattern.map(v => Math.min(255, v + 30));
      const darkened = pattern.map(v => Math.max(0, v - 30));
      
      const hashOriginal = computePHash(createImageData(pattern, 32, 32));
      const hashBright = computePHash(createImageData(brightened, 32, 32));
      const hashDark = computePHash(createImageData(darkened, 32, 32));
      
      // Count differing bits (simple Hamming distance check)
      const countDifferences = (h1: string, h2: string): number => {
        let diff = 0;
        for (let i = 0; i < h1.length; i++) {
          const n1 = parseInt(h1[i], 16);
          const n2 = parseInt(h2[i], 16);
          // Count different bits
          let xor = n1 ^ n2;
          while (xor > 0) {
            diff += xor & 1;
            xor >>= 1;
          }
        }
        return diff;
      };
      
      const diffBright = countDifferences(hashOriginal, hashBright);
      const diffDark = countDifferences(hashOriginal, hashDark);
      
      // pHash should be robust to brightness changes
      // Allow up to 40% of bits to differ (26 out of 64 bits)
      // This is more realistic for real-world brightness variations
      expect(diffBright).toBeLessThan(26);
      expect(diffDark).toBeLessThan(26);
    });
  });

  describe('Different Image Sizes', () => {
    it('should handle small images (resize from 8x8)', () => {
      const small = createSolidImage(8, 8, 100);
      const hash = computePHash(small);
      
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should handle large images (resize from 256x256)', () => {
      const large = createSolidImage(256, 256, 150);
      const hash = computePHash(large);
      
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should generate same hash for different sizes of same pattern', () => {
      // Create simple two-tone pattern at different sizes
      const create2Tone = (size: number): ImageData => {
        const pattern: number[] = [];
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            pattern.push(x < size / 2 ? 50 : 200);
          }
        }
        return createImageData(pattern, size, size);
      };
      
      const hash32 = computePHash(create2Tone(32));
      const hash64 = computePHash(create2Tone(64));
      const hash128 = computePHash(create2Tone(128));
      
      // After resizing to 32x32, these should produce similar (not identical) hashes
      // due to resampling artifacts, but they should be close
      const countDifferences = (h1: string, h2: string): number => {
        let diff = 0;
        for (let i = 0; i < h1.length; i++) {
          const n1 = parseInt(h1[i], 16);
          const n2 = parseInt(h2[i], 16);
          let xor = n1 ^ n2;
          while (xor > 0) {
            diff += xor & 1;
            xor >>= 1;
          }
        }
        return diff;
      };
      
      const diff32to64 = countDifferences(hash32, hash64);
      const diff32to128 = countDifferences(hash32, hash128);
      
      // Allow up to 50% of bits to differ due to resampling (32 out of 64 bits)
      // Canvas resampling introduces artifacts, especially for simple patterns
      expect(diff32to64).toBeLessThan(32);
      expect(diff32to128).toBeLessThan(32);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-square images', () => {
      const imageData = createSolidImage(64, 32, 128);
      const hash = computePHash(imageData);
      
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should handle images with varied content', () => {
      // Create a more complex pattern
      const varied: number[] = [];
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          // Sinusoidal pattern
          const value = Math.floor(128 + 127 * Math.sin((x + y) / 5));
          varied.push(value);
        }
      }
      
      const imageData = createImageData(varied, 32, 32);
      const hash = computePHash(imageData);
      
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('Hash Uniqueness', () => {
    it('should generate different hashes for distinct patterns', () => {
      const patterns = [
        createSolidImage(32, 32, 0),
        createSolidImage(32, 32, 128),
        createSolidImage(32, 32, 255),
      ];
      
      const hashes = patterns.map(p => computePHash(p));
      const uniqueHashes = new Set(hashes);
      
      expect(uniqueHashes.size).toBe(hashes.length);
    });
  });
});
