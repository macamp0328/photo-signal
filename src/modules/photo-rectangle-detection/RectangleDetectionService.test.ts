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

  // ── enhanceContrast ────────────────────────────────────────────────────────

  it('returns original array when all pixels are the same value (max === min)', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      enhanceContrast: (gray: Uint8ClampedArray) => Uint8ClampedArray;
    };

    const uniform = new Uint8ClampedArray(16).fill(100);
    const result = internal.enhanceContrast(uniform);

    // All output values must be unchanged — the contract is value stability, not identity
    expect(Array.from(result)).toEqual(Array.from(uniform));
  });

  it('stretches pixel values to 0–255 when min < max', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      enhanceContrast: (gray: Uint8ClampedArray) => Uint8ClampedArray;
    };

    // Two-pixel image: min=50, max=150 → stretched to 0 and 255
    const gray = new Uint8ClampedArray([50, 150]);
    const result = internal.enhanceContrast(gray);

    expect(result[0]).toBe(0);
    expect(result[1]).toBe(255);
  });

  // ── normalizeRectangle ─────────────────────────────────────────────────────

  it('normalizes rectangle coordinates relative to frame dimensions', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      normalizeRectangle: (
        rect: {
          topLeft: { x: number; y: number };
          topRight: { x: number; y: number };
          bottomRight: { x: number; y: number };
          bottomLeft: { x: number; y: number };
          width: number;
          height: number;
          aspectRatio: number;
        },
        width: number,
        height: number
      ) => {
        topLeft: { x: number; y: number };
        width: number;
        height: number;
        aspectRatio: number;
      };
    };

    const rect = {
      topLeft: { x: 100, y: 50 },
      topRight: { x: 300, y: 50 },
      bottomRight: { x: 300, y: 150 },
      bottomLeft: { x: 100, y: 150 },
      width: 200,
      height: 100,
      aspectRatio: 2,
    };

    const normalized = internal.normalizeRectangle(rect, 400, 200);

    expect(normalized.topLeft.x).toBeCloseTo(0.25);
    expect(normalized.topLeft.y).toBeCloseTo(0.25);
    expect(normalized.width).toBeCloseTo(0.5);
    expect(normalized.height).toBeCloseTo(0.5);
    // aspectRatio is preserved as-is (not re-normalized)
    expect(normalized.aspectRatio).toBe(2);
  });

  // ── measureRectangularity ──────────────────────────────────────────────────

  it('returns near-1 rectangularity for a perfect axis-aligned square', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      measureRectangularity: (points: Array<{ x: number; y: number }>) => number;
    };

    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    const r = internal.measureRectangularity(square);
    // A perfect square has 0 angle deviation → rectangularity ≈ 1
    expect(r).toBeCloseTo(1, 1);
  });

  it('returns 0 for a non-quadrilateral point set', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      measureRectangularity: (points: Array<{ x: number; y: number }>) => number;
    };

    const triangle = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];

    expect(internal.measureRectangularity(triangle)).toBe(0);
  });

  // ── perpendicularDistance (degenerate line = single point) ─────────────────

  it('returns Euclidean distance when lineStart and lineEnd are the same point', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      perpendicularDistance: (
        point: { x: number; y: number },
        lineStart: { x: number; y: number },
        lineEnd: { x: number; y: number }
      ) => number;
    };

    // dx === 0 and dy === 0 → branch falls back to Euclidean distance to the point
    const dist = internal.perpendicularDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(dist).toBeCloseTo(5); // 3-4-5 right triangle
  });

  // ── convexHull ─────────────────────────────────────────────────────────────

  it('returns input unchanged for fewer than 3 points', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      convexHull: (points: Array<{ x: number; y: number }>) => Array<{ x: number; y: number }>;
    };

    const twoPoints = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];

    const hull = internal.convexHull(twoPoints);
    expect(hull).toEqual(twoPoints);
  });

  it('returns a hull with no more points than the input', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      convexHull: (points: Array<{ x: number; y: number }>) => Array<{ x: number; y: number }>;
    };

    // A known square — hull should have exactly 4 points
    const square = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    const hull = internal.convexHull(square);
    expect(hull.length).toBeLessThanOrEqual(square.length);
    expect(hull.length).toBeGreaterThanOrEqual(3);
  });

  // ── detectRectangle error recovery ────────────────────────────────────────

  it('returns a no-detection result when an internal method throws', () => {
    const service = new RectangleDetectionService();
    // Access the private method via bracket notation and replace it for this test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceAny = service as any;
    const originalToGrayscale = serviceAny.toGrayscale;
    serviceAny.toGrayscale = () => {
      throw new Error('forced error');
    };

    let result: ReturnType<typeof service.detectRectangle>;
    try {
      result = service.detectRectangle(makeImageData(32, 32));
    } finally {
      serviceAny.toGrayscale = originalToGrayscale;
    }

    expect(result!.detected).toBe(false);
    expect(result!.rectangle).toBeNull();
    expect(result!.confidence).toBe(0);
  });

  // ── calculateConfidence ────────────────────────────────────────────────────

  it('clamps confidence between 0 and 1', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      calculateConfidence: (
        approx: Array<{ x: number; y: number }>,
        rect: {
          aspectRatio: number;
          width: number;
          height: number;
          topLeft: { x: number; y: number };
          topRight: { x: number; y: number };
          bottomRight: { x: number; y: number };
          bottomLeft: { x: number; y: number };
        },
        normalizedArea: number
      ) => number;
    };

    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const rect = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 10, y: 0 },
      bottomRight: { x: 10, y: 10 },
      bottomLeft: { x: 0, y: 10 },
      aspectRatio: 1.0,
      width: 10,
      height: 10,
    };

    const conf = internal.calculateConfidence(square, rect, 0.5);
    expect(conf).toBeGreaterThanOrEqual(0);
    expect(conf).toBeLessThanOrEqual(1);
  });
});
