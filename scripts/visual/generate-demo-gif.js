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
const VIDEO_SAMPLE_DIR = path.resolve(ROOT, 'assets/test-videos/phone-samples');
const VIDEO_SAMPLE_MANIFEST_PATH = path.resolve(VIDEO_SAMPLE_DIR, 'samples.manifest.json');
const HALF_SPEED_VIDEO_DIR = path.resolve(VIDEO_SAMPLE_DIR, 'half-speed');
const DEMO_VIDEO_ROUTE_PREFIX = '/__demo-video/';

const DEFAULT_LANDING_FRAMES = 15;
const DEFAULT_CAPTURE_FRAMES = 220;
const DEFAULT_FRAME_DELAY_MS = 80;
const DEFAULT_FPS = 12;
const DEFAULT_PRE_MATCH_MS = 1400;
const DEFAULT_VIEWPORT_WIDTH = 412;
const DEFAULT_VIEWPORT_HEIGHT = 915;
const DEFAULT_OUTPUT_WIDTH = 480;

const STORY_PACING_MS = {
  postFirstMatchHold: 4000,
  controlTapGap: 4000,
  secondTargetWarmup: 1400,
  secondTargetWarmupPadding: 700,
  secondTargetMatchPadding: 1200,
  postSecondMatchHold: 3000,
  postSwitchArtistHold: 4000,
  fadeToBlack: 1200,
};

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

