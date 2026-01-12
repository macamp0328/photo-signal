// @vitest-environment node
import worker, { type Env } from './worker';
import { describe, expect, it, vi } from 'vitest';

type HeadResult = { size: number; etag?: string; httpEtag?: string };
type GetOptions = { range?: { offset: number; length: number } };
type GetResult =
  | null
  | (HeadResult & {
      body: ReadableStream;
    });

function createBody(content: string) {
  const body = new Response(content).body;
  if (!body) {
    throw new Error('Failed to create body stream');
  }
  return body;
}

function createEnv(
  overrides: {
    headResult?: HeadResult;
    getResult?: GetResult | ((key: string, options?: GetOptions) => Promise<GetResult> | GetResult);
    allowedOrigins?: string;
    sharedSecret?: string;
  } = {}
) {
  const headResult = overrides.headResult ?? { size: 10, etag: 'abc' };

  const head = vi.fn().mockResolvedValue(headResult);
  const get = vi
    .fn()
    .mockImplementation(async (key: string, options?: GetOptions): Promise<GetResult> => {
      if (typeof overrides.getResult === 'function') {
        return overrides.getResult(key, options);
      }
      if (overrides.getResult !== undefined) {
        return overrides.getResult;
      }
      return { ...headResult, body: createBody('audio-data') };
    });

  const env: Env & { AUDIO: { head: typeof head; get: typeof get } } = {
    AUDIO: { head, get },
    ALLOWED_ORIGINS: overrides.allowedOrigins,
    SHARED_SECRET: overrides.sharedSecret,
  };

  return env;
}

function createRequest(path: string, init?: RequestInit) {
  return new Request(`https://example.com${path}`, init);
}

