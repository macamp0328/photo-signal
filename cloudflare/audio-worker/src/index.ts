interface Env {
  AUDIO: R2Bucket;
  ALLOWED_ORIGINS?: string;
  AUDIO_SHARED_SECRET?: string;
}

const AUDIO_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const MANIFEST_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=60';
const DEFAULT_CACHE_CONTROL = 'public, max-age=3600';
const ALLOWED_METHODS = 'GET,HEAD,OPTIONS';

const CONTENT_TYPES: Record<string, string> = {
  opus: 'audio/ogg; codecs=opus',
  ogg: 'audio/ogg; codecs=opus',
  json: 'application/json; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = normalizePath(url.pathname);

    const origin = request.headers.get('Origin');
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const cors = buildCorsHeaders(origin, allowedOrigins);

    if (request.method === 'OPTIONS') {
      return handleOptions(cors.headers, cors.allowed);
    }

    if (!cors.allowed) {
      return new Response('Forbidden', { status: 403, headers: cors.headers });
    }

    if (env.AUDIO_SHARED_SECRET && !origin) {
      const provided = request.headers.get('X-Audio-Secret');
      if (!provided || provided !== env.AUDIO_SHARED_SECRET) {
        return new Response('Unauthorized', { status: 401, headers: cors.headers });
      }
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: withCommonHeaders(cors.headers),
      });
    }

    if (!pathname.startsWith('prod/audio/')) {
      return new Response('Not Found', { status: 404, headers: withCommonHeaders(cors.headers) });
    }

    if (pathname.includes('..')) {
      return new Response('Bad Request', { status: 400, headers: withCommonHeaders(cors.headers) });
    }

    const extension = getExtension(pathname);
    const contentType = CONTENT_TYPES[extension] ?? 'application/octet-stream';
    const cacheControl = getCacheControl(extension);

    const head = await env.AUDIO.head(pathname);
    if (!head) {
      return new Response('Not Found', { status: 404, headers: withCommonHeaders(cors.headers) });
    }

    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && etagMatches(ifNoneMatch, head.httpEtag)) {
      const headers = applyMetadataHeaders(withCommonHeaders(cors.headers), head, {
        cacheControl,
        contentType,
      });
      return new Response(null, { status: 304, headers });
    }

    if (request.method === 'HEAD') {
      const headers = applyMetadataHeaders(withCommonHeaders(cors.headers), head, {
        cacheControl,
        contentType,
      });
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', head.size.toString());
      return new Response(null, { status: 200, headers });
    }

    const rangeHeader = request.headers.get('Range');
    const range = rangeHeader ? parseRange(rangeHeader, head.size) : null;

    if (rangeHeader && !range) {
      return new Response('Range Not Satisfiable', {
        status: 416,
        headers: withCommonHeaders(cors.headers),
      });
    }

    const object = await env.AUDIO.get(pathname, range ? { range } : undefined);
    if (!object || !object.body) {
      return new Response('Not Found', { status: 404, headers: withCommonHeaders(cors.headers) });
    }

    const headers = applyMetadataHeaders(withCommonHeaders(cors.headers), head, {
      cacheControl,
      contentType,
    });

    headers.set('Accept-Ranges', 'bytes');
    headers.set('ETag', head.httpEtag);

    if (object.range) {
      const { offset, length } = object.range;
      const end = offset + length - 1;
      headers.set('Content-Range', `bytes ${offset}-${end}/${head.size}`);
      headers.set('Content-Length', length.toString());
      return new Response(object.body, { status: 206, headers });
    }

    headers.set('Content-Length', object.size.toString());
    return new Response(object.body, { status: 200, headers });
  },
};

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildCorsHeaders(origin: string | null, allowedOrigins: string[]) {
  const headers = new Headers();
  headers.set('Vary', 'Origin');

  if (!origin) {
    return { allowed: true, headers };
  }

  const allowed = allowedOrigins.includes(origin);
  if (allowed) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    headers.set('Access-Control-Allow-Headers', 'Range,If-None-Match,Accept,Origin');
    headers.set('Access-Control-Expose-Headers', 'ETag,Accept-Ranges,Content-Length,Content-Type');
    headers.set('Access-Control-Max-Age', '86400');
  }

  return { allowed, headers };
}

function handleOptions(headers: Headers, originAllowed: boolean): Response {
  if (!originAllowed) {
    return new Response('Forbidden', { status: 403, headers });
  }

  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', 'Range,If-None-Match,Accept,Origin');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(null, { status: 204, headers });
}

function withCommonHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  next.set('Content-Security-Policy', "default-src 'none'");
  next.set('Referrer-Policy', 'same-origin');
  return next;
}

function getExtension(pathname: string): string {
  const last = pathname.split('.').pop();
  return last ? last.toLowerCase() : '';
}

function getCacheControl(extension: string): string {
  if (extension === 'opus' || extension === 'ogg') return AUDIO_CACHE_CONTROL;
  if (extension === 'json' || extension === 'md' || extension === 'markdown') {
    return MANIFEST_CACHE_CONTROL;
  }
  return DEFAULT_CACHE_CONTROL;
}

function normalizePath(pathname: string): string {
  return pathname.replace(/^\/+/, '');
}

function parseRange(rangeHeader: string, size: number) {
  const match = /^bytes=(\d+)-(\d+)?$/.exec(rangeHeader);
  if (!match) return null;

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
    return null;
  }

  return { offset: start, length: end - start + 1 } as R2Range;
}

function etagMatches(ifNoneMatch: string, etag: string | null): boolean {
  if (!etag) return false;
  const tokens = ifNoneMatch.split(',').map((value) => value.trim());
  if (tokens.includes('*')) return true;
  return tokens.some((token) => token === etag || token === `"${etag}"`);
}

function applyMetadataHeaders(
  headers: Headers,
  object: R2Object,
  options: { cacheControl: string; contentType: string }
): Headers {
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', options.cacheControl);
  headers.set('Content-Type', options.contentType);
  headers.set('Vary', 'Origin');
  return headers;
}
