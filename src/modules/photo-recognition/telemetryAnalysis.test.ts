import { describe, it, expect } from 'vitest';
import { computeActiveSettings, computeAiRecommendations } from './telemetryAnalysis';
import { createEmptyTelemetry } from './helpers';
import type { RecognitionTelemetry } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTestTelemetry = (overrides: Partial<RecognitionTelemetry>): RecognitionTelemetry => ({
  ...createEmptyTelemetry(),
  ...overrides,
  failureByCategory: {
    ...createEmptyTelemetry().failureByCategory,
    ...overrides.failureByCategory,
  },
  frameQualityStats: {
    ...createEmptyTelemetry().frameQualityStats,
    ...overrides.frameQualityStats,
    blur: {
      ...createEmptyTelemetry().frameQualityStats.blur,
      ...overrides.frameQualityStats?.blur,
    },
    glare: {
      ...createEmptyTelemetry().frameQualityStats.glare,
      ...overrides.frameQualityStats?.glare,
    },
    lighting: {
      ...createEmptyTelemetry().frameQualityStats.lighting,
      ...overrides.frameQualityStats?.lighting,
    },
  },
  hammingDistanceLog: {
    ...createEmptyTelemetry().hammingDistanceLog,
    ...overrides.hammingDistanceLog,
    matchedFrameDistances: {
      ...createEmptyTelemetry().hammingDistanceLog.matchedFrameDistances,
      ...overrides.hammingDistanceLog?.matchedFrameDistances,
    },
  },
});

// ---------------------------------------------------------------------------
// computeActiveSettings
// ---------------------------------------------------------------------------

