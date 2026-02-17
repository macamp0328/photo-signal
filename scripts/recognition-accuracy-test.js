#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';
import { loadImageData, computeDHash, computePHash } from './lib/photoHashUtils.js';
import { extractORBFeatures } from './lib/orbFeatureUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(REPO_ROOT, 'public', 'data.json');

const HASH_THRESHOLDS = {
  dhash: 24,
  phash: 12,
};

const HASH_LENGTHS = {
  dhash: 32,
  phash: 16,
};

const ORB_STRICT_CONFIG = {
  maxFeatures: 1000,
  scaleFactor: 1.5,
  nLevels: 8,
  edgeThreshold: 15,
  fastThreshold: 12,
  minMatchCount: 20,
  matchRatioThreshold: 0.75,
};

const ORB_FAST_CONFIG = {
  maxFeatures: 120,
  scaleFactor: 1.5,
  nLevels: 3,
  edgeThreshold: 15,
  fastThreshold: 12,
  minMatchCount: 20,
  matchRatioThreshold: 0.75,
};

const ORB_FAST_MAX_DIMENSION = 1280;

const FULL_CONFIDENCE_MATCH_RATIO = 0.3;

const POPCOUNT_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i += 1) {
  let value = i;
  let count = 0;
  while (value) {
    count += value & 1;
    value >>= 1;
  }
  POPCOUNT_TABLE[i] = count;
}

function parseArgs(argv) {
  const args = {
    mode: 'fast',
    maxCases: null,
    startIndex: 0,
    algorithms: new Set(['dhash', 'phash', 'orb']),
    verbose: false,
    summaryJson: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--mode') {
      const next = argv[i + 1];
      if (next === 'fast' || next === 'strict') {
        args.mode = next;
        i += 1;
      }
      continue;
    }

    if (token === '--max-cases') {
      const next = Number(argv[i + 1]);
      if (Number.isFinite(next) && next > 0) {
        args.maxCases = Math.floor(next);
        i += 1;
      }
      continue;
    }

    if (token === '--start-index') {
      const next = Number(argv[i + 1]);
      if (Number.isFinite(next) && next >= 0) {
        args.startIndex = Math.floor(next);
        i += 1;
      }
      continue;
    }

    if (token === '--algorithms') {
      const raw = (argv[i + 1] ?? '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      const nextSet = new Set(raw.filter((value) => ['dhash', 'phash', 'orb'].includes(value)));
      if (nextSet.size > 0) {
        args.algorithms = nextSet;
        i += 1;
      }
      continue;
    }

    if (token === '--verbose') {
      args.verbose = true;
      continue;
    }

    if (token === '--summary-json') {
      const next = argv[i + 1];
      if (typeof next === 'string' && next.length > 0) {
        args.summaryJson = next;
        i += 1;
      }
      continue;
    }
  }

  return args;
}

function resolveImagePath(imageFile) {
  if (!imageFile || typeof imageFile !== 'string') {
    return null;
  }
  const trimmed = imageFile.replace(/^\/+/, '');
  return path.resolve(REPO_ROOT, trimmed);
}

function normalizeHexArray(values, expectedLength) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  return values.filter(
    (value) =>
      typeof value === 'string' && value.length === expectedLength && /^[0-9a-f]+$/i.test(value)
  );
}

function hexToBinary(hex) {
  let binary = '';
  for (let i = 0; i < hex.length; i += 1) {
    binary += parseInt(hex[i], 16).toString(2).padStart(4, '0');
  }
  return binary;
}

function hammingDistance(hash1, hash2) {
  if (hash1.length !== hash2.length) {
    throw new Error(`Hash lengths must be equal (${hash1.length} vs ${hash2.length})`);
  }

  const binary1 = hexToBinary(hash1);
  const binary2 = hexToBinary(hash2);

  let distance = 0;
  for (let i = 0; i < binary1.length; i += 1) {
    if (binary1[i] !== binary2[i]) {
      distance += 1;
    }
  }
  return distance;
}

function decodeORBPayload(payload) {
  if (!payload || !Array.isArray(payload.keypoints) || !Array.isArray(payload.descriptors)) {
    return null;
  }

  const keypoints = payload.keypoints
    .filter((tuple) => Array.isArray(tuple) && tuple.length >= 6)
    .map(([x, y, angle, response, octave, size]) => ({
      x,
      y,
      angle,
      response,
      octave,
      size,
    }));

  const descriptors = payload.descriptors
    .map((entry) => {
      if (typeof entry !== 'string') {
        return null;
      }
      try {
        return new Uint8Array(Buffer.from(entry, 'base64'));
      } catch {
        return null;
      }
    })
    .filter((entry) => entry instanceof Uint8Array);

  const usableLength = Math.min(keypoints.length, descriptors.length);
  if (usableLength === 0) {
    return {
      keypoints: [],
      descriptors: [],
    };
  }

  return {
    keypoints: keypoints.slice(0, usableLength),
    descriptors: descriptors.slice(0, usableLength),
  };
}

