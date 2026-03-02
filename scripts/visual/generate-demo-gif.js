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
const DEFAULT_CAPTURE_FRAMES = 320;
const DEFAULT_FRAME_DELAY_MS = 100;
const DEFAULT_FPS = 8;
const DEFAULT_PRE_MATCH_MS = 6500;
const DEFAULT_VIEWPORT_WIDTH = 412;
const DEFAULT_VIEWPORT_HEIGHT = 915;
const DEFAULT_OUTPUT_WIDTH = 480;

const STORY_PACING_MS = {
  postFirstMatchHold: 3400,
  postPauseHold: 1800,
  postPlayHold: 1800,
  postNextHold: 2500,
  postCloseHold: 8200,
  postSecondTargetPreviewHold: 2800,
  postSecondMatchHold: 2400,
  postDropNeedleHold: 6200,
};

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

  if (result.error) {
    const code = result.error.code ? ` (${result.error.code})` : '';
    throw new Error(
      `Failed to run command${code}: ${command} ${args.join(' ')} — ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status ?? 'unknown'}: ${command} ${args.join(' ')}`
    );
  }
}

function getStderrTail(buffer) {
  const text = buffer.join('').trim();
  if (!text) {
    return 'No stderr output from preview process.';
  }
  return text.split('\n').slice(-8).join('\n');
}

async function waitForServer(url, preview, stderrBuffer, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (preview.exitCode !== null) {
      throw new Error(
        `Preview server exited early with code ${preview.exitCode}.\n${getStderrTail(stderrBuffer)}`
      );
    }

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

  throw new Error(
    `Preview server did not become ready at ${url} within ${timeoutMs}ms.\n${getStderrTail(stderrBuffer)}`
  );
}