describe('Cloudflare worker', () => {
  it('serves audio with CORS headers for an allowed origin', async () => {
    const env = createEnv();
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', { headers: { Origin: 'http://localhost:5173' } }),
      env
    );

    expect(response.status).toBe(200);
    expect(env.AUDIO.head).toHaveBeenCalledWith('prod/audio/test.opus');
    expect(env.AUDIO.get).toHaveBeenCalledWith('prod/audio/test.opus', undefined);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Content-Type')).toBe('audio/ogg; codecs=opus');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(response.headers.get('ETag')).toBe('"abc"');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(await response.text()).toBe('audio-data');
  });

  it('allows wildcard origins that match the configured pattern', async () => {
    const env = createEnv({ allowedOrigins: 'https://photo-signal-*.vercel.app' });
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        headers: { Origin: 'https://photo-signal-demo.vercel.app' },
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://photo-signal-demo.vercel.app'
    );
  });

  it('does not match base domain against a mid-hostname wildcard', async () => {
    const env = createEnv({ allowedOrigins: 'https://photo-signal-*.vercel.app' });
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        headers: { Origin: 'https://photo-signal.vercel.app' },
      }),
      env
    );

    expect(response.status).toBe(403);
  });

  it('matches longer subdomain chains with a mid-hostname wildcard', async () => {
    const env = createEnv({ allowedOrigins: 'https://photo-signal-*.vercel.app' });
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        headers: { Origin: 'https://photo-signal-git-feat-branch.vercel.app' },
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://photo-signal-git-feat-branch.vercel.app'
    );
  });

  it('ignores invalid wildcard patterns with multiple asterisks', async () => {
    const env = createEnv({ allowedOrigins: 'https://*-*-*.vercel.app' });
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        headers: { Origin: 'https://photo-signal-demo.vercel.app' },
      }),
      env
    );

    expect(response.status).toBe(403);
  });

  it('ignores wildcard patterns without suffix content', async () => {
    const env = createEnv({ allowedOrigins: 'https://*' });
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        headers: { Origin: 'https://photo-signal-demo.vercel.app' },
      }),
      env
    );

    expect(response.status).toBe(403);
  });

  it('permits any origin when a valid shared secret is provided', async () => {
    const env = createEnv({
      allowedOrigins: 'https://example.com',
      sharedSecret: 'secret',
    });

    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        headers: { Origin: 'https://unlisted.example', 'X-PS-Shared-Secret': 'secret' },
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://unlisted.example');
  });

  it('returns 204 for OPTIONS when origin is allowed', async () => {
    const env = createEnv();
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173' },
      }),
      env
    );

    expect(response.status).toBe(204);
    expect(env.AUDIO.head).not.toHaveBeenCalled();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS');
  });

  it('rejects OPTIONS when origin is forbidden', async () => {
    const env = createEnv();
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.com' },
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(env.AUDIO.head).not.toHaveBeenCalled();
    expect(env.AUDIO.get).not.toHaveBeenCalled();
  });

  it('rejects unsupported methods', async () => {
    const env = createEnv();
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', { method: 'POST' }),
      env
    );

    expect(response.status).toBe(405);
    expect(env.AUDIO.head).not.toHaveBeenCalled();
  });

  it('blocks forbidden origins for GET/HEAD', async () => {
    const env = createEnv();
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', { headers: { Origin: 'https://evil.com' } }),
      env
    );

    expect(response.status).toBe(403);
    expect(env.AUDIO.head).not.toHaveBeenCalled();
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('returns 404 for invalid paths before hitting storage', async () => {
    const env = createEnv();
    const response = await worker.fetch(
      createRequest('/invalid/path', { headers: { Origin: 'http://localhost:5173' } }),
      env
    );

    expect(response.status).toBe(404);
    expect(env.AUDIO.head).not.toHaveBeenCalled();
    expect(env.AUDIO.get).not.toHaveBeenCalled();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('returns 404 when object is missing', async () => {
    const env = createEnv({ getResult: null, headResult: { size: 10, etag: 'abc' } });
    const response = await worker.fetch(
      createRequest('/prod/audio/missing.opus', { headers: { Origin: 'http://localhost:5173' } }),
      env
    );

    expect(response.status).toBe(404);
    expect(env.AUDIO.get).toHaveBeenCalled();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('returns 304 when ETag matches If-None-Match', async () => {
    const env = createEnv({ headResult: { size: 10, httpEtag: 'etag123' } });
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        headers: { Origin: 'http://localhost:5173', 'If-None-Match': '"etag123"' },
      }),
      env
    );

    expect(response.status).toBe(304);
    expect(env.AUDIO.get).not.toHaveBeenCalled();
    expect(response.headers.get('ETag')).toBe('"etag123"');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
  });

  it('supports valid range requests', async () => {
    const env = createEnv({
      headResult: { size: 10, etag: 'range-etag' },
      getResult: { size: 4, etag: 'range-etag', body: createBody('part') },
    });

    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        headers: { Origin: 'http://localhost:5173', Range: 'bytes=0-3' },
      }),
      env
    );

    expect(response.status).toBe(206);
    expect(env.AUDIO.get).toHaveBeenCalledWith('prod/audio/test.opus', {
      range: { offset: 0, length: 4 },
    });
    expect(response.headers.get('Content-Range')).toBe('bytes 0-3/10');
    expect(response.headers.get('Content-Length')).toBe('4');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(await response.text()).toBe('part');
  });

  it('rejects invalid range requests', async () => {
    const env = createEnv({ headResult: { size: 10, etag: 'range-etag' } });
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        headers: { Origin: 'http://localhost:5173', Range: 'bytes=20-30' },
      }),
      env
    );

    expect(response.status).toBe(416);
    expect(env.AUDIO.get).not.toHaveBeenCalled();
    expect(response.headers.get('Content-Range')).toBe('bytes */10');
  });

  it('handles HEAD requests without returning a body', async () => {
    const env = createEnv();
    const response = await worker.fetch(
      createRequest('/prod/audio/test.opus', {
        method: 'HEAD',
        headers: { Origin: 'http://localhost:5173' },
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(env.AUDIO.get).toHaveBeenCalled();
    expect(await response.text()).toBe('');
  });

  it('sets metadata content headers for non-audio objects', async () => {
    const env = createEnv({ headResult: { size: 123, etag: 'meta' } });
    const response = await worker.fetch(
      createRequest('/prod/audio/info.json', { headers: { Origin: 'http://localhost:5173' } }),
      env
    );

    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
  });
});
