#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium, devices } from '@playwright/test';
import { createCanvas } from 'canvas';
import { computePHash, loadImageData } from '../lib/photoHashUtils.js';

const ROOT = process.cwd();
const BASE_URL = 'http://127.0.0.1:4173';
const FRAME_DIR = path.resolve(ROOT, 'scripts/visual/output/demo-frames');
const OUTPUT_GIF = path.resolve(ROOT, 'docs/media/demo.gif');
const OUTPUT_DIR = path.dirname(OUTPUT_GIF);

const DEFAULT_LANDING_FRAMES = 8;
const DEFAULT_CAPTURE_FRAMES = 90;
const DEFAULT_FRAME_DELAY_MS = 100;
const DEFAULT_FPS = 8;
const DEFAULT_PRE_MATCH_MS = 5000;
const DEFAULT_VIEWPORT_WIDTH = 412;
const DEFAULT_VIEWPORT_HEIGHT = 915;
const DEFAULT_OUTPUT_WIDTH = 480;

function parseArgs(argv) {
  const parsed = {
    skipBuild: false,
    keepFrames: false,
    fps: DEFAULT_FPS,
    landingFrames: DEFAULT_LANDING_FRAMES,
    captureFrames: DEFAULT_CAPTURE_FRAMES,
    frameDelayMs: DEFAULT_FRAME_DELAY_MS,
    preMatchMs: DEFAULT_PRE_MATCH_MS,
    viewportWidth: DEFAULT_VIEWPORT_WIDTH,
    viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
    outputWidth: DEFAULT_OUTPUT_WIDTH,
  };

  for (const arg of argv) {
    if (arg === '--skip-build') parsed.skipBuild = true;
    if (arg === '--keep-frames') parsed.keepFrames = true;
    if (arg.startsWith('--fps=')) parsed.fps = Number(arg.split('=')[1] ?? DEFAULT_FPS);
    if (arg.startsWith('--landing-frames=')) {
      parsed.landingFrames = Number(arg.split('=')[1] ?? DEFAULT_LANDING_FRAMES);
    }
    if (arg.startsWith('--capture-frames=')) {
      parsed.captureFrames = Number(arg.split('=')[1] ?? DEFAULT_CAPTURE_FRAMES);
    }
    if (arg.startsWith('--frame-delay-ms=')) {
      parsed.frameDelayMs = Number(arg.split('=')[1] ?? DEFAULT_FRAME_DELAY_MS);
    }
    if (arg.startsWith('--pre-match-ms=')) {
      parsed.preMatchMs = Number(arg.split('=')[1] ?? DEFAULT_PRE_MATCH_MS);
    }
    if (arg.startsWith('--viewport-width=')) {
      parsed.viewportWidth = Number(arg.split('=')[1] ?? DEFAULT_VIEWPORT_WIDTH);
    }
    if (arg.startsWith('--viewport-height=')) {
      parsed.viewportHeight = Number(arg.split('=')[1] ?? DEFAULT_VIEWPORT_HEIGHT);
    }
    if (arg.startsWith('--output-width=')) {
      parsed.outputWidth = Number(arg.split('=')[1] ?? DEFAULT_OUTPUT_WIDTH);
    }
  }

  return parsed;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

async function waitForServer(url, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`Preview server did not become ready at ${url}`);
}

