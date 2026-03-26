import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getRecognitionIndexEntries,
  clearRecognitionIndexCache,
} from './recognition-index-service';

const validPayload = {
  version: 2,
  entries: [{ concertId: 7, phash: ['abc', 'def'] }],
};

function okResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

describe('recognition-index-service', () => {
  let originalFetch: typeof globalThis.fetch;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clearRecognitionIndexCache();
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    clearRecognitionIndexCache();
    localStorage.clear();
  });

  describe('fetch() network rejection (#464)', () => {
    it('rejects when fetch() throws a network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('network'));
      globalThis.fetch = mockFetch;

      await expect(getRecognitionIndexEntries()).rejects.toThrow('network');
    });

    it('issues a fresh fetch on retry after network rejection', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce(okResponse(validPayload));
      globalThis.fetch = mockFetch;

      await expect(getRecognitionIndexEntries()).rejects.toThrow('network');
      const entries = await getRecognitionIndexEntries();
      expect(entries).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('DEV fake camera: single-clip config (#465)', () => {
    it('prepends seeded hash for single-clip { concertId, hash } config', async () => {
      localStorage.setItem('__dev_fakeCamera', JSON.stringify({ concertId: 7, hash: 'seeded' }));
      const mockFetch = vi.fn().mockResolvedValue(okResponse(validPayload));
      globalThis.fetch = mockFetch;

      const entries = await getRecognitionIndexEntries();
      const entry = entries.find((e) => e.concertId === 7);
      expect(entry?.phash[0]).toBe('seeded');
    });
  });
});
