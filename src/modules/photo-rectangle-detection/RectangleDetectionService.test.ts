import { describe, expect, it } from 'vitest';
import { RectangleDetectionService } from './RectangleDetectionService';

/**
 * Create a minimal ImageData-like object for unit tests.
 * Fills a width×height RGBA buffer with a uniform mid-grey value so the
 * detection pipeline runs without finding any rectangle (blank frame).
 */
function makeImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4).fill(128);
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

describe('RectangleDetectionService', () => {
  it('returns a no-detection result for a blank frame', () => {
    const service = new RectangleDetectionService();
    const result = service.detectRectangle(makeImageData(64, 64));

    expect(result.detected).toBe(false);
    expect(result.rectangle).toBeNull();
    expect(result.confidence).toBe(0);
    expect(typeof result.timestamp).toBe('number');
  });

  it('preserves quadrilateral corners when building rectangle geometry', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      calculateBoundingBox: (points: Array<{ x: number; y: number }>) => {
        topLeft: { x: number; y: number };
        topRight: { x: number; y: number };
        bottomRight: { x: number; y: number };
        bottomLeft: { x: number; y: number };
      };
    };

    const corners = [
      { x: 20, y: 15 },
      { x: 90, y: 25 },
      { x: 80, y: 95 },
      { x: 10, y: 85 },
    ];

    const rectangle = internal.calculateBoundingBox(corners);

    expect(rectangle.topLeft).toEqual(corners[0]);
    expect(rectangle.topRight).toEqual(corners[1]);
    expect(rectangle.bottomRight).toEqual(corners[2]);
    expect(rectangle.bottomLeft).toEqual(corners[3]);
  });

  it('returns original points when ordering corners with non-quadrilateral input', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      orderCorners: (
        points: Array<{ x: number; y: number }>
      ) => Array<{ x: number; y: number }> | null;
    };

    const triangle = [
      { x: 10, y: 10 },
      { x: 40, y: 12 },
      { x: 25, y: 60 },
    ];

    expect(internal.orderCorners(triangle)).toBeNull();
  });

  it('returns null when corner ordering encounters duplicate corners', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      orderCorners: (
        points: Array<{ x: number; y: number }>
      ) => Array<{ x: number; y: number }> | null;
    };

    const duplicateCornerPoints = [
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 90, y: 90 },
      { x: 20, y: 80 },
    ];

    expect(internal.orderCorners(duplicateCornerPoints)).toBeNull();
  });

  it('returns aspectRatio 0 for degenerate zero-height quadrilateral', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      calculateBoundingBox: (points: Array<{ x: number; y: number }>) => {
        topLeft: { x: number; y: number };
        topRight: { x: number; y: number };
        bottomRight: { x: number; y: number };
        bottomLeft: { x: number; y: number };
        width: number;
        height: number;
        aspectRatio: number;
      };
    };

    const flatPoints = [
      { x: 5, y: 30 },
      { x: 45, y: 30 },
      { x: 85, y: 30 },
      { x: 15, y: 30 },
    ];

    const rectangle = internal.calculateBoundingBox(flatPoints);
    expect(rectangle.height).toBe(0);
    expect(rectangle.aspectRatio).toBe(0);
  });
});