function startPreviewServer() {
  return spawn(
    'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
}

function resolveDemoPhotoPath() {
  const appDataPath = path.resolve(ROOT, 'public/data.app.v2.json');
  const appData = JSON.parse(fs.readFileSync(appDataPath, 'utf8'));
  const firstPhoto = appData.photos?.[0];

  if (!firstPhoto?.imageFile) {
    throw new Error('No photo.imageFile found in public/data.app.v2.json');
  }

  const relative = String(firstPhoto.imageFile).replace(/^\//, '');
  const absolute = path.resolve(ROOT, relative);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Demo photo not found on disk: ${absolute}`);
  }

  return absolute;
}

async function computeSeededMatchHash(photoPath) {
  const source = await loadImageData(photoPath);

  const cameraCanvas = createCanvas(960, 640);
  const cameraContext = cameraCanvas.getContext('2d', { willReadFrequently: true });

  const sourceCanvas = createCanvas(source.width, source.height);
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  sourceContext.putImageData(source, 0, 0);

  const targetAspect = cameraCanvas.width / cameraCanvas.height;
  const imageAspect = source.width / source.height;

  let sourceWidth = source.width;
  let sourceHeight = source.height;
  let sourceX = 0;
  let sourceY = 0;

  if (imageAspect > targetAspect) {
    sourceHeight = source.height;
    sourceWidth = sourceHeight * targetAspect;
    sourceX = (source.width - sourceWidth) / 2;
  } else {
    sourceWidth = source.width;
    sourceHeight = sourceWidth / targetAspect;
    sourceY = (source.height - sourceHeight) / 2;
  }

  cameraContext.drawImage(
    sourceCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    cameraCanvas.width,
    cameraCanvas.height
  );

  const framedWidth = 512;
  const framedHeight = 341;
  const framedX = Math.round((cameraCanvas.width - framedWidth) / 2);
  const framedY = Math.round((cameraCanvas.height - framedHeight) / 2);

  const hashCanvas = createCanvas(64, 64);
  const hashContext = hashCanvas.getContext('2d', { willReadFrequently: true });
  hashContext.drawImage(cameraCanvas, framedX, framedY, framedWidth, framedHeight, 0, 0, 64, 64);

  const imageData = hashContext.getImageData(0, 0, 64, 64);
  return computePHash(imageData);
}

async function ensureEmptyFrameDir() {
  fs.rmSync(FRAME_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAME_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function buildDataUrl(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function captureDemoFrames(options) {
  const { landingFrames, captureFrames, frameDelayMs, preMatchMs, viewportWidth, viewportHeight } =
    options;

  const demoPhotoPath = resolveDemoPhotoPath();
  const imageDataUrl = buildDataUrl(demoPhotoPath);
  const seededMatchHash = await computeSeededMatchHash(demoPhotoPath);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    ...devices['Pixel 7'],
    viewport: { width: viewportWidth, height: viewportHeight },
  });

  const page = await context.newPage();
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[browser:${type}] ${message.text()}`);
    }
  });

  await page.addInitScript(
    ({ seededImageDataUrl, seededHash, preMatchDurationMs }) => {
      try {
        const existingFlagsRaw = globalThis.localStorage.getItem('photo-signal-feature-flags');
        const existingFlags = existingFlagsRaw ? JSON.parse(existingFlagsRaw) : [];
        const byId = new Map(existingFlags.map((flag) => [flag.id, flag]));

        byId.set('rectangle-detection', {
          ...(byId.get('rectangle-detection') ?? { id: 'rectangle-detection' }),
          enabled: false,
        });
        byId.set('show-debug-overlay', {
          ...(byId.get('show-debug-overlay') ?? { id: 'show-debug-overlay' }),
          enabled: false,
        });

        globalThis.localStorage.setItem(
          'photo-signal-feature-flags',
          JSON.stringify(Array.from(byId.values()))
        );
      } catch {
        // ignore localStorage bootstrap failures
      }

      const createSyntheticStream = async () => {
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 640;
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Failed to create synthetic camera context');
        }

        const image = new globalThis.Image();
        image.src = seededImageDataUrl;
        await image.decode();

        const targetAspect = canvas.width / canvas.height;
        const imageAspect = image.width / image.height;

        let sourceWidth = image.width;
        let sourceHeight = image.height;
        let sourceX = 0;
        let sourceY = 0;

        if (imageAspect > targetAspect) {
          sourceHeight = image.height;
          sourceWidth = sourceHeight * targetAspect;
          sourceX = (image.width - sourceWidth) / 2;
        } else {
          sourceWidth = image.width;
          sourceHeight = sourceWidth / targetAspect;
          sourceY = (image.height - sourceHeight) / 2;
        }

        const startMs = globalThis.performance.now();

        const render = (now) => {
          const elapsedMs = now - startMs;
          const elapsedSeconds = elapsedMs / 1000;
          const isPreMatchPhase = elapsedMs < preMatchDurationMs;

          const driftX = isPreMatchPhase ? Math.sin(elapsedSeconds * 1.15) * 8 : 0;
          const driftY = isPreMatchPhase ? Math.cos(elapsedSeconds * 0.9) * 6 : 0;
          const zoom = isPreMatchPhase ? 1.06 + Math.sin(elapsedSeconds * 0.75) * 0.01 : 1;

          const drawWidth = sourceWidth / zoom;
          const drawHeight = sourceHeight / zoom;
          const drawX = sourceX + (sourceWidth - drawWidth) / 2 + driftX;
          const drawY = sourceY + (sourceHeight - drawHeight) / 2 + driftY;

          context.clearRect(0, 0, canvas.width, canvas.height);

          context.save();
          if (isPreMatchPhase) {
            context.filter = 'blur(1.8px) brightness(0.76) contrast(1.2) saturate(0.82)';
          } else {
            context.filter = 'none';
          }
          context.drawImage(
            image,
            drawX,
            drawY,
            drawWidth,
            drawHeight,
            0,
            0,
            canvas.width,
            canvas.height
          );
          context.restore();

          if (isPreMatchPhase) {
            const vignette = context.createRadialGradient(
              canvas.width / 2,
              canvas.height / 2,
              canvas.width * 0.15,
              canvas.width / 2,
              canvas.height / 2,
              canvas.width * 0.65
            );
            vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
            vignette.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
            context.fillStyle = vignette;
            context.fillRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < 80; i += 1) {
              const x = Math.floor(Math.random() * canvas.width);
              const y = Math.floor(Math.random() * canvas.height);
              const alpha = (Math.random() * 0.1).toFixed(3);
              context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
              context.fillRect(x, y, 2, 2);
            }
          }

          globalThis.requestAnimationFrame(render);
        };

        globalThis.requestAnimationFrame(render);
        return canvas.captureStream(24);
      };

      if (navigator.mediaDevices?.getUserMedia) {
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
          navigator.mediaDevices
        );
        const streamPromise = createSyntheticStream();
        navigator.mediaDevices.getUserMedia = async () => {
          try {
            return await streamPromise;
          } catch {
            return originalGetUserMedia({ video: true, audio: false });
          }
        };
      }

      const originalFetch = globalThis.fetch.bind(globalThis);
      globalThis.fetch = async (input, init) => {
        const requestUrl =
          typeof input === 'string' ? input : input instanceof Request ? input.url : '';
        const isRecognitionIndexRequest = requestUrl.includes('/data.recognition.v2.json');

        if (!isRecognitionIndexRequest) {
          return originalFetch(input, init);
        }

        const response = await originalFetch(input, init);
        const payload = await response
          .clone()
          .json()
          .catch(() => null);

        if (!payload || !Array.isArray(payload.entries) || payload.entries.length === 0) {
          return response;
        }

        const firstEntry = payload.entries[0];
        const existing = Array.isArray(firstEntry?.phash) ? firstEntry.phash : [];
        payload.entries[0].phash = [seededHash, ...existing.filter((hash) => hash !== seededHash)];

        return new Response(JSON.stringify(payload), {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      };
    },
    {
      seededImageDataUrl: imageDataUrl,
      seededHash: seededMatchHash,
      preMatchDurationMs: preMatchMs,
    }
  );

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /photo signal/i }).waitFor({ timeout: 10000 });

    let frameIndex = 0;
    const saveFrame = async () => {
      if (page.isClosed()) {
        throw new Error(`Browser page closed unexpectedly before frame ${frameIndex}`);
      }

      const framePath = path.join(FRAME_DIR, `frame-${String(frameIndex).padStart(4, '0')}.png`);
      await page.screenshot({ path: framePath, fullPage: false });
      frameIndex += 1;
    };

    for (let i = 0; i < landingFrames; i += 1) {
      await saveFrame();
      await page.waitForTimeout(frameDelayMs);
    }

    const activateButton = page.getByRole('button', {
      name: /activate camera and begin experience/i,
    });
    await activateButton.click();

    const hasVideo = await page
      .locator('video')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!hasVideo) {
      const hasPermissionError = await page
        .getByText(/camera access required/i)
        .isVisible()
        .catch(() => false);

      throw new Error(
        hasPermissionError
          ? 'Camera did not activate (permission/error state visible).'
          : 'Camera video element did not become visible after activation.'
      );
    }

    let matched = false;

    for (let i = 0; i < captureFrames; i += 1) {
      await saveFrame();
      if (!matched) {
        const hasConcertDetails = await page
          .getByLabel(/concert details/i)
          .isVisible()
          .catch(() => false);
        const hasSignalBadge = await page
          .getByText(/signal:\s*on air/i)
          .isVisible()
          .catch(() => false);
        const hasNowPlaying = await page
          .getByText(/now playing/i)
          .isVisible()
          .catch(() => false);

        matched = hasConcertDetails || hasSignalBadge || hasNowPlaying;
      }
      await page.waitForTimeout(frameDelayMs);
    }

    if (!matched) {
      const pageClosed = page.isClosed();
      const hasPermissionError = pageClosed
        ? false
        : await page
            .getByText(/camera access required/i)
            .isVisible()
            .catch(() => false);
      const hasBestMatch = pageClosed
        ? false
        : await page
            .getByText('Best Match')
            .isVisible()
            .catch(() => false);
      const hasDebugOverlay = pageClosed
        ? false
        : await page
            .getByText(/debug info/i)
            .isVisible()
            .catch(() => false);

      let failureScreenshot = 'unavailable';
      if (!pageClosed) {
        failureScreenshot = path.join(FRAME_DIR, 'no-match-debug.png');
        await page.screenshot({ path: failureScreenshot, fullPage: false });
      }

      const bodySnippet = pageClosed
        ? 'unavailable'
        : await page
            .locator('body')
            .innerText()
            .then((text) => text.replace(/\s+/g, ' ').slice(0, 500))
            .catch(() => 'unavailable');

      throw new Error(
        `No photo match detected during demo capture. pageClosed=${pageClosed}, cameraError=${hasPermissionError}, bestMatchVisible=${hasBestMatch}, debugOverlayVisible=${hasDebugOverlay}, screenshot=${failureScreenshot}, body=${bodySnippet}`
      );
    }
  } finally {
    await browser.close();
  }
}

