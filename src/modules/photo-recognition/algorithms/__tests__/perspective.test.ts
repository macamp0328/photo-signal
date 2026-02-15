import { describe, expect, it } from 'vitest';
import type { DetectedRectangle } from '../../../photo-rectangle-detection';
import { getPerspectiveCroppedImageData } from '../perspective';

const createGradientImage = (width: number, height: number): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = Math.round((x / Math.max(width - 1, 1)) * 255);
      data[index + 1] = Math.round((y / Math.max(height - 1, 1)) * 255);
      data[index + 2] = 120;
      data[index + 3] = 255;
    }
  }

  return new ImageData(data, width, height);
};

describe('perspective crop', () => {
  it('rectifies a skewed rectangle into a usable output image', () => {
    const source = createGradientImage(120, 80);

    const rectangle: DetectedRectangle = {
      topLeft: { x: 0.2, y: 0.2 },
      topRight: { x: 0.82, y: 0.14 },
      bottomRight: { x: 0.88, y: 0.84 },
      bottomLeft: { x: 0.15, y: 0.9 },
      width: 0.73,
      height: 0.76,
      aspectRatio: 0.96,
    };

    const warped = getPerspectiveCroppedImageData(source, rectangle);

    expect(warped).not.toBeNull();
    expect((warped?.width ?? 0) >= 24).toBe(true);
    expect((warped?.height ?? 0) >= 24).toBe(true);
  });

  it('preserves image content for axis-aligned rectangle', () => {
    const source = createGradientImage(64, 64);

    const rectangle: DetectedRectangle = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 0, y: 1 },
      width: 1,
      height: 1,
      aspectRatio: 1,
    };

    const warped = getPerspectiveCroppedImageData(source, rectangle);

    expect(warped).not.toBeNull();

    const centerX = ((warped?.width ?? 1) / 2) | 0;
    const centerY = ((warped?.height ?? 1) / 2) | 0;
    const centerIndex = (centerY * (warped?.width ?? 1) + centerX) * 4;
    const red = warped?.data[centerIndex] ?? 0;
    const green = warped?.data[centerIndex + 1] ?? 0;

    expect(red).toBeGreaterThan(90);
    expect(red).toBeLessThan(170);
    expect(green).toBeGreaterThan(90);
    expect(green).toBeLessThan(170);
  });
});
