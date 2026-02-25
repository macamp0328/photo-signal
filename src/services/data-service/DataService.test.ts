import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dataService } from './DataService';
import type { AppDataV2, Concert } from '../../types';

const v2Payload: AppDataV2 = {
  version: 2,
  artists: [
    { id: 'artist-1', name: 'The Midnight Echoes' },
    { id: 'artist-2', name: 'Electric Dreams' },
  ],
  photos: [
    {
      id: 'photo-1',
      artistId: 'artist-1',
      imageFile: '/images/photo-1.jpg',
      recognitionEnabled: true,
      photoHashes: { phash: ['0123456789abcdef'] },
    },
  ],
  tracks: [
    {
      id: 'track-1',
      artistId: 'artist-1',
      songTitle: 'Night Lines',
      audioFile: '/audio/night-lines.opus',
    },
    {
      id: 'track-2',
      artistId: 'artist-2',
      songTitle: 'Neon Hearts',
      audioFile: '/audio/neon-hearts.opus',
    },
  ],
  entries: [
    {
      id: 1,
      artistId: 'artist-1',
      trackId: 'track-1',
      photoId: 'photo-1',
      venue: 'The Fillmore',
      date: '2023-08-15T20:00:00-05:00',
    },
    {
      id: 2,
      artistId: 'artist-2',
      trackId: 'track-2',
      venue: 'Red Rocks Amphitheatre',
      date: '2023-09-22T20:00:00-05:00',
    },
  ],
};

const normalizedConcerts: Concert[] = [
  {
    id: 1,
    band: 'The Midnight Echoes',
    songTitle: 'Night Lines',
    venue: 'The Fillmore',
    date: '2023-08-15T20:00:00-05:00',
    audioFile: '/audio/night-lines.opus',
    imageFile: '/images/photo-1.jpg',
    recognitionEnabled: true,
    photoHashes: { phash: ['0123456789abcdef'] },
    photoUrl: undefined,
    camera: undefined,
    aperture: undefined,
    focalLength: undefined,
    shutterSpeed: undefined,
    iso: undefined,
    albumCoverUrl: undefined,
  },
  {
    id: 2,
    band: 'Electric Dreams',
    songTitle: 'Neon Hearts',
    venue: 'Red Rocks Amphitheatre',
    date: '2023-09-22T20:00:00-05:00',
    audioFile: '/audio/neon-hearts.opus',
    imageFile: undefined,
    photoUrl: undefined,
    recognitionEnabled: undefined,
    camera: undefined,
    aperture: undefined,
    focalLength: undefined,
    shutterSpeed: undefined,
    iso: undefined,
    photoHashes: undefined,
    albumCoverUrl: undefined,
  },
];

describe('DataService', () => {
  let originalFetch: typeof globalThis.fetch;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    dataService.clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    dataService.clearCache();
  });

  describe('getConcerts()', () => {
    it('loads and normalizes v2 data from data.app.v2.json', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => v2Payload,
      });
      globalThis.fetch = mockFetch;

      const concerts = await dataService.getConcerts();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/data.app.v2.json');
      expect(concerts).toEqual(normalizedConcerts);
      expect(dataService.getDataSourceTelemetry()).toEqual({
        v2LoadAttempts: 1,
        v2LoadFailures: 0,
      });
    });

    it('returns cached results for subsequent calls', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => v2Payload,
      });
      globalThis.fetch = mockFetch;

      const first = await dataService.getConcerts();
      const second = await dataService.getConcerts();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
      expect(first).toEqual(normalizedConcerts);
    });

    it('throws on fetch failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      globalThis.fetch = mockFetch;

      await expect(dataService.getConcerts()).rejects.toThrow('Network error');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/data.app.v2.json');
      expect(dataService.getDataSourceTelemetry()).toEqual({
        v2LoadAttempts: 1,
        v2LoadFailures: 1,
      });

      consoleErrorSpy.mockRestore();
    });

    it('throws for non-v2 payloads', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ concerts: normalizedConcerts }),
      });
      globalThis.fetch = mockFetch;

      await expect(dataService.getConcerts()).rejects.toThrow(
        'Invalid app data payload: expected /data.app.v2.json schema'
      );
    });

    it('deduplicates concurrent in-flight requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => v2Payload,
      });
      globalThis.fetch = mockFetch;

      const [a, b, c] = await Promise.all([
        dataService.getConcerts(),
        dataService.getConcerts(),
        dataService.getConcerts(),
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(a).toEqual(normalizedConcerts);
      expect(b).toEqual(normalizedConcerts);
      expect(c).toEqual(normalizedConcerts);
    });
  });

  describe('lookup APIs', () => {
    beforeEach(async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => v2Payload,
      });
      globalThis.fetch = mockFetch;
      await dataService.getConcerts();
    });

    it('getConcertsByBand returns exact match results', () => {
      expect(dataService.getConcertsByBand('The Midnight Echoes')).toEqual([normalizedConcerts[0]]);
      expect(dataService.getConcertsByBand('Unknown')).toEqual([]);
    });

    it('getConcertById returns concert or null', () => {
      expect(dataService.getConcertById(1)).toEqual(normalizedConcerts[0]);
      expect(dataService.getConcertById(999)).toBeNull();
    });

    it('lookup APIs return empty/null after clearCache', () => {
      dataService.clearCache();
      expect(dataService.getConcertsByBand('The Midnight Echoes')).toEqual([]);
      expect(dataService.getConcertById(1)).toBeNull();
      expect(dataService.getDataSourceTelemetry()).toEqual({
        v2LoadAttempts: 0,
        v2LoadFailures: 0,
      });
    });
  });
});
