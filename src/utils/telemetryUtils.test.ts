/**
 * Tests for Guidance Telemetry Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  formatGuidanceTelemetry,
  exportGuidanceTelemetry,
  calculateGuidanceEffectiveness,
} from './telemetryUtils';
import type {
  RecognitionTelemetry,
  GuidanceType,
  FailureCategory,
} from '../modules/photo-recognition/types';

/**
 * Helper to create complete guidanceTracking object with all required GuidanceType keys
 */
function createGuidanceTracking(overrides?: {
  shown?: Partial<Record<GuidanceType, number>>;
  duration?: Partial<Record<GuidanceType, number>>;
  lastShown?: Partial<Record<GuidanceType, number>>;
}): RecognitionTelemetry['guidanceTracking'] {
  const defaults = {
    'motion-blur': 0,
    glare: 0,
    'poor-lighting': 0,
    'ambiguous-match': 0,
    distance: 0,
    'off-center': 0,
    none: 0,
  };

  return {
    shown: { ...defaults, ...overrides?.shown },
    duration: { ...defaults, ...overrides?.duration },
    lastShown: { ...defaults, ...overrides?.lastShown },
  };
}

/**
 * Helper to create complete failureByCategory object with all required FailureCategory keys
 */
function createFailureByCategory(
  overrides?: Partial<Record<FailureCategory, number>>
): Record<FailureCategory, number> {
  const defaults: Record<FailureCategory, number> = {
    'motion-blur': 0,
    glare: 0,
    'poor-quality': 0,
    'no-match': 0,
    collision: 0,
    unknown: 0,
  };

  return { ...defaults, ...overrides };
}

