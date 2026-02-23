/**
 * Guidance Telemetry Utilities
 *
 * Helper functions for tracking and exporting guidance effectiveness metrics.
 */

import type {
  RecognitionTelemetry,
  GuidanceType,
  TemporalTelemetrySnapshot,
} from '../modules/photo-recognition/types';

/**
 * Format guidance telemetry for console logging
 */
export function formatGuidanceTelemetry(telemetry: RecognitionTelemetry): string {
  const { guidanceTracking } = telemetry;

  const lines: string[] = [];
  lines.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('GUIDANCE TELEMETRY REPORT');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Overall frame stats
  lines.push('\nFrame Statistics:');
  lines.push(`  Total Frames: ${telemetry.totalFrames}`);
  lines.push(
    `  Quality Frames: ${telemetry.qualityFrames} (${((telemetry.qualityFrames / telemetry.totalFrames) * 100).toFixed(1)}%)`
  );
  lines.push(
    `  Blur Rejections: ${telemetry.blurRejections} (${((telemetry.blurRejections / telemetry.totalFrames) * 100).toFixed(1)}%)`
  );
  lines.push(
    `  Glare Rejections: ${telemetry.glareRejections} (${((telemetry.glareRejections / telemetry.totalFrames) * 100).toFixed(1)}%)`
  );
  lines.push(
    `  Lighting Rejections: ${telemetry.lightingRejections} (${((telemetry.lightingRejections / telemetry.totalFrames) * 100).toFixed(1)}%)`
  );
  lines.push(`  Successful Recognitions: ${telemetry.successfulRecognitions}`);
  lines.push(`  Failed Attempts: ${telemetry.failedAttempts}`);

  // Guidance shown counts
  lines.push('\nGuidance Shown (Times):');
  const guidanceTypes: GuidanceType[] = [
    'motion-blur',
    'glare',
    'poor-lighting',
    'ambiguous-match',
    'distance',
    'off-center',
  ];
  guidanceTypes.forEach((type) => {
    const count = guidanceTracking.shown[type];
    if (count > 0) {
      lines.push(`  ${type}: ${count} times`);
    }
  });

  // Guidance duration
  lines.push('\nGuidance Duration (Total Time):');
  guidanceTypes.forEach((type) => {
    const duration = guidanceTracking.duration[type];
    if (duration > 0) {
      const seconds = (duration / 1000).toFixed(1);
      lines.push(`  ${type}: ${seconds}s`);
    }
  });

  // Failure breakdown
  lines.push('\nFailure Categories:');
  Object.entries(telemetry.failureByCategory).forEach(([category, count]) => {
    if (count > 0) {
      lines.push(`  ${category}: ${count}`);
    }
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return lines.join('\n');
}

/**
 * Export guidance telemetry as JSON for analysis
 */
export function exportGuidanceTelemetry(telemetry: RecognitionTelemetry): string {
  const exportData = {
    timestamp: new Date().toISOString(),
    frameStats: {
      total: telemetry.totalFrames,
      quality: telemetry.qualityFrames,
      qualityPercentage: (telemetry.qualityFrames / telemetry.totalFrames) * 100,
      blurRejections: telemetry.blurRejections,
      blurPercentage: (telemetry.blurRejections / telemetry.totalFrames) * 100,
      glareRejections: telemetry.glareRejections,
      glarePercentage: (telemetry.glareRejections / telemetry.totalFrames) * 100,
      lightingRejections: telemetry.lightingRejections,
      lightingPercentage: (telemetry.lightingRejections / telemetry.totalFrames) * 100,
    },
    recognitionStats: {
      successful: telemetry.successfulRecognitions,
      failed: telemetry.failedAttempts,
      successRate:
        telemetry.successfulRecognitions + telemetry.failedAttempts > 0
          ? (telemetry.successfulRecognitions /
              (telemetry.successfulRecognitions + telemetry.failedAttempts)) *
            100
          : 0,
    },
    guidanceMetrics: {
      shown: telemetry.guidanceTracking.shown,
      durationMs: telemetry.guidanceTracking.duration,
      durationSeconds: Object.fromEntries(
        Object.entries(telemetry.guidanceTracking.duration).map(([key, value]) => [
          key,
          (value / 1000).toFixed(1),
        ])
      ),
    },
    failureBreakdown: telemetry.failureByCategory,
    failureHistory: telemetry.failureHistory,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Calculate guidance effectiveness metrics
 *
 * Compares failure rates before and after guidance was shown to measure impact.
 * Returns percentage reduction in user-error-related failures.
 */
export function calculateGuidanceEffectiveness(
  beforeTelemetry: RecognitionTelemetry,
  afterTelemetry: RecognitionTelemetry
): {
  motionBlurReduction: number;
  glareReduction: number;
  lightingReduction: number;
  overallReduction: number;
} {
  const beforeMotionRate = (beforeTelemetry.blurRejections / beforeTelemetry.totalFrames) * 100;
  const afterMotionRate = (afterTelemetry.blurRejections / afterTelemetry.totalFrames) * 100;
  const motionBlurReduction = beforeMotionRate - afterMotionRate;

  const beforeGlareRate = (beforeTelemetry.glareRejections / beforeTelemetry.totalFrames) * 100;
  const afterGlareRate = (afterTelemetry.glareRejections / afterTelemetry.totalFrames) * 100;
  const glareReduction = beforeGlareRate - afterGlareRate;

  const beforeLightingRate =
    (beforeTelemetry.lightingRejections / beforeTelemetry.totalFrames) * 100;
  const afterLightingRate = (afterTelemetry.lightingRejections / afterTelemetry.totalFrames) * 100;
  const lightingReduction = beforeLightingRate - afterLightingRate;

  const beforeOverallRate =
    ((beforeTelemetry.blurRejections +
      beforeTelemetry.glareRejections +
      beforeTelemetry.lightingRejections) /
      beforeTelemetry.totalFrames) *
    100;
  const afterOverallRate =
    ((afterTelemetry.blurRejections +
      afterTelemetry.glareRejections +
      afterTelemetry.lightingRejections) /
      afterTelemetry.totalFrames) *
    100;
  const overallReduction = beforeOverallRate - afterOverallRate;

  return {
    motionBlurReduction,
    glareReduction,
    lightingReduction,
    overallReduction,
  };
}

/**
 * Build a temporal snapshot from the current live telemetry at a given elapsed second.
 * Used by the countdown useEffect in App.tsx to capture mid-session data points.
 */
export function buildTemporalSnapshot(
  live: RecognitionTelemetry,
  elapsedSeconds: number
): TemporalTelemetrySnapshot {
  return {
    elapsedSeconds,
    cumulativeCounts: {
      totalFrames: live.totalFrames,
      qualityFrames: live.qualityFrames,
      blurRejections: live.blurRejections,
      glareRejections: live.glareRejections,
      lightingRejections: live.lightingRejections,
      successfulRecognitions: live.successfulRecognitions,
      failedAttempts: live.failedAttempts,
      instantConfirmations: live.instantConfirmations ?? 0,
      qualityBypassFrames: live.qualityBypassFrames ?? 0,
    },
  };
}