function descriptorDistance(desc1, desc2) {
  if (!(desc1 instanceof Uint8Array) || !(desc2 instanceof Uint8Array)) {
    return Infinity;
  }

  if (desc1.length !== desc2.length) {
    return Infinity;
  }

  let distance = 0;
  for (let i = 0; i < desc1.length; i += 1) {
    distance += POPCOUNT_TABLE[desc1[i] ^ desc2[i]];
  }

  return distance;
}

function trimFeatures(features, maxFeatures) {
  if (!features || !Array.isArray(features.keypoints) || !Array.isArray(features.descriptors)) {
    return {
      keypoints: [],
      descriptors: [],
    };
  }

  if (!Number.isFinite(maxFeatures) || maxFeatures <= 0) {
    return features;
  }

  const usableLength = Math.min(
    features.keypoints.length,
    features.descriptors.length,
    maxFeatures
  );
  return {
    keypoints: features.keypoints.slice(0, usableLength),
    descriptors: features.descriptors.slice(0, usableLength),
  };
}

function resizeImageData(imageData, maxDimension) {
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    return imageData;
  }

  const { width, height } = imageData;
  const maxSide = Math.max(width, height);
  if (maxSide <= maxDimension) {
    return imageData;
  }

  const scale = maxDimension / maxSide;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const sourceCanvas = createCanvas(width, height);
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) {
    return imageData;
  }

  sourceCtx.putImageData(imageData, 0, 0);

  const targetCanvas = createCanvas(targetWidth, targetHeight);
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!targetCtx) {
    return imageData;
  }

  targetCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
  return targetCtx.getImageData(0, 0, targetWidth, targetHeight);
}

function matchORBFeatures(queryFeatures, refFeatures, config) {
  const matches = [];

  for (let i = 0; i < queryFeatures.descriptors.length; i += 1) {
    let bestDist = Infinity;
    let secondBestDist = Infinity;
    let bestIdx = -1;

    for (let j = 0; j < refFeatures.descriptors.length; j += 1) {
      const dist = descriptorDistance(queryFeatures.descriptors[i], refFeatures.descriptors[j]);
      if (dist === Infinity) {
        continue;
      }

      if (dist < bestDist) {
        secondBestDist = bestDist;
        bestDist = dist;
        bestIdx = j;
      } else if (dist < secondBestDist) {
        secondBestDist = dist;
      }
    }

    if (
      bestIdx >= 0 &&
      bestDist !== Infinity &&
      bestDist < config.matchRatioThreshold * secondBestDist
    ) {
      matches.push({
        queryIdx: i,
        trainIdx: bestIdx,
        distance: bestDist,
      });
    }
  }

  const matchCount = matches.length;
  const minKeypoints = Math.min(queryFeatures.keypoints.length, refFeatures.keypoints.length);
  const matchRatio = minKeypoints > 0 ? matchCount / minKeypoints : 0;
  const isMatch = matchCount >= config.minMatchCount;

  const confidence = Math.min(
    matchCount / config.minMatchCount,
    matchRatio / FULL_CONFIDENCE_MATCH_RATIO
  );

  return {
    matchCount,
    queryKeypointCount: queryFeatures.keypoints.length,
    refKeypointCount: refFeatures.keypoints.length,
    matchRatio,
    isMatch,
    confidence: Math.min(1, confidence),
  };
}

function classifyMatch(expectedId, matchedId, isMatch) {
  if (!isMatch || matchedId == null) {
    return 'no-match';
  }
  return matchedId === expectedId ? 'correct' : 'wrong';
}