describe('telemetryUtils', () => {
  describe('formatGuidanceTelemetry', () => {
    it('should format complete telemetry report', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 75,
        blurRejections: 15,
        glareRejections: 5,
        lightingRejections: 5,
        successfulRecognitions: 10,
        failedAttempts: 3,
        guidanceTracking: createGuidanceTracking({
          shown: { 'motion-blur': 5, glare: 2, 'poor-lighting': 1 },
          duration: { 'motion-blur': 15000, glare: 6000, 'poor-lighting': 3000 },
        }),
        failureByCategory: createFailureByCategory({ 'no-match': 2 }),
        failureHistory: [],
      };

      const output = formatGuidanceTelemetry(telemetry);

      expect(output).toContain('GUIDANCE TELEMETRY REPORT');
      expect(output).toContain('Total Frames: 100');
      expect(output).toContain('Quality Frames: 75 (75.0%)');
      expect(output).toContain('Blur Rejections: 15 (15.0%)');
      expect(output).toContain('motion-blur: 5 times');
      expect(output).toContain('motion-blur: 15.0s');
    });

    it('should handle zero guidance shown', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 50,
        qualityFrames: 50,
        blurRejections: 0,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 5,
        failedAttempts: 0,
        guidanceTracking: createGuidanceTracking(),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const output = formatGuidanceTelemetry(telemetry);

      expect(output).toContain('Total Frames: 50');
      expect(output).toContain('Quality Frames: 50 (100.0%)');
      // Should not list guidance types with zero count
      expect(output).not.toContain('motion-blur: 0');
    });

    it('should calculate percentages correctly', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 200,
        qualityFrames: 150,
        blurRejections: 30,
        glareRejections: 10,
        lightingRejections: 10,
        successfulRecognitions: 20,
        failedAttempts: 5,
        guidanceTracking: createGuidanceTracking(),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const output = formatGuidanceTelemetry(telemetry);

      expect(output).toContain('Quality Frames: 150 (75.0%)');
      expect(output).toContain('Blur Rejections: 30 (15.0%)');
      expect(output).toContain('Glare Rejections: 10 (5.0%)');
      expect(output).toContain('Lighting Rejections: 10 (5.0%)');
    });
  });

  describe('exportGuidanceTelemetry', () => {
    it('should export valid JSON', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 80,
        blurRejections: 10,
        glareRejections: 5,
        lightingRejections: 5,
        successfulRecognitions: 15,
        failedAttempts: 2,
        guidanceTracking: createGuidanceTracking({
          shown: { 'motion-blur': 3, glare: 1, 'poor-lighting': 1 },
          duration: { 'motion-blur': 9000, glare: 3000, 'poor-lighting': 3000 },
        }),
        failureByCategory: createFailureByCategory({ 'no-match': 1 }),
        failureHistory: [],
      };

      const json = exportGuidanceTelemetry(telemetry);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('frameStats');
      expect(parsed).toHaveProperty('recognitionStats');
      expect(parsed).toHaveProperty('guidanceMetrics');
      expect(parsed).toHaveProperty('failureBreakdown');
    });

    it('should calculate frame stats percentages', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 75,
        blurRejections: 15,
        glareRejections: 5,
        lightingRejections: 5,
        successfulRecognitions: 10,
        failedAttempts: 2,
        guidanceTracking: createGuidanceTracking(),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const json = exportGuidanceTelemetry(telemetry);
      const parsed = JSON.parse(json);

      expect(parsed.frameStats.total).toBe(100);
      expect(parsed.frameStats.quality).toBe(75);
      expect(parsed.frameStats.qualityPercentage).toBe(75);
      expect(parsed.frameStats.blurRejections).toBe(15);
      expect(parsed.frameStats.blurPercentage).toBe(15);
    });

    it('should calculate success rate', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 100,
        blurRejections: 0,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 8,
        failedAttempts: 2,
        guidanceTracking: createGuidanceTracking(),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const json = exportGuidanceTelemetry(telemetry);
      const parsed = JSON.parse(json);

      expect(parsed.recognitionStats.successful).toBe(8);
      expect(parsed.recognitionStats.failed).toBe(2);
      expect(parsed.recognitionStats.successRate).toBe(80);
    });

    it('should handle zero recognitions without dividing by zero', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 50,
        qualityFrames: 50,
        blurRejections: 0,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 0,
        failedAttempts: 0,
        guidanceTracking: createGuidanceTracking(),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const json = exportGuidanceTelemetry(telemetry);
      const parsed = JSON.parse(json);

      expect(parsed.recognitionStats.successRate).toBe(0);
    });

    it('should convert duration to seconds', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 100,
        blurRejections: 0,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 0,
        failedAttempts: 0,
        guidanceTracking: createGuidanceTracking({
          shown: { 'motion-blur': 1 },
          duration: { 'motion-blur': 12345 },
        }),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const json = exportGuidanceTelemetry(telemetry);
      const parsed = JSON.parse(json);

      expect(parsed.guidanceMetrics.durationMs['motion-blur']).toBe(12345);
      expect(parsed.guidanceMetrics.durationSeconds['motion-blur']).toBe('12.3');
    });
  });

  describe('calculateGuidanceEffectiveness', () => {
    it('should calculate reduction in failure rates', () => {
      const before: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 50,
        blurRejections: 30,
        glareRejections: 10,
        lightingRejections: 10,
        successfulRecognitions: 5,
        failedAttempts: 10,
        guidanceTracking: createGuidanceTracking(),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const after: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 80,
        blurRejections: 10,
        glareRejections: 5,
        lightingRejections: 5,
        successfulRecognitions: 15,
        failedAttempts: 2,
        guidanceTracking: createGuidanceTracking({
          shown: { 'motion-blur': 5, glare: 2, 'poor-lighting': 2 },
          duration: { 'motion-blur': 15000, glare: 6000, 'poor-lighting': 6000 },
        }),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const effectiveness = calculateGuidanceEffectiveness(before, after);

      expect(effectiveness.motionBlurReduction).toBe(20); // 30% -> 10%
      expect(effectiveness.glareReduction).toBe(5); // 10% -> 5%
      expect(effectiveness.lightingReduction).toBe(5); // 10% -> 5%
      expect(effectiveness.overallReduction).toBe(30); // 50% -> 20%
    });

    it('should handle improvement in quality', () => {
      const before: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 60,
        blurRejections: 40,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 5,
        failedAttempts: 5,
        guidanceTracking: createGuidanceTracking(),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const after: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 90,
        blurRejections: 10,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 20,
        failedAttempts: 1,
        guidanceTracking: createGuidanceTracking({
          shown: { 'motion-blur': 10 },
          duration: { 'motion-blur': 30000 },
        }),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const effectiveness = calculateGuidanceEffectiveness(before, after);

      expect(effectiveness.motionBlurReduction).toBe(30); // 40% -> 10%
      expect(effectiveness.overallReduction).toBe(30); // 40% -> 10%
    });

    it('should handle no change', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 80,
        blurRejections: 10,
        glareRejections: 5,
        lightingRejections: 5,
        successfulRecognitions: 10,
        failedAttempts: 2,
        guidanceTracking: createGuidanceTracking(),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const effectiveness = calculateGuidanceEffectiveness(telemetry, telemetry);

      expect(effectiveness.motionBlurReduction).toBe(0);
      expect(effectiveness.glareReduction).toBe(0);
      expect(effectiveness.lightingReduction).toBe(0);
      expect(effectiveness.overallReduction).toBe(0);
    });

    it('should handle negative reduction (worse performance)', () => {
      const before: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 90,
        blurRejections: 10,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 15,
        failedAttempts: 1,
        guidanceTracking: createGuidanceTracking(),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const after: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 70,
        blurRejections: 30,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 8,
        failedAttempts: 5,
        guidanceTracking: createGuidanceTracking({
          shown: { 'motion-blur': 5 },
          duration: { 'motion-blur': 15000 },
        }),
        failureByCategory: createFailureByCategory(),
        failureHistory: [],
      };

      const effectiveness = calculateGuidanceEffectiveness(before, after);

      expect(effectiveness.motionBlurReduction).toBe(-20); // Worse: 10% -> 30%
      expect(effectiveness.overallReduction).toBe(-20);
    });
  });
});
