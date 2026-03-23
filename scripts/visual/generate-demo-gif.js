#!/usr/bin/env node
/**
 * Demo GIF + MP4 Generator
 *
 * Produces docs/media/demo.gif and docs/media/demo.mp4 by:
 *  1. Starting the production preview server (port 4173)
 *  2. Injecting a fake camera feed from pre-recorded phone videos
 *  3. Recording the full story with Playwright recordVideo — smooth, continuous WebM
 *     (no screenshot accumulation, no frame-rate jitter)
 *  4. Intercepting and caching audio (*.opus) requests for MP4 muxing
 *  5. Assembling GIF from the WebM via ffmpeg two-pass palette
 *  6. Muxing intercepted audio into MP4 with correct timestamps
 *
 * The fake camera uses a 3× slow-speed palindrome video (forward + reverse) so the
 * recognition pipeline has a natural "scanning → found" period without custom haze
 * overlays. The real app CRT/dead-signal visual state is shown during scanning.
 *
 * Prerequisites: ffmpeg and ffprobe must be on PATH.
 * Video samples must be placed in assets/test-videos/phone-samples/ (not committed).
 *
 * Usage:
 *   npm run demo:gif               # full demo (builds first)
 *   npm run demo:gif:quick         # full demo, skip build
 *   npm run demo:gif:test          # fast smoke test (skip build, first target only)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium, devices } from '@playwright/test';
import { loadImageData, computePHash } from '../lib/photoHashUtils.js';

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const BASE_URL = 'http://127.0.0.1:4173';
const VIDEO_SAMPLE_DIR = path.resolve(ROOT, 'assets/test-videos/phone-samples');
const VIDEO_SAMPLE_MANIFEST_PATH = path.resolve(VIDEO_SAMPLE_DIR, 'samples.manifest.json');
const HALF_SPEED_VIDEO_DIR = path.resolve(VIDEO_SAMPLE_DIR, 'half-speed');
const OUTPUT_DIR = path.resolve(ROOT, 'docs/media');
const AUDIO_CACHE_DIR = path.resolve(ROOT, 'scripts/visual/output/audio');
const VIDEO_RECORDING_DIR = path.resolve(ROOT, 'scripts/visual/output/recording');

// ── Full story timing ─────────────────────────────────────────────────────────
const TIMING_FULL = {
  landingHoldMs: 2000,
  hazeHoldMs: 3000, // scanning state before clearing haze
  hazeClearMs: 1500, // duration of haze fade
  matchTimeoutMs: 15000,
  firstMatchHoldMs: 6000,
  controlTapGapMs: 2500,
  matchHoldMs: 5000, // for 2nd and 3rd targets
  fadeToBlackMs: 1500,
};

// ── Test story timing (fast smoke) ────────────────────────────────────────────
const TIMING_TEST = {
  landingHoldMs: 500,
  hazeHoldMs: 1500,
  hazeClearMs: 1000,
  matchTimeoutMs: 15000,
  firstMatchHoldMs: 1500,
  controlTapGapMs: 800,
  matchHoldMs: 1000,
  fadeToBlackMs: 500,
};

// ── Output file paths (test mode uses timestamps to avoid clobbering full demo) ──
const OUTPUT_GIF = path.resolve(OUTPUT_DIR, 'demo.gif');
const OUTPUT_MP4 = path.resolve(OUTPUT_DIR, 'demo.mp4');

// ── Viewport / output parameters ─────────────────────────────────────────────
const VIEWPORT_WIDTH = 412;
const VIEWPORT_HEIGHT = 915;
const GIF_FPS = 8;
const GIF_WIDTH = 320;
const MP4_CRF = 18;

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const SKIP_BUILD = args.includes('--skip-build');
const TEST_MODE = args.includes('--test');

const TIMING = TEST_MODE ? TIMING_TEST : TIMING_FULL;
const TARGET_GIF = TEST_MODE ? path.resolve(OUTPUT_DIR, `demo-test-${Date.now()}.gif`) : OUTPUT_GIF;
const TARGET_MP4 = TEST_MODE ? path.resolve(OUTPUT_DIR, `demo-test-${Date.now()}.mp4`) : OUTPUT_MP4;

// ── Utilities ─────────────────────────────────────────────────────────────────

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options });
  if (result.error) {
    const code = result.error.code ? ` (${result.error.code})` : '';
    throw new Error(`Failed to run${code}: ${command} ${args.join(' ')} — ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Exit ${result.status ?? 'unknown'}: ${command} ${args.join(' ')}`);
  }
}

async function waitForServer(url, preview, stderrBuffer, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (preview.exitCode !== null) {
      const tail = stderrBuffer.join('').trim().split('\n').slice(-8).join('\n');
      throw new Error(`Preview server exited early (code ${preview.exitCode}).\n${tail}`);
    }
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  const tail = stderrBuffer.join('').trim().split('\n').slice(-8).join('\n');
  throw new Error(`Preview server not ready at ${url} after ${timeoutMs}ms.\n${tail}`);
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

// ── Video utilities ───────────────────────────────────────────────────────────

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
  const rot = Number.parseInt(String(result.stdout ?? '').trim(), 10);
  return Number.isFinite(rot) ? rot : 0;
}

function prepareHalfSpeedVideo(sourceVideoPath, outputPath) {
  const rotationDeg = getVideoRotation(sourceVideoPath);
  let rotationFilter = '';
  if (rotationDeg === 180 || rotationDeg === -180) rotationFilter = 'hflip,vflip,';
  else if (rotationDeg === 90 || rotationDeg === -270) rotationFilter = 'transpose=1,';
  else if (rotationDeg === -90 || rotationDeg === 270) rotationFilter = 'transpose=2,';
  if (rotationDeg !== 0) {
    console.log(`   ↻ Applying ${rotationDeg}° rotation to ${path.basename(sourceVideoPath)}`);
  }
  run('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    sourceVideoPath,
    '-filter_complex',
    `[0:v]${rotationFilter}setpts=3*PTS,scale=960:-2:flags=lanczos,format=yuv420p,split=2[fwd1][fwd2];[fwd2]reverse[rev];[fwd1][rev]concat=n=2:v=1:a=0[out]`,
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

function ensureHalfSpeedVideo(sourceVideoPath) {
  fs.mkdirSync(HALF_SPEED_VIDEO_DIR, { recursive: true });
  const base = path.basename(sourceVideoPath, path.extname(sourceVideoPath));
  const outputPath = path.join(HALF_SPEED_VIDEO_DIR, `${base}.3x-palindrome.webm`);
  if (fs.existsSync(outputPath)) {
    const srcStat = fs.statSync(sourceVideoPath);
    const outStat = fs.statSync(outputPath);
    if (outStat.mtimeMs >= srcStat.mtimeMs && outStat.size > 0) return outputPath;
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
  if (result.status !== 0) throw new Error(`ffprobe failed for ${videoPath}`);
  const secs = Number.parseFloat(String(result.stdout ?? '').trim());
  if (!Number.isFinite(secs) || secs <= 0)
    throw new Error(`Invalid duration from ffprobe: ${videoPath}`);
  return Math.floor(secs * 1000);
}

async function computeHashFromVideoFrame(videoPath) {
  const durationMs = getVideoDurationMs(videoPath);
  const seekSec = (durationMs / 1000) * 0.3;
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

// ── Target resolution ─────────────────────────────────────────────────────────

function resolveDemoTargets() {
  if (!fs.existsSync(VIDEO_SAMPLE_MANIFEST_PATH)) {
    throw new Error(`Video sample manifest missing: ${VIDEO_SAMPLE_MANIFEST_PATH}`);
  }
  const manifest = JSON.parse(fs.readFileSync(VIDEO_SAMPLE_MANIFEST_PATH, 'utf8'));
  const appData = JSON.parse(
    fs.readFileSync(path.resolve(ROOT, 'public/data.app.v2.json'), 'utf8')
  );
  const recognitionData = JSON.parse(
    fs.readFileSync(path.resolve(ROOT, 'public/data.recognition.v2.json'), 'utf8')
  );

  const tracksById = new Map((appData.tracks ?? []).map((t) => [t.id, t]));
  const photosById = new Map((appData.photos ?? []).map((p) => [p.id, p]));
  const artistNameById = new Map((appData.artists ?? []).map((a) => [a.id, a.name ?? a.id]));
  const recognitionByConcertId = new Map(
    (recognitionData.entries ?? []).map((e, i) => [e.concertId, { entry: e, index: i }])
  );

  const usableByConcertId = new Map(
    (appData.entries ?? [])
      .map((entry) => {
        const track = tracksById.get(entry.trackId);
        const photo = photosById.get(entry.photoId);
        const recognition = recognitionByConcertId.get(entry.id);
        if (
          entry.recognitionEnabled === false ||
          !track?.audioFile ||
          !photo?.imageFile ||
          !recognition
        )
          return null;
        return {
          concertId: entry.id,
          artistId: entry.artistId,
          artistName: artistNameById.get(entry.artistId) ?? entry.artistId,
          photoId: entry.photoId,
          imageFile: photo.imageFile,
          audioFile: track.audioFile,
        };
      })
      .filter(Boolean)
      .map((e) => [String(e.concertId), e])
  );

  const samples = (manifest.samples ?? []).filter((s) => s.captures?.length === 1);
  const candidateTargets = samples
    .map((sample, i) => {
      const capture = sample.captures[0];
      const entry = usableByConcertId.get(String(capture.concertId));
      if (!entry) return null;
      if (String(capture.photoId) !== String(entry.photoId)) return null;
      const rawFilename = String(sample.filename ?? '');
      // Guard against empty filenames, absolute paths, and path traversal sequences
      if (
        !rawFilename ||
        rawFilename.includes('..') ||
        rawFilename.includes('/') ||
        rawFilename.includes('\\') ||
        path.isAbsolute(rawFilename)
      )
        return null;
      const sourceVideoPath = path.resolve(VIDEO_SAMPLE_DIR, rawFilename);
      if (!fs.existsSync(sourceVideoPath) || !fs.statSync(sourceVideoPath).isFile()) return null;
      return {
        ...entry,
        sampleId: String(sample.sampleId ?? `sample-${String(i + 1).padStart(2, '0')}`),
        sourceVideoPath,
      };
    })
    .filter(Boolean);

  const count = TEST_MODE ? 1 : 3;
  if (candidateTargets.length < count) {
    throw new Error(
      `Need at least ${count} single-capture samples in manifest, found ${candidateTargets.length}.`
    );
  }

  const chosen = [];
  for (const candidate of candidateTargets) {
    if (chosen.length >= count) break;
    if (chosen.every((c) => c.artistId !== candidate.artistId)) chosen.push(candidate);
  }
  let fillIdx = 0;
  while (chosen.length < count && fillIdx < candidateTargets.length) {
    if (!chosen.includes(candidateTargets[fillIdx])) chosen.push(candidateTargets[fillIdx]);
    fillIdx++;
  }
  if (chosen.length < count) throw new Error(`Could not choose ${count} targets from manifest.`);

  return chosen;
}

// ── Browser camera script ─────────────────────────────────────────────────────
//
// Builds an ES5-compatible IIFE that:
//  1. Overrides navigator.mediaDevices.getUserMedia to return canvas.captureStream()
//  2. Draws video frames to the canvas with a controllable haze (blur + brightness)
//  3. Seeds all target hashes into /data.recognition.v2.json on the first fetch
//  4. Exposes window.__clearHaze(durationMs) and window.__setCameraTarget(index)
//  5. Sets the demo-no-audio-fade flag so Howler starts quickly in the recording
//
// Haze is a real filter applied to canvas draws — blurry frames produce pHash values
// that don't match the seeded (clear-frame) hash, so recognition only fires once the
// haze is gone. Calling __clearHaze() fades the filter over durationMs and recognition
// will fire shortly after.

function buildDemoCameraScript(targets) {
  const targetsJson = JSON.stringify(
    targets.map((t) => ({ videoUrl: t.videoUrl, concertId: t.concertId, seededHash: t.seededHash }))
  );
  return `(function () {
  var targets = ${targetsJson};
  var currentIndex = 0;
  var hazeLevel = 1.0;

  var canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 640;
  var ctx = canvas.getContext('2d');
  if (!ctx) { return; }

  var video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  video.style.cssText = 'position:fixed;top:-200%;left:-200%;width:1px;height:1px;pointer-events:none;';

  function loadTarget(index) {
    video.src = targets[index].videoUrl;
    video.load();
    video.play().catch(function () {});
  }

  function drawCoverFrame() {
    if (video.readyState < 2) { return; }
    var vw = video.videoWidth, vh = video.videoHeight;
    var sx = 0, sy = 0, sw = vw, sh = vh;
    var aspect = 960 / 640;
    if (vw / vh > aspect) { sw = sh * aspect; sx = (vw - sw) / 2; }
    else { sh = sw / aspect; sy = (vh - sh) / 2; }
    if (hazeLevel > 0) {
      ctx.filter = 'blur(' + (hazeLevel * 8).toFixed(1) + 'px) brightness(' + (0.55 + (1 - hazeLevel) * 0.45).toFixed(2) + ')';
    } else {
      ctx.filter = 'none';
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 960, 640);
  }

  var renderTimer = null;
  function startRender() {
    if (renderTimer !== null) { return; }
    (function tick() { drawCoverFrame(); renderTimer = setTimeout(tick, 33); }());
  }

  var doAppend = function () {
    document.body.appendChild(video);
    loadTarget(0);
    startRender();
  };
  if (document.body) { doAppend(); }
  else { document.addEventListener('DOMContentLoaded', doAppend); }

  var stream = canvas.captureStream(24);
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = function () { return Promise.resolve(stream); };
  }

  // Seed all target hashes on first fetch of recognition data
  var originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
    if (!url.includes('/data.recognition.v2.json')) { return originalFetch(input, init); }
    return originalFetch(input, init).then(function (response) {
      return response.clone().json().catch(function () { return null; }).then(function (payload) {
        if (!payload || !Array.isArray(payload.entries)) { return response; }
        targets.forEach(function (target) {
          if (!target.seededHash) { return; }
          var entry = payload.entries.find(function (e) { return e && e.concertId === target.concertId; });
          if (entry) {
            var existing = Array.isArray(entry.phash) ? entry.phash : [];
            entry.phash = [target.seededHash].concat(existing.filter(function (h) { return h !== target.seededHash; }));
          }
        });
        return new Response(JSON.stringify(payload), {
          status: response.status,
          statusText: response.statusText,
          headers: { 'Content-Type': 'application/json' },
        });
      });
    });
  };

  // Demo mode: fast audio fade so playback starts quickly in the recording
  try { localStorage.setItem('photo-signal-demo-no-audio-fade', 'true'); } catch (e) {}

  // Controls exposed for the demo script to call via page.evaluate()
  window.__clearHaze = function (durationMs) {
    hazeLevel = 1.0;
    var start = Date.now();
    var dur = durationMs || 1500;
    (function tick() {
      var elapsed = Date.now() - start;
      hazeLevel = Math.max(0, 1 - elapsed / dur);
      if (hazeLevel > 0) { setTimeout(tick, 33); }
    }());
  };

  window.__setCameraTarget = function (index) {
    currentIndex = index;
    hazeLevel = 1.0;
    loadTarget(index);
  };
}());
`;
}

// ── Audio interception ────────────────────────────────────────────────────────

async function setupAudioInterception(page, audioEvents, captureStartRef) {
  fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });
  await page.route(/\.opus($|\?)/, async (route) => {
    const url = route.request().url();
    const filename = url.split('/').pop().split('?')[0];
    const cachePath = path.join(AUDIO_CACHE_DIR, filename);

    if (!fs.existsSync(cachePath)) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          fs.writeFileSync(cachePath, Buffer.from(await res.arrayBuffer()));
        }
      } catch (err) {
        console.warn(`[audio] Download failed for ${filename}: ${err.message}`);
      }
    }

    if (fs.existsSync(cachePath)) {
      // Track first request per file (subsequent requests are seeks/retries)
      if (!audioEvents.some((e) => e.cachePath === cachePath)) {
        const startMs = captureStartRef.value !== null ? Date.now() - captureStartRef.value : 0;
        audioEvents.push({ url, cachePath, startMs });
        console.log(`   ♪ Audio intercepted: ${filename} at +${(startMs / 1000).toFixed(1)}s`);
      }
      await route.fulfill({
        body: fs.readFileSync(cachePath),
        contentType: 'audio/ogg; codecs=opus',
        headers: {
          'Content-Length': String(fs.statSync(cachePath).size),
          'Cache-Control': 'no-store',
        },
      });
    } else {
      await route.continue();
    }
  });
}

// ── Click helper ──────────────────────────────────────────────────────────────

async function clickWithIndicator(page, locator) {
  const box = await locator.boundingBox();
  if (box) {
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);
    // String-based evaluate so ESLint doesn't flag browser globals (document, setTimeout)
    await page.evaluate(`(function(){
      var dot = document.createElement('div');
      dot.style.cssText = 'position:fixed;left:${cx}px;top:${cy}px;width:68px;height:68px;border-radius:50%;border:3px solid rgba(255,255,255,0.9);background:rgba(255,255,255,0.25);transform:translate(-50%,-50%);z-index:99999;pointer-events:none;transition:opacity 0.25s ease;';
      document.body.appendChild(dot);
      setTimeout(function(){dot.style.opacity='0';setTimeout(function(){dot.remove();},300);},500);
    })()`);
  }
  await locator.click({ force: true });
}

// ── Story functions ───────────────────────────────────────────────────────────
// Two separate functions with zero if (testMode) branches inside.
// runFastTestStory: landing → first search → match → fade (validates the core pipeline)
// runFullDemoStory: complete 3-target narrative

async function runFastTestStory(page, timing) {
  const {
    landingHoldMs,
    hazeHoldMs,
    hazeClearMs,
    matchTimeoutMs,
    firstMatchHoldMs,
    fadeToBlackMs,
  } = timing;
  const beginBtn = page.getByRole('button', { name: /activate camera and begin experience/i });
  const closeBtn = page.getByRole('button', { name: /close concert view/i });

  // Scene 0: Landing
  await page.waitForTimeout(landingHoldMs);

  // Scene 1: Begin → fake camera starts with haze
  await clickWithIndicator(page, beginBtn);
  await page.waitForTimeout(500);
  await page.waitForTimeout(hazeHoldMs);
  // String-based evaluate so ESLint doesn't flag browser globals (window, document, rAF)
  await page.evaluate(`window.__clearHaze(${hazeClearMs})`);

  // Scene 2: Wait for match
  await page.waitForSelector('html[data-state="matched"]', { timeout: matchTimeoutMs });
  await page.waitForTimeout(firstMatchHoldMs);

  // Scene 3: Close + fade to black
  const closeVisible = await closeBtn.isVisible().catch(() => false);
  if (closeVisible) await clickWithIndicator(page, closeBtn);

  await page.evaluate(
    `(function(){var o=document.createElement('div');o.style.cssText='position:fixed;inset:0;background:#000;opacity:0;z-index:99999;pointer-events:none;transition:opacity 1s ease;';document.body.appendChild(o);requestAnimationFrame(function(){o.style.opacity='1';});})()`
  );
  await page.waitForTimeout(fadeToBlackMs);
}

async function runFullDemoStory(page, timing) {
  const {
    landingHoldMs,
    hazeHoldMs,
    hazeClearMs,
    matchTimeoutMs,
    firstMatchHoldMs,
    controlTapGapMs,
    matchHoldMs,
    fadeToBlackMs,
  } = timing;

  const beginBtn = page.getByRole('button', { name: /activate camera and begin experience/i });
  const closeBtn = page.getByRole('button', { name: /close concert view/i });
  const nextTrackBtn = page.getByRole('button', { name: 'Next track' });
  const prevTrackBtn = page.getByRole('button', { name: 'Previous track' });

  // Scene 0: Landing hold
  await page.waitForTimeout(landingHoldMs);

  // Scene 1: Begin camera + wait in scanning state, then clear haze
  await clickWithIndicator(page, beginBtn);
  await page.waitForTimeout(500);
  await page.waitForTimeout(hazeHoldMs);
  // String-based evaluate so ESLint doesn't flag browser globals (window, document, rAF)
  await page.evaluate(`window.__clearHaze(${hazeClearMs})`);

  // Scene 2: First match (target 0) — hold on concert info
  await page.waitForSelector('html[data-state="matched"]', { timeout: matchTimeoutMs });
  await page.waitForTimeout(firstMatchHoldMs);

  // Scene 3: Audio controls
  const playPauseBtn = page
    .locator('button[aria-label^="Play"], button[aria-label^="Pause"]')
    .first();
  await clickWithIndicator(page, playPauseBtn);
  await page.waitForTimeout(controlTapGapMs);

  const nextVisible = await nextTrackBtn.isVisible().catch(() => false);
  if (nextVisible) {
    await clickWithIndicator(page, nextTrackBtn);
    await page.waitForTimeout(controlTapGapMs);
    await clickWithIndicator(page, prevTrackBtn);
    await page.waitForTimeout(controlTapGapMs);
  }

  // Scene 4: Close panel, switch to second target
  await clickWithIndicator(page, closeBtn);
  await page.waitForSelector('html:not([data-state="matched"])', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);

  // Scene 5: Second target (Barna)
  await page.evaluate('window.__setCameraTarget(1)');
  await page.waitForTimeout(hazeHoldMs);
  await page.evaluate(`window.__clearHaze(${hazeClearMs})`);
  await page.waitForSelector('html[data-state="matched"]', { timeout: matchTimeoutMs });
  await page.waitForTimeout(matchHoldMs);

  // Scene 6: Close, switch to third target
  await clickWithIndicator(page, closeBtn);
  await page.waitForSelector('html:not([data-state="matched"])', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);

  // Scene 7: Third target (Croy)
  await page.evaluate('window.__setCameraTarget(2)');
  await page.waitForTimeout(hazeHoldMs);
  await page.evaluate(`window.__clearHaze(${hazeClearMs})`);
  await page.waitForSelector('html[data-state="matched"]', { timeout: matchTimeoutMs });
  await page.waitForTimeout(matchHoldMs);

  // Scene 8: Fade to black
  await page.evaluate(
    `(function(){var o=document.createElement('div');o.style.cssText='position:fixed;inset:0;background:#000;opacity:0;z-index:99999;pointer-events:none;transition:opacity 1.5s ease;';document.body.appendChild(o);requestAnimationFrame(function(){o.style.opacity='1';});})()`
  );
  await page.waitForTimeout(fadeToBlackMs);
}

// ── Output builders ───────────────────────────────────────────────────────────

function buildGif(webmPath, gifPath) {
  const tmpPalette = path.join(os.tmpdir(), `demo-palette-${Date.now()}.png`);
  try {
    run('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      webmPath,
      '-vf',
      `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff`,
      tmpPalette,
    ]);
    run('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      webmPath,
      '-i',
      tmpPalette,
      '-filter_complex',
      `[0:v]fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a`,
      '-loop',
      '0',
      gifPath,
    ]);
  } finally {
    try {
      fs.unlinkSync(tmpPalette);
    } catch {
      /* ignore */
    }
  }
}