function startPreviewServer() {
  return spawn(
    'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
    {
      cwd: ROOT,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
}

function resolvePhotoPath(imageFile) {
  const relative = String(imageFile ?? '').replace(/^\//, '');
  const absolute = path.resolve(ROOT, relative);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Demo photo not found on disk: ${absolute}`);
  }

  return absolute;
}

function resolveDemoTargets() {
  const appDataPath = path.resolve(ROOT, 'public/data.app.v2.json');
  const recognitionPath = path.resolve(ROOT, 'public/data.recognition.v2.json');

  const appData = JSON.parse(fs.readFileSync(appDataPath, 'utf8'));
  const recognitionData = JSON.parse(fs.readFileSync(recognitionPath, 'utf8'));

  const appEntries = Array.isArray(appData.entries) ? appData.entries : [];
  const tracks = Array.isArray(appData.tracks) ? appData.tracks : [];
  const photos = Array.isArray(appData.photos) ? appData.photos : [];
  const artists = Array.isArray(appData.artists) ? appData.artists : [];
  const recognitionEntries = Array.isArray(recognitionData.entries) ? recognitionData.entries : [];

  const tracksById = new Map(tracks.map((track) => [track.id, track]));
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const artistNameById = new Map(artists.map((artist) => [artist.id, artist.name ?? artist.id]));
  const recognitionByConcertId = new Map(
    recognitionEntries.map((entry, index) => [entry.concertId, { entry, index }])
  );

  const usableEntries = appEntries
    .map((entry) => {
      const track = tracksById.get(entry.trackId);
      const photo = photosById.get(entry.photoId);
      const recognition = recognitionByConcertId.get(entry.id);
      const recognitionEnabled = entry.recognitionEnabled !== false;

      if (!recognitionEnabled || !track?.audioFile || !photo?.imageFile || !recognition) {
        return null;
      }

      return {
        concertId: entry.id,
        artistId: entry.artistId,
        artistName: artistNameById.get(entry.artistId) ?? entry.artistId,
        imageFile: photo.imageFile,
        recognitionEntryIndex: recognition.index,
      };
    })
    .filter(Boolean);

  if (usableEntries.length < 2) {
    throw new Error('Not enough recognition-enabled entries found for demo sequence.');
  }

  const countsByArtist = usableEntries.reduce((counts, entry) => {
    counts.set(entry.artistId, (counts.get(entry.artistId) ?? 0) + 1);
    return counts;
  }, new Map());

  const firstTarget = usableEntries.find((entry) => (countsByArtist.get(entry.artistId) ?? 0) > 1);

  if (!firstTarget) {
    throw new Error('No artist with multiple tracks found for deterministic next-track demo.');
  }

  const secondaryCandidates = usableEntries.filter(
    (entry) => entry.artistId !== firstTarget.artistId
  );

  if (secondaryCandidates.length === 0) {
    throw new Error(
      'Could not find second target with a different artist for Drop the Needle demo.'
    );
  }

  const orderedSecondaryCandidates = [...secondaryCandidates].sort((a, b) => {
    const aPreferred = /jonny fritz/i.test(a.artistName) ? 0 : 1;
    const bPreferred = /jonny fritz/i.test(b.artistName) ? 0 : 1;
    return aPreferred - bPreferred;
  });

  return {
    firstTarget: {
      ...firstTarget,
      photoPath: resolvePhotoPath(firstTarget.imageFile),
    },
    secondaryTargets: orderedSecondaryCandidates.slice(0, 3).map((candidate) => ({
      ...candidate,
      photoPath: resolvePhotoPath(candidate.imageFile),
    })),
  };
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

  const { firstTarget, secondaryTargets } = resolveDemoTargets();
  if (secondaryTargets.length === 0) {
    throw new Error('No secondary target available for second match.');
  }
  const allTargets = [firstTarget, ...secondaryTargets];
  const targetImageDataUrls = allTargets.map((target) => buildDataUrl(target.photoPath));
  const targetSeededHashes = await Promise.all(
    allTargets.map(async (target) => computeSeededMatchHash(target.photoPath))
  );

  console.log(
    `🎬 Demo targets: A=${firstTarget.artistName} (concert ${firstTarget.concertId}), secondary candidates=${secondaryTargets.length}`
  );

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
    ({ seededImageDataUrls, seededTargets }) => {
      try {
        const existingFlagsRaw = globalThis.localStorage.getItem('photo-signal-feature-flags');
        const existingFlags = existingFlagsRaw ? JSON.parse(existingFlagsRaw) : [];
        const byId = new Map(existingFlags.map((flag) => [flag.id, flag]));

        byId.set('rectangle-detection', {
          ...(byId.get('rectangle-detection') ?? { id: 'rectangle-detection' }),
          enabled: true,
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

      const demoState = {
        phase: 'pre-match',
        targetIndex: 0,
      };

      globalThis.__photoSignalDemoSetPhase = (nextPhase) => {
        if (typeof nextPhase === 'string') {
          demoState.phase = nextPhase;
        }
      };
      globalThis.__photoSignalDemoSetTargetIndex = (nextIndex) => {
        if (typeof nextIndex === 'number' && Number.isFinite(nextIndex)) {
          const normalized = Math.max(
            0,
            Math.min(Math.floor(nextIndex), seededImageDataUrls.length - 1)
          );
          demoState.targetIndex = normalized;
        }
      };
      globalThis.__photoSignalDemoGetPhase = () => demoState.phase;

      const createSyntheticStream = async () => {
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 640;
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Failed to create synthetic camera context');
        }

        const images = [];
        for (const imageDataUrl of seededImageDataUrls) {
          const image = new globalThis.Image();
          image.src = imageDataUrl;
          await image.decode();
          images.push(image);
        }

        const calculateImageCrop = (image) => {
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

          return {
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
          };
        };

        const cropsByIndex = images.map((image) => calculateImageCrop(image));

        const createRecognitionBox = () => {
          const videoElement = globalThis.document.querySelector('video');
          if (!videoElement) {
            return;
          }

          const host = videoElement.parentElement;
          if (!host || host.querySelector('[data-demo-recognition-box="true"]')) {
            return;
          }

          if (globalThis.getComputedStyle(host).position === 'static') {
            host.style.position = 'relative';
          }

          const box = globalThis.document.createElement('div');
          box.setAttribute('data-demo-recognition-box', 'true');
          box.style.position = 'absolute';
          box.style.left = '18%';
          box.style.top = '20%';
          box.style.width = '64%';
          box.style.height = '58%';
          box.style.border = '3px solid var(--color-warning, #fbbf24)';
          box.style.boxShadow =
            '0 0 0.7rem color-mix(in srgb, var(--color-warning, #fbbf24) 55%, transparent)';
          box.style.pointerEvents = 'none';
          box.style.zIndex = '16';

          const createCorner = (left, top, right, bottom) => {
            const corner = globalThis.document.createElement('div');
            corner.style.position = 'absolute';
            corner.style.width = '20px';
            corner.style.height = '20px';
            corner.style.border = '3px solid currentColor';
            if (left) corner.style.left = '-3px';
            if (top) corner.style.top = '-3px';
            if (right) corner.style.right = '-3px';
            if (bottom) corner.style.bottom = '-3px';
            if (left) corner.style.borderRight = 'none';
            if (right) corner.style.borderLeft = 'none';
            if (top) corner.style.borderBottom = 'none';
            if (bottom) corner.style.borderTop = 'none';
            return corner;
          };

          box.appendChild(createCorner(true, true, false, false));
          box.appendChild(createCorner(false, true, true, false));
          box.appendChild(createCorner(false, false, true, true));
          box.appendChild(createCorner(true, false, false, true));
          host.appendChild(box);

          const updateBoxStyle = () => {
            const isPreMatch = demoState.phase === 'pre-match';
            box.style.color = isPreMatch
              ? 'var(--color-warning, #fbbf24)'
              : 'var(--color-success, #10b981)';
            box.style.borderColor = isPreMatch
              ? 'var(--color-warning, #fbbf24)'
              : 'var(--color-success, #10b981)';
            box.style.boxShadow = isPreMatch
              ? '0 0 0.7rem color-mix(in srgb, var(--color-warning, #fbbf24) 55%, transparent)'
              : '0 0 0.95rem color-mix(in srgb, var(--color-success, #10b981) 65%, transparent)';
            box.style.opacity = isPreMatch ? '0.8' : '1';
          };

          const animate = () => {
            updateBoxStyle();
            globalThis.requestAnimationFrame(animate);
          };

          animate();
        };

        const boxBoot = () => {
          createRecognitionBox();
          globalThis.requestAnimationFrame(boxBoot);
        };
        globalThis.requestAnimationFrame(boxBoot);

        const startMs = globalThis.performance.now();

        const deterministicUnit = (seed) => {
          let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
          value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
          value ^= value >>> 16;
          return (value >>> 0) / 4294967295;
        };

        const render = (now) => {
          const elapsedMs = now - startMs;
          const elapsedSeconds = elapsedMs / 1000;
          const frameTick = Math.floor(elapsedMs / (1000 / 24));
          const phase =
            demoState.phase === 'target'
              ? 'target'
              : demoState.phase === 'target-preview'
                ? 'target-preview'
                : demoState.phase === 'no-match'
                  ? 'no-match'
                  : 'pre-match';
          const isPreMatchPhase =
            phase === 'pre-match' || phase === 'no-match' || phase === 'target-preview';

          const activeIndex = Math.max(0, Math.min(demoState.targetIndex, images.length - 1));
          const image = images[activeIndex];
          const crop = cropsByIndex[activeIndex];

          const driftX = isPreMatchPhase ? Math.sin(elapsedSeconds * 1.15) * 8 : 0;
          const driftY = isPreMatchPhase ? Math.cos(elapsedSeconds * 0.9) * 6 : 0;
          const zoom = isPreMatchPhase ? 1.06 + Math.sin(elapsedSeconds * 0.75) * 0.01 : 1;

          const drawWidth = crop.sourceWidth / zoom;
          const drawHeight = crop.sourceHeight / zoom;
          const drawX = crop.sourceX + (crop.sourceWidth - drawWidth) / 2 + driftX;
          const drawY = crop.sourceY + (crop.sourceHeight - drawHeight) / 2 + driftY;

          context.clearRect(0, 0, canvas.width, canvas.height);

          if (phase === 'no-match') {
            const pulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * 1.2);
            context.fillStyle = `rgba(22, 22, 30, ${0.9 - pulse * 0.08})`;
            context.fillRect(0, 0, canvas.width, canvas.height);

            const scanHeight = Math.round(canvas.height * 0.28);
            const scanY = Math.round(
              ((elapsedSeconds * 85) % (canvas.height + scanHeight)) - scanHeight
            );
            const scanGradient = context.createLinearGradient(0, scanY, 0, scanY + scanHeight);
            scanGradient.addColorStop(0, 'rgba(124, 58, 237, 0.0)');
            scanGradient.addColorStop(0.5, 'rgba(124, 58, 237, 0.16)');
            scanGradient.addColorStop(1, 'rgba(124, 58, 237, 0.0)');
            context.fillStyle = scanGradient;
            context.fillRect(0, scanY, canvas.width, scanHeight);

            for (let i = 0; i < 140; i += 1) {
              const baseSeed = frameTick * 811 + i * 131 + 17;
              const x = Math.floor(deterministicUnit(baseSeed) * canvas.width);
              const y = Math.floor(deterministicUnit(baseSeed + 1) * canvas.height);
              const alpha = (deterministicUnit(baseSeed + 2) * 0.05).toFixed(3);
              context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
              context.fillRect(x, y, 2, 2);
            }
          } else {
            context.save();
            if (phase === 'target-preview') {
              context.filter = 'blur(2.2px) brightness(0.72) contrast(1.15) saturate(0.78)';
            } else if (isPreMatchPhase) {
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
          }

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
              const baseSeed = frameTick * 577 + i * 97 + 41;
              const x = Math.floor(deterministicUnit(baseSeed) * canvas.width);
              const y = Math.floor(deterministicUnit(baseSeed + 1) * canvas.height);
              const alpha = (deterministicUnit(baseSeed + 2) * 0.1).toFixed(3);
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

        for (const seededTarget of seededTargets) {
          const entry = payload.entries.find(
            (candidate) => candidate?.concertId === seededTarget.concertId
          );
          if (!entry) {
            continue;
          }

          const existing = Array.isArray(entry.phash) ? entry.phash : [];
          entry.phash = [
            seededTarget.seededHash,
            ...existing.filter((hash) => hash !== seededTarget.seededHash),
          ];
        }

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
      seededImageDataUrls: targetImageDataUrls,
      seededTargets: allTargets.map((target, index) => ({
        concertId: target.concertId,
        seededHash: targetSeededHashes[index],
      })),
    }
  );

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /photo signal/i }).waitFor({ timeout: 10000 });

    let frameIndex = 0;
    const maxFrames = Math.max(landingFrames + captureFrames, 1);

    const saveFrame = async () => {
      if (page.isClosed()) {
        throw new Error(`Browser page closed unexpectedly before frame ${frameIndex}`);
      }

      if (frameIndex >= maxFrames) {
        return false;
      }

      const framePath = path.join(FRAME_DIR, `frame-${String(frameIndex).padStart(4, '0')}.png`);
      await page.screenshot({ path: framePath, fullPage: false });
      frameIndex += 1;
      return true;
    };

    const captureFor = async (durationMs) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < durationMs) {
        const saved = await saveFrame();
        if (!saved) {
          return false;
        }
        await page.waitForTimeout(frameDelayMs);
      }
      return true;
    };

    const captureUntil = async (condition, timeoutMs) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const saved = await saveFrame();
        if (!saved) {
          return false;
        }

        if (await condition()) {
          return true;
        }

        await page.waitForTimeout(frameDelayMs);
      }
      return false;
    };

    const waitUntil = async (condition, timeoutMs, pollMs = 120) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        if (await condition()) {
          return true;
        }
        await page.waitForTimeout(pollMs);
      }
      return false;
    };

    const captureForWithoutConcertInfo = async (durationMs) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < durationMs) {
        const infoVisible = await hasConcertDetails();
        if (infoVisible) {
          const closeButtonVisible = await page
            .getByRole('button', { name: /close concert details/i })
            .isVisible()
            .catch(() => false);

          if (closeButtonVisible) {
            await page.getByRole('button', { name: /close concert details/i }).click();
          }

          const infoHidden = await waitUntil(async () => !(await hasConcertDetails()), 1500, 80);
          if (!infoHidden) {
            return false;
          }

          await page.waitForTimeout(80);
          continue;
        }

        const saved = await saveFrame();
        if (!saved) {
          return false;
        }

        await page.waitForTimeout(frameDelayMs);
      }

      return true;
    };

    const waitForEnabledButton = async (name, timeoutMs = 6000) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const button = page.getByRole('button', { name });
        const isVisible = await button.isVisible().catch(() => false);
        if (isVisible) {
          const disabled = await button.isDisabled().catch(() => false);
          if (!disabled) {
            return button;
          }
        }
        await page.waitForTimeout(120);
      }

      throw new Error(`Button did not become enabled: ${name}`);
    };

    const tapWithHighlight = async (button) => {
      await button.evaluate((element) => {
        const target = element;
        const rect = target.getBoundingClientRect();
        const previous = {
          transition: target.style.transition,
          transform: target.style.transform,
          boxShadow: target.style.boxShadow,
          filter: target.style.filter,
          outline: target.style.outline,
          outlineOffset: target.style.outlineOffset,
        };

        const ripple = globalThis.document.createElement('div');
        ripple.style.position = 'fixed';
        ripple.style.left = `${rect.left + rect.width / 2}px`;
        ripple.style.top = `${rect.top + rect.height / 2}px`;
        ripple.style.width = '84px';
        ripple.style.height = '84px';
        ripple.style.marginLeft = '-42px';
        ripple.style.marginTop = '-42px';
        ripple.style.borderRadius = '9999px';
        ripple.style.border = '3px solid rgba(255,255,255,0.92)';
        ripple.style.background = 'rgba(124, 58, 237, 0.28)';
        ripple.style.boxShadow = '0 0 0.9rem rgba(124, 58, 237, 0.65)';
        ripple.style.pointerEvents = 'none';
        ripple.style.zIndex = '999999';
        ripple.style.transform = 'scale(0.55)';
        ripple.style.opacity = '0.95';
        ripple.style.transition = 'transform 380ms ease-out, opacity 380ms ease-out';
        globalThis.document.body.appendChild(ripple);

        globalThis.requestAnimationFrame(() => {
          ripple.style.transform = 'scale(1.35)';
          ripple.style.opacity = '0';
        });

        globalThis.setTimeout(() => {
          ripple.remove();
        }, 420);

        target.style.transition = 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease';
        target.style.transform = 'scale(0.9)';
        target.style.boxShadow =
          '0 0 0 0.2rem color-mix(in srgb, var(--color-accent, #7c3aed) 58%, transparent)';
        target.style.filter = 'brightness(1.2) saturate(1.08)';
        target.style.outline = '2px solid rgba(255,255,255,0.9)';
        target.style.outlineOffset = '1px';

        globalThis.setTimeout(() => {
          target.style.transition = previous.transition;
          target.style.transform = previous.transform;
          target.style.boxShadow = previous.boxShadow;
          target.style.filter = previous.filter;
          target.style.outline = previous.outline;
          target.style.outlineOffset = previous.outlineOffset;
        }, 360);
      });

      await button.click();
    };

    const hasConcertDetails = async () =>
      page
        .getByLabel(/concert details/i)
        .isVisible()
        .catch(() => false);

    const hasNowPlaying = async () =>
      page
        .getByLabel(/now playing controls/i)
        .isVisible()
        .catch(() => false);

    const hasDropNeedle = async () =>
      page
        .getByRole('button', { name: /drop the needle/i })
        .isVisible()
        .catch(() => false);

    const hasDropNeedleForTarget = async (target) =>
      page
        .getByRole('button', {
          name: new RegExp(`drop the needle for\\s+${escapeRegex(target.artistName)}`, 'i'),
        })
        .isVisible()
        .catch(() => false);

    const setSyntheticPhase = async (phase) => {
      const activePhase = await page.evaluate((nextPhase) => {
        if (typeof globalThis.__photoSignalDemoSetPhase === 'function') {
          globalThis.__photoSignalDemoSetPhase(nextPhase);
        }
        if (typeof globalThis.__photoSignalDemoGetPhase === 'function') {
          return globalThis.__photoSignalDemoGetPhase();
        }
        return 'unknown';
      }, phase);

      console.log(`🎥 Synthetic camera phase -> ${activePhase}`);
    };

    const setSyntheticTargetIndex = async (targetIndex) => {
      const applied = await page.evaluate((nextTargetIndex) => {
        if (typeof globalThis.__photoSignalDemoSetTargetIndex === 'function') {
          globalThis.__photoSignalDemoSetTargetIndex(nextTargetIndex);
        }
        if (typeof globalThis.__photoSignalDemoGetPhase === 'function') {
          return globalThis.__photoSignalDemoGetPhase();
        }
        return 'unknown';
      }, targetIndex);

      console.log(`🎯 Synthetic camera target index -> ${targetIndex} (phase=${applied})`);
    };

    for (let i = 0; i < landingFrames; i += 1) {
      const saved = await saveFrame();
      if (!saved) {
        break;
      }
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

    await setSyntheticPhase('pre-match');
    await setSyntheticTargetIndex(0);
    const continuedAfterPreMatch = await captureFor(preMatchMs);
    if (!continuedAfterPreMatch) {
      return;
    }

    await setSyntheticPhase('target');
    await setSyntheticTargetIndex(0);

    const firstMatchSeen = await captureUntil(
      async () => (await hasConcertDetails()) || (await hasNowPlaying()),
      20000
    );

    if (!firstMatchSeen) {
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

    await captureFor(STORY_PACING_MS.postFirstMatchHold);

    const pauseButton = await waitForEnabledButton(/^pause$/i);
    await tapWithHighlight(pauseButton);
    await captureFor(STORY_PACING_MS.postPauseHold);

    const playButton = await waitForEnabledButton(/^play$/i);
    await tapWithHighlight(playButton);
    await captureFor(STORY_PACING_MS.postPlayHold);

    const nextButton = await waitForEnabledButton(/play next track/i);
    await tapWithHighlight(nextButton);
    await captureFor(STORY_PACING_MS.postNextHold);

    await setSyntheticPhase('no-match');
    await setSyntheticTargetIndex(0);

    const closeButton = await waitForEnabledButton(/close concert details/i);
    await tapWithHighlight(closeButton);

    const closedDetails = await captureUntil(async () => !(await hasConcertDetails()), 3500);
    if (!closedDetails) {
      throw new Error('Concert details did not close after tapping close button.');
    }

    const noMatchWindowClean = await captureForWithoutConcertInfo(STORY_PACING_MS.postCloseHold);
    if (!noMatchWindowClean) {
      throw new Error('Concert info reappeared during the post-close no-match window.');
    }

    await setSyntheticPhase('target-preview');
    await setSyntheticTargetIndex(1);
    const secondTargetPreviewClean = await captureForWithoutConcertInfo(
      STORY_PACING_MS.postSecondTargetPreviewHold
    );
    if (!secondTargetPreviewClean) {
      throw new Error('Concert info reappeared during the second-target preview window.');
    }

    await setSyntheticPhase('target');

    const matchedSecondTarget = allTargets[1];
    const secondMatchSeen = await captureUntil(
      async () => await hasDropNeedleForTarget(matchedSecondTarget),
      9000
    );

    if (!secondMatchSeen) {
      const secondFailureScreenshot = path.join(FRAME_DIR, 'second-match-debug.png');
      await page.screenshot({ path: secondFailureScreenshot, fullPage: false });
      const bodySnippet = await page
        .locator('body')
        .innerText()
        .then((text) => text.replace(/\s+/g, ' ').slice(0, 500))
        .catch(() => 'unavailable');
      const activePhase = await page
        .evaluate(() =>
          typeof globalThis.__photoSignalDemoGetPhase === 'function'
            ? globalThis.__photoSignalDemoGetPhase()
            : 'unknown'
        )
        .catch(() => 'unknown');

      throw new Error(
        `Second match for expected secondary artists was not detected during demo. phase=${activePhase}, screenshot=${secondFailureScreenshot}, body=${bodySnippet}`
      );
    }

    console.log(`🎵 Second match target: ${matchedSecondTarget.artistName}`);

    let dropNeedleSeen = secondMatchSeen;

    if (!dropNeedleSeen) {
      dropNeedleSeen = await captureUntil(async () => await hasDropNeedle(), 5000);
    }

    if (!dropNeedleSeen) {
      const playButtonVisible = await page
        .getByRole('button', { name: /^play$/i })
        .isVisible()
        .catch(() => false);

      if (playButtonVisible) {
        const playButton = await waitForEnabledButton(/^play$/i);
        await tapWithHighlight(playButton);
        await captureFor(600);
        dropNeedleSeen = await captureUntil(async () => await hasDropNeedle(), 5000);
      }
    }

    if (!dropNeedleSeen) {
      throw new Error('Drop the Needle prompt was not detected after second match.');
    }

    await captureFor(STORY_PACING_MS.postSecondMatchHold);

    const dropNeedleButton = await waitForEnabledButton(
      new RegExp(`drop the needle for\\s+${escapeRegex(matchedSecondTarget.artistName)}`, 'i')
    );
    await tapWithHighlight(dropNeedleButton);
    await captureFor(STORY_PACING_MS.postDropNeedleHold);
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

async function waitForExit(processHandle, timeoutMs) {
  if (processHandle.exitCode !== null) {
    return true;
  }

  return await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    processHandle.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function stopPreviewServer(preview) {
  const killGroup = (signal) => {
    const pid = preview.pid;
    if (!pid) {
      return;
    }

    try {
      process.kill(-pid, signal);
    } catch {
      // Process group may already be gone
    }
  };

  killGroup('SIGTERM');
  const stoppedAfterTerm = await waitForExit(preview, 2000);
  if (!stoppedAfterTerm) {
    killGroup('SIGKILL');
    await waitForExit(preview, 1500);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.skipBuild) {
    run('npm', ['run', 'build']);
  }

  await ensureEmptyFrameDir();

  const preview = startPreviewServer();
  const previewStderrBuffer = [];
  preview.stdout.on('data', (chunk) => process.stdout.write(chunk.toString()));
  preview.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    previewStderrBuffer.push(text);
    process.stderr.write(text);
  });

  try {
    await waitForServer(BASE_URL, preview, previewStderrBuffer);
    await captureDemoFrames(options);
    buildGif(options.fps, options.outputWidth);
    console.log(`\n✅ Demo GIF generated: ${OUTPUT_GIF}`);
  } finally {
    await stopPreviewServer(preview);

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
