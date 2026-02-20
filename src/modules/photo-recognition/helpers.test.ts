import { describe, expect, it } from 'vitest';
import type { Concert } from '../../types';
import { createEmptyTelemetry, getPHashes, recordCollisionDetails } from './helpers';

const buildConcert = (phash?: unknown): Concert => ({
  id: 1,
  band: 'Test Band',
  venue: 'Test Venue',
  date: '2026-01-01T00:00:00-06:00',
  audioFile: '/audio/test.opus',
  photoHashes: phash === undefined ? undefined : { phash: phash as string[] },
});

describe('helpers', () => {
  describe('createEmptyTelemetry', () => {
    it('initializes frameQualityStats with zero values', () => {
      const telemetry = createEmptyTelemetry();
      expect(telemetry.frameQualityStats.blur.sharpnessSum).toBe(0);
      expect(telemetry.frameQualityStats.blur.sampleCount).toBe(0);
      expect(telemetry.frameQualityStats.glare.glarePercentSum).toBe(0);
      expect(telemetry.frameQualityStats.glare.sampleCount).toBe(0);
      expect(telemetry.frameQualityStats.lighting.brightnessSum).toBe(0);
      expect(telemetry.frameQualityStats.lighting.sampleCount).toBe(0);
    });

    it('initializes hammingDistanceLog with zero values and empty nearMisses', () => {
      const telemetry = createEmptyTelemetry();
      expect(telemetry.hammingDistanceLog.nearMisses).toEqual([]);
      expect(telemetry.hammingDistanceLog.matchedFrameDistances.min).toBeNull();
      expect(telemetry.hammingDistanceLog.matchedFrameDistances.max).toBeNull();
      expect(telemetry.hammingDistanceLog.matchedFrameDistances.sum).toBe(0);
      expect(telemetry.hammingDistanceLog.matchedFrameDistances.count).toBe(0);
    });

    it('initializes collisionStats with empty counters and histogram bins', () => {
      const telemetry = createEmptyTelemetry();
      expect(telemetry.collisionStats.ambiguousCount).toBe(0);
      expect(telemetry.collisionStats.nearThresholdCount).toBe(0);
      expect(telemetry.collisionStats.ambiguousMarginHistogram).toEqual({
        '0-1': 0,
        '2': 0,
        '3-4': 0,
        '5+': 0,
        unknown: 0,
      });
      expect(telemetry.collisionStats.ambiguousPairCounts).toEqual({});
    });
  });

  describe('getPHashes', () => {
    it('returns valid 16-char hex pHashes', () => {
      const concert = buildConcert(['abcdef1234567890', 'ABCDEF1234567890']);

      expect(getPHashes(concert)).toEqual(['abcdef1234567890', 'ABCDEF1234567890']);
    });

    it('filters out malformed pHashes with non-hex characters', () => {
      const concert = buildConcert(['abcdef1234567890', 'abcdeg1234567890', '1234567890123456']);

      expect(getPHashes(concert)).toEqual(['abcdef1234567890', '1234567890123456']);
    });

    it('filters out values that are not 16 characters', () => {
      const concert = buildConcert(['abc', 'abcdef1234567890f']);

      expect(getPHashes(concert)).toEqual([]);
    });

    it('returns empty array for empty string entries', () => {
      const concert = buildConcert(['']);

      expect(getPHashes(concert)).toEqual([]);
    });

    it('returns empty array for non-string entries', () => {
      const concert = buildConcert([null, 123, {}, []]);

      expect(getPHashes(concert)).toEqual([]);
    });

    it('returns empty array when all entries are invalid hex', () => {
      const concert = buildConcert(['gggggggggggggggg']);

      expect(getPHashes(concert)).toEqual([]);
    });

    it('returns empty array for entries with special characters', () => {
      const concert = buildConcert(['@#$%^&*()123456']);

      expect(getPHashes(concert)).toEqual([]);
    });
  });

  describe('recordCollisionDetails', () => {
    it('normalizes pair keys so rival order aggregates to one entry', () => {
      const telemetry = createEmptyTelemetry();

      recordCollisionDetails(telemetry, {
        isAmbiguous: true,
        margin: 2,
        bestBand: 'Band A',
        secondBand: 'Band B',
      });

      recordCollisionDetails(telemetry, {
        isAmbiguous: true,
        margin: 2,
        bestBand: 'Band B',
        secondBand: 'Band A',
      });

      expect(telemetry.collisionStats.ambiguousPairCounts['Band A vs Band B']).toBe(2);
      expect(Object.keys(telemetry.collisionStats.ambiguousPairCounts)).toHaveLength(1);
    });
  });
});
