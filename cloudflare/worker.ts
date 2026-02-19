type R2ObjectHead = {
  size: number;
  etag?: string;
  httpEtag?: string;
};

type R2ObjectBody = R2ObjectHead & {
  body: ReadableStream;
};

type R2BucketBinding = {
  head(key: string): Promise<R2ObjectHead | null>;
  get(
    key: string,
    options?: { range?: { offset: number; length: number } }
  ): Promise<R2ObjectBody | null>;
};

export interface Env {
  AUDIO: R2BucketBinding;
  ALLOWED_ORIGINS?: string;
  SHARED_SECRET?: string;
}

const AUDIO_PREFIX = 'prod/audio';
const DEFAULT_AUDIO_CONTENT_TYPE = 'audio/ogg; codecs=opus';
const DEFAULT_CACHE_CONTROL_AUDIO = 'public, max-age=31536000, immutable';
const DEFAULT_CACHE_CONTROL_METADATA = 'public, max-age=300';
const DEFAULT_ALLOWED_ORIGIN_STRINGS = [
  'https://www.whoisduck2.com',
  'https://whoisduck2.com',
  'https://photo-signal.vercel.app',
  'http://localhost:5173',
];
const MAX_ASTERISKS = 1;

type AllowedOrigin =
  | { type: 'exact'; origin: string }
  | { type: 'wildcard'; protocol: string; hostnameSuffix: string; hostnamePrefix?: string };

function parseAllowedOrigins(value?: string | null): AllowedOrigin[] {
  const rawValues = value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : DEFAULT_ALLOWED_ORIGIN_STRINGS;

  return rawValues
    .map((raw) => {
      const wildcardMatch = /^(https?):\/\/([^/]*\*[^/]*)$/i.exec(raw);
      if (wildcardMatch) {
        const [, protocol, hostnamePattern] = wildcardMatch;
        const asteriskCount = hostnamePattern.split('*').length - 1;
        if (asteriskCount > MAX_ASTERISKS) {
          return null;
        }
        const wildcardIndex = hostnamePattern.indexOf('*');
        if (wildcardIndex === hostnamePattern.length - 1) {
          return null;
        }

        const [hostnamePrefix = '', hostnameSuffix = ''] = hostnamePattern.split('*');
        const normalizedSuffix = hostnameSuffix.replace(/^\./, '').toLowerCase();
        if (!normalizedSuffix) {
          return null;
        }

        return {
          type: 'wildcard' as const,
          protocol: `${protocol.toLowerCase()}:`,
          hostnamePrefix: hostnamePrefix.toLowerCase(),
          hostnameSuffix: normalizedSuffix,
        };
      }

      try {
        const url = new URL(raw);
        return { type: 'exact' as const, origin: url.origin };
      } catch {
        return null;
      }
    })
    .filter((value): value is AllowedOrigin => Boolean(value));
}

function matchAllowedOrigin(origin: string | null, allowedOrigins: AllowedOrigin[]): string | null {
  if (!origin) {
    return null;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return null;
  }

  const normalizedOrigin = `${originUrl.protocol}//${originUrl.host}`;
  const hostname = originUrl.hostname.toLowerCase();

  for (const allowed of allowedOrigins) {
    if (allowed.type === 'exact' && normalizedOrigin === allowed.origin) {
      return normalizedOrigin;
    }

    if (allowed.type === 'wildcard') {
      if (originUrl.protocol !== allowed.protocol) {
        continue;
      }

      const suffix = allowed.hostnameSuffix.toLowerCase();
      const prefix = (allowed.hostnamePrefix ?? '').toLowerCase();

      if (!hostname.endsWith(suffix)) {
        continue;
      }

      if (prefix && !hostname.startsWith(prefix)) {
        continue;
      }

      const wildcardContentLength = hostname.length - prefix.length - suffix.length;
      if (wildcardContentLength > 0) {
        return normalizedOrigin;
      }
    }
  }

  return null;
}

function buildCorsHeaders(origin: string | null) {
  const headers = new Headers();
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, If-None-Match, Range, X-Requested-With, X-PS-Shared-Secret'
  );
  headers.set(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Content-Type, ETag, Accept-Ranges'
  );
  headers.set('Vary', 'Origin');
  return headers;
}

function inferContentType(pathname: string) {
  if (pathname.endsWith('.opus')) {
    return DEFAULT_AUDIO_CONTENT_TYPE;
  }
  if (pathname.endsWith('.json')) {
    return 'application/json; charset=utf-8';
  }
  if (pathname.endsWith('.md') || pathname.endsWith('.markdown')) {
    return 'text/markdown; charset=utf-8';
  }
  return 'application/octet-stream';
}

function getCacheControl(pathname: string) {
  if (pathname.endsWith('.opus')) {
    return DEFAULT_CACHE_CONTROL_AUDIO;
  }
  return DEFAULT_CACHE_CONTROL_METADATA;
}

