/**
 * Fake Camera Injection for Playwright / AI Agent Testing
 *
 * Allows programmatic end-to-end tests to achieve a real photo match by injecting
 * existing phone-capture video clips as a fake camera feed, bypassing the need for
 * physical camera hardware or interactive permission grants.
 *
 * ## How it works
 *
 * Three layers compose the system:
 *
 * 1. **Playwright route handler** — Intercepts `/test-assets/camera/[filename]` requests
 *    and serves video bytes from `assets/test-videos/phone-samples/` with HTTP 206
 *    byte-range support (required for Chrome's `<video>` element).
 *
 * 2. **Browser init script** — Overrides `navigator.mediaDevices.getUserMedia` to return
 *    a `canvas.captureStream()` fed by a hidden `<video>` playing the routed clip.
 *
 * 3. **Hash seeding** — Intercepts `fetch('/data.recognition.v2.json')` and prepends
 *    a pHash computed from the actual video frame, guaranteeing recognition fires
 *    regardless of codec compression differences.
 *
 * ## Usage
 *
 * ### Playwright tests
 * ```typescript
 * const sample = getSampleByConcertId(16);
 * await bootstrapVisualState(page);
 * await safeGrantCameraPermissions(page.context());
 * await setupFakeCamera(page, sample);  // must be before page.goto()
 * await page.goto('/');
 * ```
 *
 * ### AI agent preview tools
 * ```typescript
 * // After preview_start (dev server running on port 5173)
 * const sample = getSampleByConcertId(16);
 * const hash = await computeVideoFrameHash(videoPath);
 * const script = buildFakeCameraScript('/test-assets/camera/test_1_overcoats.mp4', 16, hash);
 * // preview_eval(script)  — before clicking "Activate Camera"
 * ```
 *
 * Videos are served at `/test-assets/camera/[filename]` by the Vite dev/preview
 * middleware registered in vite.config.ts (dev and preview modes only).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../');
const ASSET_VIDEO_DIR = path.join(REPO_ROOT, 'assets/test-videos/phone-samples');

/** URL prefix used for both Playwright route interception and the Vite middleware. */
export const FAKE_CAMERA_ROUTE_PREFIX = '/test-assets/camera/';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FakeCameraSample {
  sampleId: string;
  filename: string;
  concertId: number;
  photoId: string;
}

export interface FakeCameraOptions {
  /** Frames per second for canvas.captureStream(). Default: 24. */
  fps?: number;
  /**
   * Whether to intercept fetch('/data.recognition.v2.json') and prepend a pHash
   * computed from the video frame. Strongly recommended — raw video frames may not
   * match stored hashes due to codec compression. Default: true.
   */
  seedHash?: boolean;
  /** Canvas width in pixels. Default: 960. */
  canvasWidth?: number;
  /** Canvas height in pixels. Default: 640. */
  canvasHeight?: number;
}

// ---------------------------------------------------------------------------
// Manifest types (private)
// ---------------------------------------------------------------------------

interface ManifestCapture {
  captureId: string;
  concertId: number;
  photoId: string;
}

interface ManifestSample {
  sampleId: string;
  filename: string;
  captures: ManifestCapture[];
}

interface Manifest {
  version: number;
  samples: ManifestSample[];
}

function readManifest(): Manifest {
  return JSON.parse(
    fs.readFileSync(path.join(ASSET_VIDEO_DIR, 'samples.manifest.json'), 'utf8')
  ) as Manifest;
}

// ---------------------------------------------------------------------------
// Manifest lookup helpers
// ---------------------------------------------------------------------------

/**
 * Look up a video sample by the concertId of any of its captures.
 * Returns metadata for the first capture that matches.
 *
 * Available samples (from samples.manifest.json):
 *   concertId 16 → test_1_overcoats.mp4  (Overcoats)
 *   concertId 35 → test_5_barna.mp4      (Sean Barna)
 *   concertId 14 → test_2_croy.mp4       (Croy and the Boys)
 *   concertId 21 → test_6_voxtrot.mp4    (Voxtrot)
 */
export function getSampleByConcertId(concertId: number): FakeCameraSample {
  const manifest = readManifest();
  for (const sample of manifest.samples) {
    const capture = sample.captures.find((c) => c.concertId === concertId);
    if (capture) {
      return {
        sampleId: sample.sampleId,
        filename: sample.filename,
        concertId: capture.concertId,
        photoId: capture.photoId,
      };
    }
  }
  throw new Error(`No video sample found for concertId=${concertId}`);
}

