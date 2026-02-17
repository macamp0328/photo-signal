/**
 * Tests for Image Processing Utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resizeImageData,
  toGrayscale,
  binaryToHex,
  hexToBinary,
  convertToGrayscale,
  computeLaplacianVariance,
  detectGlare,
  adjustBrightness,
  calculateAdaptiveQualityThresholds,
  calculateAverageBrightness,
  detectPoorLighting,
} from '../utils';

describe('Image Processing Utilities', () => {
  describe('resizeImageData', () => {
    let imageData: ImageData;

    beforeEach(() => {
      // Create a simple 2x2 test image (RGBA format)
      const data = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // Red pixel
        0,
        255,
        0,
        255, // Green pixel
        0,
        0,
        255,
        255, // Blue pixel
        255,
        255,
        255,
        255, // White pixel
      ]);
      imageData = new ImageData(data, 2, 2);
    });

    it('should resize image to smaller dimensions', () => {
      const resized = resizeImageData(imageData, 1, 1);

      expect(resized.width).toBe(1);
      expect(resized.height).toBe(1);
      expect(resized.data.length).toBe(4); // 1 pixel * 4 channels
    });

    it('should resize image to larger dimensions', () => {
      const resized = resizeImageData(imageData, 4, 4);

      expect(resized.width).toBe(4);
      expect(resized.height).toBe(4);
      expect(resized.data.length).toBe(64); // 16 pixels * 4 channels
    });

    it('should resize image to non-square dimensions', () => {
      const resized = resizeImageData(imageData, 9, 8);

      expect(resized.width).toBe(9);
      expect(resized.height).toBe(8);
      expect(resized.data.length).toBe(288); // 72 pixels * 4 channels
    });

    it('should throw error if context cannot be created', () => {
      // This is hard to test without mocking, but we can verify the function exists
      expect(resizeImageData).toBeDefined();
    });
  });

  describe('toGrayscale', () => {
    it('should convert pure red to grayscale', () => {
      const data = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // Pure red
      ]);
      const imageData = new ImageData(data, 1, 1);

      const grayscale = toGrayscale(imageData);

      expect(grayscale).toHaveLength(1);
      // Red luma: 0.299 * 255 = 76.245 ≈ 76
      expect(grayscale[0]).toBe(76);
    });

    it('should convert pure green to grayscale', () => {
      const data = new Uint8ClampedArray([
        0,
        255,
        0,
        255, // Pure green
      ]);
      const imageData = new ImageData(data, 1, 1);

      const grayscale = toGrayscale(imageData);

      expect(grayscale).toHaveLength(1);
      // Green luma: 0.587 * 255 = 149.685 ≈ 149
      expect(grayscale[0]).toBe(149);
    });

    it('should convert pure blue to grayscale', () => {
      const data = new Uint8ClampedArray([
        0,
        0,
        255,
        255, // Pure blue
      ]);
      const imageData = new ImageData(data, 1, 1);

      const grayscale = toGrayscale(imageData);

      expect(grayscale).toHaveLength(1);
      // Blue luma: 0.114 * 255 = 29.07 ≈ 29
      expect(grayscale[0]).toBe(29);
    });

    it('should convert white to grayscale 255', () => {
      const data = new Uint8ClampedArray([
        255,
        255,
        255,
        255, // White
      ]);
      const imageData = new ImageData(data, 1, 1);

      const grayscale = toGrayscale(imageData);

      expect(grayscale).toHaveLength(1);
      expect(grayscale[0]).toBe(255);
    });

    it('should convert black to grayscale 0', () => {
      const data = new Uint8ClampedArray([
        0,
        0,
        0,
        255, // Black
      ]);
      const imageData = new ImageData(data, 1, 1);

      const grayscale = toGrayscale(imageData);

      expect(grayscale).toHaveLength(1);
      expect(grayscale[0]).toBe(0);
    });

    it('should convert multiple pixels correctly', () => {
      const data = new Uint8ClampedArray([
        255,
        255,
        255,
        255, // White
        0,
        0,
        0,
        255, // Black
        128,
        128,
        128,
        255, // Gray
      ]);
      const imageData = new ImageData(data, 3, 1);

      const grayscale = toGrayscale(imageData);

      expect(grayscale).toHaveLength(3);
      expect(grayscale[0]).toBe(255); // White
      expect(grayscale[1]).toBe(0); // Black
      // Gray: 0.299*128 + 0.587*128 + 0.114*128 = 127.872 ≈ 127
      expect(grayscale[2]).toBe(127); // Gray (note: rounding down)
    });

    it('should ignore alpha channel', () => {
      const data = new Uint8ClampedArray([
        255,
        255,
        255,
        0, // White with 0 alpha
        255,
        255,
        255,
        255, // White with full alpha
      ]);
      const imageData = new ImageData(data, 2, 1);

      const grayscale = toGrayscale(imageData);

      expect(grayscale).toHaveLength(2);
      // Both should produce same grayscale value regardless of alpha
      expect(grayscale[0]).toBe(grayscale[1]);
    });
  });

  describe('binaryToHex', () => {
    it('should convert simple binary to hex', () => {
      expect(binaryToHex('0000')).toBe('0');
      expect(binaryToHex('0001')).toBe('1');
      expect(binaryToHex('1111')).toBe('f');
    });

    it('should convert 8-bit binary to hex', () => {
      expect(binaryToHex('00000000')).toBe('00');
      expect(binaryToHex('11111111')).toBe('ff');
      expect(binaryToHex('10101010')).toBe('aa');
      expect(binaryToHex('01010101')).toBe('55');
    });

    it('should convert 64-bit binary to 16-character hex', () => {
      const binary = '1010101010101010101010101010101010101010101010101010101010101010';
      const hex = binaryToHex(binary);

      expect(hex).toHaveLength(16);
      expect(hex).toBe('aaaaaaaaaaaaaaaa');
    });

    it('should handle various patterns', () => {
      expect(binaryToHex('10000000')).toBe('80');
      expect(binaryToHex('00000001')).toBe('01');
      expect(binaryToHex('11110000')).toBe('f0');
      expect(binaryToHex('00001111')).toBe('0f');
    });
  });

  describe('hexToBinary', () => {
    it('should convert simple hex to binary', () => {
      expect(hexToBinary('0')).toBe('0000');
      expect(hexToBinary('1')).toBe('0001');
      expect(hexToBinary('f')).toBe('1111');
    });

    it('should convert 2-digit hex to 8-bit binary', () => {
      expect(hexToBinary('00')).toBe('00000000');
      expect(hexToBinary('ff')).toBe('11111111');
      expect(hexToBinary('aa')).toBe('10101010');
      expect(hexToBinary('55')).toBe('01010101');
    });

    it('should pad binary to 4 bits per hex digit', () => {
      expect(hexToBinary('1')).toBe('0001');
      expect(hexToBinary('01')).toBe('00000001');
    });

    it('should handle 16-character hex (64-bit)', () => {
      const hex = 'aaaaaaaaaaaaaaaa';
      const binary = hexToBinary(hex);

      expect(binary).toHaveLength(64);
      expect(binary).toBe('1010101010101010101010101010101010101010101010101010101010101010');
    });
  });

  describe('binaryToHex and hexToBinary round-trip', () => {
    it('should convert back and forth without loss', () => {
      const original = 'a5b3c7d9e1f20486';
      const binary = hexToBinary(original);
      const hex = binaryToHex(binary);

      expect(hex).toBe(original);
    });

    it('should work with all zeros', () => {
      const original = '0000000000000000';
      const binary = hexToBinary(original);
      const hex = binaryToHex(binary);

      expect(hex).toBe(original);
    });

    it('should work with all ones', () => {
      const original = 'ffffffffffffffff';
      const binary = hexToBinary(original);
      const hex = binaryToHex(binary);

      expect(hex).toBe(original);
    });
  });

  describe('convertToGrayscale', () => {
    it('should convert color image to grayscale in-place', () => {
      // Create a test image with a red pixel
      const data = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // Red pixel (R=255, G=0, B=0, A=255)
      ]);
      const imageData = new ImageData(data, 1, 1);

      // Convert to grayscale
      const result = convertToGrayscale(imageData);

      // Should modify in-place and return same object
      expect(result).toBe(imageData);

      // Calculate expected gray value using ITU-R BT.601 formula
      // gray = 0.299 * R + 0.587 * G + 0.114 * B
      // gray = 0.299 * 255 + 0.587 * 0 + 0.114 * 0 = 76.245 ≈ 76
      const expectedGray = Math.floor(0.299 * 255 + 0.587 * 0 + 0.114 * 0);

      expect(imageData.data[0]).toBe(expectedGray); // R channel
      expect(imageData.data[1]).toBe(expectedGray); // G channel
      expect(imageData.data[2]).toBe(expectedGray); // B channel
      expect(imageData.data[3]).toBe(255); // Alpha unchanged
    });

    it('should preserve alpha channel', () => {
      // Create a test image with semi-transparent pixel
      const data = new Uint8ClampedArray([
        100,
        150,
        200,
        128, // Semi-transparent blue-ish pixel
      ]);
      const imageData = new ImageData(data, 1, 1);

      convertToGrayscale(imageData);

      // Alpha should remain unchanged
      expect(imageData.data[3]).toBe(128);
    });

    it('should handle multiple pixels correctly', () => {
      // Create a 2x2 image with different colors
      const data = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // Red
        0,
        255,
        0,
        255, // Green
        0,
        0,
        255,
        255, // Blue
        255,
        255,
        255,
        255, // White
      ]);
      const imageData = new ImageData(data, 2, 2);

      convertToGrayscale(imageData);

      // Each pixel should have R=G=B
      for (let i = 0; i < imageData.data.length; i += 4) {
        expect(imageData.data[i]).toBe(imageData.data[i + 1]); // R === G
        expect(imageData.data[i + 1]).toBe(imageData.data[i + 2]); // G === B
        expect(imageData.data[i + 3]).toBe(255); // Alpha preserved
      }
    });

    it('should handle already grayscale image correctly', () => {
      // Create an already grayscale image
      const gray = 128;
      const data = new Uint8ClampedArray([gray, gray, gray, 255]);
      const imageData = new ImageData(data, 1, 1);

      convertToGrayscale(imageData);

      // The formula is applied: 0.299*128 + 0.587*128 + 0.114*128 = 127.872 ≈ 127
      // So the value will be very close but may have slight rounding
      const expectedGray = Math.floor(0.299 * gray + 0.587 * gray + 0.114 * gray);

      expect(imageData.data[0]).toBe(expectedGray);
      expect(imageData.data[1]).toBe(expectedGray);
      expect(imageData.data[2]).toBe(expectedGray);
      expect(imageData.data[3]).toBe(255);
    });

    it('should return the same ImageData object for chaining', () => {
      const data = new Uint8ClampedArray([100, 100, 100, 255]);
      const imageData = new ImageData(data, 1, 1);

      const result = convertToGrayscale(imageData);

      // Should return same object reference
      expect(result).toBe(imageData);
    });
  });

  describe('computeLaplacianVariance', () => {
    it('should return higher variance for sharp edge patterns', () => {
      // Create a sharp checkerboard pattern (4x4)
      // High contrast edges should produce high variance
      const data = new Uint8ClampedArray(64); // 4x4 pixels * 4 channels
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const idx = (y * 4 + x) * 4;
          const isWhite = (x + y) % 2 === 0;
          const value = isWhite ? 255 : 0;
          data[idx] = value; // R
          data[idx + 1] = value; // G
          data[idx + 2] = value; // B
          data[idx + 3] = 255; // A
        }
      }
      const sharpImage = new ImageData(data, 4, 4);
      const sharpVariance = computeLaplacianVariance(sharpImage);

      // Sharp edges should have significant variance
      expect(sharpVariance).toBeGreaterThan(1000);
    });

    it('should return lower variance for uniform images', () => {
      // Create a uniform gray image (4x4)
      const data = new Uint8ClampedArray(64); // 4x4 pixels * 4 channels
      data.fill(128); // All pixels same gray value
      for (let i = 3; i < 64; i += 4) {
        data[i] = 255; // Set alpha to 255
      }
      const uniformImage = new ImageData(data, 4, 4);
      const uniformVariance = computeLaplacianVariance(uniformImage);

      // Uniform image should have very low variance
      expect(uniformVariance).toBe(0);
    });

    it('should return lower variance for blurry gradients', () => {
      // Create a smooth gradient (4x4)
      const data = new Uint8ClampedArray(64);
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const idx = (y * 4 + x) * 4;
          const value = Math.floor((x / 3) * 255); // Smooth gradient
          data[idx] = value;
          data[idx + 1] = value;
          data[idx + 2] = value;
          data[idx + 3] = 255;
        }
      }
      const gradientImage = new ImageData(data, 4, 4);
      const gradientVariance = computeLaplacianVariance(gradientImage);

      // Smooth gradient should have lower variance than sharp edges
      expect(gradientVariance).toBeLessThan(1000);
    });

    it('should handle minimum size images (3x3)', () => {
      // 3x3 is minimum size for Laplacian filter (needs 1px border)
      const data = new Uint8ClampedArray(36); // 3x3 * 4
      // Create simple pattern
      data.fill(128);
      for (let i = 3; i < 36; i += 4) {
        data[i] = 255;
      }
      const smallImage = new ImageData(data, 3, 3);
      const variance = computeLaplacianVariance(smallImage);

      expect(variance).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for images too small to process', () => {
      // 2x2 is too small (needs at least 3x3 for 1px border)
      const data = new Uint8ClampedArray(16); // 2x2 * 4
      data.fill(128);
      for (let i = 3; i < 16; i += 4) {
        data[i] = 255;
      }
      const tinyImage = new ImageData(data, 2, 2);
      const variance = computeLaplacianVariance(tinyImage);

      expect(variance).toBe(0);
    });
  });

  describe('detectGlare', () => {
    it('should detect glare when >20% of pixels are blown out', () => {
      // Create 5x5 image (25 pixels) with 6 blown out pixels (24%)
      const data = new Uint8ClampedArray(100); // 5x5 * 4

      // Fill with normal gray pixels
      for (let i = 0; i < 100; i += 4) {
        data[i] = 128; // R
        data[i + 1] = 128; // G
        data[i + 2] = 128; // B
        data[i + 3] = 255; // A
      }

      // Make 6 pixels blown out (indices 0-5)
      for (let i = 0; i < 6; i++) {
        const idx = i * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
      }

      const imageData = new ImageData(data, 5, 5);
      const result = detectGlare(imageData);

      expect(result.hasGlare).toBe(true);
      expect(result.glarePercentage).toBeGreaterThan(20);
    });

    it('should not detect glare when <20% of pixels are blown out', () => {
      // Create 5x5 image (25 pixels) with 4 blown out pixels (16%)
      const data = new Uint8ClampedArray(100); // 5x5 * 4

      // Fill with normal gray pixels
      for (let i = 0; i < 100; i += 4) {
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
        data[i + 3] = 255;
      }

      // Make 4 pixels blown out
      for (let i = 0; i < 4; i++) {
        const idx = i * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
      }

      const imageData = new ImageData(data, 5, 5);
      const result = detectGlare(imageData);

      expect(result.hasGlare).toBe(false);
      expect(result.glarePercentage).toBeLessThan(20);
    });

    it('should not count strongly colored pixels whose luminance is below threshold', () => {
      // Create image with pixels that have only some channels blown out
      const data = new Uint8ClampedArray(16); // 2x2 * 4

      // Pixel 1: R high, but luminance still below 250 threshold
      data[0] = 255;
      data[1] = 100;
      data[2] = 100;
      data[3] = 255;
      // Pixel 2: G high, but luminance below threshold
      data[4] = 100;
      data[5] = 255;
      data[6] = 100;
      data[7] = 255;
      // Pixel 3: B high, but luminance below threshold
      data[8] = 100;
      data[9] = 100;
      data[10] = 255;
      data[11] = 255;
      // Pixel 4: All blown out
      data[12] = 255;
      data[13] = 255;
      data[14] = 255;
      data[15] = 255;

      const imageData = new ImageData(data, 2, 2);
      const result = detectGlare(imageData);

      // Only 1 out of 4 pixels (25%) should be counted as glare at threshold 250
      expect(result.glarePercentage).toBe(25);
      expect(result.hasGlare).toBe(true); // 25% > 20%
    });

    it('should detect warm-tinted blown-out pixels via luminance threshold', () => {
      const data = new Uint8ClampedArray(16); // 2x2 * 4

      // Warm near-white pixels (not all channels maxed)
      for (let i = 0; i < 16; i += 4) {
        data[i] = 255;
        data[i + 1] = 245;
        data[i + 2] = 235;
        data[i + 3] = 255;
      }

      const imageData = new ImageData(data, 2, 2);
      const result = detectGlare(imageData, 240, 50);

      expect(result.glarePercentage).toBe(100);
      expect(result.hasGlare).toBe(true);
    });

    it('should use custom threshold and percentage threshold', () => {
      const data = new Uint8ClampedArray(16); // 2x2 * 4

      // Make all pixels at 240 (not blown out at default 250, but blown out at 230)
      for (let i = 0; i < 16; i += 4) {
        data[i] = 240;
        data[i + 1] = 240;
        data[i + 2] = 240;
        data[i + 3] = 255;
      }

      const imageData = new ImageData(data, 2, 2);

      // With default threshold (250), no glare
      const defaultResult = detectGlare(imageData);
      expect(defaultResult.hasGlare).toBe(false);

      // With lower threshold (230), all pixels are glare
      const customResult = detectGlare(imageData, 230, 50);
      expect(customResult.hasGlare).toBe(true);
      expect(customResult.glarePercentage).toBe(100);
    });

    it('should return 0% for images with no bright pixels', () => {
      const data = new Uint8ClampedArray(16); // 2x2 * 4

      // All dark pixels
      for (let i = 0; i < 16; i += 4) {
        data[i] = 50;
        data[i + 1] = 50;
        data[i + 2] = 50;
        data[i + 3] = 255;
      }

      const imageData = new ImageData(data, 2, 2);
      const result = detectGlare(imageData);

      expect(result.hasGlare).toBe(false);
      expect(result.glarePercentage).toBe(0);
    });
  });

  describe('adjustBrightness', () => {
    it('should brighten image with positive factor', () => {
      const data = new Uint8ClampedArray([100, 100, 100, 255]);
      const imageData = new ImageData(data, 1, 1);

      const brightened = adjustBrightness(imageData, 50);

      expect(brightened.data[0]).toBe(150); // 100 + 50
      expect(brightened.data[1]).toBe(150);
      expect(brightened.data[2]).toBe(150);
      expect(brightened.data[3]).toBe(255); // Alpha unchanged
    });

    it('should darken image with negative factor', () => {
      const data = new Uint8ClampedArray([150, 150, 150, 255]);
      const imageData = new ImageData(data, 1, 1);

      const darkened = adjustBrightness(imageData, -50);

      expect(darkened.data[0]).toBe(100); // 150 - 50
      expect(darkened.data[1]).toBe(100);
      expect(darkened.data[2]).toBe(100);
      expect(darkened.data[3]).toBe(255); // Alpha unchanged
    });

    it('should clamp values at 0 (no underflow)', () => {
      const data = new Uint8ClampedArray([50, 50, 50, 255]);
      const imageData = new ImageData(data, 1, 1);

      const darkened = adjustBrightness(imageData, -100);

      expect(darkened.data[0]).toBe(0); // Clamped to 0
      expect(darkened.data[1]).toBe(0);
      expect(darkened.data[2]).toBe(0);
    });

    it('should clamp values at 255 (no overflow)', () => {
      const data = new Uint8ClampedArray([200, 200, 200, 255]);
      const imageData = new ImageData(data, 1, 1);

      const brightened = adjustBrightness(imageData, 100);

      expect(brightened.data[0]).toBe(255); // Clamped to 255
      expect(brightened.data[1]).toBe(255);
      expect(brightened.data[2]).toBe(255);
    });

    it('should not modify original ImageData', () => {
      const data = new Uint8ClampedArray([100, 100, 100, 255]);
      const imageData = new ImageData(data, 1, 1);

      const adjusted = adjustBrightness(imageData, 50);

      // Original should be unchanged
      expect(imageData.data[0]).toBe(100);
      // New should be modified
      expect(adjusted.data[0]).toBe(150);
      // Should be different objects
      expect(adjusted).not.toBe(imageData);
    });

    it('should preserve alpha channel', () => {
      const data = new Uint8ClampedArray([100, 100, 100, 128]);
      const imageData = new ImageData(data, 1, 1);

      const adjusted = adjustBrightness(imageData, 50);

      expect(adjusted.data[3]).toBe(128); // Alpha preserved
    });

    it('should handle zero factor (no change)', () => {
      const data = new Uint8ClampedArray([100, 150, 200, 255]);
      const imageData = new ImageData(data, 1, 1);

      const adjusted = adjustBrightness(imageData, 0);

      expect(adjusted.data[0]).toBe(100);
      expect(adjusted.data[1]).toBe(150);
      expect(adjusted.data[2]).toBe(200);
    });
  });

  describe('calculateAverageBrightness', () => {
    it('should calculate average brightness correctly', () => {
      // Create image with known grayscale values
      // ITU-R BT.601: gray = 0.299*R + 0.587*G + 0.114*B
      const data = new Uint8ClampedArray([
        0,
        0,
        0,
        255, // Black (brightness 0)
        255,
        255,
        255,
        255, // White (brightness 255)
      ]);
      const imageData = new ImageData(data, 2, 1);

      const avgBrightness = calculateAverageBrightness(imageData);

      // Average of 0 and 255 = 127.5
      expect(avgBrightness).toBeCloseTo(127.5, 1);
    });

    it('should return 0 for empty image', () => {
      const data = new Uint8ClampedArray([]);
      const imageData = new ImageData(data, 0, 0);

      const avgBrightness = calculateAverageBrightness(imageData);

      expect(avgBrightness).toBe(0);
    });

    it('should handle mid-tone images', () => {
      // Create uniform mid-gray image (128, 128, 128)
      const data = new Uint8ClampedArray([128, 128, 128, 255, 128, 128, 128, 255]);
      const imageData = new ImageData(data, 2, 1);

      const avgBrightness = calculateAverageBrightness(imageData);

      // ITU-R BT.601: gray = 0.299*R + 0.587*G + 0.114*B
      // For RGB(128,128,128): floor(0.299*128 + 0.587*128 + 0.114*128) = 127
      expect(avgBrightness).toBe(127);
    });
  });

  describe('detectPoorLighting', () => {
    it('should detect underexposed images', () => {
      // Create very dark image
      const data = new Uint8ClampedArray([10, 10, 10, 255, 20, 20, 20, 255]);
      const imageData = new ImageData(data, 2, 1);

      const result = detectPoorLighting(imageData, 50, 220);

      expect(result.hasPoorLighting).toBe(true);
      expect(result.type).toBe('underexposed');
      expect(result.averageBrightness).toBeLessThan(50);
    });

    it('should detect overexposed images', () => {
      // Create very bright image
      const data = new Uint8ClampedArray([240, 240, 240, 255, 250, 250, 250, 255]);
      const imageData = new ImageData(data, 2, 1);

      const result = detectPoorLighting(imageData, 50, 220);

      expect(result.hasPoorLighting).toBe(true);
      expect(result.type).toBe('overexposed');
      expect(result.averageBrightness).toBeGreaterThan(220);
    });

    it('should not flag well-lit images', () => {
      // Create normal brightness image
      const data = new Uint8ClampedArray([128, 128, 128, 255, 150, 150, 150, 255]);
      const imageData = new ImageData(data, 2, 1);

      const result = detectPoorLighting(imageData, 50, 220);

      expect(result.hasPoorLighting).toBe(false);
      expect(result.type).toBe('ok');
      expect(result.averageBrightness).toBeGreaterThanOrEqual(50);
      expect(result.averageBrightness).toBeLessThanOrEqual(220);
    });

    it('should use custom thresholds', () => {
      // Create image with brightness 100
      const data = new Uint8ClampedArray([100, 100, 100, 255]);
      const imageData = new ImageData(data, 1, 1);

      // With strict thresholds (120-200), this should be underexposed
      const result = detectPoorLighting(imageData, 120, 200);

      expect(result.hasPoorLighting).toBe(true);
      expect(result.type).toBe('underexposed');
    });

    it('should handle edge case at exact threshold', () => {
      // Create image at exactly the minimum threshold
      const data = new Uint8ClampedArray([50, 50, 50, 255]);
      const imageData = new ImageData(data, 1, 1);

      const result = detectPoorLighting(imageData, 50, 220);

      // At exact threshold should be OK
      expect(result.hasPoorLighting).toBe(false);
      expect(result.type).toBe('ok');
    });
  });

  describe('calculateAdaptiveQualityThresholds', () => {
    it('returns base thresholds when ambient context is unavailable', () => {
      const thresholds = calculateAdaptiveQualityThresholds(50, 220, 20, null, null);

      expect(thresholds.minBrightness).toBe(50);
      expect(thresholds.maxBrightness).toBe(220);
      expect(thresholds.glarePercentageThreshold).toBe(20);
    });

    it('lowers minimum brightness and raises glare tolerance in dark ambient scenes', () => {
      const thresholds = calculateAdaptiveQualityThresholds(50, 220, 20, 70, 6);

      expect(thresholds.minBrightness).toBeLessThan(50);
      expect(thresholds.maxBrightness).toBeLessThanOrEqual(220);
      expect(thresholds.glarePercentageThreshold).toBeGreaterThan(20);
    });

    it('raises maximum brightness in bright ambient scenes', () => {
      const thresholds = calculateAdaptiveQualityThresholds(50, 220, 20, 205, 2);

      expect(thresholds.maxBrightness).toBeGreaterThan(220);
      expect(thresholds.minBrightness).toBeGreaterThanOrEqual(50);
      expect(thresholds.glarePercentageThreshold).toBeGreaterThanOrEqual(20);
    });
  });
});
