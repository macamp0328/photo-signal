import { describe, expect, it } from 'vitest';
import type { Concert, CropRegionKey } from '../../types';
import {
  createEmptyTelemetry,
  getCropHashes,
  getPHashes,
  recordCollisionDetails,
  VALID_CROP_REGION_KEYS,
} from './helpers';

const buildConcert = (phash?: unknown): Concert => ({
  id: 1,
  band: 'Test Band',
  venue: 'Test Venue',
  date: '2026-01-01T00:00:00-06:00',
  audioFile: '/audio/test.opus',
  photoHashes: phash === undefined ? undefined : { phash: phash as string[] },
});

const VALID_HASH = 'abcdef1234567890';
const VALID_HASHES_5 = [
  'abcdef1234567890',
  'bbcdef1234567890',
  'cbcdef1234567890',
  'dbcdef1234567890',
  'ebcdef1234567890',
];

const buildConcertWithCrops = (
  cropPhashes?: Partial<Record<CropRegionKey, string[]>>
): Concert => ({
  id: 2,
  band: 'Crop Test Band',
  venue: 'Test Venue',
  date: '2026-01-01T00:00:00-06:00',
  audioFile: '/audio/test.opus',
  photoHashes: { cropPhashes },
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
      expect(telemetry.index_mode_used).toBe(0);
      expect(telemetry.fallback_mode_used).toBe(0);
      expect(telemetry.candidate_count_per_frame).toEqual({
        last: 0,
        max: 0,
        total: 0,
        frames: 0,
      });
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

  describe('getCropHashes', () => {
    it('returns empty array when photoHashes is undefined', () => {
      const concert = buildConcert(undefined);
      expect(getCropHashes(concert)).toEqual([]);
    });

    it('returns empty array when cropPhashes is absent', () => {
      const concert = buildConcertWithCrops(undefined);
      expect(getCropHashes(concert)).toEqual([]);
    });

    it('returns empty array when cropPhashes is empty object', () => {
      const concert = buildConcertWithCrops({});
      expect(getCropHashes(concert)).toEqual([]);
    });

    it('returns validated hashes for a single crop region', () => {
      const concert = buildConcertWithCrops({ 'center-80': VALID_HASHES_5 });
      const result = getCropHashes(concert);
      expect(result).toHaveLength(5);
      result.forEach(({ hash, cropKey }) => {
        expect(hash).toMatch(/^[0-9a-f]{16}$/i);
        expect(cropKey).toBe('center-80');
      });
    });

    it('flattens all 7 crop regions into a single array', () => {
      const allRegions = Object.fromEntries(
        VALID_CROP_REGION_KEYS.map((key) => [key, [VALID_HASH]])
      ) as Partial<Record<CropRegionKey, string[]>>;
      const concert = buildConcertWithCrops(allRegions);
      const result = getCropHashes(concert);
      expect(result).toHaveLength(7);
      const keys = result.map(({ cropKey }) => cropKey);
      expect(keys).toEqual(VALID_CROP_REGION_KEYS);
    });

    it('filters out hashes with wrong length', () => {
      const concert = buildConcertWithCrops({
        'center-60': ['abc', 'abcdef1234567890', 'tooooooooolong1'],
      });
      const result = getCropHashes(concert);
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('abcdef1234567890');
    });

    it('filters out hashes with non-hex characters', () => {
      const concert = buildConcertWithCrops({
        'center-50': ['zzzzzzzzzzzzzzzz', 'abcdef1234567890'],
      });
      const result = getCropHashes(concert);
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('abcdef1234567890');
    });

    it('filters out non-string entries in crop hash arrays', () => {
      const concert = buildConcertWithCrops({
        'top-left-70': [null as unknown as string, 123 as unknown as string, 'abcdef1234567890'],
      });
      const result = getCropHashes(concert);
      expect(result).toHaveLength(1);
    });

    it('includes cropKey in each result entry', () => {
      const concert = buildConcertWithCrops({
        'top-right-70': [VALID_HASH],
        'bottom-left-70': [VALID_HASH],
      });
      const result = getCropHashes(concert);
      expect(result.map((r) => r.cropKey)).toEqual(['top-right-70', 'bottom-left-70']);
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
