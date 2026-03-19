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
// Usage (AI agent preview tools):
//   preview_eval(buildFakeCameraScript('/test-assets/camera/test_1_overcoats.mp4', 16, hash))
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
  if (!filename) {
    next();
    return;
  }

  const filePath = path.join(videoDir, filename);
  if (!fs.existsSync(filePath)) {
    next();
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.mp4' ? 'video/mp4' : ext === '.webm' ? 'video/webm' : 'application/octet-stream';

  const stats = fs.statSync(filePath);
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
    const buf = Buffer.alloc(chunkSize);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, buf, 0, chunkSize, start);
    } finally {
      fs.closeSync(fd);
    }
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