/**
 * Look up a video sample by its sampleId (e.g. 'sample-01').
 * Returns metadata for the first capture in that sample.
 */
export function getSampleById(sampleId: string): FakeCameraSample {
  const manifest = readManifest();
  const sample = manifest.samples.find((s) => s.sampleId === sampleId);
  if (!sample || sample.captures.length === 0) {
    throw new Error(`No video sample found for sampleId=${sampleId}`);
  }
  const capture = sample.captures[0];
  return {
    sampleId: sample.sampleId,
    filename: sample.filename,
    concertId: capture.concertId,
    photoId: capture.photoId,
  };
}

// ---------------------------------------------------------------------------
// Browser-side script builder
// ---------------------------------------------------------------------------

/**
 * Build the browser-side JavaScript that:
 *  1. Creates a hidden <video> pointing at `videoUrl`
 *  2. Draws frames to a <canvas> in a rAF loop (cover-fit scaling)
 *  3. Overrides navigator.mediaDevices.getUserMedia to return canvas.captureStream()
 *  4. Optionally intercepts fetch('/data.recognition.v2.json') to prepend `seededHash`
 *
 * Returns a self-contained IIFE string. Use with:
 *   - page.addInitScript(buildFakeCameraScript(...))  — Playwright
 *   - preview_eval(buildFakeCameraScript(...))         — AI agent preview tools
 *
 * The script is written as ES5-compatible to avoid any transpilation surprises in the
 * injected context.
 */
export function buildFakeCameraScript(
  videoUrl: string,
  concertId: number,
  seededHash?: string,
  options?: FakeCameraOptions
): string {
  const fps = options?.fps ?? 24;
  const canvasWidth = options?.canvasWidth ?? 960;
  const canvasHeight = options?.canvasHeight ?? 640;
  const doSeedHash = (options?.seedHash ?? true) && Boolean(seededHash);

  // JSON-encode all values so they can be safely embedded as literals.
  const sv = JSON.stringify(videoUrl);
  const scid = JSON.stringify(concertId);
  const shash = JSON.stringify(seededHash ?? '');
  const sfps = JSON.stringify(fps);
  const sw = JSON.stringify(canvasWidth);
  const sh = JSON.stringify(canvasHeight);
  const sseed = JSON.stringify(doSeedHash);

  return `(function () {
  var videoUrl = ${sv};
  var concertId = ${scid};
  var seededHash = ${shash};
  var fps = ${sfps};
  var canvasWidth = ${sw};
  var canvasHeight = ${sh};
  var doSeedHash = ${sseed};

  var canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  var ctx = canvas.getContext('2d');
  if (!ctx) { return; }

  var video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  // Position off-screen WITHOUT opacity:0 — Chrome needs to composite the element
  // to decode video frames in headless mode. opacity:0 suppresses decoding.
  video.style.cssText = 'position:fixed;top:-200%;left:-200%;width:1px;height:1px;pointer-events:none;';

  var drawCoverFrame = function () {
    if (video.readyState < 2) { return; }
    var targetAspect = canvasWidth / canvasHeight;
    var videoAspect = video.videoWidth / video.videoHeight;
    var sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
    if (videoAspect > targetAspect) {
      sw = sh * targetAspect;
      sx = (video.videoWidth - sw) / 2;
    } else {
      sh = sw / targetAspect;
      sy = (video.videoHeight - sh) / 2;
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
  };

  // Append to DOM so Chrome composites the element and decodes video frames.
  // Must happen before or at DOMContentLoaded since getUserMedia may be called early.
  var doAppend = function () { document.body.appendChild(video); };
  if (document.body) { doAppend(); }
  else { document.addEventListener('DOMContentLoaded', doAppend); }

  // Create stream promise once; all getUserMedia calls share the same stream.
  var streamPromise = new Promise(function (resolve, reject) {
    var onLoaded = function () {
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onError);
      video.play().catch(function () { /* headless autoplay restriction — ok */ });
      (function render() { drawCoverFrame(); requestAnimationFrame(render); }());
      resolve(canvas.captureStream(fps));
    };
    var onError = function () {
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onError);
      reject(new Error('[fake-camera] Failed to load: ' + videoUrl));
    };
    if (video.readyState >= 2) {
      onLoaded();
    } else {
      video.addEventListener('loadeddata', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
    }
  });

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = function () { return streamPromise; };
  }

  if (doSeedHash && seededHash) {
    var originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = function (input, init) {
      var url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (!url.includes('/data.recognition.v2.json')) {
        return originalFetch(input, init);
      }
      return originalFetch(input, init).then(function (response) {
        return response
          .clone()
          .json()
          .catch(function () { return null; })
          .then(function (payload) {
            if (!payload || !Array.isArray(payload.entries)) { return response; }
            var entry = payload.entries.find(function (e) {
              return e && e.concertId === concertId;
            });
            if (entry) {
              var existing = Array.isArray(entry.phash) ? entry.phash : [];
              entry.phash = [seededHash].concat(
                existing.filter(function (h) { return h !== seededHash; }),
              );
            }
            return new Response(JSON.stringify(payload), {
              status: response.status,
              statusText: response.statusText,
              headers: { 'Content-Type': 'application/json' },
            });
          });
      });
    };
  }
}());
`;
}

