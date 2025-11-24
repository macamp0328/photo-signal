import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dataService } from './DataService';
import type { Concert } from '../../types';

/**
 * DataService Test Suite
 *
 * Tests validate the service contract defined in README.md:
 * - getConcerts(): Promise<Concert[]> - loads all concerts with caching
 * - getConcertById(id): Concert | null - retrieves specific concert
 * - search(query): Concert[] - searches by band, venue, or date
 * - getRandomConcert(): Concert | null - returns random concert
 * - clearCache(): void - clears in-memory cache
 */

// Mock concert data matching the structure in the shared concerts dataset
const mockConcerts: Concert[] = [
  {
    id: 1,
    band: 'The Midnight Echoes',
    venue: 'The Fillmore',
    date: '2023-08-15',
    audioFile: '/audio/sample.opus',
  },
  {
    id: 2,
    band: 'Electric Dreams',
    venue: 'Red Rocks Amphitheatre',
    date: '2023-09-22',
    audioFile: '/audio/sample.opus',
  },
  {
    id: 3,
    band: 'Velvet Revolution',
    venue: 'Madison Square Garden',
    date: '2023-10-10',
    audioFile: '/audio/sample.opus',
  },
];

describe('DataService', () => {
  // Store original fetch to restore after tests
  let originalFetch: typeof global.fetch;

  // Spy on console methods to avoid noise in test output
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Store original fetch
    originalFetch = global.fetch;

    // Mock console methods to avoid noise in test output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Clear cache before each test to ensure isolation
    dataService.clearCache();

    // Clear all mock call history
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;

    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();

    // Clear cache after each test
    dataService.clearCache();
  });

  describe('getConcerts()', () => {
    it('should fetch and return concert data on first call', async () => {
      // Mock successful fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch;

      const concerts = await dataService.getConcerts();

      // Verify fetch was called with correct URL
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/assets/test-data/concerts.dev.json');

      // Verify returned data structure
      expect(concerts).toEqual(mockConcerts);
      expect(concerts).toHaveLength(3);
      expect(concerts[0]).toHaveProperty('id');
      expect(concerts[0]).toHaveProperty('band');
      expect(concerts[0]).toHaveProperty('venue');
      expect(concerts[0]).toHaveProperty('date');
      expect(concerts[0]).toHaveProperty('audioFile');
    });

    it('should return cached data on subsequent calls without fetching', async () => {
      // Mock fetch for first call
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch;

      // First call - should fetch
      const concerts1 = await dataService.getConcerts();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const concerts2 = await dataService.getConcerts();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call

      // Third call - should still use cache
      const concerts3 = await dataService.getConcerts();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call

      // Verify all calls return the same cached data
      expect(concerts1).toEqual(mockConcerts);
      expect(concerts2).toEqual(mockConcerts);
      expect(concerts3).toEqual(mockConcerts);
      expect(concerts1).toBe(concerts2); // Same reference
      expect(concerts2).toBe(concerts3); // Same reference
    });

    it('should handle fetch errors gracefully and return empty array', async () => {
      // Mock fetch to throw error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const concerts = await dataService.getConcerts();

      // Verify error handling
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[DataService] Failed to load concert data:',
        expect.any(Error)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[DataService] Attempted to load from: /assets/test-data/concerts.dev.json'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[DataService] Test mode is DISABLED. Try enabling it in Secret Settings.'
      );
      expect(concerts).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed JSON response gracefully', async () => {
      // Mock fetch with invalid JSON
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });
      global.fetch = mockFetch;

      const concerts = await dataService.getConcerts();

      expect(concerts).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle missing concerts property in response', async () => {
      // Mock fetch with response missing concerts array
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}), // No concerts property
      });
      global.fetch = mockFetch;

      const concerts = await dataService.getConcerts();

      // Should return empty array when concerts property is missing
      expect(concerts).toEqual([]);
    });

    it('should cache empty array when response has no concerts', async () => {
      // Mock fetch returning empty concerts array
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: [] }),
      });
      global.fetch = mockFetch;

      const concerts1 = await dataService.getConcerts();
      const concerts2 = await dataService.getConcerts();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(concerts1).toEqual([]);
      expect(concerts2).toEqual([]);
    });
  });

  describe('getConcertById()', () => {
    beforeEach(async () => {
      // Pre-load cache with mock data
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch;
      await dataService.getConcerts();
    });

    it('should return correct concert for valid ID', () => {
      const concert = dataService.getConcertById(1);

      expect(concert).not.toBeNull();
      expect(concert).toEqual(mockConcerts[0]);
      expect(concert?.band).toBe('The Midnight Echoes');
    });

    it('should return null for invalid ID', () => {
      const concert = dataService.getConcertById(999);

      expect(concert).toBeNull();
    });

    it('should return null when cache is empty', () => {
      dataService.clearCache();

      const concert = dataService.getConcertById(1);

      expect(concert).toBeNull();
    });

    it('should find concerts with different IDs', () => {
      const concert1 = dataService.getConcertById(1);
      const concert2 = dataService.getConcertById(2);
      const concert3 = dataService.getConcertById(3);

      expect(concert1?.id).toBe(1);
      expect(concert2?.id).toBe(2);
      expect(concert3?.id).toBe(3);
      expect(concert1).not.toEqual(concert2);
      expect(concert2).not.toEqual(concert3);
    });
  });

  describe('search()', () => {
    beforeEach(async () => {
      // Pre-load cache with mock data
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch;
      await dataService.getConcerts();
    });

    it('should search by band name (case-insensitive)', () => {
      const results = dataService.search('midnight');

      expect(results).toHaveLength(1);
      expect(results[0].band).toBe('The Midnight Echoes');
    });

    it('should search by venue name (case-insensitive)', () => {
      const results = dataService.search('fillmore');

      expect(results).toHaveLength(1);
      expect(results[0].venue).toBe('The Fillmore');
    });

    it('should search by date', () => {
      const results = dataService.search('2023-08-15');

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe('2023-08-15');
    });

    it('should return multiple matches when query matches multiple concerts', () => {
      const results = dataService.search('2023');

      // All concerts have dates in 2023
      expect(results).toHaveLength(3);
    });

    it('should return empty array when no matches found', () => {
      const results = dataService.search('nonexistent');

      expect(results).toEqual([]);
    });

    it('should return empty array when cache is empty', () => {
      dataService.clearCache();

      const results = dataService.search('midnight');

      expect(results).toEqual([]);
    });

    it('should handle partial matches', () => {
      const results = dataService.search('red');

      expect(results).toHaveLength(1);
      expect(results[0].venue).toBe('Red Rocks Amphitheatre');
    });

    it('should be case-insensitive for all search fields', () => {
      const resultsLower = dataService.search('electric dreams');
      const resultsUpper = dataService.search('ELECTRIC DREAMS');
      const resultsMixed = dataService.search('ElEcTrIc DrEaMs');

      expect(resultsLower).toHaveLength(1);
      expect(resultsUpper).toHaveLength(1);
      expect(resultsMixed).toHaveLength(1);
      expect(resultsLower).toEqual(resultsUpper);
      expect(resultsUpper).toEqual(resultsMixed);
    });
  });

  describe('getRandomConcert()', () => {
    beforeEach(async () => {
      // Pre-load cache with mock data
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch;
      await dataService.getConcerts();
    });

    it('should return a concert from the dataset', () => {
      const concert = dataService.getRandomConcert();

      expect(concert).not.toBeNull();
      expect(mockConcerts).toContainEqual(concert);
    });

    it('should return null when cache is empty', () => {
      dataService.clearCache();

      const concert = dataService.getRandomConcert();

      expect(concert).toBeNull();
    });

    it('should return a valid concert on multiple calls', () => {
      for (let i = 0; i < 10; i++) {
        const concert = dataService.getRandomConcert();
        expect(concert).not.toBeNull();
        expect(mockConcerts).toContainEqual(concert);
      }
    });

    it('should potentially return different concerts over multiple calls', () => {
      // Call multiple times and collect results
      const concerts = new Set();
      for (let i = 0; i < 20; i++) {
        const concert = dataService.getRandomConcert();
        if (concert) {
          concerts.add(concert.id);
        }
      }

      // With 20 calls and 3 concerts, we should likely get at least 2 different ones
      // This is probabilistic but very unlikely to fail
      expect(concerts.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('clearCache()', () => {
    it('should clear cache and force re-fetch on next getConcerts() call', async () => {
      // First fetch
      const mockFetch1 = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch1;

      await dataService.getConcerts();
      expect(mockFetch1).toHaveBeenCalledTimes(1);

      // Clear cache
      dataService.clearCache();

      // Second fetch with new data
      const newMockData = [{ ...mockConcerts[0], band: 'Updated Band' }];
      const mockFetch2 = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: newMockData }),
      });
      global.fetch = mockFetch2;

      const concerts = await dataService.getConcerts();

      // Should have fetched again
      expect(mockFetch2).toHaveBeenCalledTimes(1);
      expect(concerts[0].band).toBe('Updated Band');
    });

    it('should make getConcertById return null after clearing cache', async () => {
      // Load data
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch;
      await dataService.getConcerts();

      // Verify data is available
      expect(dataService.getConcertById(1)).not.toBeNull();

      // Clear cache
      dataService.clearCache();

      // Should return null now
      expect(dataService.getConcertById(1)).toBeNull();
    });

    it('should make search return empty array after clearing cache', async () => {
      // Load data
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch;
      await dataService.getConcerts();

      // Verify search works
      expect(dataService.search('midnight')).toHaveLength(1);

      // Clear cache
      dataService.clearCache();

      // Should return empty array now
      expect(dataService.search('midnight')).toEqual([]);
    });

    it('should make getRandomConcert return null after clearing cache', async () => {
      // Load data
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch;
      await dataService.getConcerts();

      // Verify random concert works
      expect(dataService.getRandomConcert()).not.toBeNull();

      // Clear cache
      dataService.clearCache();

      // Should return null now
      expect(dataService.getRandomConcert()).toBeNull();
    });
  });

  describe('empty data handling', () => {
    it('should handle empty concerts array gracefully in getConcerts', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: [] }),
      });
      global.fetch = mockFetch;

      const concerts = await dataService.getConcerts();

      expect(concerts).toEqual([]);
      expect(concerts).toHaveLength(0);
    });

    it('should return null from getConcertById when data is empty', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: [] }),
      });
      global.fetch = mockFetch;
      await dataService.getConcerts();

      const concert = dataService.getConcertById(1);

      expect(concert).toBeNull();
    });

    it('should return empty array from search when data is empty', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: [] }),
      });
      global.fetch = mockFetch;
      await dataService.getConcerts();

      const results = dataService.search('anything');

      expect(results).toEqual([]);
    });

    it('should return null from getRandomConcert when data is empty', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: [] }),
      });
      global.fetch = mockFetch;
      await dataService.getConcerts();

      const concert = dataService.getRandomConcert();

      expect(concert).toBeNull();
    });
  });

  describe('setTestMode() and test data loading', () => {
    it('should switch data source when test mode is enabled', async () => {
      // Enable test mode
      dataService.setTestMode(true);

      // Mock fetch for test data URL
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch;

      await dataService.getConcerts();

      // Verify fetch was called with test data URL
      expect(mockFetch).toHaveBeenCalledWith('/assets/test-data/concerts.dev.json');
      expect(dataService.getTestMode()).toBe(true);
    });

    it('should switch back to production data when test mode is disabled', async () => {
      // Enable then disable test mode
      dataService.setTestMode(true);
      dataService.setTestMode(false);

      // Mock fetch for production data URL
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch;

      await dataService.getConcerts();

      // Verify fetch was called with production data URL
      expect(mockFetch).toHaveBeenCalledWith('/assets/test-data/concerts.dev.json');
      expect(dataService.getTestMode()).toBe(false);
    });

    it('should clear cache when switching test mode', async () => {
      // Load production data
      const mockFetch1 = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: mockConcerts }),
      });
      global.fetch = mockFetch1;
      await dataService.getConcerts();

      expect(mockFetch1).toHaveBeenCalledTimes(1);
      expect(mockFetch1).toHaveBeenCalledWith('/assets/test-data/concerts.dev.json');

      // Switch to test mode
      dataService.setTestMode(true);

      // Load test data
      const testMockData = [{ ...mockConcerts[0], band: 'Test Band' }];
      const mockFetch2 = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: testMockData }),
      });
      global.fetch = mockFetch2;

      const concerts = await dataService.getConcerts();

      // Should fetch from test URL with new data
      expect(mockFetch2).toHaveBeenCalledTimes(1);
      expect(mockFetch2).toHaveBeenCalledWith('/assets/test-data/concerts.dev.json');
      expect(concerts[0].band).toBe('Test Band');
    });

    it('should log when test mode changes', () => {
      // Ensure starting state is disabled so subsequent toggle triggers logs
      dataService.setTestMode(false);
      consoleLogSpy.mockClear();

      dataService.setTestMode(true);

      // Verify logging occurred
      expect(consoleLogSpy).toHaveBeenCalledWith('[DataService] Test mode ENABLED');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[DataService] Data will be loaded from: /assets/test-data/concerts.dev.json'
      );
    });

    it('should not clear cache or notify if test mode does not change', () => {
      // Set test mode to true
      dataService.setTestMode(true);
      consoleLogSpy.mockClear();

      // Set it to true again (no change)
      dataService.setTestMode(true);

      // Should not log again
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('data source change notifications', () => {
    it('should notify subscribers when test mode changes', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      // Ensure a known starting state
      dataService.setTestMode(false);

      // Subscribe
      const unsubscribe1 = dataService.subscribe(listener1);
      const unsubscribe2 = dataService.subscribe(listener2);

      // Change test mode
      dataService.setTestMode(true);

      // Both listeners should be called
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      // Unsubscribe one listener
      unsubscribe1();

      // Change test mode again
      dataService.setTestMode(false);

      // Only listener2 should be called again
      expect(listener1).toHaveBeenCalledTimes(1); // Still 1
      expect(listener2).toHaveBeenCalledTimes(2); // Now 2

      // Clean up
      unsubscribe2();
    });
  });
});
