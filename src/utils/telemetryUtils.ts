/**
 * Guidance Telemetry Utilities
 *
 * Helper functions for tracking and exporting guidance effectiveness metrics.
 */

import type { RecognitionTelemetry, GuidanceType } from '../modules/photo-recognition/types';

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
  const switchDecision = telemetry.switchDecision ?? {
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
  };
  const latencyValues = switchDecision.decisionLatenciesMs;
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
    switchDecisionMetrics: {
      shownCount: switchDecision.shownCount,
      confirmCount: switchDecision.confirmCount,
      dismissCount: switchDecision.dismissCount,
      confirmRate:
        switchDecision.shownCount > 0
          ? (switchDecision.confirmCount / switchDecision.shownCount) * 100
          : 0,
      dismissRate:
        switchDecision.shownCount > 0
          ? (switchDecision.dismissCount / switchDecision.shownCount) * 100
          : 0,
      decisionLatencyMs: {
        average: switchDecision.averageDecisionLatencyMs,
        last: switchDecision.lastDecisionLatencyMs,
        min: latencyValues.length > 0 ? Math.min(...latencyValues) : null,
        max: latencyValues.length > 0 ? Math.max(...latencyValues) : null,
        samples: latencyValues,
      },
      lastPromptSnapshot: switchDecision.lastPromptSnapshot,
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