function buildMp4(webmPath, audioEvents, mp4Path) {
  // Convert any opus files to WAV first (better ffmpeg compatibility)
  const wavEvents = audioEvents.map((ev) => {
    const wavPath = ev.cachePath.replace(/\.opus$/, '.wav');
    if (!fs.existsSync(wavPath)) {
      run('ffmpeg', ['-loglevel', 'error', '-y', '-i', ev.cachePath, wavPath]);
    }
    return { wavPath, startMs: ev.startMs };
  });

  const ffArgs = ['-loglevel', 'error', '-y'];

  // Input 0: video
  ffArgs.push('-i', webmPath);

  // Subsequent inputs: audio tracks with itsoffset
  for (const { wavPath, startMs } of wavEvents) {
    ffArgs.push('-itsoffset', String(startMs / 1000));
    ffArgs.push('-i', wavPath);
  }

  // Video filter: normalize frame rate + even pixel dimensions
  ffArgs.push('-vf', 'fps=fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2');
  ffArgs.push(
    '-c:v',
    'libx264',
    '-crf',
    String(MP4_CRF),
    '-preset',
    'medium',
    '-pix_fmt',
    'yuv420p'
  );

  if (wavEvents.length === 0) {
    ffArgs.push('-an');
  } else if (wavEvents.length === 1) {
    ffArgs.push('-map', '0:v', '-map', '1:a');
    ffArgs.push('-c:a', 'aac', '-b:a', '128k');
  } else {
    const audioLabels = wavEvents.map((_, i) => `[${i + 1}:a]`).join('');
    ffArgs.push(
      '-filter_complex',
      `${audioLabels}amix=inputs=${wavEvents.length}:duration=longest:normalize=0[aout]`
    );
    ffArgs.push('-map', '0:v', '-map', '[aout]');
    ffArgs.push('-c:a', 'aac', '-b:a', '128k');
  }

  ffArgs.push(mp4Path);
  run('ffmpeg', ffArgs);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎬 Photo Signal demo generator — ${TEST_MODE ? 'TEST MODE' : 'FULL DEMO'}\n`);

  // Build production bundle (skip in test/quick modes)
  if (!SKIP_BUILD) {
    console.log('📦 Building production bundle...');
    run('npm', ['run', 'build']);
  }

  // Ensure output dirs
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_RECORDING_DIR, { recursive: true });
  // Clean old recording files so page.video().path() gives us the fresh one
  fs.readdirSync(VIDEO_RECORDING_DIR)
    .filter((f) => f.endsWith('.webm'))
    .forEach((f) => fs.unlinkSync(path.join(VIDEO_RECORDING_DIR, f)));

  // Resolve demo targets (validates manifest + app data)
  console.log('📋 Resolving demo targets...');
  const targets = resolveDemoTargets();
  console.log(
    targets.map((t, i) => `   ${i + 1}. ${t.artistName} (concertId=${t.concertId})`).join('\n')
  );

  // Generate palindrome videos
  console.log('\n🎞️  Preparing palindrome videos...');
  for (const target of targets) {
    process.stdout.write(`   ${path.basename(target.sourceVideoPath)}...`);
    target.halfSpeedPath = ensureHalfSpeedVideo(target.sourceVideoPath);
    console.log(' ✓');
  }

  // Compute seeded hashes from palindrome files
  console.log('\n🔍 Computing video-frame hashes...');
  for (const target of targets) {
    process.stdout.write(`   ${path.basename(target.halfSpeedPath)}...`);
    target.seededHash = await computeHashFromVideoFrame(target.halfSpeedPath);
    target.videoUrl = `/test-assets/camera/${path.basename(target.halfSpeedPath)}`;
    console.log(` ✓ ${target.seededHash.slice(0, 12)}...`);
  }

  // Start preview server
  console.log('\n🚀 Starting preview server...');
  const stderrBuffer = [];
  const preview = startPreviewServer();
  preview.stderr.on('data', (d) => stderrBuffer.push(d.toString()));
  preview.stdout.on('data', () => {}); // drain

  let browser = null;
  const audioEvents = [];
  const captureStartRef = { value: null };
  let webmPath = null;

  try {
    // waitForServer is inside try so the preview process is always killed on failure
    await waitForServer(BASE_URL, preview, stderrBuffer);
    console.log(`   ✓ Preview server ready at ${BASE_URL}`);
    browser = await chromium.launch({
      headless: true,
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });

    const context = await browser.newContext({
      ...devices['Pixel 7'],
      deviceScaleFactor: 1,
      recordVideo: {
        dir: VIDEO_RECORDING_DIR,
        size: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      },
    });

    const page = await context.newPage();

    // Grant camera permissions
    await context.grantPermissions(['camera']);

    // Set up audio interception (before page load)
    await setupAudioInterception(page, audioEvents, captureStartRef);

    // Build and inject camera script (before page load)
    const cameraScript = buildDemoCameraScript(targets);
    await page.addInitScript(cameraScript);

    console.log('\n🎥 Recording demo story...');
    // Set capture start before navigation so audio startMs offsets share
    // the same time origin as the recorded WebM (avoids A/V sync drift).
    captureStartRef.value = Date.now();
    await page.goto(BASE_URL);

    if (TEST_MODE) {
      await runFastTestStory(page, TIMING);
    } else {
      await runFullDemoStory(page, TIMING);
    }

    console.log('   ✓ Story complete, flushing recording...');
    webmPath = await page.video().path();
    await context.close(); // flushes WebM
    // The path may change after close; re-read
    webmPath = await page.video().path();

    console.log(
      `   ✓ WebM saved: ${path.basename(webmPath)} (${(fs.statSync(webmPath).size / 1024 / 1024).toFixed(1)} MB)`
    );

    // Assemble GIF
    console.log('\n🖼️  Building GIF...');
    buildGif(webmPath, TARGET_GIF);
    const gifSize = (fs.statSync(TARGET_GIF).size / 1024 / 1024).toFixed(1);
    console.log(`   ✓ GIF: ${TARGET_GIF} (${gifSize} MB)`);

    // Assemble MP4
    console.log('\n🎬 Building MP4...');
    if (audioEvents.length === 0) {
      console.log('   ⚠ No audio events captured — producing video-only MP4');
    } else {
      console.log(`   ♪ Muxing ${audioEvents.length} audio track(s)...`);
    }
    buildMp4(webmPath, audioEvents, TARGET_MP4);
    const mp4Size = (fs.statSync(TARGET_MP4).size / 1024 / 1024).toFixed(1);
    console.log(`   ✓ MP4: ${TARGET_MP4} (${mp4Size} MB)`);

    console.log('\n✅ Done!\n');
  } finally {
    if (browser) await browser.close().catch(() => {});
    // Graceful shutdown with SIGKILL escalation after 5s
    preview.kill('SIGTERM');
    try {
      process.kill(-preview.pid, 'SIGTERM');
    } catch {
      /* ignore */
    }
    await new Promise((resolve) => {
      const forceKill = setTimeout(() => {
        try {
          preview.kill('SIGKILL');
          process.kill(-preview.pid, 'SIGKILL');
        } catch {
          /* ignore */
        }
        resolve();
      }, 5000);
      preview.once('exit', () => {
        clearTimeout(forceKill);
        resolve();
      });
    });
  }
}

main().catch((err) => {
  console.error('\n❌ Demo generation failed:', err.message ?? err);
  process.exit(1);
});
