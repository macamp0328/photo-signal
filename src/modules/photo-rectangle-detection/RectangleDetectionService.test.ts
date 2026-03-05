import { describe, expect, it } from 'vitest';
import { RectangleDetectionService } from './RectangleDetectionService';
import type { DetectedRectangle, RectangleRoiHint } from './types';

describe('RectangleDetectionService ROI weighting', () => {
  const invokeRoiWeight = (rect: DetectedRectangle, roiHint: RectangleRoiHint): number => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      calculateRoiWeight: (
        rectangle: DetectedRectangle,
        width: number,
        height: number,
        hint: RectangleRoiHint
      ) => number;
    };

    return internal.calculateRoiWeight(rect, 100, 100, roiHint);
  };

  it('scores rectangles near tap higher than far rectangles', () => {
    const roiHint: RectangleRoiHint = {
      center: { x: 0.3, y: 0.3 },
      radius: 0.25,
      ageMs: 120,
      lockStrength: 1,
    };

    const nearRect: DetectedRectangle = {
      topLeft: { x: 15, y: 15 },
      topRight: { x: 45, y: 15 },
      bottomRight: { x: 45, y: 45 },
      bottomLeft: { x: 15, y: 45 },
      width: 30,
      height: 30,
      aspectRatio: 1,
    };

    const farRect: DetectedRectangle = {
      topLeft: { x: 70, y: 70 },
      topRight: { x: 95, y: 70 },
      bottomRight: { x: 95, y: 95 },
      bottomLeft: { x: 70, y: 95 },
      width: 25,
      height: 25,
      aspectRatio: 1,
    };

    const nearScore = invokeRoiWeight(nearRect, roiHint);
    const farScore = invokeRoiWeight(farRect, roiHint);

    expect(nearScore).toBeGreaterThan(farScore);
  });

  it('does not bias when lockStrength is zero', () => {
    const roiHint: RectangleRoiHint = {
      center: { x: 0.1, y: 0.1 },
      radius: 0.2,
      ageMs: 0,
      lockStrength: 0,
    };

    const rect: DetectedRectangle = {
      topLeft: { x: 60, y: 60 },
      topRight: { x: 90, y: 60 },
      bottomRight: { x: 90, y: 90 },
      bottomLeft: { x: 60, y: 90 },
      width: 30,
      height: 30,
      aspectRatio: 1,
    };

    const score = invokeRoiWeight(rect, roiHint);
    expect(score).toBe(1);
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
});
