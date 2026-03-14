#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium, devices } from '@playwright/test';
import { loadImageData, computePHash } from '../lib/photoHashUtils.js';

// ── Output Configuration ─────────────────────────────────────────────────────
// Edit these constants to tune the quality and dimensions of the output files.

const VIEWPORT_WIDTH = 412;
const VIEWPORT_HEIGHT = 915;

// GIF — frame capture rate also sets GIF playback speed
const CAPTURE_FPS = 12; // frames per second captured + played back in GIF
const CAPTURE_DELAY_MS = Math.round(1000 / CAPTURE_FPS); // ~83ms per frame
const GIF_OUTPUT_WIDTH = 480; // pixels wide; height is auto-calculated

// MP4 — higher quality, smooth screen-capture feel (no frame-rate cap from GIF)
const MP4_CRF = 18; // H.264 quality: 0 = lossless, 51 = worst (18 = high quality)
const MP4_PRESET = 'medium'; // encode speed: slower = better compression
const MP4_AUDIO_BITRATE = '128k'; // AAC audio bitrate

// ── Story Timing ─────────────────────────────────────────────────────────────
// All three search scenes and all three match-hold scenes use the same durations.

const LANDING_DURATION_MS = 2400; // hold on landing screen before activating camera
const SEARCH_DURATION_MS = 4000; // haze-clear window per photo (≥4s for viewer readability)
const MATCH_HOLD_MS = 6000; // show concert info after each recognition
const CONTROL_TAP_PAUSE_MS = 3000; // pause between audio control interactions (full demo only)
const SWITCH_ARTIST_HOLD_MS = 6000; // hold after tapping Switch Artist (full demo only)
const FADE_DURATION_MS = 2000; // closing fade to black

// Test mode — shorter landing only; recognition timing stays the same
const TEST_LANDING_DURATION_MS = 500;
const TEST_MATCH_HOLD_MS = 1000;

// ── Internal Limits ──────────────────────────────────────────────────────────
const MIN_STORY_FRAMES = 900; // safety cap: full demo at ~700 frames expected
const MIN_TEST_FRAMES = 150; // safety cap: fast test at ~110 frames expected
const MIN_MAX_VOLUME_DB = -80; // test mode MP4 audio loudness gate (dB)

// ── Path Constants ───────────────────────────────────────────────────────────
const ROOT = process.cwd();
const BASE_URL = 'http://127.0.0.1:4173';
const FRAME_DIR = path.resolve(ROOT, 'scripts/visual/output/demo-frames');
const OUTPUT_DIR = path.resolve(ROOT, 'docs/media');
const DEFAULT_OUTPUT_GIF = path.resolve(OUTPUT_DIR, 'demo.gif');
const DEFAULT_OUTPUT_MP4 = path.resolve(OUTPUT_DIR, 'demo.mp4');
const VIDEO_OUTPUT_DIR = path.resolve(ROOT, 'scripts/visual/output/video');
const AUDIO_LOCAL_DIR = path.resolve(ROOT, 'scripts/visual/output/audio');
const VIDEO_SAMPLE_DIR = path.resolve(ROOT, 'assets/test-videos/phone-samples');
const VIDEO_SAMPLE_MANIFEST_PATH = path.resolve(VIDEO_SAMPLE_DIR, 'samples.manifest.json');
const HALF_SPEED_VIDEO_DIR = path.resolve(VIDEO_SAMPLE_DIR, 'half-speed');
const DEMO_VIDEO_ROUTE_PREFIX = '/__demo-video/';

// ── Demo Timeline Spec ────────────────────────────────────────────────────────
//
// FULL DEMO  (npm run demo:gif)
//
//  0. Landing     ~2.4s blank intro screen
//  1. Search #1   Camera activates. Photo of Overcoats visible.
//                 Haze clears over 4s as the app "focuses" → recognition fires
//  2. Match #1    Concert info displayed — 6s
//  3. Controls    Tap Stop → Play → Previous → Next (3s pause between each)
//  4. Transition  Close details, dim flash, new photo in frame
//  5. Search #2   Sean Barna photo. Haze clears 4s → recognition fires
//  6. Match #2    Concert info displayed — 6s
//  7. Transition  Close details, dim flash, new photo in frame
//  8. Search #3   Croy and the Boys photo. Haze clears 4s → recognition fires
//  9. Match #3    Concert info displayed — 6s
// 10. Switch      Tap "Switch Artist", new track starts — 6s
// 11. Fade        Fade to black — 2s
//
// FAST TEST  (npm run demo:gif:test)
//
//  Validates: app loads, camera feed serves, recognition fires,
//             audio downloads, GIF builds, MP4 with audio builds
//
//  0. Landing     ~0.5s
//  1. Search #1   Haze clears 4s → recognition fires
//  2. Match #1    1s hold
//  3. Fade        1s
//
// Edit this spec first when changing the demo story, then mirror in the
// story functions below (runFastTestStory / runFullDemoStory).
// ─────────────────────────────────────────────────────────────────────────────

// ── CLI Parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const parsed = { skipBuild: false, testMode: false };
  for (const arg of argv) {
    if (arg === '--skip-build') parsed.skipBuild = true;
    if (arg === '--test') {
      parsed.testMode = true;
      parsed.skipBuild = true;
    }
  }
  return parsed;
}

function getOutputPaths(testMode) {
  if (!testMode) {
    return { gifPath: DEFAULT_OUTPUT_GIF, mp4Path: DEFAULT_OUTPUT_MP4 };
  }

  const now = new Date();
  const pad2 = (v) => String(v).padStart(2, '0');
  const pad3 = (v) => String(v).padStart(3, '0');
  const stamp = [
    now.getUTCFullYear(),
    pad2(now.getUTCMonth() + 1),
    pad2(now.getUTCDate()),
    '-',
    pad2(now.getUTCHours()),
    pad2(now.getUTCMinutes()),
    pad2(now.getUTCSeconds()),
    '-',
    pad3(now.getUTCMilliseconds()),
  ].join('');

  return {
    gifPath: path.resolve(OUTPUT_DIR, `demo-test-${stamp}.gif`),
    mp4Path: path.resolve(OUTPUT_DIR, `demo-test-${stamp}.mp4`),
  };
}

// ── FFmpeg / Media Utilities ─────────────────────────────────────────────────

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options });
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
  if (!text) return 'No stderr output from preview process.';
  return text.split('\n').slice(-8).join('\n');
}

