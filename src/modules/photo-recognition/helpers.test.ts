import { describe, expect, it } from 'vitest';
import type { Concert } from '../../types';
import { getPHashes } from './helpers';

const buildConcert = (phash?: unknown): Concert => ({
  id: 1,
  band: 'Test Band',
  venue: 'Test Venue',
  date: '2026-01-01T00:00:00-06:00',
  audioFile: '/audio/test.opus',
  photoHashes: phash === undefined ? undefined : { phash: phash as string[] },
});

describe('helpers', () => {
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
});
