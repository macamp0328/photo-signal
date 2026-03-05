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

  it('returns original points when ordering corners with non-quadrilateral input', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      orderCorners: (points: Array<{ x: number; y: number }>) => Array<{ x: number; y: number }>;
    };

    const triangle = [
      { x: 10, y: 10 },
      { x: 40, y: 12 },
      { x: 25, y: 60 },
    ];

    expect(internal.orderCorners(triangle)).toEqual(triangle);
  });

  it('falls back to original points when corner ordering encounters duplicate corners', () => {
    const service = new RectangleDetectionService();
    const internal = service as unknown as {
      orderCorners: (points: Array<{ x: number; y: number }>) => Array<{ x: number; y: number }>;
    };

    const duplicateCornerPoints = [
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 90, y: 90 },
      { x: 20, y: 80 },
    ];

    expect(internal.orderCorners(duplicateCornerPoints)).toEqual(duplicateCornerPoints);
  });

  it('uses quad bounds (not topLeft+width) for ROI center/containment weighting', () => {
    const roiHint: RectangleRoiHint = {
      center: { x: 0.8, y: 0.8 },
      radius: 0.25,
      ageMs: 100,
      lockStrength: 1,
    };

    const rotatedQuadWithOffBoundsTopLeft: DetectedRectangle = {
      topLeft: { x: 5, y: 5 },
      topRight: { x: 95, y: 15 },
      bottomRight: { x: 90, y: 90 },
      bottomLeft: { x: 15, y: 95 },
      width: 20,
      height: 20,
      aspectRatio: 1,
    };

    const score = invokeRoiWeight(rotatedQuadWithOffBoundsTopLeft, roiHint);
    expect(score).toBeGreaterThan(0.6);
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
