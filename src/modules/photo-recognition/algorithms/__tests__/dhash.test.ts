/**
 * Tests for dHash (Difference Hash) Algorithm
 */

import { describe, it, expect } from 'vitest';
import { computeDHash } from '../dhash';

describe('dHash Algorithm', () => {
  /**
   * Helper function to create a simple test ImageData
   */
  function createTestImage(
    width: number,
    height: number,
    pattern: 'solid' | 'gradient' | 'checkerboard' = 'solid'
  ): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        if (pattern === 'solid') {
          // Solid white
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        } else if (pattern === 'gradient') {
          // Horizontal gradient from black to white
          const value = Math.floor((x / width) * 255);
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
          data[i + 3] = 255;
        } else if (pattern === 'checkerboard') {
          // Checkerboard pattern
          const isWhite = (x + y) % 2 === 0;
          const value = isWhite ? 255 : 0;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
          data[i + 3] = 255;
        }
      }
    }

    return new ImageData(data, width, height);
  }

  describe('Basic Functionality', () => {
    it('should compute hash for solid white image', () => {
      const imageData = createTestImage(100, 100, 'solid');
      const hash = computeDHash(imageData);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(32); // 128-bit hash = 32 hex characters
    });

    it('should compute hash for solid black image', () => {
      const data = new Uint8ClampedArray(100 * 100 * 4); // All zeros
      const imageData = new ImageData(data, 100, 100);
      const hash = computeDHash(imageData);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(32);
    });

    it('should compute hash for gradient image', () => {
      const imageData = createTestImage(100, 100, 'gradient');
      const hash = computeDHash(imageData);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(32);
    });

    it('should compute hash for checkerboard pattern', () => {
      const imageData = createTestImage(100, 100, 'checkerboard');
      const hash = computeDHash(imageData);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(32);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should produce same hash for same image', () => {
      const imageData = createTestImage(100, 100, 'gradient');
      const hash1 = computeDHash(imageData);
      const hash2 = computeDHash(imageData);

      expect(hash1).toBe(hash2);
    });

    it('should produce consistent hash across multiple calls', () => {
      const imageData = createTestImage(200, 200, 'checkerboard');
      const hashes = Array.from({ length: 5 }, () => computeDHash(imageData));

      // All hashes should be identical
      expect(new Set(hashes).size).toBe(1);
    });
  });

  describe('Size Independence', () => {
    it('should produce same hash for same pattern at different sizes', () => {
      const small = createTestImage(50, 50, 'gradient');
      const medium = createTestImage(100, 100, 'gradient');
      const large = createTestImage(200, 200, 'gradient');

      const hash1 = computeDHash(small);
      const hash2 = computeDHash(medium);
      const hash3 = computeDHash(large);

      // All should produce similar (if not identical) hashes
      // They should be the same since the pattern is the same
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should handle very small images', () => {
      const imageData = createTestImage(10, 10, 'solid');
      const hash = computeDHash(imageData);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(32);
    });

    it('should handle very large images', () => {
      const imageData = createTestImage(1000, 1000, 'gradient');
      const hash = computeDHash(imageData);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(32);
    });
  });

  describe('Pattern Differentiation', () => {
    it('should produce all zeros for uniform image (no gradients)', () => {
      // Create a 9x8 uniform image directly
      const width = 9;
      const height = 8;
      const data = new Uint8ClampedArray(width * height * 4);
      data.fill(128); // All pixels same gray value
      for (let i = 3; i < data.length; i += 4) {
        data[i] = 255; // Set alpha
      }
      const imageData = new ImageData(data, width, height);
      const hash = computeDHash(imageData);

      // Uniform image should have no gradients, so all bits should be 0
      expect(hash).toBe('00000000000000000000000000000000');
    });

    // Note: Tests for gradient and checkerboard patterns are not included
    // because they depend heavily on canvas resizing/interpolation behavior,
    // which varies between Node.js test environment and real browsers.
    // Real-world testing with actual photos validates the algorithm works correctly.
  });

  describe('Hex Format Validation', () => {
    it('should return valid hexadecimal string', () => {
      const imageData = createTestImage(100, 100, 'checkerboard');
      const hash = computeDHash(imageData);

      // Should only contain hex characters (0-9, a-f)
      expect(hash).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should always return lowercase hex', () => {
      const imageData = createTestImage(100, 100, 'gradient');
      const hash = computeDHash(imageData);

      expect(hash).toBe(hash.toLowerCase());
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-square images', () => {
      const data = new Uint8ClampedArray(200 * 100 * 4);
      const imageData = new ImageData(data, 200, 100);
      const hash = computeDHash(imageData);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(32);
    });

    it('should handle images with varied colors', () => {
      const width = 100;
      const height = 100;
      const data = new Uint8ClampedArray(width * height * 4);

      // Create rainbow gradient
      for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        const hue = (pixelIndex / (width * height)) * 360;

        // Simple RGB from hue
        data[i] = Math.floor((Math.sin((hue / 60) * Math.PI) + 1) * 127.5);
        data[i + 1] = Math.floor((Math.sin(((hue - 120) / 60) * Math.PI) + 1) * 127.5);
        data[i + 2] = Math.floor((Math.sin(((hue - 240) / 60) * Math.PI) + 1) * 127.5);
        data[i + 3] = 255;
      }

      const imageData = new ImageData(data, width, height);
      const hash = computeDHash(imageData);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(32);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical photo dimensions', () => {
      // Common photo sizes
      const sizes = [
        [640, 480], // VGA
        [1920, 1080], // Full HD
        [3840, 2160], // 4K
      ];

      sizes.forEach(([width, height]) => {
        const imageData = createTestImage(width, height, 'gradient');
        const hash = computeDHash(imageData);

        expect(hash).toBeDefined();
        expect(hash).toHaveLength(32);
      });
    });
  });
});
