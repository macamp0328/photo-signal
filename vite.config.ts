import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Test video middleware (dev + preview only — never ships to production)
//
// Serves assets/test-videos/phone-samples/ at /test-assets/camera/[filename]
// so the fake camera injection in tests/visual/utils/fake-camera.ts can
// reference video files by URL without needing Playwright route interception.
//
// Serves both root files (*.mp4) and subdirectory files (half-speed/*.webm) under
// the same flat URL namespace — /test-assets/camera/[filename].
//
// Usage (AI agent preview tools):
//   preview_eval(buildFakeCameraScript('/test-assets/camera/test_1_overcoats.3x-palindrome.webm', 16, hash))
// ---------------------------------------------------------------------------

function parseTestVideoByteRange(
  rangeHeader: string | undefined,
  totalSize: number
): { start: number; end: number } | null {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;
  const [, startRaw, endRaw] = match;
  if (startRaw === '' && endRaw === '') return null;
  let start: number;
  let end: number;
  if (startRaw === '') {
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(totalSize - suffixLength, 0);
    end = totalSize - 1;
  } else {
    start = Number(startRaw);
    end = endRaw === '' ? totalSize - 1 : Number(endRaw);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= totalSize) return null;
  return { start, end: Math.min(end, totalSize - 1) };
}

function serveTestVideo(
  videoDir: string,
  req: { url?: string; headers: Record<string, string | string[] | undefined> },
  res: {
    writeHead: (status: number, headers: Record<string, string | number>) => void;
    end: (body?: Buffer) => void;
  },
  next: () => void
): void {
  const filename = (req.url ?? '').replace(/^\//, '').split('?')[0];
  // Reject empty names and any path traversal sequences — served names must be flat file names.
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    next();
    return;
  }

  // Search root first, then immediate subdirectories (e.g. half-speed/ for VP9 WebMs).
  let filePath = path.join(videoDir, filename);
  if (!fs.existsSync(filePath)) {
    const subDirs = fs
      .readdirSync(videoDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(videoDir, d.name, filename));
    const found = subDirs.find((p) => fs.existsSync(p));
    if (!found) {
      next();
      return;
    }
    filePath = found;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.mp4' ? 'video/mp4' : ext === '.webm' ? 'video/webm' : 'application/octet-stream';

  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    next();
    return;
  }
  const totalSize = stats.size;
  const rangeHeader = typeof req.headers['range'] === 'string' ? req.headers['range'] : undefined;
  const byteRange = parseTestVideoByteRange(rangeHeader, totalSize);

  if (rangeHeader && !byteRange) {
    res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
    res.end();
    return;
  }

  if (byteRange) {
    const { start, end } = byteRange;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Content-Length': chunkSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    // readFileSync+slice guarantees the exact byte range without the partial-read
    // risk of a single fs.readSync() call.
    const buf = fs.readFileSync(filePath).slice(start, end + 1);
    res.end(buf);
    return;
  }

  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Length': totalSize,
    'Accept-Ranges': 'bytes',
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const testVideoDir = path.join(__dirname, 'assets/test-videos/phone-samples');
const TEST_VIDEO_ROUTE = '/test-assets/camera/';

const testVideoPlugin = {
  name: 'test-video-assets',
  configureServer(server: {
    middlewares: { use: (path: string, fn: (...args: unknown[]) => void) => void };
  }) {
    server.middlewares.use(TEST_VIDEO_ROUTE, (req, res, next) => {
      serveTestVideo(
        testVideoDir,
        req as Parameters<typeof serveTestVideo>[1],
        res as Parameters<typeof serveTestVideo>[2],
        next as () => void
      );
    });
  },
  configurePreviewServer(server: {
    middlewares: { use: (path: string, fn: (...args: unknown[]) => void) => void };
  }) {
    server.middlewares.use(TEST_VIDEO_ROUTE, (req, res, next) => {
      serveTestVideo(
        testVideoDir,
        req as Parameters<typeof serveTestVideo>[1],
        res as Parameters<typeof serveTestVideo>[2],
        next as () => void
      );
    });
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const nodeEnv = mode === 'production' ? 'production' : 'development';

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
    plugins: [react(), testVideoPlugin],
    server: {
      host: true,
      port: 5173,
    },
  };
});
