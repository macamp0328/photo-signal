#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadImageData, computePHash } from './lib/photoHashUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const APP_DATA_PATH = path.join(REPO_ROOT, 'public', 'data.app.v2.json');
const RECOGNITION_DATA_PATH = path.join(REPO_ROOT, 'public', 'data.recognition.v2.json');

const DEFAULT_PHASH_THRESHOLD = 14;
const DEFAULT_MARGIN_THRESHOLD = 4;
const PHASH_LENGTH = 16;

function parseArgs(argv) {
  const args = {
    maxCases: null,
    startIndex: 0,
    verbose: false,
    summaryJson: null,
    threshold: DEFAULT_PHASH_THRESHOLD,
    marginThreshold: DEFAULT_MARGIN_THRESHOLD,
    topPairs: 10,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

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

    if (token === '--threshold') {
      const next = Number(argv[i + 1]);
      if (Number.isFinite(next) && next >= 0 && next <= 64) {
        args.threshold = Math.floor(next);
        i += 1;
      }
      continue;
    }

    if (token === '--margin-threshold') {
      const next = Number(argv[i + 1]);
      if (Number.isFinite(next) && next >= 0 && next <= 64) {
        args.marginThreshold = Math.floor(next);
        i += 1;
      }
      continue;
    }

    if (token === '--top-pairs') {
      const next = Number(argv[i + 1]);
      if (Number.isFinite(next) && next > 0) {
        args.topPairs = Math.floor(next);
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

function printHeader(args) {
  console.log('═'.repeat(88));
  console.log('PHOTO RECOGNITION ACCURACY AUDIT (pHash)');
  console.log('Sanity test: reference image should match its own stored pHash fingerprints');
  console.log(
    `Runtime-aligned defaults: threshold<=${args.threshold}, margin>=${args.marginThreshold}`
  );
  console.log('═'.repeat(88));
}

function printSummary(summary, totalCases, args) {
  console.log('\n' + '═'.repeat(88));
  console.log('SUMMARY (pHash all-vs-all matching)');
  console.log('═'.repeat(88));
  console.log('Metric | Value');
  console.log('-'.repeat(88));
  const attempts = summary.correct + summary.wrong + summary.noMatch;
  const accuracy = attempts > 0 ? (summary.correct / attempts) * 100 : 0;
  const timings = summarizeTimings(summary.times);
  console.log(`Algorithm | pHash`);
  console.log(`Accuracy  | ${accuracy.toFixed(1)}%`);
  console.log(`Correct   | ${summary.correct}`);
  console.log(`Wrong     | ${summary.wrong}`);
  console.log(`No match  | ${summary.noMatch}`);
  console.log(`Ambiguous | ${summary.ambiguousCollision}`);
  console.log(`Near-thr  | ${summary.nearThresholdNoMatch}`);
  console.log(`Avg time  | ${formatMs(timings.avg)}`);
  console.log(`Min-Max   | ${formatMs(timings.min)}-${formatMs(timings.max)}`);

  console.log('-'.repeat(88));
  console.log(`Cases tested: ${totalCases}`);
  console.log(`Threshold: pHash<=${args.threshold}`);
  console.log(`Margin: best-vs-second >= ${args.marginThreshold}`);

  const topPairs = Object.entries(summary.ambiguousPairCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, args.topPairs);

  if (topPairs.length > 0) {
    console.log('Top ambiguous pairs:');
    topPairs.forEach(([pair, count]) => {
      console.log(`  - ${pair}: ${count}`);
    });
  }

  console.log(
    `Collision margin bins: 0-1=${summary.ambiguousMarginHistogram['0-1']}, 2=${summary.ambiguousMarginHistogram['2']}, 3-4=${summary.ambiguousMarginHistogram['3-4']}, 5+=${summary.ambiguousMarginHistogram['5+']}, unknown=${summary.ambiguousMarginHistogram.unknown}`
  );
  console.log('═'.repeat(88));
}

function buildSummaryPayload(summary, totalCases, startIndex, args) {
  const attempts = summary.correct + summary.wrong + summary.noMatch;
  const timeSum = summary.times.reduce((sum, value) => sum + value, 0);
  const topPairs = Object.entries(summary.ambiguousPairCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, args.topPairs)
    .map(([pair, count]) => ({ pair, count }));

  const payload = {
    totalCases,
    startIndex,
    algorithm: 'phash',
    settings: {
      threshold: args.threshold,
      marginThreshold: args.marginThreshold,
      topPairs: args.topPairs,
    },
    result: {
      correct: summary.correct,
      wrong: summary.wrong,
      noMatch: summary.noMatch,
      ambiguousCollision: summary.ambiguousCollision,
      nearThresholdNoMatch: summary.nearThresholdNoMatch,
      attempts,
      timeSum,
      timeMin: summary.times.length > 0 ? Math.min(...summary.times) : 0,
      timeMax: summary.times.length > 0 ? Math.max(...summary.times) : 0,
    },
    collisionStats: {
      ambiguousMarginHistogram: summary.ambiguousMarginHistogram,
      topAmbiguousPairs: topPairs,
    },
  };

  return payload;
}

function buildConcertRecords(appData, recognitionData) {
  if (Array.isArray(appData?.concerts)) {
    return appData.concerts.map((concert) => ({
      id: concert.id,
      band: concert.band,
      imageFile: concert.imageFile,
      hashes: normalizeHexArray(concert.photoHashes?.phash, PHASH_LENGTH),
    }));
  }

  if (
    appData?.version === 2 &&
    Array.isArray(appData?.artists) &&
    Array.isArray(appData?.photos) &&
    Array.isArray(appData?.entries)
  ) {
    if (recognitionData?.version !== 2 || !Array.isArray(recognitionData?.entries)) {
      throw new Error('Invalid recognition dataset format: expected v2 recognition payload');
    }

    const artistsById = new Map(appData.artists.map((artist) => [artist.id, artist]));
    const photosById = new Map(appData.photos.map((photo) => [photo.id, photo]));
    const recognitionByConcertId = new Map(
      recognitionData.entries.map((entry) => [entry.concertId, entry])
    );

    return appData.entries.flatMap((entry) => {
      const artist = artistsById.get(entry.artistId);
      const photo = entry.photoId ? photosById.get(entry.photoId) : undefined;

      if (!artist) {
        return [];
      }

      const recognitionEntry = recognitionByConcertId.get(entry.id);

      return [
        {
          id: entry.id,
          band: artist.name,
          imageFile: photo?.imageFile,
          hashes: normalizeHexArray(recognitionEntry?.phash, PHASH_LENGTH),
        },
      ];
    });
  }

  throw new Error('Invalid app dataset format: expected v2 payload or legacy concerts array');
}

async function main() {
  const args = parseArgs(process.argv);

  printHeader(args);

  const appRaw = await readFile(APP_DATA_PATH, 'utf-8');
  const appData = JSON.parse(appRaw);

  let recognitionData = null;
  if (!Array.isArray(appData?.concerts)) {
    const recognitionRaw = await readFile(RECOGNITION_DATA_PATH, 'utf-8');
    recognitionData = JSON.parse(recognitionRaw);
  }

  const concerts = buildConcertRecords(appData, recognitionData);

  const testCasesAll = concerts.filter((concert) => typeof concert.imageFile === 'string');
  const startIndex = Math.min(args.startIndex, testCasesAll.length);
  const sliced = testCasesAll.slice(startIndex);
  const testCases = args.maxCases ? sliced.slice(0, args.maxCases) : sliced;

  console.log(`Loaded records: ${concerts.length}`);
  console.log(`App dataset: ${path.relative(REPO_ROOT, APP_DATA_PATH)}`);
  if (recognitionData) {
    console.log(`Recognition dataset: ${path.relative(REPO_ROOT, RECOGNITION_DATA_PATH)}`);
  }
  console.log(`Concerts with imageFile: ${testCasesAll.length}`);
  console.log(`Start index: ${startIndex}`);
  console.log(`Test cases selected: ${testCases.length}`);
  console.log(`Verbose per-case logging: ${args.verbose ? 'ON' : 'OFF'}`);

  const phashReferences = concerts
    .map((concert) => ({
      id: concert.id,
      band: concert.band,
      hashes: concert.hashes,
    }))
    .filter((entry) => entry.hashes.length > 0);

  console.log(`Reference coverage: pHash=${phashReferences.length}\n`);

  const summary = {
    correct: 0,
    wrong: 0,
    noMatch: 0,
    ambiguousCollision: 0,
    nearThresholdNoMatch: 0,
    times: [],
    ambiguousMarginHistogram: {
      '0-1': 0,
      2: 0,
      '3-4': 0,
      '5+': 0,
      unknown: 0,
    },
    ambiguousPairCounts: {},
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

    const start = performance.now();
    const frameHash = computePHash(imageData);
    let best = null;
    let secondBest = null;

    for (const ref of phashReferences) {
      for (const refHash of ref.hashes) {
        const distance = hammingDistance(frameHash, refHash);
        if (!best || distance < best.distance) {
          if (best && best.concertId !== ref.id) {
            secondBest = best;
          }
          best = {
            concertId: ref.id,
            band: ref.band,
            distance,
          };
        } else if (
          best &&
          ref.id !== best.concertId &&
          distance !== best.distance &&
          (!secondBest || distance < secondBest.distance)
        ) {
          secondBest = {
            concertId: ref.id,
            band: ref.band,
            distance,
          };
        }
      }
    }

    const elapsed = performance.now() - start;
    const margin = best && secondBest ? secondBest.distance - best.distance : null;
    const isAmbiguous =
      Boolean(best && best.distance <= args.threshold) &&
      margin !== null &&
      margin < args.marginThreshold;
    const isMatch = Boolean(best && best.distance <= args.threshold && !isAmbiguous);
    const outcome = classifyMatch(concert.id, best?.concertId ?? null, isMatch);

    summary.times.push(elapsed);
    if (outcome === 'correct') summary.correct += 1;
    else if (outcome === 'wrong') summary.wrong += 1;
    else summary.noMatch += 1;

    if (isAmbiguous && best) {
      summary.ambiguousCollision += 1;
      if (margin === null) {
        summary.ambiguousMarginHistogram.unknown += 1;
      } else if (margin <= 1) {
        summary.ambiguousMarginHistogram['0-1'] += 1;
      } else if (margin === 2) {
        summary.ambiguousMarginHistogram['2'] += 1;
      } else if (margin <= 4) {
        summary.ambiguousMarginHistogram['3-4'] += 1;
      } else {
        summary.ambiguousMarginHistogram['5+'] += 1;
      }

      const pairKey = `${best.band} vs ${secondBest?.band ?? 'Unknown rival'}`;
      summary.ambiguousPairCounts[pairKey] = (summary.ambiguousPairCounts[pairKey] ?? 0) + 1;
    } else if (!isMatch && best && best.distance <= args.threshold + 2) {
      summary.nearThresholdNoMatch += 1;
    }

    const marginText = margin === null ? 'n/a' : String(margin);
    const resultLine = `pHash:${outcome}${best ? `(${best.band},d=${best.distance},m=${marginText},${formatMs(elapsed)})` : `(none,${formatMs(elapsed)})`}`;

    if (args.verbose) {
      console.log(`${prefix} ... ${resultLine}`);
    } else if ((i + 1) % 10 === 0 || i + 1 === testCases.length) {
      console.log(`Progress: ${i + 1}/${testCases.length}`);
    }
  }

  printSummary(summary, testCases.length, args);

  if (args.summaryJson) {
    const payload = buildSummaryPayload(summary, testCases.length, startIndex, args);
    const outputPath = path.resolve(REPO_ROOT, args.summaryJson);
    await writeFile(outputPath, JSON.stringify(payload, null, 2));
    console.log(`Summary JSON written: ${outputPath}`);
  }
}

main().catch((error) => {
  console.error('Fatal error in recognition accuracy audit:', error);
  process.exit(1);
});
