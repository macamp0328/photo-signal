/** Telemetry utility helpers used by the app runtime. */

import type {
  RecognitionTelemetry,
  TemporalTelemetrySnapshot,
} from '../modules/photo-recognition/types';

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
