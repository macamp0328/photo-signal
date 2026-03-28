import { describe, it, expect } from 'vitest';
import { calculateVisibleViewport } from '../framing';

describe('calculateVisibleViewport', () => {
  describe('normal crop paths', () => {
    it('crops horizontally when video is wider than display', () => {
      // 16:9 video displayed at 1:1 → video wider than display
      // videoRatio = 1.778 > safeRatio = 1
      const result = calculateVisibleViewport(1920, 1080, 1);
      expect(result.y).toBe(0);
      expect(result.width).toBe(1080); // height * safeRatio = 1080 * 1
      expect(result.height).toBe(1080);
      // x should be centred
      expect(result.x).toBe(Math.round((1920 - 1080) / 2));
    });

    it('crops vertically when video is taller than display', () => {
      // Portrait video 9:16 (0.5625) displayed at 1:1 → video narrower
      // videoRatio = 0.5625 < safeRatio = 1
      const result = calculateVisibleViewport(1080, 1920, 1);
      expect(result.x).toBe(0);
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1080); // width / safeRatio = 1080 / 1
      // y should be centred
      expect(result.y).toBe(Math.round((1920 - 1080) / 2));
    });
  });

  describe('edge cases', () => {
    it('returns full frame when video ratio matches display ratio', () => {
      // 16:9 video displayed at exactly 16:9 → difference < 0.001
      const result = calculateVisibleViewport(1920, 1080, 16 / 9);
      expect(result).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    });

    it('returns full frame when videoRatio is non-finite — zero-height video', () => {
      // videoHeight = 0 → videoRatio = Infinity → !isFinite → early return
      const result = calculateVisibleViewport(1920, 0);
      expect(result).toEqual({ x: 0, y: 0, width: 1920, height: 0 });
    });

    it('returns full frame when videoWidth and videoHeight are both zero — NaN ratio', () => {
      // 0 / 0 = NaN → !isFinite(NaN) → early return
      const result = calculateVisibleViewport(0, 0);
      expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('uses video ratio as safeRatio when displayAspectRatio is 0', () => {
      // displayAspectRatio = 0 → safeRatio = videoWidth / videoHeight = 1920/1080
      // videoRatio === safeRatio → difference < 0.001 → returns full frame
      const result = calculateVisibleViewport(1920, 1080, 0);
      expect(result).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    });
  });
});