function normalizeEtag(etag?: string | null) {
  if (!etag) return null;
  const trimmed = etag.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith('W/')) {
    return trimmed;
  }
  return `"${trimmed}"`;
}

function parseRange(rangeHeader: string | null, size: number) {
  if (!rangeHeader) return null;
  const matches = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!matches) return null;
  const start = matches[1] ? Number.parseInt(matches[1], 10) : 0;
  const end = matches[2] ? Number.parseInt(matches[2], 10) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= size) {
    return 'invalid';
  }
  return { offset: start, length: end - start + 1, end };
}

function getObjectKey(pathname: string) {
  const decoded = decodeURIComponent(pathname);
  if (!decoded.startsWith(`/${AUDIO_PREFIX}`)) {
    return null;
  }

  const rawKey = decoded.replace(/^\/+/, '');
  const segments = rawKey.split('/');
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (normalizedSegments.length === 0) {
        return null;
      }
      normalizedSegments.pop();
      continue;
    }
    normalizedSegments.push(segment);
  }

  const normalizedKey = normalizedSegments.join('/');
  if (normalizedKey !== AUDIO_PREFIX && !normalizedKey.startsWith(`${AUDIO_PREFIX}/`)) {
    return null;
  }

  return normalizedKey;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const origin = request.headers.get('Origin');
    const matchedOrigin = matchAllowedOrigin(origin, allowedOrigins);
    const hasSharedSecret =
      Boolean(env.SHARED_SECRET) &&
      safeCompare(request.headers.get('X-PS-Shared-Secret'), env.SHARED_SECRET);
    const allowAnyOrigin = hasSharedSecret;
    const originAllowed = Boolean(matchedOrigin) || allowAnyOrigin;
    const corsOrigin = allowAnyOrigin ? (origin ?? matchedOrigin) : matchedOrigin;

    if (request.method === 'OPTIONS') {
      if (!originAllowed) {
        return new Response('Forbidden', { status: 403, headers: { Vary: 'Origin' } });
      }
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(corsOrigin),
      });
    }

    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (!originAllowed) {
      return new Response('Forbidden', { status: 403, headers: { Vary: 'Origin' } });
    }

    const key = getObjectKey(url.pathname);
    if (!key) {
      const headers = buildCorsHeaders(corsOrigin);
      return new Response('Not found', { status: 404, headers });
    }

    const head = await env.AUDIO.head(key);
    if (!head) {
      const headers = buildCorsHeaders(corsOrigin);
      return new Response('Not found', { status: 404, headers });
    }

    const etag = normalizeEtag(head.httpEtag ?? head.etag);
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && etag) {
      const candidates = ifNoneMatch.split(',').map((value) => value.trim());
      if (candidates.includes(etag)) {
        const headers = buildCorsHeaders(corsOrigin);
        headers.set('ETag', etag);
        headers.set('Cache-Control', getCacheControl(key));
        headers.set('Accept-Ranges', 'bytes');
        return new Response(null, { status: 304, headers });
      }
    }

    const rangeHeader = request.headers.get('Range');
    const range = parseRange(rangeHeader, head.size);
    if (range === 'invalid') {
      const headers = buildCorsHeaders(corsOrigin);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Range', `bytes */${head.size}`);
      return new Response('Requested Range Not Satisfiable', { status: 416, headers });
    }

    const object = await env.AUDIO.get(
      key,
      range ? { range: { offset: range.offset, length: range.length } } : undefined
    );

    if (!object) {
      const headers = buildCorsHeaders(corsOrigin);
      return new Response('Not found', { status: 404, headers });
    }

    const headers = buildCorsHeaders(corsOrigin);
    headers.set('Content-Type', inferContentType(key));
    headers.set('Cache-Control', getCacheControl(key));
    headers.set('ETag', etag ?? '');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Vary', 'Origin');

    if (range && object.size !== undefined) {
      headers.set('Content-Range', `bytes ${range.offset}-${range.end}/${head.size}`);
      headers.set('Content-Length', `${object.size}`);
    } else if (object.size !== undefined) {
      headers.set('Content-Length', `${object.size}`);
    }

    const status = range ? 206 : 200;
    if (request.method === 'HEAD') {
      return new Response(null, { status, headers });
    }

    return new Response(object.body, { status, headers });
  },
};

function safeCompare(a: string | null, b: string | null) {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a ?? '');
  const bBytes = enc.encode(b ?? '');
  const len = Math.max(aBytes.length, bBytes.length);
  let result = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    const av = aBytes[i % aBytes.length] ?? 0;
    const bv = bBytes[i % bBytes.length] ?? 0;
    result |= av ^ bv;
  }
  return result === 0;
}