function isPathInside(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function getMimeTypeForVideo(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

function parseByteRange(rangeHeader, totalSize) {
  if (!rangeHeader) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const [, startRaw, endRaw] = match;
  if (startRaw === '' && endRaw === '') {
    return null;
  }

  let start;
  let end;

  if (startRaw === '') {
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(totalSize - suffixLength, 0);
    end = totalSize - 1;
  } else {
    start = Number(startRaw);
    end = endRaw === '' ? totalSize - 1 : Number(endRaw);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  if (start < 0 || end < start || start >= totalSize) {
    return null;
  }

  end = Math.min(end, totalSize - 1);
  return { start, end };
}

function resolvePhotoPath(imageFile) {
  const relative = String(imageFile ?? '').replace(/^\//, '');
  const absolute = path.resolve(ROOT, relative);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Demo photo not found on disk: ${absolute}`);
  }

  return absolute;
}

function readFileRange(filePath, start, end) {
  const length = end - start + 1;
  const body = Buffer.alloc(length);
  const fd = fs.openSync(filePath, 'r');
  let offset = 0;
  let position = start;
  try {
    while (offset < length) {
      const bytesRead = fs.readSync(fd, body, offset, length - offset, position);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
      position += bytesRead;
    }
  } finally {
    fs.closeSync(fd);
  }
  if (offset < length) {
    return body.subarray(0, offset);
  }
  return body;
}

function prepareHalfSpeedVideo(sourceVideoPath, outputPath) {
  run('ffmpeg', [
    '-y',
    '-i',
    sourceVideoPath,
    '-an',
    '-r',
    '24',
    '-vf',
    'setpts=2*PTS,scale=960:-2:flags=lanczos,format=yuv420p',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '2M',
    outputPath,
  ]);
}

function prepareHalfSpeedReverseVideo(sourceVideoPath, outputPath) {
  run('ffmpeg', [
    '-y',
    '-i',
    sourceVideoPath,
    '-an',
    '-r',
    '24',
    '-vf',
    'reverse,setpts=2*PTS,scale=960:-2:flags=lanczos,format=yuv420p',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '2M',
    outputPath,
  ]);
}

function getHalfSpeedVideoPath(sourceVideoPath) {
  const baseName = path.basename(sourceVideoPath, path.extname(sourceVideoPath));
  return path.join(HALF_SPEED_VIDEO_DIR, `${baseName}.half.webm`);
}

function getHalfSpeedReverseVideoPath(sourceVideoPath) {
  const baseName = path.basename(sourceVideoPath, path.extname(sourceVideoPath));
  return path.join(HALF_SPEED_VIDEO_DIR, `${baseName}.half.reverse.webm`);
}

function ensureHalfSpeedVideo(sourceVideoPath) {
  fs.mkdirSync(HALF_SPEED_VIDEO_DIR, { recursive: true });
  const outputPath = getHalfSpeedVideoPath(sourceVideoPath);

  if (fs.existsSync(outputPath)) {
    const sourceStat = fs.statSync(sourceVideoPath);
    const outputStat = fs.statSync(outputPath);
    if (outputStat.mtimeMs >= sourceStat.mtimeMs && outputStat.size > 0) {
      return outputPath;
    }
  }

  prepareHalfSpeedVideo(sourceVideoPath, outputPath);
  return outputPath;
}

function ensureHalfSpeedReverseVideo(sourceVideoPath) {
  fs.mkdirSync(HALF_SPEED_VIDEO_DIR, { recursive: true });
  const outputPath = getHalfSpeedReverseVideoPath(sourceVideoPath);

  if (fs.existsSync(outputPath)) {
    const sourceStat = fs.statSync(sourceVideoPath);
    const outputStat = fs.statSync(outputPath);
    if (outputStat.mtimeMs >= sourceStat.mtimeMs && outputStat.size > 0) {
      return outputPath;
    }
  }

  prepareHalfSpeedReverseVideo(sourceVideoPath, outputPath);
  return outputPath;
}

function getVideoDurationMs(videoPath) {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', videoPath],
    { cwd: ROOT, encoding: 'utf8' }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to read video duration via ffprobe: ${videoPath}`);
  }

  const seconds = Number.parseFloat(String(result.stdout ?? '').trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Invalid video duration from ffprobe: ${videoPath}`);
  }

  return Math.floor(seconds * 1000);
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

function pickTwoSingleCaptureTargets(samples, usableByConcertId) {
  const singleCaptureTargets = [];

  samples.forEach((sample, sampleIndex) => {
    const captures = Array.isArray(sample?.captures) ? sample.captures : [];
    if (captures.length !== 1) {
      return;
    }

    const capture = captures[0];
    const sampleLabel = `samples[${sampleIndex}]`;
    const concertId = capture?.concertId;
    const photoId = capture?.photoId;

    if (!Number.isFinite(Number(concertId))) {
      throw new Error(`Manifest ${sampleLabel}.captures[0] is missing a numeric concertId.`);
    }

    if (!photoId) {
      throw new Error(`Manifest ${sampleLabel}.captures[0] is missing photoId.`);
    }

    const mappedEntry = usableByConcertId.get(String(concertId));
    if (!mappedEntry) {
      throw new Error(
        `Manifest ${sampleLabel}.captures[0] references unknown or non-usable concertId: ${concertId}.`
      );
    }

    if (String(photoId) !== String(mappedEntry.photoId)) {
      throw new Error(
        `Manifest ${sampleLabel}.captures[0] photoId mismatch. Expected ${mappedEntry.photoId}, received ${photoId}.`
      );
    }

    const filename = String(sample?.filename ?? '').trim();
    if (!filename) {
      throw new Error(`Missing filename in ${sampleLabel} in ${VIDEO_SAMPLE_MANIFEST_PATH}.`);
    }

    const sourceVideoPath = path.resolve(VIDEO_SAMPLE_DIR, filename);
    if (!isPathInside(VIDEO_SAMPLE_DIR, sourceVideoPath)) {
      throw new Error(`Invalid filename path traversal in ${sampleLabel}: ${filename}`);
    }

    if (!fs.existsSync(sourceVideoPath)) {
      throw new Error(
        `Video sample file not found: ${sourceVideoPath}. Place the sample videos under ${VIDEO_SAMPLE_DIR}.`
      );
    }

    singleCaptureTargets.push({
      ...mappedEntry,
      sampleId: String(sample?.sampleId ?? `sample-${String(sampleIndex + 1).padStart(2, '0')}`),
      sourceVideoPath,
      photoPath: resolvePhotoPath(mappedEntry.imageFile),
      sourceDurationMs: getVideoDurationMs(sourceVideoPath),
    });
  });

  if (singleCaptureTargets.length < 2) {
    throw new Error(
      `Need at least 2 single-capture samples in ${VIDEO_SAMPLE_MANIFEST_PATH} for demo GIF generation.`
    );
  }

  const firstTarget = singleCaptureTargets[0];
  const secondTarget =
    singleCaptureTargets.find((candidate) => candidate.artistId !== firstTarget.artistId) ??
    singleCaptureTargets[1];

  if (!secondTarget) {
    throw new Error('Could not choose a second single-capture target from manifest.');
  }

  return [firstTarget, secondTarget];
}

function resolveManifestVideoSources(samples) {
  const sources = [];
  const seen = new Set();
  const seenBaseNames = new Map();

  samples.forEach((sample, sampleIndex) => {
    const sampleLabel = `samples[${sampleIndex}]`;
    const filename = String(sample?.filename ?? '').trim();

    if (!filename) {
      throw new Error(`Missing filename in ${sampleLabel} in ${VIDEO_SAMPLE_MANIFEST_PATH}.`);
    }

    const sourceVideoPath = path.resolve(VIDEO_SAMPLE_DIR, filename);
    if (!isPathInside(VIDEO_SAMPLE_DIR, sourceVideoPath)) {
      throw new Error(`Invalid filename path traversal in ${sampleLabel}: ${filename}`);
    }

    if (!fs.existsSync(sourceVideoPath)) {
      throw new Error(
        `Video sample file not found: ${sourceVideoPath}. Place the sample videos under ${VIDEO_SAMPLE_DIR}.`
      );
    }

    if (!seen.has(sourceVideoPath)) {
      const baseName = path.basename(sourceVideoPath, path.extname(sourceVideoPath));
      const existingPath = seenBaseNames.get(baseName);
      if (existingPath && existingPath !== sourceVideoPath) {
        throw new Error(
          `Duplicate sample basename detected (${baseName}) between ${existingPath} and ${sourceVideoPath}. Rename one file to keep half-speed outputs unique.`
        );
      }
      seenBaseNames.set(baseName, sourceVideoPath);
      seen.add(sourceVideoPath);
      sources.push(sourceVideoPath);
    }
  });

  return sources;
}

function resolveDemoTargets() {
  if (!fs.existsSync(VIDEO_SAMPLE_MANIFEST_PATH)) {
    throw new Error(
      `Video sample manifest missing at ${VIDEO_SAMPLE_MANIFEST_PATH}. This demo flow now requires manifest video clips.`
    );
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(VIDEO_SAMPLE_MANIFEST_PATH, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not parse video sample manifest at ${VIDEO_SAMPLE_MANIFEST_PATH}: ${message}`
    );
  }

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
        photoId: entry.photoId,
        imageFile: photo.imageFile,
      };
    })
    .filter(Boolean);

  const usableByConcertId = new Map(usableEntries.map((entry) => [String(entry.concertId), entry]));
  const samples = Array.isArray(manifest?.samples) ? manifest.samples : [];

  if (samples.length < 2) {
    throw new Error(
      `Expected at least 2 samples in ${VIDEO_SAMPLE_MANIFEST_PATH}, found ${samples.length}.`
    );
  }

  const manifestVideoSources = resolveManifestVideoSources(samples);

  const cameraTargets = pickTwoSingleCaptureTargets(samples, usableByConcertId);

  return {
    firstTarget: cameraTargets[0],
    secondTarget: cameraTargets[1],
    manifestVideoSources,
    sourceMode: 'video-clips-camera-feed',
  };
}

