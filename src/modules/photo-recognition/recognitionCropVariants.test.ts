import { describe, expect, it } from 'vitest';
import { getRecognitionCropVariants } from './recognitionCropVariants';

describe('getRecognitionCropVariants', () => {
  it('returns only the full crop when demo fallback is disabled', () => {
    expect(getRecognitionCropVariants(640, 480, false)).toEqual([
      { id: 'full', x: 0, y: 0, width: 640, height: 480 },
    ]);
  });

  it('adds bottom and center trims when demo fallback is enabled', () => {
    expect(getRecognitionCropVariants(100, 100, true)).toEqual([
      { id: 'full', x: 0, y: 0, width: 100, height: 100 },
      { id: 'bottom-trim', x: 0, y: 0, width: 100, height: 78 },
      { id: 'center-trim', x: 0, y: 8, width: 100, height: 74 },
    ]);
  });

  it('keeps all enabled crop variants inside source bounds', () => {
    const variants = getRecognitionCropVariants(320, 240, true);

    for (const variant of variants) {
      expect(variant.x).toBeGreaterThanOrEqual(0);
      expect(variant.y).toBeGreaterThanOrEqual(0);
      expect(variant.x + variant.width).toBeLessThanOrEqual(320);
      expect(variant.y + variant.height).toBeLessThanOrEqual(240);
    }
  });

  it('drops trims that would be too small to hash reliably', () => {
    expect(getRecognitionCropVariants(100, 18, true)).toEqual([
      { id: 'full', x: 0, y: 0, width: 100, height: 18 },
    ]);
  });
});
