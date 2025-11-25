import { describe, it, expect } from 'vitest';
import {
  formatConcertTimestamp,
  getTimestampSearchText,
  hasTimeComponent,
  getDateFromConcertTimestamp,
} from './dateUtils';

describe('dateUtils', () => {
  describe('formatConcertTimestamp', () => {
    it('formats timestamps with time and timezone', () => {
      const formatted = formatConcertTimestamp('2023-08-15T21:30:00-05:00');
      expect(formatted).toBe('August 15, 2023 at 9:30 PM CDT');
    });

    it('omits time when includeTime is false', () => {
      const formatted = formatConcertTimestamp('2023-08-15T21:30:00-05:00', {
        includeTime: false,
      });
      expect(formatted).toBe('August 15, 2023');
    });

    it('uses fallback when timestamp is invalid', () => {
      const formatted = formatConcertTimestamp('invalid-date', { fallback: 'Unknown' });
      expect(formatted).toBe('Unknown');
    });
  });

  describe('getTimestampSearchText', () => {
    it('returns lower-case formatted text suitable for search', () => {
      const searchText = getTimestampSearchText('2023-01-10T08:15:00-06:00');
      expect(searchText).toBe('january 10, 2023 at 8:15 am');
    });

    it('returns empty string for invalid timestamps', () => {
      const searchText = getTimestampSearchText('');
      expect(searchText).toBe('');
    });
  });

  describe('hasTimeComponent', () => {
    it('detects timestamps with time data', () => {
      expect(hasTimeComponent('2024-03-01T12:00:00-06:00')).toBe(true);
    });
  });

  describe('getDateFromConcertTimestamp', () => {
    it('returns a Date object for valid timestamps', () => {
      const date = getDateFromConcertTimestamp('2023-08-15T21:30:00-05:00');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getUTCFullYear()).toBe(2023);
    });

    it('returns null for invalid values', () => {
      expect(getDateFromConcertTimestamp('')).toBeNull();
    });
  });
});