describe('computeActiveSettings', () => {
  it('returns all defaults when given empty options', () => {
    const settings = computeActiveSettings({});
    expect(settings.similarityThreshold).toBe(14);
    expect(settings.matchMarginThreshold).toBe(4);
    expect(settings.sharpnessThreshold).toBe(100);
    expect(settings.glarePercentageThreshold).toBe(20);
    expect(settings.glareThreshold).toBe(250);
    expect(settings.minBrightness).toBe(50);
    expect(settings.maxBrightness).toBe(220);
    expect(settings.recognitionDelay).toBe(200);
    expect(settings.checkInterval).toBe(120);
    expect(settings.switchDistanceThreshold).toBe(7);
    expect(settings.switchMatchMarginThreshold).toBe(6);
    expect(settings.switchRecognitionDelayMultiplier).toBe(1.8);
    expect(settings.continuousRecognition).toBe(false);
    expect(settings.enableRectangleDetection).toBe(false);
    expect(settings.rectangleConfidenceThreshold).toBe(0.35);
  });

  it('overrides individual fields while keeping defaults for the rest', () => {
    const settings = computeActiveSettings({ similarityThreshold: 16, sharpnessThreshold: 75 });
    expect(settings.similarityThreshold).toBe(16);
    expect(settings.sharpnessThreshold).toBe(75);
    // defaults preserved for unspecified fields
    expect(settings.matchMarginThreshold).toBe(4);
    expect(settings.recognitionDelay).toBe(200);
  });

  it('handles partial options without errors', () => {
    const settings = computeActiveSettings({ continuousRecognition: true });
    expect(settings.continuousRecognition).toBe(true);
    expect(settings.similarityThreshold).toBe(14);
  });

  it('returns an object with no undefined values', () => {
    const settings = computeActiveSettings({});
    for (const value of Object.values(settings)) {
      expect(value).not.toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// computeAiRecommendations
// ---------------------------------------------------------------------------

describe('computeAiRecommendations', () => {
  const defaultSettings = computeActiveSettings({});

  it('returns empty array for zero-frame telemetry', () => {
    const telemetry = makeTestTelemetry({ totalFrames: 0 });
    const recs = computeAiRecommendations(telemetry, defaultSettings);
    expect(recs).toHaveLength(0);
  });

  it('returns empty array for a perfect session', () => {
    const telemetry = makeTestTelemetry({
      totalFrames: 100,
      qualityFrames: 100,
      successfulRecognitions: 90,
      failedAttempts: 10,
    });
    const recs = computeAiRecommendations(telemetry, defaultSettings);
    expect(recs).toHaveLength(0);
  });

  describe('blur recommendations', () => {
    it('returns high-priority blur recommendation when blur rate > 40%', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        blurRejections: 45,
        frameQualityStats: {
          blur: { sharpnessSum: 3600, sampleCount: 45 }, // avg = 80
          glare: { glarePercentSum: 0, sampleCount: 0 },
          lighting: { brightnessSum: 0, sampleCount: 0 },
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const blurRec = recs.find((r) => r.parameterChange.startsWith('sharpnessThreshold'));
      expect(blurRec).toBeDefined();
      expect(blurRec?.priority).toBe('high');
    });

    it('returns medium-priority blur recommendation when blur rate is 20–40%', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        blurRejections: 25,
        frameQualityStats: {
          blur: { sharpnessSum: 2000, sampleCount: 25 }, // avg = 80
          glare: { glarePercentSum: 0, sampleCount: 0 },
          lighting: { brightnessSum: 0, sampleCount: 0 },
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const blurRec = recs.find((r) => r.parameterChange.startsWith('sharpnessThreshold'));
      expect(blurRec).toBeDefined();
      expect(blurRec?.priority).toBe('medium');
    });

    it('computes suggested sharpness threshold from avg rejected sharpness', () => {
      // avg sharpness = 80, suggested = round(80 * 0.85) = 68
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        blurRejections: 50,
        frameQualityStats: {
          blur: { sharpnessSum: 4000, sampleCount: 50 },
          glare: { glarePercentSum: 0, sampleCount: 0 },
          lighting: { brightnessSum: 0, sampleCount: 0 },
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const blurRec = recs.find((r) => r.parameterChange.startsWith('sharpnessThreshold'));
      expect(blurRec?.parameterChange).toBe('sharpnessThreshold: 68');
    });

    it('falls back to percentage reduction when no blur samples exist', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        blurRejections: 50,
        // sampleCount stays 0
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const blurRec = recs.find((r) => r.parameterChange.startsWith('sharpnessThreshold'));
      // fallback: round(100 * 0.8) = 80
      expect(blurRec?.parameterChange).toBe('sharpnessThreshold: 80');
    });
  });

  describe('glare recommendations', () => {
    it('returns high-priority glare recommendation when glare rate > 30%', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        glareRejections: 35,
        frameQualityStats: {
          blur: { sharpnessSum: 0, sampleCount: 0 },
          glare: { glarePercentSum: 35 * 25, sampleCount: 35 }, // avg glare = 25%
          lighting: { brightnessSum: 0, sampleCount: 0 },
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const glareRec = recs.find((r) => r.parameterChange.startsWith('glarePercentageThreshold'));
      expect(glareRec?.priority).toBe('high');
    });

    it('caps suggested glarePercentageThreshold at 60', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        glareRejections: 35,
        frameQualityStats: {
          blur: { sharpnessSum: 0, sampleCount: 0 },
          glare: { glarePercentSum: 35 * 55, sampleCount: 35 }, // avg = 55%, suggested = min(72, 60) = 60
          lighting: { brightnessSum: 0, sampleCount: 0 },
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const glareRec = recs.find((r) => r.parameterChange.startsWith('glarePercentageThreshold'));
      expect(glareRec?.parameterChange).toBe('glarePercentageThreshold: 60');
    });
  });

  describe('no-match recommendations', () => {
    it('includes near-miss evidence when nearMisses are present', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        failureByCategory: {
          'no-match': 30,
          'motion-blur': 0,
          glare: 0,
          'poor-quality': 0,
          collision: 0,
          unknown: 0,
        },
        hammingDistanceLog: {
          nearMisses: [
            { distance: 15, frameHash: 'abc', timestamp: Date.now() },
            { distance: 17, frameHash: 'def', timestamp: Date.now() },
          ],
          matchedFrameDistances: { min: null, max: null, sum: 0, count: 0 },
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const noMatchRec = recs.find((r) => r.parameterChange.startsWith('similarityThreshold'));
      expect(noMatchRec).toBeDefined();
      // avg near miss = (15+17)/2 = 16, suggested = round(16 * 1.1) = 18
      expect(noMatchRec?.parameterChange).toBe('similarityThreshold: 18');
    });

    it('gives generic suggestion when no near-misses recorded', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        failureByCategory: {
          'no-match': 30,
          'motion-blur': 0,
          glare: 0,
          'poor-quality': 0,
          collision: 0,
          unknown: 0,
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const noMatchRec = recs.find((r) => r.parameterChange.startsWith('similarityThreshold'));
      // fallback: current + 3 = 14 + 3 = 17
      expect(noMatchRec?.parameterChange).toBe('similarityThreshold: 17');
    });
  });

  describe('collision recommendations', () => {
    it('returns high-priority collision recommendation when collision rate > 20%', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        failureByCategory: {
          'no-match': 0,
          'motion-blur': 0,
          glare: 0,
          'poor-quality': 0,
          collision: 25,
          unknown: 0,
        },
        collisionStats: {
          ...createEmptyTelemetry().collisionStats,
          ambiguousCount: 20,
          ambiguousMarginHistogram: {
            '0-1': 10,
            '2': 6,
            '3-4': 3,
            '5+': 1,
            unknown: 0,
          },
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const collisionRec = recs.find((r) => r.parameterChange.startsWith('matchMarginThreshold'));
      expect(collisionRec?.priority).toBe('high');
      // low-margin-dominated collisions suggest +1 margin step (4 -> 5)
      expect(collisionRec?.parameterChange).toBe('matchMarginThreshold: 5');
    });

    it('returns medium-priority collision recommendation when collision rate 10–20%', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        failureByCategory: {
          'no-match': 0,
          'motion-blur': 0,
          glare: 0,
          'poor-quality': 0,
          collision: 15,
          unknown: 0,
        },
        collisionStats: {
          ...createEmptyTelemetry().collisionStats,
          ambiguousCount: 10,
          ambiguousMarginHistogram: {
            '0-1': 4,
            '2': 3,
            '3-4': 2,
            '5+': 1,
            unknown: 0,
          },
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const collisionRec = recs.find((r) => r.parameterChange.startsWith('matchMarginThreshold'));
      expect(collisionRec?.priority).toBe('medium');
    });

    it('recommends hash refresh when collisions are not margin-dominated', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        failureByCategory: {
          'no-match': 0,
          'motion-blur': 0,
          glare: 0,
          'poor-quality': 0,
          collision: 30,
          unknown: 0,
        },
        collisionStats: {
          ...createEmptyTelemetry().collisionStats,
          ambiguousCount: 16,
          ambiguousMarginHistogram: {
            '0-1': 2,
            '2': 2,
            '3-4': 8,
            '5+': 4,
            unknown: 0,
          },
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const collisionRec = recs.find(
        (r) =>
          r.parameterChange === 'refreshHashes: true' ||
          r.parameterChange.startsWith('matchMarginThreshold')
      );
      expect(collisionRec?.parameterChange).toBe('refreshHashes: true');
    });

    it('recommends threshold/hash remediation when collisions are near-threshold without ambiguity', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        failureByCategory: {
          'no-match': 0,
          'motion-blur': 0,
          glare: 0,
          'poor-quality': 0,
          collision: 24,
          unknown: 0,
        },
        collisionStats: {
          ...createEmptyTelemetry().collisionStats,
          ambiguousCount: 0,
          nearThresholdCount: 24,
        },
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      const collisionRec = recs.find((r) => r.issue.includes('collision rate'));
      expect(collisionRec?.parameterChange).toBe('refreshHashes: true');
      expect(collisionRec?.recommendation).toContain('similarity threshold');
    });
  });

  describe('low quality catch-all', () => {
    it('returns dominant-cause recommendation when quality rate < 30% with no other recs', () => {
      const telemetry = makeTestTelemetry({
        totalFrames: 100,
        qualityFrames: 20,
        blurRejections: 5, // not enough to trigger blur rec (< 20%)
        glareRejections: 5, // not enough to trigger glare rec (< 15%)
        lightingRejections: 40,
      });
      const recs = computeAiRecommendations(telemetry, defaultSettings);
      expect(recs).toHaveLength(1);
      expect(recs[0].priority).toBe('high');
      expect(recs[0].recommendation).toContain('lighting');
    });
  });

  it('returns multiple recommendations when multiple issues present', () => {
    const telemetry = makeTestTelemetry({
      totalFrames: 100,
      blurRejections: 45,
      glareRejections: 35,
    });
    const recs = computeAiRecommendations(telemetry, defaultSettings);
    expect(recs.length).toBeGreaterThanOrEqual(2);
  });

  it('does not divide by zero when sampleCount is 0', () => {
    const telemetry = makeTestTelemetry({
      totalFrames: 100,
      blurRejections: 50,
      // frameQualityStats.blur.sampleCount is 0 (default)
    });
    expect(() => computeAiRecommendations(telemetry, defaultSettings)).not.toThrow();
  });
});