function buildGif(fps, outputWidth) {
  const palettePath = path.resolve(FRAME_DIR, 'palette.png');
  const framePattern = path.join(FRAME_DIR, 'frame-%04d.png');

  run('ffmpeg', [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    framePattern,
    '-vf',
    'palettegen=stats_mode=full',
    palettePath,
  ]);

  run('ffmpeg', [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    framePattern,
    '-i',
    palettePath,
    '-lavfi',
    `fps=${fps},scale=${outputWidth}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a`,
    OUTPUT_GIF,
  ]);
}

function cleanup(keepFrames) {
  if (!keepFrames) {
    fs.rmSync(FRAME_DIR, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.skipBuild) {
    run('npm', ['run', 'build']);
  }

  spawnSync('pkill', ['-f', 'vite preview'], { stdio: 'ignore' });

  await ensureEmptyFrameDir();

  const preview = startPreviewServer();
  preview.stdout.on('data', (chunk) => process.stdout.write(chunk.toString()));
  preview.stderr.on('data', (chunk) => process.stderr.write(chunk.toString()));

  try {
    await waitForServer(BASE_URL);
    await captureDemoFrames(options);
    buildGif(options.fps, options.outputWidth);
    console.log(`\n✅ Demo GIF generated: ${OUTPUT_GIF}`);
  } finally {
    if (!preview.killed) {
      preview.kill('SIGTERM');
    }
    spawnSync('pkill', ['-f', 'vite preview --host 127.0.0.1 --port 4173'], { stdio: 'ignore' });
    cleanup(options.keepFrames);
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`\n❌ Demo GIF generation failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(`\n❌ Demo GIF generation failed: ${String(error)}`);
  }
  process.exit(1);
});