async function ensureEmptyFrameDir() {
  fs.rmSync(FRAME_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAME_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function captureDemoFrames(options) {
  const { landingFrames, captureFrames, frameDelayMs, preMatchMs, viewportWidth, viewportHeight } =
    options;

  const { firstTarget, secondTarget, manifestVideoSources, sourceMode } = resolveDemoTargets();
  const cameraTargets = [firstTarget, secondTarget];
  const targetSeededHashes = await Promise.all(
    cameraTargets.map(async (target) => computeSeededMatchHash(target.photoPath))
  );

  const halfSpeedMap = new Map(
    manifestVideoSources.map((sourcePath) => [sourcePath, ensureHalfSpeedVideo(sourcePath)])
  );

  const preparedCameraTargets = cameraTargets.map((target) => {
    const preparedPath = halfSpeedMap.get(target.sourceVideoPath);
    if (!preparedPath) {
      throw new Error(`Missing half-speed video for ${target.sourceVideoPath}`);
    }
    return {
      ...target,
      sourceVideoPath: preparedPath,
    };
  });

  const reverseSecondTargetPath = ensureHalfSpeedReverseVideo(secondTarget.sourceVideoPath);
  const preparedReverseSecondTarget = {
    ...secondTarget,
    sourceVideoPath: reverseSecondTargetPath,
  };

  console.log(
    `🎬 Demo targets (${sourceMode}): ${firstTarget.artistName} -> ${secondTarget.artistName}`
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

  const routeToVideoPath = new Map();
  const targetVideoInputs = [...preparedCameraTargets, preparedReverseSecondTarget];
  const targetVideoUrls = targetVideoInputs.map((target, index) => {
    const routePath = `${DEMO_VIDEO_ROUTE_PREFIX}${index}-${path.basename(target.sourceVideoPath)}`;
    routeToVideoPath.set(routePath, target.sourceVideoPath);
    return routePath;
  });

  await page.route(`**${DEMO_VIDEO_ROUTE_PREFIX}*`, async (route) => {
    const requestUrl = route.request().url();
    const pathname = new URL(requestUrl).pathname;
    const sourceVideoPath = routeToVideoPath.get(pathname);

    if (!sourceVideoPath) {
      await route.abort();
      return;
    }

    const stats = fs.statSync(sourceVideoPath);
    const totalSize = stats.size;
    const rangeHeader = route.request().headers()['range'];
    const byteRange = parseByteRange(rangeHeader, totalSize);

    if (rangeHeader && !byteRange) {
      await route.fulfill({
        status: 416,
        headers: {
          'Content-Range': `bytes */${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      });
      return;
    }

    if (byteRange) {
      const { start, end } = byteRange;
      const body = readFileRange(sourceVideoPath, start, end);
      await route.fulfill({
        status: 206,
        body,
        contentType: getMimeTypeForVideo(sourceVideoPath),
        headers: {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': String(body.length),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      });
      return;
    }

    const body = fs.readFileSync(sourceVideoPath);
    await route.fulfill({
      status: 200,
      body,
      contentType: getMimeTypeForVideo(sourceVideoPath),
      headers: {
        'Content-Length': String(totalSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    });
  });

  await page.addInitScript(
    ({ videoUrls, seededTargets }) => {
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
        targetIndex: 0,
        phase: 'search',
      };

      globalThis.__photoSignalDemoSetTargetIndex = (nextIndex) => {
        if (typeof nextIndex === 'number' && Number.isFinite(nextIndex)) {
          const normalized = Math.max(0, Math.min(Math.floor(nextIndex), videoUrls.length - 1));
          demoState.targetIndex = normalized;
        }
      };

      globalThis.__photoSignalDemoSetPhase = (nextPhase) => {
        if (nextPhase === 'search' || nextPhase === 'target') {
          demoState.phase = nextPhase;
        }
      };

      const waitForVideoLoaded = (video) =>
        new Promise((resolve, reject) => {
          const onLoaded = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error('Failed to load demo video stream source'));
          };
          const cleanup = () => {
            video.removeEventListener('loadeddata', onLoaded);
            video.removeEventListener('error', onError);
          };

          if (video.readyState >= 2) {
            resolve();
            return;
          }

          video.addEventListener('loadeddata', onLoaded, { once: true });
          video.addEventListener('error', onError, { once: true });
        });

      const createVideoCameraStream = async () => {
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 640;
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Failed to create camera canvas context');
        }

        const videos = [];
        for (const videoUrl of videoUrls) {
          const video = globalThis.document.createElement('video');
          video.src = videoUrl;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = 'auto';
          await waitForVideoLoaded(video);
          videos.push(video);
        }

        let activeIndex = -1;

        const setActiveVideo = async (nextIndex) => {
          if (nextIndex === activeIndex) {
            return;
          }

          if (activeIndex >= 0) {
            videos[activeIndex].pause();
          }

          activeIndex = nextIndex;
          const activeVideo = videos[activeIndex];
          activeVideo.currentTime = 0;
          activeVideo.playbackRate = 1;
          try {
            await activeVideo.play();
          } catch {
            // ignore autoplay restrictions in headless mode
          }
        };

        await setActiveVideo(0);

        const drawCoverFrame = (video) => {
          const targetAspect = canvas.width / canvas.height;
          const videoAspect = video.videoWidth / video.videoHeight;

          let sourceWidth = video.videoWidth;
          let sourceHeight = video.videoHeight;
          let sourceX = 0;
          let sourceY = 0;

          if (videoAspect > targetAspect) {
            sourceHeight = video.videoHeight;
            sourceWidth = sourceHeight * targetAspect;
            sourceX = (video.videoWidth - sourceWidth) / 2;
          } else {
            sourceWidth = video.videoWidth;
            sourceHeight = sourceWidth / targetAspect;
            sourceY = (video.videoHeight - sourceHeight) / 2;
          }

          context.drawImage(
            video,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height
          );
        };

        const render = () => {
          const desiredIndex = Math.max(0, Math.min(demoState.targetIndex, videos.length - 1));
          if (desiredIndex !== activeIndex) {
            void setActiveVideo(desiredIndex);
          }

          context.clearRect(0, 0, canvas.width, canvas.height);
          const isSearchPhase = demoState.phase === 'search';

          const activeVideo = videos[Math.max(activeIndex, 0)];
          if (activeVideo && activeVideo.readyState >= 2) {
            context.save();
            if (isSearchPhase) {
              context.filter = 'blur(1.8px) brightness(0.72) contrast(1.08) saturate(0.92)';
            }
            drawCoverFrame(activeVideo);
            context.restore();
          }

          if (isSearchPhase) {
            const time = globalThis.performance.now() / 1000;
            const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, 'rgba(18, 20, 28, 0.18)');
            gradient.addColorStop(1, 'rgba(34, 36, 46, 0.14)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, canvas.width, canvas.height);

            const scanHeight = Math.round(canvas.height * 0.18);
            const scanY = Math.round(((time * 95) % (canvas.height + scanHeight)) - scanHeight);
            const scanGradient = context.createLinearGradient(0, scanY, 0, scanY + scanHeight);
            scanGradient.addColorStop(0, 'rgba(95, 211, 179, 0.0)');
            scanGradient.addColorStop(0.5, 'rgba(95, 211, 179, 0.16)');
            scanGradient.addColorStop(1, 'rgba(95, 211, 179, 0.0)');
            context.fillStyle = scanGradient;
            context.fillRect(0, scanY, canvas.width, scanHeight);
          }

          globalThis.requestAnimationFrame(render);
        };

        globalThis.requestAnimationFrame(render);
        return canvas.captureStream(24);
      };

      if (navigator.mediaDevices?.getUserMedia) {
        const streamPromise = createVideoCameraStream();

        navigator.mediaDevices.getUserMedia = async () => {
          return await streamPromise;
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
      videoUrls: targetVideoUrls,
      seededTargets: preparedCameraTargets.map((target, index) => ({
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

    const hasArtistText = async (artistName) => {
      const bodyText = await page
        .locator('body')
        .innerText()
        .then((text) => text.replace(/\s+/g, ' '))
        .catch(() => '');
      return new RegExp(String(artistName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(
        bodyText
      );
    };

    const hasArtistMatchState = async (artistName) => {
      const artistVisible = await hasArtistText(artistName);
      if (!artistVisible) {
        return false;
      }

      return (await hasConcertDetails()) || (await hasNowPlaying());
    };

    const ensurePlaybackActive = async () => {
      const playButton = page.getByRole('button', { name: /^play$/i });
      const playVisible = await playButton.isVisible().catch(() => false);
      if (playVisible) {
        const disabled = await playButton.isDisabled().catch(() => false);
        if (!disabled) {
          await playButton.click();
          await captureFor(900);
        }
      }
    };

    const waitForEnabledButton = async (name, timeoutMs = 7000) => {
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

    const isSwitchArtistVisible = async () =>
      page
        .getByRole('button', { name: /switch artist|drop the needle/i })
        .isVisible()
        .catch(() => false);

    const setCameraTargetIndex = async (targetIndex) => {
      await page.evaluate((nextTargetIndex) => {
        if (typeof globalThis.__photoSignalDemoSetTargetIndex === 'function') {
          globalThis.__photoSignalDemoSetTargetIndex(nextTargetIndex);
        }
      }, targetIndex);

      console.log(`🎯 Camera clip target index -> ${targetIndex}`);
    };

    const setCameraPhase = async (phase) => {
      await page.evaluate((nextPhase) => {
        if (typeof globalThis.__photoSignalDemoSetPhase === 'function') {
          globalThis.__photoSignalDemoSetPhase(nextPhase);
        }
      }, phase);
      console.log(`🎥 Camera phase -> ${phase}`);
    };

    const activateButton = page.getByRole('button', {
      name: /activate camera and begin experience/i,
    });

    for (let i = 0; i < landingFrames; i += 1) {
      const saved = await saveFrame();
      if (!saved) {
        break;
      }
      await page.waitForTimeout(frameDelayMs);
    }

    await activateButton.click();

    const hasVideo = await page
      .locator('video')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!hasVideo) {
      throw new Error('Camera video element did not become visible after activation.');
    }

    await setCameraPhase('search');
    await setCameraTargetIndex(0);
    const firstSceneMaxMs = Math.max(1200, firstTarget.sourceDurationMs * 2 - 200);
    const firstSearchWarmupMs = Math.min(preMatchMs, Math.max(firstSceneMaxMs - 600, 900));

    const continuedAfterWarmup = await captureFor(firstSearchWarmupMs);
    if (!continuedAfterWarmup) {
      return;
    }

    await setCameraPhase('target');

    const firstMatchSeen = await captureUntil(
      async () => await hasArtistMatchState(firstTarget.artistName),
      firstSceneMaxMs
    );

    if (!firstMatchSeen) {
      throw new Error(`First target did not match for artist ${firstTarget.artistName}.`);
    }

    await captureFor(STORY_PACING_MS.postFirstMatchHold);

    const stopButton = await waitForEnabledButton(/^pause$|^stop$/i);
    await stopButton.click();
    await captureFor(STORY_PACING_MS.controlTapGap);

    const playButton = await waitForEnabledButton(/^play$/i);
    await playButton.click();
    await captureFor(STORY_PACING_MS.controlTapGap);

    const previousButton = await waitForEnabledButton(/play previous track|previous track/i);
    await previousButton.click();
    await captureFor(STORY_PACING_MS.controlTapGap);

    const nextButton = await waitForEnabledButton(/play next track|next track/i);
    await nextButton.click();
    await captureFor(STORY_PACING_MS.controlTapGap);

    const closeButton = page.getByRole('button', {
      name: /next pic, please|close concert details/i,
    });
    const closeButtonVisible = await closeButton.isVisible().catch(() => false);
    if (closeButtonVisible) {
      await closeButton.click();
      await page
        .getByLabel(/concert details/i)
        .waitFor({ state: 'hidden', timeout: 3000 })
        .catch(() => null);
    }

    await setCameraPhase('search');
    await setCameraTargetIndex(1);
    const secondSceneMaxMs = Math.max(
      1200,
      secondTarget.sourceDurationMs * 2 - 200 + STORY_PACING_MS.secondTargetMatchPadding
    );
    const secondWarmupMs = Math.min(
      STORY_PACING_MS.secondTargetWarmup + STORY_PACING_MS.secondTargetWarmupPadding,
      secondSceneMaxMs
    );
    await captureFor(secondWarmupMs);
    await setCameraPhase('target');

    const secondMatchSeen = await captureUntil(
      async () => await hasArtistMatchState(secondTarget.artistName),
      secondSceneMaxMs
    );

    if (!secondMatchSeen) {
      throw new Error(`Second target did not match for artist ${secondTarget.artistName}.`);
    }

    await captureFor(STORY_PACING_MS.postSecondMatchHold);

    await ensurePlaybackActive();

    let hasSwitchArtist = await isSwitchArtistVisible();
    if (!hasSwitchArtist) {
      await setCameraTargetIndex(1);
      await captureFor(500);
      await setCameraTargetIndex(2);
      await captureFor(900);
      hasSwitchArtist = await captureUntil(async () => await isSwitchArtistVisible(), 6000);
    }

    if (!hasSwitchArtist) {
      console.warn('⚠️ Scene 8: Switch Artist button not visible; skipping press and proceeding.');
    } else {
      const switchArtistButton = await waitForEnabledButton(/switch artist|drop the needle/i, 4000);
      await switchArtistButton.click();
      await captureFor(STORY_PACING_MS.postSwitchArtistHold);
    }

    await page.evaluate(() => {
      const existing = globalThis.document.querySelector('[data-demo-fade="true"]');
      if (existing) {
        existing.remove();
      }

      const fade = globalThis.document.createElement('div');
      fade.setAttribute('data-demo-fade', 'true');
      fade.style.position = 'fixed';
      fade.style.left = '0';
      fade.style.top = '0';
      fade.style.width = '100vw';
      fade.style.height = '100vh';
      fade.style.background = '#000';
      fade.style.opacity = '0';
      fade.style.pointerEvents = 'none';
      fade.style.zIndex = '999999';
      fade.style.transition = 'opacity 1100ms linear';
      globalThis.document.body.appendChild(fade);

      globalThis.requestAnimationFrame(() => {
        fade.style.opacity = '1';
      });
    });
    await captureFor(STORY_PACING_MS.fadeToBlack);
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
