import type { Concert } from '../../types';
import type {
  CollisionStats,
  FailureCategory,
  FailureDiagnostic,
  FrameQualityStats,
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

const emptyCollisionStats = (): CollisionStats => ({
  ambiguousCount: 0,
  nearThresholdCount: 0,
  ambiguousMarginHistogram: {
    '0-1': 0,
    '2': 0,
    '3-4': 0,
    '5+': 0,
    unknown: 0,
  },
  ambiguousPairCounts: {},
});

export const createEmptyTelemetry = (): RecognitionTelemetry => ({
  totalFrames: 0,
  blurRejections: 0,
  glareRejections: 0,
  lightingRejections: 0,
  qualityFrames: 0,
  qualityBypassFrames: 0,
  successfulRecognitions: 0,
  instantConfirmations: 0,
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
  frameQualityStats: emptyFrameQualityStats(),
  hammingDistanceLog: emptyHammingDistanceLog(),
  collisionStats: emptyCollisionStats(),
  index_mode_used: 0,
  candidate_count_per_frame: {
    last: 0,
    max: 0,
    total: 0,
    frames: 0,
  },
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

export const recordCollisionDetails = (
  telemetry: RecognitionTelemetry,
  args: {
    isAmbiguous: boolean;
    margin: number | null;
    bestBand: string;
    secondBand: string | null;
  }
): void => {
  if (args.isAmbiguous) {
    telemetry.collisionStats.ambiguousCount += 1;

    if (args.margin === null) {
      telemetry.collisionStats.ambiguousMarginHistogram.unknown += 1;
    } else if (args.margin <= 1) {
      telemetry.collisionStats.ambiguousMarginHistogram['0-1'] += 1;
    } else if (args.margin === 2) {
      telemetry.collisionStats.ambiguousMarginHistogram['2'] += 1;
    } else if (args.margin <= 4) {
      telemetry.collisionStats.ambiguousMarginHistogram['3-4'] += 1;
    } else {
      telemetry.collisionStats.ambiguousMarginHistogram['5+'] += 1;
    }

    const rival = args.secondBand ?? 'Unknown rival';
    const pairKey =
      args.bestBand <= rival ? `${args.bestBand} vs ${rival}` : `${rival} vs ${args.bestBand}`;
    telemetry.collisionStats.ambiguousPairCounts[pairKey] =
      (telemetry.collisionStats.ambiguousPairCounts[pairKey] ?? 0) + 1;
    return;
  }

  telemetry.collisionStats.nearThresholdCount += 1;
};
