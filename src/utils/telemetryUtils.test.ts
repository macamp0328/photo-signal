import { describe, it, expect } from 'vitest';
import { buildTemporalSnapshot } from './telemetryUtils';
import { createEmptyTelemetry } from '../modules/photo-recognition/helpers';
import type { RecognitionTelemetry } from '../modules/photo-recognition/types';

function makeTelemetry(overrides: Partial<RecognitionTelemetry>): RecognitionTelemetry {
  return { ...createEmptyTelemetry(), ...overrides };
}

describe('telemetryUtils', () => {
  describe('buildTemporalSnapshot', () => {
    it('maps all fields from telemetry', () => {
      const telemetry: RecognitionTelemetry = makeTelemetry({
        totalFrames: 83,
        qualityFrames: 60,
        blurRejections: 7,
        glareRejections: 14,
        lightingRejections: 2,
        successfulRecognitions: 4,
        failedAttempts: 2,
        instantConfirmations: 3,
        qualityBypassFrames: 2,
      });

      const snapshot = buildTemporalSnapshot(telemetry, 10);

      expect(snapshot.elapsedSeconds).toBe(10);
      expect(snapshot.cumulativeCounts.totalFrames).toBe(83);
      expect(snapshot.cumulativeCounts.qualityFrames).toBe(60);
      expect(snapshot.cumulativeCounts.blurRejections).toBe(7);
      expect(snapshot.cumulativeCounts.glareRejections).toBe(14);
      expect(snapshot.cumulativeCounts.lightingRejections).toBe(2);
      expect(snapshot.cumulativeCounts.successfulRecognitions).toBe(4);
      expect(snapshot.cumulativeCounts.failedAttempts).toBe(2);
      expect(snapshot.cumulativeCounts.instantConfirmations).toBe(3);
      expect(snapshot.cumulativeCounts.qualityBypassFrames).toBe(2);
    });

    it('defaults optional fields to 0 when absent', () => {
      const telemetry: RecognitionTelemetry = makeTelemetry({
        totalFrames: 50,
        qualityFrames: 40,
        blurRejections: 5,
        glareRejections: 3,
        lightingRejections: 2,
        successfulRecognitions: 2,
        failedAttempts: 1,
      });

      const snapshot = buildTemporalSnapshot(telemetry, 20);

      expect(snapshot.cumulativeCounts.instantConfirmations).toBe(0);
      expect(snapshot.cumulativeCounts.qualityBypassFrames).toBe(0);
    });
  });
});