function readMediaDurationSeconds(mediaPath) {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      mediaPath,
    ],
    { cwd: ROOT, encoding: 'utf8' }
  );
  if (result.error || result.status !== 0) return null;
  const parsed = Number.parseFloat((result.stdout ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readMaxVolumeDb(mediaPath) {
  const nullSink = process.platform === 'win32' ? 'NUL' : '/dev/null';
  const result = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', mediaPath, '-af', 'volumedetect', '-f', 'null', nullSink],
    { cwd: ROOT, encoding: 'utf8' }
  );
  const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (/max_volume:\s*(-inf)\s*dB/i.test(combined)) return Number.NEGATIVE_INFINITY;
  const m = /max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i.exec(combined);
  if (!m) return null;
  const parsed = Number.parseFloat(m[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Builds the demo GIF from captured frames using a two-pass FFmpeg palette strategy.
 * Output width and frame rate come from the module-level Output Configuration constants.
 */
function buildGif(outputGifPath) {
  const palettePath = path.resolve(FRAME_DIR, 'palette.png');
  const framePattern = path.join(FRAME_DIR, 'frame-%04d.png');

  run('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-framerate',
    String(CAPTURE_FPS),
    '-i',
    framePattern,
    '-vf',
    'palettegen=stats_mode=full',
    palettePath,
  ]);

  run('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-thread_queue_size',
    '512',
    '-framerate',
    String(CAPTURE_FPS),
    '-i',
    framePattern,
    '-i',
    palettePath,
    '-lavfi',
    `fps=${CAPTURE_FPS},scale=${GIF_OUTPUT_WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a`,
    outputGifPath,
  ]);
}

/**
 * Builds the demo MP4 from Playwright's raw video recording plus an optional
 * audio file. No speed retiming — the Playwright recording captures real-time
 * pacing so the output is inherently smooth. Audio is trimmed to video length.
 */
function buildMp4(rawVideoPath, audioPath, outputPath, audioOffsetSec = 0) {
  const hasAudio = Boolean(audioPath && fs.existsSync(audioPath));

  // libx264 requires even pixel dimensions. fps=fps=30 normalises the variable-rate
  // Playwright WebM to a constant 30 fps so the output plays back without judder.
  const videoFilter = 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=fps=30';

  const args = ['-loglevel', 'error', '-y', '-i', rawVideoPath];
  if (hasAudio) {
    // Delay audio start to match when audio capture began relative to recording start.
    // The captured audio file starts at t=0 (capture start), but recording began
    // earlier (before camera activation). audioOffsetSec bridges the gap.
    if (audioOffsetSec > 0) {
      args.push('-itsoffset', audioOffsetSec.toFixed(3));
    }
    args.push('-i', audioPath);
  }
  args.push('-vf', videoFilter);
  args.push(
    '-c:v',
    'libx264',
    '-crf',
    String(MP4_CRF),
    '-preset',
    MP4_PRESET,
    '-pix_fmt',
    'yuv420p'
  );
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', MP4_AUDIO_BITRATE, '-shortest');
  args.push(outputPath);
  run('ffmpeg', args);
}

function cleanupVideoDir() {
  fs.rmSync(VIDEO_OUTPUT_DIR, { recursive: true, force: true });
}

function cleanup() {
  fs.rmSync(FRAME_DIR, { recursive: true, force: true });
}

// ── Video Preparation ────────────────────────────────────────────────────────

/**
 * Reads the rotation angle (degrees) recorded in the video stream's displaymatrix
 * side-data. Returns 0 when no rotation is found.
 *
 * This is needed because `-filter_complex` in FFmpeg 5.x does NOT honour the
 * `autorotate` option — rotation must be applied explicitly in the filter chain.
 */
function getVideoRotation(videoPath) {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream_tags=rotate',
      '-of',
      'default=nw=1:nk=1',
      videoPath,
    ],
    { cwd: ROOT, encoding: 'utf8' }
  );
  const rotStr = String(result.stdout ?? '').trim();
  const rot = Number.parseInt(rotStr, 10);
  return Number.isFinite(rot) ? rot : 0;
}

function prepareHalfSpeedVideo(sourceVideoPath, outputPath) {
  // Produces a palindrome (forward + reverse at 2× slow-speed) so the video loops
  // smoothly without a jarring jump-cut, and the printed photo is visible for
  // longer per loop — giving rectangle detection more stable frames.
  // split=2 creates two copies so [fwd1] feeds concat while [fwd2] feeds reverse.
  //
  // Rotation must be corrected explicitly: -filter_complex does not honour
  // autorotate in FFmpeg 5.x, so videos recorded with displaymatrix metadata
  // (e.g. upside-down phone clips) would otherwise play inverted in the browser.
  const rotationDeg = getVideoRotation(sourceVideoPath);
  let rotationFilter = '';
  if (rotationDeg === 180 || rotationDeg === -180) {
    rotationFilter = 'hflip,vflip,';
  } else if (rotationDeg === 90 || rotationDeg === -270) {
    rotationFilter = 'transpose=1,';
  } else if (rotationDeg === -90 || rotationDeg === 270) {
    rotationFilter = 'transpose=2,';
  }

  if (rotationDeg !== 0) {
    console.log(
      `   ↻ Applying ${rotationDeg}° rotation correction to ${path.basename(sourceVideoPath)}`
    );
  }

  run('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    sourceVideoPath,
    '-filter_complex',
    `[0:v]${rotationFilter}setpts=2*PTS,scale=960:-2:flags=lanczos,format=yuv420p,split=2[fwd1][fwd2];[fwd2]reverse[rev];[fwd1][rev]concat=n=2:v=1:a=0[out]`,
    '-map',
    '[out]',
    '-r',
    '24',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '2M',
    outputPath,
  ]);
}