function summarizeTimings(values) {
  if (values.length === 0) {
    return { avg: 0, min: 0, max: 0 };
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    avg: total / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

function printHeader() {
  console.log('═'.repeat(88));
  console.log('PHOTO RECOGNITION ACCURACY AUDIT');
  console.log('Sanity test: reference image should match its own stored fingerprints/features');
  console.log('═'.repeat(88));
}

function printSummary(summary, totalCases, algorithms, mode) {
  console.log('\n' + '═'.repeat(88));
  console.log('SUMMARY (all-vs-all matching)');
  console.log('═'.repeat(88));
  console.log('Algorithm | Accuracy | Correct | Wrong | No match | Avg time | Min-Max');
  console.log('-'.repeat(88));

  for (const algorithm of ['dhash', 'phash', 'orb']) {
    if (!algorithms.has(algorithm)) {
      continue;
    }
    const bucket = summary[algorithm];
    const attempts = bucket.correct + bucket.wrong + bucket.noMatch;
    const accuracy = attempts > 0 ? (bucket.correct / attempts) * 100 : 0;
    const timings = summarizeTimings(bucket.times);

    const line = [
      algorithm.padEnd(9, ' '),
      `${accuracy.toFixed(1).padStart(6, ' ')}%`,
      String(bucket.correct).padStart(7, ' '),
      String(bucket.wrong).padStart(5, ' '),
      String(bucket.noMatch).padStart(8, ' '),
      formatMs(timings.avg).padStart(9, ' '),
      `${formatMs(timings.min)}-${formatMs(timings.max)}`,
    ].join(' | ');

    console.log(line);
  }

  console.log('-'.repeat(88));
  console.log(`Cases tested: ${totalCases}`);
  console.log(`Mode: ${mode}`);
  console.log('Thresholds: dHash<=24, pHash<=12, ORB minMatchCount>=20');
  console.log('═'.repeat(88));
}

function buildSummaryPayload(summary, totalCases, algorithms, mode, startIndex) {
  const payload = {
    totalCases,
    startIndex,
    mode,
    algorithms: Array.from(algorithms),
    results: {},
  };

  for (const algorithm of ['dhash', 'phash', 'orb']) {
    if (!algorithms.has(algorithm)) {
      continue;
    }

    const bucket = summary[algorithm];
    const attempts = bucket.correct + bucket.wrong + bucket.noMatch;
    const timeSum = bucket.times.reduce((sum, value) => sum + value, 0);

    payload.results[algorithm] = {
      correct: bucket.correct,
      wrong: bucket.wrong,
      noMatch: bucket.noMatch,
      attempts,
      timeSum,
      timeMin: bucket.times.length > 0 ? Math.min(...bucket.times) : 0,
      timeMax: bucket.times.length > 0 ? Math.max(...bucket.times) : 0,
    };
  }

  return payload;
}

async function main() {
  const args = parseArgs(process.argv);
  const orbConfig = args.mode === 'strict' ? ORB_STRICT_CONFIG : ORB_FAST_CONFIG;

  printHeader();

  const raw = await readFile(DATA_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const concerts = Array.isArray(data.concerts) ? data.concerts : [];

  const testCasesAll = concerts.filter((concert) => typeof concert.imageFile === 'string');
  const startIndex = Math.min(args.startIndex, testCasesAll.length);
  const sliced = testCasesAll.slice(startIndex);
  const testCases = args.maxCases ? sliced.slice(0, args.maxCases) : sliced;

  console.log(`Loaded concerts: ${concerts.length}`);
  console.log(`Concerts with imageFile: ${testCasesAll.length}`);
  console.log(`Start index: ${startIndex}`);
  console.log(`Test cases selected: ${testCases.length}`);
  console.log(`Algorithms: ${Array.from(args.algorithms).join(', ')}`);
  console.log(`Mode: ${args.mode}`);
  console.log(`Verbose per-case logging: ${args.verbose ? 'ON' : 'OFF'}`);

  const dhashReferences = concerts
    .map((concert) => ({
      id: concert.id,
      band: concert.band,
      hashes: normalizeHexArray(concert.photoHashes?.dhash, HASH_LENGTHS.dhash),
    }))
    .filter((entry) => entry.hashes.length > 0);

  const phashReferences = concerts
    .map((concert) => ({
      id: concert.id,
      band: concert.band,
      hashes: normalizeHexArray(concert.photoHashes?.phash, HASH_LENGTHS.phash),
    }))
    .filter((entry) => entry.hashes.length > 0);

  const orbReferences = concerts
    .map((concert) => ({
      id: concert.id,
      band: concert.band,
      features: trimFeatures(decodeORBPayload(concert.orbFeatures), orbConfig.maxFeatures),
    }))
    .filter((entry) => entry.features !== null);

  console.log(
    `Reference coverage: dHash=${dhashReferences.length}, pHash=${phashReferences.length}, ORB=${orbReferences.length}\n`
  );

  const summary = {
    dhash: { correct: 0, wrong: 0, noMatch: 0, times: [] },
    phash: { correct: 0, wrong: 0, noMatch: 0, times: [] },
    orb: { correct: 0, wrong: 0, noMatch: 0, times: [] },
  };

  for (let i = 0; i < testCases.length; i += 1) {
    const concert = testCases[i];
    const imagePath = resolveImagePath(concert.imageFile);

    const prefix = `[${String(i + 1).padStart(2, '0')}/${testCases.length}] ${concert.band}`;

    if (!imagePath) {
      if (args.verbose) {
        console.log(`${prefix} ... SKIPPED (invalid imageFile)`);
      }
      continue;
    }

    let imageData;
    try {
      imageData = await loadImageData(imagePath);
    } catch (error) {
      if (args.verbose) {
        console.log(`${prefix} ... ERROR loading image (${error.message})`);
      }
      continue;
    }

    const parts = [];

    // dHash
    if (args.algorithms.has('dhash')) {
      const start = performance.now();
      const frameHash = computeDHash(imageData);
      let best = null;

      for (const ref of dhashReferences) {
        for (const refHash of ref.hashes) {
          const distance = hammingDistance(frameHash, refHash);
          if (!best || distance < best.distance) {
            best = {
              concertId: ref.id,
              band: ref.band,
              distance,
            };
          }
        }
      }

      const elapsed = performance.now() - start;
      const isMatch = Boolean(best && best.distance <= HASH_THRESHOLDS.dhash);
      const outcome = classifyMatch(concert.id, best?.concertId ?? null, isMatch);

      summary.dhash.times.push(elapsed);
      if (outcome === 'correct') summary.dhash.correct += 1;
      else if (outcome === 'wrong') summary.dhash.wrong += 1;
      else summary.dhash.noMatch += 1;

      parts.push(
        `dHash:${outcome}${best ? `(${best.band},d=${best.distance},${formatMs(elapsed)})` : `(none,${formatMs(elapsed)})`}`
      );
    }

    // pHash
    if (args.algorithms.has('phash')) {
      const start = performance.now();
      const frameHash = computePHash(imageData);
      let best = null;

      for (const ref of phashReferences) {
        for (const refHash of ref.hashes) {
          const distance = hammingDistance(frameHash, refHash);
          if (!best || distance < best.distance) {
            best = {
              concertId: ref.id,
              band: ref.band,
              distance,
            };
          }
        }
      }

      const elapsed = performance.now() - start;
      const isMatch = Boolean(best && best.distance <= HASH_THRESHOLDS.phash);
      const outcome = classifyMatch(concert.id, best?.concertId ?? null, isMatch);

      summary.phash.times.push(elapsed);
      if (outcome === 'correct') summary.phash.correct += 1;
      else if (outcome === 'wrong') summary.phash.wrong += 1;
      else summary.phash.noMatch += 1;

      parts.push(
        `pHash:${outcome}${best ? `(${best.band},d=${best.distance},${formatMs(elapsed)})` : `(none,${formatMs(elapsed)})`}`
      );
    }

    // ORB
    if (args.algorithms.has('orb')) {
      const start = performance.now();
      const orbInput =
        args.mode === 'fast' ? resizeImageData(imageData, ORB_FAST_MAX_DIMENSION) : imageData;
      const frameFeatures = trimFeatures(
        extractORBFeatures(orbInput, orbConfig),
        orbConfig.maxFeatures
      );
      let best = null;

      for (const ref of orbReferences) {
        const result = matchORBFeatures(frameFeatures, ref.features, orbConfig);
        if (!best || result.confidence > best.confidence) {
          best = {
            concertId: ref.id,
            band: ref.band,
            ...result,
          };
        }
      }

      const elapsed = performance.now() - start;
      const isMatch = Boolean(best && best.isMatch);
      const outcome = classifyMatch(concert.id, best?.concertId ?? null, isMatch);

      summary.orb.times.push(elapsed);
      if (outcome === 'correct') summary.orb.correct += 1;
      else if (outcome === 'wrong') summary.orb.wrong += 1;
      else summary.orb.noMatch += 1;

      parts.push(
        `ORB:${outcome}${best ? `(${best.band},m=${best.matchCount},c=${(best.confidence * 100).toFixed(1)}%,${formatMs(elapsed)})` : `(none,${formatMs(elapsed)})`}`
      );
    }

    if (args.verbose) {
      console.log(`${prefix} ... ${parts.join(' | ')}`);
    } else if ((i + 1) % 10 === 0 || i + 1 === testCases.length) {
      console.log(`Progress: ${i + 1}/${testCases.length}`);
    }
  }

  printSummary(summary, testCases.length, args.algorithms, args.mode);

  if (args.summaryJson) {
    const payload = buildSummaryPayload(
      summary,
      testCases.length,
      args.algorithms,
      args.mode,
      startIndex
    );
    const outputPath = path.resolve(REPO_ROOT, args.summaryJson);
    await writeFile(outputPath, JSON.stringify(payload, null, 2));
    console.log(`Summary JSON written: ${outputPath}`);
  }
}

main().catch((error) => {
  console.error('Fatal error in recognition accuracy audit:', error);
  process.exit(1);
});
