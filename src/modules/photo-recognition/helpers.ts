import type { Concert } from '../../types';
import type {
  FailureCategory,
  FailureDiagnostic,
  FrameQualityInfo,
  FrameQualityStats,
  GuidanceType,
  HammingDistanceLog,
  RecognitionTelemetry,
} from './types';

export const PHASH_HEX_LENGTH = 16;
export const PHASH_MAX_DISTANCE = PHASH_HEX_LENGTH * 4;
const PHASH_HEX_PATTERN = /^[0-9a-f]+$/i;

const emptyFrameQualityStats = (): FrameQualityStats => ({
  blur: { sharpnessSum: 0, sampleCount: 0 },
  glare: { glarePercentSum: 0, sampleCount: 0 },
  lighting: { brightnessSum: 0, sampleCount: 0 },
});

const emptyHammingDistanceLog = (): HammingDistanceLog => ({
  nearMisses: [],
  matchedFrameDistances: { min: null, max: null, sum: 0, count: 0 },
});

export const createEmptyTelemetry = (): RecognitionTelemetry => ({
  totalFrames: 0,
  blurRejections: 0,
  glareRejections: 0,
  lightingRejections: 0,
  qualityFrames: 0,
  successfulRecognitions: 0,
  failedAttempts: 0,
  failureHistory: [],
  failureByCategory: {
    'motion-blur': 0,
    glare: 0,
    'poor-quality': 0,
    'no-match': 0,
    collision: 0,
    unknown: 0,
  },
  guidanceTracking: {
    shown: {
      'motion-blur': 0,
      glare: 0,
      'poor-lighting': 0,
      'ambiguous-match': 0,
      distance: 0,
      'off-center': 0,
      none: 0,
    },
    duration: {
      'motion-blur': 0,
      glare: 0,
      'poor-lighting': 0,
      'ambiguous-match': 0,
      distance: 0,
      'off-center': 0,
      none: 0,
    },
    lastShown: {
      'motion-blur': 0,
      glare: 0,
      'poor-lighting': 0,
      'ambiguous-match': 0,
      distance: 0,
      'off-center': 0,
      none: 0,
    },
  },
  switchDecision: {
    shownCount: 0,
    confirmCount: 0,
    dismissCount: 0,
    decisionLatenciesMs: [],
    averageDecisionLatencyMs: null,
    lastDecisionLatencyMs: null,
    lastPromptSnapshot: {
      activeConcertId: null,
      candidateConcertId: null,
      confidence: null,
      margin: null,
      shownAt: null,
    },
  },
  frameQualityStats: emptyFrameQualityStats(),
  hammingDistanceLog: emptyHammingDistanceLog(),
});

export const similarityPercent = (distance: number): number =>
  ((PHASH_MAX_DISTANCE - distance) / PHASH_MAX_DISTANCE) * 100;

export const getPHashes = (concert: Concert): string[] => {
  const hashes = concert.photoHashes?.phash;
  if (!Array.isArray(hashes) || hashes.length === 0) {
    return [];
  }

  return hashes.filter(
    (value) =>
      typeof value === 'string' &&
      value.length === PHASH_HEX_LENGTH &&
      PHASH_HEX_PATTERN.test(value)
  );
};

export const recordFailure = (
  telemetry: RecognitionTelemetry,
  category: FailureCategory,
  reason: string,
  frameHash: string
): void => {
  telemetry.failureByCategory[category] += 1;
  const diagnostic: FailureDiagnostic = {
    category,
    reason,
    frameHash,
    timestamp: Date.now(),
  };
  telemetry.failureHistory.push(diagnostic);
  if (telemetry.failureHistory.length > 50) {
    telemetry.failureHistory.shift();
  }
};

export const pickGuidance = (quality: FrameQualityInfo): GuidanceType => {
  if (!quality.isSharp) {
    return 'motion-blur';
  }
  if (quality.hasGlare) {
    return 'glare';
  }
  if (quality.hasPoorLighting) {
    return 'poor-lighting';
  }
  return 'none';
};
