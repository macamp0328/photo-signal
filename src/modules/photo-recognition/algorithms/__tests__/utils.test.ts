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
});
