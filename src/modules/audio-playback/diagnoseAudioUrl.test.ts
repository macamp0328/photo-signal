import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { diagnoseAudioUrl } from './diagnoseAudioUrl';

describe('diagnoseAudioUrl', () => {
  const testUrl = 'https://audio.example.com/song.opus';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return success result for 200 response', async () => {
    const headers = new Headers({
      'access-control-allow-origin': '*',
      'content-type': 'audio/ogg; codecs=opus',
      'content-length': '123456',
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers,
    } as Response);

    const result = await diagnoseAudioUrl(testUrl);

    expect(result.httpStatus).toBe(200);
    expect(result.corsOrigin).toBe('*');
    expect(result.contentType).toBe('audio/ogg; codecs=opus');
    expect(result.contentLength).toBe(123456);
    expect(result.likelyCorsIssue).toBe(false);
    expect(result.message).toContain('OK');
  });

  it('should detect likely CORS issue on 403 without CORS header', async () => {
    const headers = new Headers({});

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers,
    } as Response);

    const result = await diagnoseAudioUrl(testUrl);

    expect(result.httpStatus).toBe(403);
    expect(result.corsOrigin).toBeNull();
    expect(result.likelyCorsIssue).toBe(true);
    expect(result.message).toContain('Forbidden');
    expect(result.message).toContain('No CORS origin header');
  });

  it('should return 404 result', async () => {
    const headers = new Headers({
      'access-control-allow-origin': '*',
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers,
    } as Response);

    const result = await diagnoseAudioUrl(testUrl);

    expect(result.httpStatus).toBe(404);
    expect(result.likelyCorsIssue).toBe(false);
    expect(result.message).toContain('Not Found');
  });

  it('should handle network error (CORS block)', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await diagnoseAudioUrl(testUrl);

    expect(result.httpStatus).toBeNull();
    expect(result.corsOrigin).toBeNull();
    expect(result.likelyCorsIssue).toBe(true);
    expect(result.message).toContain('Network request failed');
  });

  it('should not flag CORS issue for non-403 errors with CORS header', async () => {
    const headers = new Headers({
      'access-control-allow-origin': 'https://example.com',
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers,
    } as Response);

    const result = await diagnoseAudioUrl(testUrl);

    expect(result.httpStatus).toBe(500);
    expect(result.likelyCorsIssue).toBe(false);
    expect(result.corsOrigin).toBe('https://example.com');
  });

  it('should handle missing content-length gracefully', async () => {
    const headers = new Headers({
      'access-control-allow-origin': '*',
      'content-type': 'audio/opus',
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers,
    } as Response);

    const result = await diagnoseAudioUrl(testUrl);

    expect(result.contentLength).toBeNull();
    expect(result.contentType).toBe('audio/opus');
  });
});