function getHalfSpeedVideoPath(sourceVideoPath) {
  const baseName = path.basename(sourceVideoPath, path.extname(sourceVideoPath));
  return path.join(HALF_SPEED_VIDEO_DIR, `${baseName}.2x-palindrome.webm`);
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

async function computeHashFromVideoFrame(videoPath) {
  const durationSec = getVideoDurationMs(videoPath) / 1000;
  // Seek to 30% of duration — past the haze-clearing period in palindrome files,
  // landing on a clean forward-pass frame that matches what browser recognition sees.
  const seekSec = durationSec * 0.3;
  const tmpFile = path.join(os.tmpdir(), `demo-frame-${Date.now()}.png`);
  try {
    run('ffmpeg', [
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
    ]);
    const imageData = await loadImageData(tmpFile);
    return computePHash(imageData);
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
}

// ── Data Resolution ──────────────────────────────────────────────────────────

function resolvePhotoPath(imageFile) {
  const relative = String(imageFile ?? '').replace(/^\//, '');
  const absolute = path.resolve(ROOT, relative);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Demo photo not found on disk: ${absolute}`);
  }
  return absolute;
}

function pickDemoTargets(samples, usableByConcertId, count = 3) {
  const singleCaptureTargets = [];

  samples.forEach((sample, sampleIndex) => {
    const captures = Array.isArray(sample?.captures) ? sample.captures : [];
    if (captures.length !== 1) return;

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

  if (singleCaptureTargets.length < count) {
    throw new Error(
      `Need at least ${count} single-capture samples in ${VIDEO_SAMPLE_MANIFEST_PATH} for demo GIF generation.`
    );
  }

  // Pick `count` targets, preferring distinct artists.
  const chosen = [];
  for (const candidate of singleCaptureTargets) {
    if (chosen.length >= count) break;
    if (chosen.every((c) => c.artistId !== candidate.artistId)) chosen.push(candidate);
  }
  let fillIdx = 0;
  while (chosen.length < count && fillIdx < singleCaptureTargets.length) {
    if (!chosen.includes(singleCaptureTargets[fillIdx])) chosen.push(singleCaptureTargets[fillIdx]);
    fillIdx++;
  }
  if (chosen.length < count) {
    throw new Error(`Could not choose ${count} targets from manifest.`);
  }

  return chosen;
}

function resolveDemoTargets() {
  if (!fs.existsSync(VIDEO_SAMPLE_MANIFEST_PATH)) {
    throw new Error(`Video sample manifest missing at ${VIDEO_SAMPLE_MANIFEST_PATH}.`);
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

  const tracksById = new Map(tracks.map((t) => [t.id, t]));
  const photosById = new Map(photos.map((p) => [p.id, p]));
  const artistNameById = new Map(artists.map((a) => [a.id, a.name ?? a.id]));
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

  const usableByConcertId = new Map(usableEntries.map((e) => [String(e.concertId), e]));
  const samples = Array.isArray(manifest?.samples) ? manifest.samples : [];

  if (samples.length < 3) {
    throw new Error(
      `Expected at least 3 samples in ${VIDEO_SAMPLE_MANIFEST_PATH}, found ${samples.length}.`
    );
  }

  const [firstTarget, secondTarget, thirdTarget] = pickDemoTargets(samples, usableByConcertId);
  return { firstTarget, secondTarget, thirdTarget };
}

function ensureEmptyFrameDir() {
  fs.rmSync(FRAME_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAME_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function ensureEmptyVideoDir() {
  fs.rmSync(VIDEO_OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(VIDEO_OUTPUT_DIR, { recursive: true });
  // Audio local dir persists across runs so cached downloads are reused.
  fs.mkdirSync(AUDIO_LOCAL_DIR, { recursive: true });
}

// ── Server Management ────────────────────────────────────────────────────────

function startPreviewServer() {
  return spawn(
    'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
    { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
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
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(
    `Preview server did not become ready at ${url} within ${timeoutMs}ms.\n${getStderrTail(stderrBuffer)}`
  );
}

async function waitForExit(processHandle, timeoutMs) {
  if (processHandle.exitCode !== null) return true;
  return new Promise((resolve) => {
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
    if (!pid) return;
    try {
      process.kill(-pid, signal);
    } catch {
      /* already gone */
    }
  };
  killGroup('SIGTERM');
  const stopped = await waitForExit(preview, 2000);
  if (!stopped) {
    killGroup('SIGKILL');
    await waitForExit(preview, 1500);
  }
}

// ── Browser Route Helpers ────────────────────────────────────────────────────

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
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;
  const [, startRaw, endRaw] = match;
  if (startRaw === '' && endRaw === '') return null;

  let start;
  let end;
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

function readFileRange(filePath, start, end) {
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

// ── Page Control Helpers ─────────────────────────────────────────────────────
//
// All helpers receive a `controls` object:
//   {
//     page,                         — Playwright Page
//     frameRef: { current: 0 },     — mutable frame index
//     maxFrames,                    — absolute capture cap
//     fps: CAPTURE_FPS,
//     frameDelayMs: CAPTURE_DELAY_MS,
//     preparedCameraTargets,        — for timing log labels
//     clipTimingByIndex: new Map(), — timing tracking
//   }

async function saveFrame(controls) {
  if (controls.page.isClosed()) {
    throw new Error(`Browser page closed unexpectedly before frame ${controls.frameRef.current}`);
  }
  if (controls.frameRef.current >= controls.maxFrames) return false;

  const framePath = path.join(
    FRAME_DIR,
    `frame-${String(controls.frameRef.current).padStart(4, '0')}.png`
  );
  await controls.page.screenshot({ path: framePath, fullPage: false });
  controls.frameRef.current += 1;
  return true;
}

async function captureFor(controls, durationMs) {
  const targetFrames = Math.max(1, Math.round((durationMs / 1000) * controls.fps));
  for (let i = 0; i < targetFrames; i += 1) {
    const saved = await saveFrame(controls);
    if (!saved) return false;
    await controls.page.waitForTimeout(controls.frameDelayMs);
  }
  return true;
}

async function captureUntil(controls, condition, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const saved = await saveFrame(controls);
    if (!saved) return false;
    if (await condition()) return true;
    await controls.page.waitForTimeout(controls.frameDelayMs);
  }
  return false;
}

/**
 * Injects a static tap indicator dot at the element's center, captures ~500ms
 * with the dot fully visible, removes it, then performs the click.
 *
 * No CSS transitions — Playwright headless captures snapshots between rAF ticks
 * so transition-based animation is invisible. Falls back to plain .click() if
 * the bounding box is unavailable.
 */
async function clickWithIndicator(controls, locator) {
  let box = null;
  try {
    box = await locator.boundingBox();
  } catch {
    /* element not in layout — fall back silently */
  }

  // Click FIRST so Howler responds immediately — then show the tap indicator
  // OVER the audio response. Previous order (indicator 500ms → click) made
  // the audio feel unresponsive: viewers saw the "tap" for half a second
  // before anything changed.
  await locator.click();

  if (box) {
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);

    await controls.page.evaluate(
      ({ x, y }) => {
        const stale = globalThis.document.querySelector('[data-demo-tap="true"]');
        if (stale) stale.remove();
        const dot = globalThis.document.createElement('div');
        dot.setAttribute('data-demo-tap', 'true');
        Object.assign(dot.style, {
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(95, 211, 179, 0.45)',
          border: '3px solid rgba(255, 255, 255, 0.92)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: '999999',
        });
        globalThis.document.body.appendChild(dot);
      },
      { x: cx, y: cy }
    );

    await captureFor(controls, 500);

    await controls.page.evaluate(() => {
      globalThis.document.querySelector('[data-demo-tap="true"]')?.remove();
    });
  }
}

async function hasConcertDetails(page) {
  return page
    .getByLabel(/concert details/i)
    .isVisible()
    .catch(() => false);
}

async function hasNowPlaying(page) {
  return page
    .getByLabel(/now playing controls/i)
    .isVisible()
    .catch(() => false);
}

async function hasArtistText(page, artistName) {
  const bodyText = await page
    .locator('body')
    .innerText()
    .then((text) => text.replace(/\s+/g, ' '))
    .catch(() => '');
  return new RegExp(String(artistName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(bodyText);
}

async function hasArtistMatchState(page, artistName) {
  const artistVisible = await hasArtistText(page, artistName);
  if (!artistVisible) return false;
  const hasDetails = await hasConcertDetails(page);
  const hasPlaying = await hasNowPlaying(page);
  return hasDetails || hasPlaying;
}

function markClipActivated(controls, targetIndex) {
  const label = controls.preparedCameraTargets[targetIndex]?.artistName ?? `target-${targetIndex}`;
  controls.clipTimingByIndex.set(targetIndex, {
    label,
    activatedAt: Date.now(),
    searchStartedAt: null,
    matchedAt: null,
  });
}

function markSearchStart(controls, targetIndex, clearDurationSec) {
  const existing = controls.clipTimingByIndex.get(targetIndex);
  if (!existing) return;
  existing.searchStartedAt = Date.now();
  const sinceActivatedMs = existing.searchStartedAt - existing.activatedAt;
  console.log(
    `🕒 [timing] ${existing.label}: search started ${sinceActivatedMs}ms after clip activation (clear=${clearDurationSec}s)`
  );
}

function markMatchSeen(controls, targetIndex) {
  const existing = controls.clipTimingByIndex.get(targetIndex);
  if (!existing) return;
  existing.matchedAt = Date.now();
  const activeBeforeMatchMs = existing.matchedAt - existing.activatedAt;
  const searchToMatchMs = existing.searchStartedAt
    ? existing.matchedAt - existing.searchStartedAt
    : null;
  console.log(
    `🕒 [timing] ${existing.label}: match seen after ${activeBeforeMatchMs}ms active${
      searchToMatchMs !== null ? ` (${searchToMatchMs}ms since search start)` : ''
    }`
  );
}

function logClipSummary(controls, targetIndex, stageLabel) {
  const existing = controls.clipTimingByIndex.get(targetIndex);
  if (!existing) return;
  const now = Date.now();
  console.log(
    `🕒 [timing] ${existing.label}: ${stageLabel} at ${now - existing.activatedAt}ms active`
  );
}

async function ensurePlaybackActive(controls) {
  const { page } = controls;

  const playbackState = await page.evaluate(() => {
    const howler = globalThis.__photoSignalHowler ?? globalThis.Howler;
    try {
      if (typeof howler?.mute === 'function') howler.mute(false);
      if (typeof howler?.volume === 'function') howler.volume(1);
    } catch {
      /* ignore */
    }
    const howls = Array.isArray(howler?._howls) ? howler._howls : [];
    let playingCount = 0;
    for (const howl of howls) {
      if (!howl) continue;
      try {
        if (typeof howl.mute === 'function') howl.mute(false);
        if (typeof howl.volume === 'function') howl.volume(1);
        if (typeof howl.playing === 'function' && howl.playing()) playingCount += 1;
      } catch {
        /* ignore */
      }
    }
    if (playingCount === 0 && howls.length > 0) {
      for (const howl of howls) {
        try {
          if (typeof howl.play === 'function') howl.play();
        } catch {
          /* ignore */
        }
      }
      for (const howl of howls) {
        try {
          if (typeof howl.playing === 'function' && howl.playing()) playingCount += 1;
        } catch {
          /* ignore */
        }
      }
    }
    return { totalHowls: howls.length, playingCount };
  });

  if (playbackState.totalHowls > 0) {
    console.log(
      `🔊 Howler state: ${playbackState.playingCount}/${playbackState.totalHowls} track(s) playing`
    );
  }

  const playButton = page.getByRole('button', { name: /^play$/i });
  const playVisible = await playButton.isVisible().catch(() => false);
  if (playVisible) {
    const disabled = await playButton.isDisabled().catch(() => false);
    if (!disabled) {
      console.log('🔊 Play button visible; forcing playback start');
      await clickWithIndicator(controls, playButton);
      await captureFor(controls, 1200);
      return;
    }
  }

  if (playbackState.playingCount > 0) {
    console.log('🔊 Playback already active via Howler');
    await captureFor(controls, 800);
    return;
  }

  console.log('🔊 No active playback confirmed — audio may be silent in MP4');
}

async function waitForEnabledButton(page, name, timeoutMs = 7000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const button = page.getByRole('button', { name });
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      const disabled = await button.isDisabled().catch(() => false);
      if (!disabled) return button;
    }
    await page.waitForTimeout(120);
  }
  throw new Error(`Button did not become enabled: ${String(name)}`);
}

async function isSwitchArtistVisible(page) {
  return page
    .getByRole('button', { name: /switch artist|drop the needle/i })
    .isVisible()
    .catch(() => false);
}

async function showBlackFade(controls, transitionMs, captureMs = transitionMs) {
  await controls.page.evaluate((durationMs) => {
    const existing = globalThis.document.querySelector('[data-demo-fade="true"]');
    if (existing) existing.remove();
    const fade = globalThis.document.createElement('div');
    fade.setAttribute('data-demo-fade', 'true');
    Object.assign(fade.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      background: '#000',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '999999',
      transition: `opacity ${durationMs}ms linear`,
    });
    globalThis.document.body.appendChild(fade);
    globalThis.requestAnimationFrame(() => {
      fade.style.opacity = '1';
    });
  }, transitionMs);

  await captureFor(controls, captureMs);
}

async function showClipResetFlash(controls) {
  await controls.page.evaluate(() => {
    const existing = globalThis.document.querySelector('[data-demo-clip-reset="true"]');
    if (existing) existing.remove();
    const dimOverlay = globalThis.document.createElement('div');
    dimOverlay.setAttribute('data-demo-clip-reset', 'true');
    Object.assign(dimOverlay.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      background: '#000',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '99998',
      transition: 'opacity 220ms linear',
    });
    globalThis.document.body.appendChild(dimOverlay);
    globalThis.requestAnimationFrame(() => {
      dimOverlay.style.opacity = '0.72';
    });
    globalThis.setTimeout(() => {
      dimOverlay.style.transition = 'opacity 280ms linear';
      dimOverlay.style.opacity = '0';
      globalThis.setTimeout(() => {
        if (dimOverlay.parentNode) dimOverlay.remove();
      }, 350);
    }, 500);
  });

  await captureFor(controls, 800);
}

async function setCameraTargetIndex(controls, targetIndex) {
  await controls.page.evaluate((nextTargetIndex) => {
    if (typeof globalThis.__photoSignalDemoSetTargetIndex === 'function') {
      globalThis.__photoSignalDemoSetTargetIndex(nextTargetIndex);
    }
  }, targetIndex);
  markClipActivated(controls, targetIndex);
  console.log(`🎯 Camera clip target index -> ${targetIndex}`);
}

async function startSearch(controls, clearDurationSec, targetIndex) {
  await controls.page.evaluate((sec) => {
    if (typeof globalThis.__photoSignalDemoStartSearch === 'function') {
      globalThis.__photoSignalDemoStartSearch(sec);
    }
  }, clearDurationSec);
  if (typeof targetIndex === 'number') {
    markSearchStart(controls, targetIndex, clearDurationSec);
  }
  console.log(`🔍 Haze-clearing search started (${clearDurationSec}s to clear)`);
}

// ── Story: Fast Test ─────────────────────────────────────────────────────────
//
// Fastest path to confirm all core systems work: browser loads, camera feed
// serves, recognition fires, audio URL is captured, GIF builds, MP4 builds.
//
// Covers scenes 0 (landing), 1 (search + match), 2 (hold), 3 (fade).

async function runFastTestStory(controls, targets) {
  const { page } = controls;
  const { firstTarget } = targets;

  // Scene 0 — short landing
  await captureFor(controls, TEST_LANDING_DURATION_MS);

  // Activate camera
  const activateButton = page.getByRole('button', {
    name: /activate camera and begin experience/i,
  });
  await clickWithIndicator(controls, activateButton);

  const hasVideo = await page
    .locator('video')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!hasVideo) {
    throw new Error('Camera video element did not become visible after activation.');
  }

  // Scene 1 — haze-clearing search
  const clearDurationSec = SEARCH_DURATION_MS / 1000;
  await setCameraTargetIndex(controls, 0);
  await startSearch(controls, clearDurationSec, 0);
  console.log(`📹 Fast test: capturing ${SEARCH_DURATION_MS}ms haze-clear window...`);
  await captureFor(controls, SEARCH_DURATION_MS);

  // Recognition should have fired during the 4s window; allow 2s grace for timing variation
  const firstMatchSeen = await captureUntil(
    controls,
    () => hasArtistMatchState(page, firstTarget.artistName),
    2000
  );
  if (!firstMatchSeen) {
    throw new Error(
      `First target did not match for artist "${firstTarget.artistName}" within the expected window.`
    );
  }
  markMatchSeen(controls, 0);
  await ensurePlaybackActive(controls);

  // Start capturing audio from Howler's Web Audio graph.
  // Howler.masterGain is tapped → MediaStreamDestination → MediaRecorder,
  // so the recording reflects the real app state: play/pause/next/prev all
  // affect the captured audio exactly as they do during normal use.
  const audioCaptureStarted = await page
    .evaluate(() => globalThis.__startDemoAudioCapture())
    .catch(() => false);
  if (audioCaptureStarted) {
    controls.audioCaptureStartedAt = Date.now();
    console.log('🎙️ Audio capture started — app controls drive playback from here');
  } else {
    console.warn('⚠️  Audio capture failed to start — MP4 may be silent');
  }

  // Scene 2 — brief match hold
  logClipSummary(controls, 0, 'fast-test match hold start');
  await captureFor(controls, TEST_MATCH_HOLD_MS);
  logClipSummary(controls, 0, 'fast-test complete');

  // Scene 3 — fade out
  await showBlackFade(controls, 1000, 1000);
}

// ── Story: Full Demo ─────────────────────────────────────────────────────────
//
// Complete 11-scene demo. All search scenes use SEARCH_DURATION_MS (4s).
// All match holds use MATCH_HOLD_MS (6s). See Demo Timeline Spec above.

async function runFullDemoStory(controls, targets) {
  const { page } = controls;
  const { firstTarget, secondTarget, thirdTarget } = targets;
  const clearDurationSec = SEARCH_DURATION_MS / 1000;

  // Scene 0 — landing
  await captureFor(controls, LANDING_DURATION_MS);

  // Activate camera
  const activateButton = page.getByRole('button', {
    name: /activate camera and begin experience/i,
  });
  await clickWithIndicator(controls, activateButton);

  const hasVideo = await page
    .locator('video')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!hasVideo) {
    throw new Error('Camera video element did not become visible after activation.');
  }

  // Scene 1 — first haze-clearing search (Overcoats)
  await setCameraTargetIndex(controls, 0);
  await startSearch(controls, clearDurationSec, 0);
  console.log(
    `📹 Scene 1: ${SEARCH_DURATION_MS}ms haze-clear window (${firstTarget.artistName})...`
  );
  await captureFor(controls, Math.ceil(SEARCH_DURATION_MS) + 100);
  await captureFor(controls, 500);

  const firstMatchSeen = await captureUntil(
    controls,
    () => hasArtistMatchState(page, firstTarget.artistName),
    Math.max(SEARCH_DURATION_MS + 8000, firstTarget.sourceDurationMs * 2)
  );
  if (!firstMatchSeen) {
    throw new Error(`First target did not match for artist "${firstTarget.artistName}".`);
  }
  markMatchSeen(controls, 0);
  await ensurePlaybackActive(controls);

  // Start capturing audio from Howler's Web Audio graph.
  // Howler.masterGain is tapped → MediaStreamDestination → MediaRecorder,
  // so the recording reflects the real app state: play/pause/next/prev all
  // affect the captured audio exactly as they do during normal use.
  const audioCaptureStarted = await page
    .evaluate(() => globalThis.__startDemoAudioCapture())
    .catch(() => false);
  if (audioCaptureStarted) {
    controls.audioCaptureStartedAt = Date.now();
    console.log('🎙️ Audio capture started — app controls drive playback from here');
  } else {
    console.warn('⚠️  Audio capture failed to start — MP4 may be silent');
  }

  // Scene 2 — first match hold
  logClipSummary(controls, 0, 'match hold start');
  await captureFor(controls, MATCH_HOLD_MS);
  logClipSummary(controls, 0, 'match hold end');

  // Scene 3 — audio controls choreography
  const stopButton = await waitForEnabledButton(page, /^pause$|^stop$/i);
  await clickWithIndicator(controls, stopButton);
  await captureFor(controls, CONTROL_TAP_PAUSE_MS);

  const playButton = await waitForEnabledButton(page, /^play$/i);
  await clickWithIndicator(controls, playButton);
  await captureFor(controls, CONTROL_TAP_PAUSE_MS);

  const previousButton = await waitForEnabledButton(page, /play previous track|previous track/i);
  await clickWithIndicator(controls, previousButton);
  await captureFor(controls, CONTROL_TAP_PAUSE_MS);

  const nextButton = await waitForEnabledButton(page, /play next track|next track/i);
  await clickWithIndicator(controls, nextButton);
  await captureFor(controls, CONTROL_TAP_PAUSE_MS);

  // Scene 4 — close first artist details, switch to second clip
  const closeButton = page.getByRole('button', {
    name: /next pic, please|close concert details/i,
  });
  if (await closeButton.isVisible().catch(() => false)) {
    await clickWithIndicator(controls, closeButton);
    await page
      .getByLabel(/concert details/i)
      .waitFor({ state: 'hidden', timeout: 3000 })
      .catch(() => null);
  }

  // Switch video before dim flash so new clip is already playing when flash fades out
  logClipSummary(controls, 0, 'clip switch out');
  await setCameraTargetIndex(controls, 1);
  await page.evaluate(() => {
    if (typeof globalThis.__photoSignalDemoSetPhase === 'function') {
      globalThis.__photoSignalDemoSetPhase('search');
    }
  });
  await showClipResetFlash(controls);

  // Scene 5 — second haze-clearing search (Sean Barna)
  await startSearch(controls, clearDurationSec, 1);
  console.log(
    `📹 Scene 5: ${SEARCH_DURATION_MS}ms haze-clear window (${secondTarget.artistName})...`
  );
  await captureFor(controls, Math.ceil(SEARCH_DURATION_MS) + 100);
  await captureFor(controls, 500);

  const secondMatchSeen = await captureUntil(
    controls,
    () => hasArtistMatchState(page, secondTarget.artistName),
    Math.max(SEARCH_DURATION_MS + 8000, secondTarget.sourceDurationMs * 2)
  );
  if (!secondMatchSeen) {
    throw new Error(`Second target did not match for artist "${secondTarget.artistName}".`);
  }
  markMatchSeen(controls, 1);
  console.log(`✅ Second match found for "${secondTarget.artistName}"`);
  await ensurePlaybackActive(controls);

  // Scene 6 — second match hold
  await captureFor(controls, MATCH_HOLD_MS);

  // Scene 7 — close second artist details, switch to third clip
  const closeBarnaButton = page.getByRole('button', {
    name: /next pic, please|close concert details/i,
  });
  if (await closeBarnaButton.isVisible().catch(() => false)) {
    await clickWithIndicator(controls, closeBarnaButton);
    await page
      .getByLabel(/concert details/i)
      .waitFor({ state: 'hidden', timeout: 3000 })
      .catch(() => null);
  }

  logClipSummary(controls, 1, 'clip switch out');
  await setCameraTargetIndex(controls, 2);
  await page.evaluate(() => {
    if (typeof globalThis.__photoSignalDemoSetPhase === 'function') {
      globalThis.__photoSignalDemoSetPhase('search');
    }
  });
  await showClipResetFlash(controls);

  // Scene 8 — third haze-clearing search (Croy and the Boys)
  await startSearch(controls, clearDurationSec, 2);
  console.log(
    `📹 Scene 8: ${SEARCH_DURATION_MS}ms haze-clear window (${thirdTarget.artistName})...`
  );
  await captureFor(controls, Math.ceil(SEARCH_DURATION_MS) + 100);
  await captureFor(controls, 500);

  const thirdMatchSeen = await captureUntil(
    controls,
    () => hasArtistMatchState(page, thirdTarget.artistName),
    Math.max(SEARCH_DURATION_MS + 8000, thirdTarget.sourceDurationMs * 2)
  );
  if (!thirdMatchSeen) {
    throw new Error(`Third target did not match for artist "${thirdTarget.artistName}".`);
  }
  markMatchSeen(controls, 2);
  console.log(`✅ Third match found for "${thirdTarget.artistName}"`);
  await ensurePlaybackActive(controls);

  // Scene 9 — third match hold
  await captureFor(controls, MATCH_HOLD_MS);

  // Scene 10 — Switch Artist
  const hasSwitchArtist = await captureUntil(controls, () => isSwitchArtistVisible(page), 6000);
  if (!hasSwitchArtist) {
    console.warn('⚠️ Switch Artist button not visible; skipping press and proceeding.');
  } else {
    const switchArtistButton = await waitForEnabledButton(
      page,
      /switch artist|drop the needle/i,
      4000
    );
    await clickWithIndicator(controls, switchArtistButton);
    await captureFor(controls, SWITCH_ARTIST_HOLD_MS);
  }

  logClipSummary(controls, 2, 'final clip window complete');

  // Scene 11 — fade to black
  await showBlackFade(controls, 1100, FADE_DURATION_MS);
}

// ── Frame Capture Orchestrator ───────────────────────────────────────────────

async function captureDemoFrames(options) {
  const { testMode } = options;

  // 1. Resolve demo targets from manifest + app data
  const { firstTarget, secondTarget, thirdTarget } = resolveDemoTargets();
  const cameraTargets = [firstTarget, secondTarget, thirdTarget];

  // 2. Prepare palindrome videos
  //    In test mode only the first target's palindrome is needed; skipping the
  //    others saves several minutes on a clean run (palindromes are cached after first prep).
  const targetsToPrep = testMode ? [cameraTargets[0]] : cameraTargets;

  console.log(
    `🎞️  Preparing palindrome video${targetsToPrep.length > 1 ? 's' : ''} (${targetsToPrep.length} of ${cameraTargets.length})...`
  );
  const halfSpeedMap = new Map(
    targetsToPrep.map((target) => [
      target.sourceVideoPath,
      ensureHalfSpeedVideo(target.sourceVideoPath),
    ])
  );

  // 3. Extract pHash from palindrome frames so seeded hashes match browser recognition
  console.log('🔍 Computing video-frame hashes for seeding...');
  const targetSeededHashes = await Promise.all(
    targetsToPrep.map((target) =>
      computeHashFromVideoFrame(halfSpeedMap.get(target.sourceVideoPath))
    )
  );

  targetsToPrep.forEach((target, idx) => {
    console.log(
      `📸 Target ${idx}: ${target.artistName} (concertId=${target.concertId}, photoId=${target.photoId})`
    );
    console.log(`   ├─ palindrome: ${path.basename(halfSpeedMap.get(target.sourceVideoPath))}`);
    console.log(`   └─ hash: ${targetSeededHashes[idx]}`);
  });

  const preparedCameraTargets = targetsToPrep.map((target) => {
    const preparedPath = halfSpeedMap.get(target.sourceVideoPath);
    if (!preparedPath) throw new Error(`Missing half-speed video for ${target.sourceVideoPath}`);
    return { ...target, sourceVideoPath: preparedPath };
  });

  if (testMode) {
    console.log(`🎬 Fast test target: ${firstTarget.artistName}`);
  } else {
    console.log(
      `🎬 Full demo targets: ${firstTarget.artistName} → ${secondTarget.artistName} → ${thirdTarget.artistName}`
    );
  }

  // 4. Launch browser with fake device media stream
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  let context;
  let page;
  let rawVideoPath = null;

  try {
    // 5. Create context with video recording
    context = await browser.newContext({
      ...devices['Pixel 7'],
      // Force 1:1 physical-to-CSS pixel ratio. The Pixel 7 preset sets
      // deviceScaleFactor=2.625, which makes the browser render at ~1082×2402
      // physical pixels even though the logical viewport is 412×915. Playwright
      // then scales the framebuffer DOWN for recordVideo — that mismatch causes
      // the "scaling to a huge screen" flickering artifact.  With DPR=1 the
      // physical and CSS pixel dimensions match exactly, so no scaling happens.
      deviceScaleFactor: 1,
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      recordVideo: {
        dir: VIDEO_OUTPUT_DIR,
        size: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      },
    });
    // Mark recording start so we can compute the audio offset later.
    // The first match time minus this value = how far into the video music begins.
    const recordingStartedAt = Date.now();

    page = await context.newPage();
    page.on('console', (message) => {
      const type = message.type();
      const text = message.text();
      if (type === 'error' || type === 'warning') {
        console.log(`[browser:${type}] ${text}`);
      } else if (text.includes('[demo]')) {
        console.log(`[browser:log] ${text}`);
      }
    });

    // 6. Register video routes with byte-range support for smooth palindrome playback
    const routeToVideoPath = new Map();
    const targetVideoUrls = preparedCameraTargets.map((target, index) => {
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

    // 6b. Intercept audio requests and serve local files.
    //     When Howler tries to load a track from the Cloudflare Worker, the browser
    //     blocks it with a CORS error. We intercept every *.opus request, download it
    //     from Node.js (no CORS restrictions), cache in memory, and serve the full
    //     buffer back — so Howler sees a clean 200 response and loads real audio data.
    //     Files are also written to AUDIO_LOCAL_DIR for reuse across runs.
    const audioMemoryCache = new Map(); // url → Buffer
    await page.route('**/*.opus', async (route) => {
      const url = route.request().url();

      if (!audioMemoryCache.has(url)) {
        const filename = path.basename(new URL(url).pathname);
        const diskPath = path.join(AUDIO_LOCAL_DIR, filename);
        if (fs.existsSync(diskPath)) {
          // Reuse file cached by a previous run — no network request needed.
          const bytes = fs.readFileSync(diskPath);
          audioMemoryCache.set(url, bytes);
          console.log(`📁 Serving audio from disk cache: ${filename} (${bytes.length} bytes)`);
        } else {
          try {
            const response = await fetch(url);
            if (response.ok) {
              const bytes = Buffer.from(await response.arrayBuffer());
              audioMemoryCache.set(url, bytes);
              fs.writeFileSync(diskPath, bytes);
              console.log(`📥 Cached audio locally: ${filename} (${bytes.length} bytes)`);
            } else {
              audioMemoryCache.set(url, null);
              console.warn(`⚠️  Audio fetch failed (${response.status}): ${url}`);
            }
          } catch (err) {
            audioMemoryCache.set(url, null);
            console.warn(`⚠️  Audio fetch error: ${err.message ?? err}`);
          }
        }
      }

      const cached = audioMemoryCache.get(url);
      if (cached) {
        await route.fulfill({
          status: 200,
          body: cached,
          contentType: 'audio/ogg; codecs=opus',
          headers: {
            'Content-Length': String(cached.length),
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } else {
        await route.continue();
      }
    });

    // 7. Inject browser-side demo infrastructure before the app loads
    //
    //    Five systems are bootstrapped:
    //    (a) Feature flags — enables rectangle-detection, disables debug overlay + audio fade
    //    (b) Demo state machine — __photoSignalDemoSetTargetIndex / SetPhase / StartSearch
    //    (c) Fake camera stream — canvas renders palindrome videos with a progressive haze effect;
    //        blur starts at 8px and clears to 0 over SEARCH_DURATION_MS seconds, allowing pHash
    //        recognition to fire naturally once the image is sharp enough
    //    (d) Recognition seeding — intercepts /data.recognition.v2.json to inject computed hashes
    //    (e) Audio capture — __startDemoAudioCapture / __stopDemoAudioCapture tap Howler.masterGain
    await page.addInitScript(
      ({ videoUrls, seededTargets }) => {
        // (a) Feature flags
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
          globalThis.localStorage.setItem('photo-signal-demo-no-audio-fade', 'true');
        } catch {
          // ignore localStorage bootstrap failures
        }

        // (b) Demo state machine
        const demoState = {
          targetIndex: 0,
          phase: 'search',
          searchStartTime: null,
          clearDurationSec: 4.0,
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
            // Reset searchStartTime so clearT returns to 0 (full haze) until
            // startSearch is explicitly called. Without this, the old elapsed
            // time produces clearT=1 and recognition fires on the clear image
            // before the new search phase even begins.
            if (nextPhase === 'search') {
              demoState.searchStartTime = null;
            }
          }
        };

        /**
         * Starts a new search phase with progressive haze clearing.
         * The canvas starts blurry/dark and clears over clearDurationSec seconds so
         * recognition fires naturally when the image becomes sharp enough for pHash.
         * An auto-switch to 'target' fires at clearDurationSec to fully remove the
         * canvas filter (blur(0px) still differs subtly from no filter).
         */
        globalThis.__photoSignalDemoStartSearch = (clearDurationSec) => {
          demoState.phase = 'search';
          demoState.searchStartTime = globalThis.performance.now();
          demoState.clearDurationSec =
            typeof clearDurationSec === 'number' && clearDurationSec > 0 ? clearDurationSec : 4.0;
          const timeoutMs = demoState.clearDurationSec * 1000;
          globalThis.console.log(
            `[demo] scheduling phase switch to 'target' in ${timeoutMs}ms (clearDurationSec=${demoState.clearDurationSec})`
          );
          globalThis.setTimeout(() => {
            if (demoState.phase === 'search') {
              globalThis.console.log(`[demo] phase auto-switched to 'target' after ${timeoutMs}ms`);
              demoState.phase = 'target';
            }
          }, timeoutMs);
        };

        // (c) Fake camera stream
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
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to create camera canvas context');

          const videos = [];
          for (let i = 0; i < videoUrls.length; i++) {
            const videoUrl = videoUrls[i];
            globalThis.console.log(`[demo] loading video[${i}]: ${videoUrl}`);
            const video = globalThis.document.createElement('video');
            video.src = videoUrl;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.preload = 'auto';
            video.addEventListener('error', () => {
              globalThis.console.error(
                `[demo] ❌ video[${i}] failed to load: ${videoUrl} (readyState=${video.readyState}, error=${video.error?.message})`
              );
            });
            await waitForVideoLoaded(video);
            globalThis.console.log(
              `[demo] video[${i}] loaded (${video.videoWidth}x${video.videoHeight}, duration=${video.duration}s)`
            );
            videos.push(video);
          }

          let activeIndex = -1;

          const setActiveVideo = async (nextIndex) => {
            if (nextIndex === activeIndex) return;
            globalThis.console.log(`[demo] switching active video: ${activeIndex} → ${nextIndex}`);
            if (activeIndex >= 0) videos[activeIndex].pause();
            activeIndex = nextIndex;
            const activeVideo = videos[activeIndex];
            activeVideo.currentTime = 0;
            activeVideo.playbackRate = 1;
            try {
              await activeVideo.play();
              globalThis.console.log(
                `[demo] video[${activeIndex}] playing (currentTime=0, playbackRate=1)`
              );
            } catch {
              // ignore autoplay restrictions in headless mode
            }
          };

          await setActiveVideo(0);

          const drawContainFrame = (video) => {
            const scale = Math.min(
              canvas.width / video.videoWidth,
              canvas.height / video.videoHeight
            );
            const drawWidth = video.videoWidth * scale;
            const drawHeight = video.videoHeight * scale;
            const offsetX = (canvas.width - drawWidth) / 2;
            const offsetY = (canvas.height - drawHeight) / 2;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
              video,
              0,
              0,
              video.videoWidth,
              video.videoHeight,
              offsetX,
              offsetY,
              drawWidth,
              drawHeight
            );
          };

          // Debug counter — logs haze state every 30 render ticks.
          // Look for clearT rising from 0.000 → 1.000 during search phases.
          let debugFrameCount = 0;
          globalThis.console.log('[demo] render loop starting');

          const render = () => {
            try {
              debugFrameCount++;
              if (debugFrameCount === 1) {
                globalThis.console.log('[demo] render tick #1 — loop is alive');
              }

              const desiredIndex = Math.max(0, Math.min(demoState.targetIndex, videos.length - 1));
              if (desiredIndex !== activeIndex) {
                void setActiveVideo(desiredIndex);
              }

              ctx.clearRect(0, 0, canvas.width, canvas.height);
              const isSearchPhase = demoState.phase === 'search';

              // Compute haze-clearing progress: 0 = full haze, 1 = fully clear
              let clearT = 1.0;
              if (isSearchPhase && demoState.searchStartTime !== null) {
                const elapsedSec =
                  (globalThis.performance.now() - demoState.searchStartTime) / 1000;
                clearT = Math.min(elapsedSec / demoState.clearDurationSec, 1.0);
              } else if (!isSearchPhase) {
                clearT = 1.0;
              } else {
                clearT = 0.0; // search phase not yet started — full haze
              }

              const activeVideo = videos[Math.max(activeIndex, 0)];
              if (activeVideo && activeVideo.readyState >= 2) {
                ctx.save();
                let blurVal = null;
                if (isSearchPhase) {
                  blurVal = (8.0 * (1 - clearT)).toFixed(2);
                  const brightness = (0.62 + 0.38 * clearT).toFixed(2);
                  const contrast = (1.1 - 0.1 * clearT).toFixed(2);
                  const saturate = (0.88 + 0.12 * clearT).toFixed(2);
                  ctx.filter = `blur(${blurVal}px) brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
                }
                drawContainFrame(activeVideo);
                ctx.restore();
              }

              // Debug: log haze progression every 30 frames
              if (debugFrameCount % 30 === 0) {
                globalThis.console.log(
                  `[demo] haze render #${debugFrameCount}: phase=${demoState.phase}, clearT=${clearT.toFixed(3)}`
                );
              }

              if (isSearchPhase) {
                const overlayAlpha = 0.18 * (1 - clearT * 0.8);
                const time = globalThis.performance.now() / 1000;
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, `rgba(18, 20, 28, ${overlayAlpha.toFixed(3)})`);
                gradient.addColorStop(1, `rgba(34, 36, 46, ${(overlayAlpha * 0.78).toFixed(3)})`);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const scanAlpha = 0.16 * (1 - clearT * 0.85);
                if (scanAlpha > 0.005) {
                  const scanHeight = Math.round(canvas.height * 0.18);
                  const scanY = Math.round(
                    ((time * 95) % (canvas.height + scanHeight)) - scanHeight
                  );
                  const scanGradient = ctx.createLinearGradient(0, scanY, 0, scanY + scanHeight);
                  scanGradient.addColorStop(0, 'rgba(95, 211, 179, 0.0)');
                  scanGradient.addColorStop(0.5, `rgba(95, 211, 179, ${scanAlpha.toFixed(3)})`);
                  scanGradient.addColorStop(1, 'rgba(95, 211, 179, 0.0)');
                  ctx.fillStyle = scanGradient;
                  ctx.fillRect(0, scanY, canvas.width, scanHeight);
                }
              }
            } catch (err) {
              globalThis.console.error(`[demo] render error at tick #${debugFrameCount}: ${err}`);
            }

            // setTimeout fires reliably in Playwright headless (rAF may be throttled)
            globalThis.setTimeout(render, 33); // ~30 FPS
          };

          globalThis.console.log('[demo] scheduling first render tick');
          globalThis.setTimeout(render, 0);
          return canvas.captureStream(30);
        };

        if (navigator.mediaDevices?.getUserMedia) {
          const streamPromise = createVideoCameraStream();
          navigator.mediaDevices.getUserMedia = async () => {
            return await streamPromise;
          };
        }

        // (d) Recognition seeding — intercepts /data.recognition.v2.json to inject hashes
        const originalFetch = globalThis.fetch.bind(globalThis);
        globalThis.fetch = async (input, init) => {
          const requestUrl =
            typeof input === 'string' ? input : input instanceof Request ? input.url : '';
          const isRecognitionRequest = requestUrl.includes('/data.recognition.v2.json');

          if (!isRecognitionRequest) return originalFetch(input, init);

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
              globalThis.console.log(
                `[demo] ⚠️ concertId=${seededTarget.concertId} NOT FOUND in recognition data`
              );
              continue;
            }
            const existing = Array.isArray(entry.phash) ? entry.phash : [];
            entry.phash = [
              seededTarget.seededHash,
              ...existing.filter((hash) => hash !== seededTarget.seededHash),
            ];
            globalThis.console.log(
              `[demo] ✅ seeded concertId=${seededTarget.concertId} with hash=${seededTarget.seededHash}`
            );
          }

          return new Response(JSON.stringify(payload), {
            status: response.status,
            statusText: response.statusText,
            headers: { 'Content-Type': 'application/json' },
          });
        };

        // (e) Audio capture via Web Audio API
        //     Called from Node.js story helpers after first recognition fires and
        //     Howler begins playing. Taps Howler.masterGain → MediaStreamDestination
        //     so MediaRecorder captures exactly what the app plays — including the
        //     effect of every play/pause/next/prev interaction.
        globalThis.__startDemoAudioCapture = () => {
          try {
            const howler = globalThis.__photoSignalHowler ?? globalThis.Howler;
            // Howler v2 exposes the AudioContext as .ctx or ._audioContext,
            // and the master gain node as .masterGain or ._masterGain.
            const ctx = howler?.ctx ?? howler?._audioContext;
            const masterGain = howler?.masterGain ?? howler?._masterGain;
            if (!ctx || !masterGain) {
              globalThis.console.warn(
                '[demo] 🎙️ Cannot start audio capture: Howler ctx/masterGain not ready'
              );
              return false;
            }
            if (ctx.state === 'suspended') ctx.resume();
            const dest = ctx.createMediaStreamDestination();
            // Tap the master gain so all Howl sounds — current and future — flow
            // into the capture stream. This includes every track change and control action.
            masterGain.connect(dest);
            const mimeType = globalThis.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : 'audio/webm';
            const recorder = new globalThis.MediaRecorder(dest.stream, { mimeType });
            const chunks = [];
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) chunks.push(e.data);
            };
            recorder.start(100);
            globalThis.__demoAudioRecorder = recorder;
            globalThis.__demoAudioChunks = chunks;
            globalThis.console.log(`[demo] 🎙️ Audio capture started (${mimeType})`);
            return true;
          } catch (err) {
            globalThis.console.warn('[demo] 🎙️ Audio capture setup failed:', String(err));
            return false;
          }
        };

        globalThis.__stopDemoAudioCapture = () =>
          new Promise((resolve) => {
            const recorder = globalThis.__demoAudioRecorder;
            if (!recorder || recorder.state === 'inactive') {
              resolve(null);
              return;
            }
            recorder.onstop = async () => {
              try {
                const blob = new Blob(globalThis.__demoAudioChunks, { type: recorder.mimeType });
                const buffer = await blob.arrayBuffer();
                resolve(Array.from(new Uint8Array(buffer)));
              } catch {
                resolve(null);
              }
            };
            recorder.stop();
          });
      },
      {
        videoUrls: targetVideoUrls,
        seededTargets: preparedCameraTargets.map((target, index) => ({
          concertId: target.concertId,
          seededHash: targetSeededHashes[index],
        })),
      }
    );

    // 8. Navigate to app
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /photo signal/i }).waitFor({ timeout: 10000 });

    // 9. Build controls object for story helpers
    const maxFrames = testMode ? MIN_TEST_FRAMES : MIN_STORY_FRAMES;
    const controls = {
      page,
      frameRef: { current: 0 },
      maxFrames,
      fps: CAPTURE_FPS,
      frameDelayMs: CAPTURE_DELAY_MS,
      preparedCameraTargets,
      clipTimingByIndex: new Map(),
      // Set by story function immediately after first recognition + ensurePlaybackActive.
      // Used to compute the audio offset: recordingStartedAt → audioCaptureStartedAt = silence.
      audioCaptureStartedAt: null,
    };

    console.log(
      `🧮 Capture budget: maxFrames=${maxFrames}, fps=${CAPTURE_FPS}, frameDelayMs=${CAPTURE_DELAY_MS}ms`
    );

    // 10. Run the story
    const storyTargets = {
      firstTarget: preparedCameraTargets[0],
      secondTarget: preparedCameraTargets[1], // undefined in test mode — not accessed
      thirdTarget: preparedCameraTargets[2], // undefined in test mode — not accessed
    };

    if (testMode) {
      await runFastTestStory(controls, storyTargets);
    } else {
      await runFullDemoStory(controls, storyTargets);
    }

    // 11. Stop audio capture and retrieve recorded bytes from the browser.
    //     MediaRecorder has been recording from Howler.masterGain since first recognition,
    //     so this captures exactly what the app played — including every control interaction.
    const frameCount = controls.frameRef.current;
    console.log(`📸 Captured ${frameCount} frames`);

    let audioCaptureFile = null;
    const audioBytes = await page
      .evaluate(() => globalThis.__stopDemoAudioCapture())
      .catch(() => null);
    if (audioBytes && audioBytes.length > 0) {
      const audioCaptureWebm = path.join(VIDEO_OUTPUT_DIR, 'demo-audio-capture.webm');
      fs.writeFileSync(audioCaptureWebm, Buffer.from(audioBytes));
      console.log(`🎙️ Audio capture saved: ${audioBytes.length} bytes → demo-audio-capture.webm`);

      // Convert the MediaRecorder WebM to WAV before muxing.
      // MediaRecorder output typically lacks a duration header in its WebM container,
      // which confuses ffmpeg's A/V sync when used with -itsoffset and produces
      // visual artifacts throughout the output video. WAV is headerless PCM — no
      // metadata ambiguity, and ffmpeg handles the timing perfectly.
      const audioCaptureWav = path.join(VIDEO_OUTPUT_DIR, 'demo-audio-capture.wav');
      try {
        run('ffmpeg', ['-loglevel', 'error', '-y', '-i', audioCaptureWebm, audioCaptureWav]);
        audioCaptureFile = audioCaptureWav;
        console.log('🎙️ Audio converted to WAV for clean muxing');
      } catch {
        audioCaptureFile = audioCaptureWebm;
        console.warn('⚠️  WAV conversion failed — falling back to raw WebM capture');
      }
    } else {
      console.warn('⚠️  No audio captured — MP4 will be silent');
    }

    // Close browser — Playwright writes the .webm video file on context.close()
    await page.close().catch(() => null);
    page = null;
    await context.close().catch(() => null);
    context = null;
    await browser.close();

    // Read video path after context is closed (Playwright finishes writing then)
    if (fs.existsSync(VIDEO_OUTPUT_DIR)) {
      const videoFiles = fs
        .readdirSync(VIDEO_OUTPUT_DIR)
        .filter((file) => file.endsWith('.webm') && !file.startsWith('demo-audio-capture'));
      if (videoFiles.length > 0) {
        rawVideoPath = path.join(VIDEO_OUTPUT_DIR, videoFiles[0]);
      }
    }

    // Compute the audio offset: time from recording start to when audio capture began.
    // The captured audio starts at t=0 of the capture (i.e., right after recognition),
    // so we delay the audio stream by this offset when muxing the MP4.
    const audioOffsetMs = controls.audioCaptureStartedAt
      ? Math.max(0, controls.audioCaptureStartedAt - recordingStartedAt)
      : 0;
    if (audioOffsetMs > 0) {
      console.log(
        `🎵 Audio offset: ${(audioOffsetMs / 1000).toFixed(2)}s (capture started after first recognition)`
      );
    }

    return { rawVideoPath, audioCaptureFile, frameCount, audioOffsetMs };
  } finally {
    // Emergency cleanup if an error interrupted normal browser shutdown
    if (page) await page.close().catch(() => null);
    if (context) await context.close().catch(() => null);
  }
}

// ── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputPaths = getOutputPaths(options.testMode);

  console.log(`🖼️  GIF output: ${outputPaths.gifPath}`);
  console.log(`🎬 MP4 output: ${outputPaths.mp4Path}`);

  if (!options.skipBuild) {
    run('npm', ['run', 'build']);
  }

  ensureEmptyFrameDir();
  ensureEmptyVideoDir();
  fs.rmSync(outputPaths.mp4Path, { force: true });

  const preview = startPreviewServer();
  const previewStderrBuffer = [];
  preview.stdout.on('data', (chunk) => process.stdout.write(chunk.toString()));
  preview.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    previewStderrBuffer.push(text);
    process.stderr.write(text);
  });

  let captureError = null;
  let captureArtifacts = { rawVideoPath: null, audioCaptureFile: null, frameCount: 0 };

  try {
    await waitForServer(BASE_URL, preview, previewStderrBuffer);
    captureArtifacts = await captureDemoFrames(options);
  } catch (error) {
    captureError = error;
    console.error('\n⚠️  Frame capture failed:', error);
    console.log('Building partial GIF from captured frames...');
  }

  try {
    // Build GIF — required; errors are fatal
    try {
      buildGif(outputPaths.gifPath);
    } catch (buildError) {
      if (captureError) {
        throw new AggregateError(
          [captureError, buildError],
          'Frame capture failed and partial GIF build also failed.'
        );
      }
      throw buildError;
    }

    const gifDuration = readMediaDurationSeconds(outputPaths.gifPath);
    console.log(
      `✅ Demo GIF generated: ${outputPaths.gifPath}${gifDuration ? ` (${gifDuration.toFixed(2)}s)` : ''}`
    );

    // Build MP4 — required; only skipped if frame capture itself failed
    if (!captureError) {
      if (!captureArtifacts.rawVideoPath || !fs.existsSync(captureArtifacts.rawVideoPath)) {
        throw new Error(
          'Playwright video recording not found — MP4 cannot be built. ' +
            'Ensure the browser context was not closed prematurely.'
        );
      }

      // Use the audio captured from the browser's Web Audio graph.
      // This file contains exactly what Howler played — every control interaction included.
      const audioPath = captureArtifacts.audioCaptureFile ?? null;
      if (!audioPath || !fs.existsSync(audioPath)) {
        console.warn('⚠️  MP4 audio unavailable — building silent MP4');
      }

      buildMp4(
        captureArtifacts.rawVideoPath,
        audioPath,
        outputPaths.mp4Path,
        (captureArtifacts.audioOffsetMs ?? 0) / 1000
      );
      cleanupVideoDir();

      const mp4Duration = readMediaDurationSeconds(outputPaths.mp4Path);
      console.log(
        `✅ Demo MP4 generated: ${outputPaths.mp4Path}${mp4Duration ? ` (${mp4Duration.toFixed(2)}s)` : ''}`
      );

      // Test mode: validate MP4 has audible audio when audio was captured
      if (options.testMode && audioPath) {
        const maxVolumeDb = readMaxVolumeDb(outputPaths.mp4Path);
        if (maxVolumeDb === null || maxVolumeDb <= MIN_MAX_VOLUME_DB) {
          const observed = maxVolumeDb === null ? 'unavailable' : `${maxVolumeDb.toFixed(2)} dB`;
          throw new Error(
            `Demo test MP4 audio too quiet (max_volume=${observed}, required > ${MIN_MAX_VOLUME_DB} dB).`
          );
        }
        console.log(`🔊 MP4 loudness check passed (max_volume=${maxVolumeDb.toFixed(2)} dB)`);
      }
    } else {
      console.log('⚠️  MP4 skipped due to capture failure');
    }

    if (captureError) {
      console.log(`\n⚠️  Partial Demo GIF generated: ${outputPaths.gifPath}`);
      throw captureError;
    }

    console.log('\n✅ Demo generation complete');
  } finally {
    await stopPreviewServer(preview);
    cleanup();
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`\n❌ Demo generation failed: ${error.message}`);
    if (error.stack) console.error(error.stack);
  } else {
    console.error(`\n❌ Demo generation failed: ${String(error)}`);
  }
  process.exit(1);
});