// ---------------------------------------------------------------------------
// Playwright route handler
// ---------------------------------------------------------------------------

function getMimeTypeForVideo(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

/**
 * Parse a byte-range request header.
 * Copied from scripts/visual/generate-demo-gif.js.
 */
function parseByteRange(
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

  end = Math.min(end, totalSize - 1);
  return { start, end };
}

/**
 * Read a byte range from a file.
 * Copied from scripts/visual/generate-demo-gif.js.
 */
function readFileRange(filePath: string, start: number, end: number): Buffer {
  const length = end - start + 1;
  const body = Buffer.alloc(length);
  const fd = fs.openSync(filePath, 'r');
  let offset = 0;
  let position = start;
  try {
    while (offset < length) {
      const bytesRead = fs.readSync(fd, body, offset, length - offset, position);
      if (bytesRead === 0) break;
      offset += bytesRead;
      position += bytesRead;
    }
  } finally {
    fs.closeSync(fd);
  }
  return offset < length ? body.subarray(0, offset) : body;
}

/**
 * Register a Playwright route handler that serves a video file with byte-range support.
 * Must be called before page.goto().
 *
 * @returns The relative URL path for the video (e.g. '/test-assets/camera/test_1_overcoats.mp4')
 */
export async function routeFakeCamera(page: Page, videoPath: string): Promise<string> {
  const filename = path.basename(videoPath);
  const routeUrl = `${FAKE_CAMERA_ROUTE_PREFIX}${filename}`;

  await page.route(`**${FAKE_CAMERA_ROUTE_PREFIX}*`, async (route) => {
    const requestUrl = route.request().url();
    const pathname = new URL(requestUrl).pathname;

    if (pathname !== routeUrl) {
      await route.continue();
      return;
    }

    if (!fs.existsSync(videoPath)) {
      await route.abort();
      return;
    }

    const stats = fs.statSync(videoPath);
    const totalSize = stats.size;
    const contentType = getMimeTypeForVideo(videoPath);
    const rangeHeader = route.request().headers()['range'];
    const byteRange = parseByteRange(rangeHeader, totalSize);

    if (rangeHeader && !byteRange) {
      await route.fulfill({
        status: 416,
        headers: { 'Content-Range': `bytes */${totalSize}`, 'Accept-Ranges': 'bytes' },
      });
      return;
    }

    if (byteRange) {
      const { start, end } = byteRange;
      const body = readFileRange(videoPath, start, end);
      await route.fulfill({
        status: 206,
        body,
        contentType,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': String(body.length),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      });
      return;
    }

    const body = fs.readFileSync(videoPath);
    await route.fulfill({
      status: 200,
      body,
      contentType,
      headers: {
        'Content-Length': String(totalSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    });
  });

  return routeUrl;
}

// ---------------------------------------------------------------------------
// Hash computation (Node.js only — requires ffmpeg + ffprobe)
// ---------------------------------------------------------------------------

/**
 * Extract a frame from the video at 30% of its duration and compute its pHash.
 * The result can be passed to buildFakeCameraScript() as `seededHash` to
 * guarantee the recognition pipeline matches the video frames it receives.
 *
 * Requires ffmpeg and ffprobe to be installed.
 * Mirrors computeHashFromVideoFrame() in scripts/visual/generate-demo-gif.js.
 *
 * @throws If ffprobe/ffmpeg are unavailable or the video cannot be processed.
 */
export async function computeVideoFrameHash(videoPath: string): Promise<string> {
  const probeResult = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', videoPath],
    { encoding: 'utf8' }
  );

  if (probeResult.status !== 0) {
    throw new Error(
      `ffprobe failed for ${path.basename(videoPath)}: ${probeResult.stderr?.trim() ?? 'unknown error'}`
    );
  }

  const durationSec = parseFloat(String(probeResult.stdout ?? '').trim());
  if (!isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`Invalid video duration from ffprobe: ${videoPath}`);
  }

  const seekSec = durationSec * 0.3;
  const tmpFile = path.join(os.tmpdir(), `fake-camera-frame-${Date.now()}.png`);

  try {
    const ffmpegResult = spawnSync(
      'ffmpeg',
      [
        '-loglevel',
        'error',
        '-ss',
        String(seekSec),
        '-i',
        videoPath,
        '-vframes',
        '1',
        '-q:v',
        '2',
        tmpFile,
      ],
      { encoding: 'utf8' }
    );

    if (ffmpegResult.status !== 0) {
      throw new Error(
        `ffmpeg frame extraction failed: ${ffmpegResult.stderr?.trim() ?? 'unknown error'}`
      );
    }

    // Dynamic import keeps the top-level module clean and avoids pulling node-canvas
    // into non-hash-computing call paths.
    const utilsPath = path.join(REPO_ROOT, 'scripts/lib/photoHashUtils.js');
    const { loadImageData, computePHash } = (await import(utilsPath)) as {
      loadImageData: (
        p: string
      ) => Promise<{ data: Uint8ClampedArray; width: number; height: number }>;
      computePHash: (d: { data: Uint8ClampedArray; width: number; height: number }) => string;
    };

    const imageData = await loadImageData(tmpFile);
    return computePHash(imageData);
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup failure
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience wrapper — the single function Playwright tests call
// ---------------------------------------------------------------------------

/**
 * Find the best video file for fake camera injection.
 *
 * All phone-captured MP4 files use HEVC (H.265), which Chrome headless cannot
 * decode without GPU hardware acceleration. The half-speed WebM palindromes use
 * VP9, which Chrome can always decode in software. This function prefers the
 * WebM variant when available and falls back to the MP4.
 *
 * WebM files live at: assets/test-videos/phone-samples/half-speed/{base}.3x-palindrome.webm
 */
function resolveCompatibleVideoPath(sample: FakeCameraSample): string {
  const base = path.basename(sample.filename, path.extname(sample.filename));
  const webmPath = path.join(ASSET_VIDEO_DIR, 'half-speed', `${base}.3x-palindrome.webm`);
  if (fs.existsSync(webmPath)) {
    return webmPath;
  }
  // Fall back to MP4 — note: HEVC MP4 won't decode in headless Chrome without GPU
  return path.join(ASSET_VIDEO_DIR, sample.filename);
}

/**
 * Set up a fake camera feed for a Playwright test. Must be called before page.goto().
 *
 * Registers a Playwright route handler (so videos are served from disk) and injects
 * a browser-side init script that overrides getUserMedia and optionally seeds the
 * recognition hash for reliable matches.
 *
 * Prefers VP9 WebM files (in half-speed/) over HEVC MP4 files because Chrome
 * headless cannot decode HEVC without GPU hardware.
 *
 * @param page    Playwright Page (fresh, before navigation)
 * @param sample  Video sample from getSampleByConcertId() or getSampleById()
 * @param options FakeCameraOptions (seedHash defaults to true)
 * @returns       The seeded hash (empty string if seeding was skipped)
 */
export async function setupFakeCamera(
  page: Page,
  sample: FakeCameraSample,
  options: FakeCameraOptions = {}
): Promise<{ seededHash: string }> {
  const videoPath = resolveCompatibleVideoPath(sample);

  // Register the route handler first (needs to be active before page loads)
  const videoUrl = await routeFakeCamera(page, videoPath);

  // Compute the seeded hash (requires ffmpeg — degrades gracefully if unavailable)
  let seededHash = '';
  if (options.seedHash !== false) {
    try {
      seededHash = await computeVideoFrameHash(videoPath);
    } catch (err) {
      console.warn(
        `[fake-camera] Hash seeding skipped (ffmpeg/ffprobe unavailable?): ${String(err)}`
      );
    }
  }

  // Inject the browser-side override script
  const script = buildFakeCameraScript(
    videoUrl,
    sample.concertId,
    seededHash || undefined,
    options
  );
  await page.addInitScript(script);

  return { seededHash };
}
