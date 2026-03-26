import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRecognitionIndexCache,
  getRecognitionIndexEntries,
  preloadRecognitionIndex,
} from './recognition-index-service';

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function makeResponse(payload: unknown, ok = true, status = 200): MockResponse {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('recognition-index-service', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    clearRecognitionIndexCache();
    localStorage.removeItem('__dev_fakeCamera');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearRecognitionIndexCache();
    localStorage.removeItem('__dev_fakeCamera');
    vi.restoreAllMocks();
  });

  it('loads entries and caches them for subsequent calls', async () => {
    const payload = { version: 2 as const, entries: [{ concertId: 1, phash: ['a'] }] };
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(payload));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const first = await getRecognitionIndexEntries();
    const second = await getRecognitionIndexEntries();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(payload.entries);
    expect(second).toBe(first);
  });

  it('deduplicates concurrent in-flight requests', async () => {
    const pending = deferred<MockResponse>();
    const fetchMock = vi.fn().mockImplementation(() => pending.promise);
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const p1 = getRecognitionIndexEntries();
    const p2 = getRecognitionIndexEntries();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    pending.resolve(makeResponse({ version: 2, entries: [{ concertId: 2, phash: ['b'] }] }));

    await expect(p1).resolves.toEqual([{ concertId: 2, phash: ['b'] }]);
    await expect(p2).resolves.toEqual([{ concertId: 2, phash: ['b'] }]);
  });

  it('throws when fetch is unavailable', async () => {
    globalThis.fetch = undefined as unknown as typeof globalThis.fetch;

    await expect(getRecognitionIndexEntries()).rejects.toThrow(
      'Fetch API is unavailable while loading recognition index'
    );
  });

  it('throws when response status is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(null, false, 503));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(getRecognitionIndexEntries()).rejects.toThrow(
      'Failed to load /data.recognition.v2.json: HTTP 503'
    );
  });

  it('throws on invalid payload schema', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ entries: [] }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(getRecognitionIndexEntries()).rejects.toThrow(
      'Invalid recognition index payload: expected /data.recognition.v2.json'
    );
  });

  it('rejects when fetch() throws a network error (#464)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(getRecognitionIndexEntries()).rejects.toThrow('network');
  });

  it('issues a fresh fetch on retry after network rejection (#464)', async () => {
    const payload = { version: 2 as const, entries: [{ concertId: 7, phash: ['abc'] }] };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(makeResponse(payload));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(getRecognitionIndexEntries()).rejects.toThrow('network');
    const entries = await getRecognitionIndexEntries();
    expect(entries).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('prepends seeded hash and logs info when DEV fake camera clips are configured', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    localStorage.setItem(
      '__dev_fakeCamera',
      JSON.stringify({
        clips: [
          { concertId: 7, hash: 'seeded' },
          { concertId: 999, hash: 'missing-entry' },
        ],
      })
    );

    const payload = {
      version: 2 as const,
      entries: [{ concertId: 7, phash: ['old-a', 'seeded', 'old-b'] }],
    };
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(payload));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const entries = await getRecognitionIndexEntries();

    // Tests always run with import.meta.env.DEV === true, so the seeding branch is always active.
    expect(entries[0].phash).toEqual(['seeded', 'old-a', 'old-b']);
    expect(infoSpy).toHaveBeenCalledWith(
      '[dev] recognition hash seeded for concertId=7 from localStorage.__dev_fakeCamera'
    );
  });

  it('prepends seeded hash for single-clip { concertId, hash } config (#465)', async () => {
    localStorage.setItem('__dev_fakeCamera', JSON.stringify({ concertId: 7, hash: 'seeded' }));

    const payload = {
      version: 2 as const,
      entries: [{ concertId: 7, phash: ['old-a', 'old-b'] }],
    };
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(payload));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const entries = await getRecognitionIndexEntries();
    expect(entries[0].phash[0]).toBe('seeded');
  });

  it('ignores malformed DEV fake camera config without failing load', async () => {
    localStorage.setItem('__dev_fakeCamera', '{not-valid-json');

    const payload = { version: 2 as const, entries: [{ concertId: 1, phash: ['a'] }] };
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(payload));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(getRecognitionIndexEntries()).resolves.toEqual(payload.entries);
  });

  it('preloadRecognitionIndex logs warning when preload fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('network-down')) as unknown as typeof fetch;

    preloadRecognitionIndex();
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('[recognition-index] Preload skipped:', 'network-down');
    });
  });

  it('preloadRecognitionIndex normalizes non-Error rejections', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockRejectedValue('boom') as unknown as typeof fetch;

    preloadRecognitionIndex();
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        '[recognition-index] Preload skipped:',
        'Failed to preload recognition index'
      );
    });
  });

  it('does not let stale in-flight result overwrite cache after clear', async () => {
    const first = deferred<MockResponse>();

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(
        makeResponse({ version: 2, entries: [{ concertId: 20, phash: ['new'] }] })
      );

    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const stalePromise = getRecognitionIndexEntries();
    clearRecognitionIndexCache();

    const fresh = await getRecognitionIndexEntries();
    expect(fresh).toEqual([{ concertId: 20, phash: ['new'] }]);

    first.resolve(makeResponse({ version: 2, entries: [{ concertId: 10, phash: ['old'] }] }));
    await expect(stalePromise).resolves.toEqual([{ concertId: 10, phash: ['old'] }]);

    const cached = await getRecognitionIndexEntries();
    expect(cached).toEqual([{ concertId: 20, phash: ['new'] }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
