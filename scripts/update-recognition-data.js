#!/usr/bin/env node

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadImageData,
  generateHashVariants,
  generateCropHashVariants,
  DEFAULT_GAMMA_VARIANTS,
  DEFAULT_ROTATION_VARIANTS,
  DEFAULT_NEAR_DUP_HAMMING_THRESHOLD,
} from './lib/photoHashUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const ORIGINAL_ARGS = process.argv.slice(2);
const BATCH_CHILD_ENV = 'PHOTO_SIGNAL_BATCH_CHILD';
const IS_BATCH_CHILD = process.env[BATCH_CHILD_ENV] === '1';
const DEFAULT_BATCH_SIZE = 6;
const DEFAULT_TEST_DATA = path.resolve(repoRoot, 'public/data.app.v2.json');
const DEFAULT_PUBLIC_DATA = null;
const DEFAULT_PUBLIC_APP_DATA_V2 = path.resolve(repoRoot, 'public/data.app.v2.json');
const DEFAULT_PUBLIC_RECOGNITION_V2 = path.resolve(repoRoot, 'public/data.recognition.v2.json');
const DEFAULT_IMAGE_DIR = path.resolve(repoRoot, 'assets/prod-photographs');
const VALID_ALGORITHMS = new Set(['phash']);
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp)$/i;
// Labels for each gamma variant in DEFAULT_GAMMA_VARIANTS order [2.0, 1.4, 1.0, 0.7, 0.5]
const EXPOSURE_LABELS = ['very-dark', 'dark', 'normal', 'bright', 'very-bright'];

function parseNumberList(value, label) {
  const parsed = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part));

  if (parsed.length === 0 || parsed.some((num) => !Number.isFinite(num))) {
    throw new Error(`${label} requires a comma-separated list of numbers`);
  }

  return parsed;
}

function parseIds(value, bucket) {
  if (!bucket) {
    bucket = new Set();
  }

  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const parsed = Number(part);
      if (!Number.isInteger(parsed)) {
        throw new Error(`Invalid concert id: ${part}`);
      }
      bucket.add(parsed);
    });

  return bucket;
}

function parseArgs() {
  const args = ORIGINAL_ARGS;
  const options = {
    input: DEFAULT_TEST_DATA,
    public: DEFAULT_PUBLIC_DATA,
    appV2: DEFAULT_PUBLIC_APP_DATA_V2,
    recognitionV2: DEFAULT_PUBLIC_RECOGNITION_V2,
    dryRun: false,
    tasks: {
      hashes: true,
    },
    algorithms: new Set(VALID_ALGORITHMS),
    ids: null,
    pathsMode: false,
    imageTargets: [],
    batchSize: IS_BATCH_CHILD ? Number.POSITIVE_INFINITY : DEFAULT_BATCH_SIZE,
    isBatchChild: IS_BATCH_CHILD,
    hashVariants: {
      rotationAngles: [...DEFAULT_ROTATION_VARIANTS],
      nearDupHammingThreshold: DEFAULT_NEAR_DUP_HAMMING_THRESHOLD,
      useWarmLuma: false,
    },
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--input':
        if (!args[i + 1]) {
          throw new Error('--input requires a file path');
        }
        options.input = path.resolve(process.cwd(), args[++i]);
        break;
      case '--public':
        if (!args[i + 1]) {
          throw new Error('--public requires a file path');
        }
        options.public = path.resolve(process.cwd(), args[++i]);
        break;
      case '--skip-public':
        options.public = null;
        options.appV2 = null;
        options.recognitionV2 = null;
        break;
      case '--app-v2':
        if (!args[i + 1]) {
          throw new Error('--app-v2 requires a file path');
        }
        options.appV2 = path.resolve(process.cwd(), args[++i]);
        break;
      case '--skip-app-v2':
        options.appV2 = null;
        break;
      case '--recognition-v2':
        if (!args[i + 1]) {
          throw new Error('--recognition-v2 requires a file path');
        }
        options.recognitionV2 = path.resolve(process.cwd(), args[++i]);
        break;
      case '--skip-recognition-v2':
        options.recognitionV2 = null;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--hashes-only':
        options.tasks.hashes = true;
        break;
      case '--no-hashes':
        options.tasks.hashes = false;
        break;
      case '--algorithm':
      case '--algorithms':
      case '--hash-algorithms': {
        if (!args[i + 1]) {
          throw new Error(`${arg} requires a comma-separated list`);
        }
        const raw = args[++i]
          .split(',')
          .map((token) => token.trim().toLowerCase())
          .filter(Boolean);
        if (raw.length === 0) {
          throw new Error('At least one hash algorithm must be provided');
        }
        const invalid = raw.filter((token) => !VALID_ALGORITHMS.has(token));
        if (invalid.length > 0) {
          throw new Error(`Unsupported hash algorithm(s): ${invalid.join(', ')}`);
        }
        options.algorithms = new Set(raw);
        break;
      }
      case '--id':
        if (!args[i + 1]) {
          throw new Error('--id requires a numeric value');
        }
        options.ids = parseIds(args[++i], options.ids);
        break;
      case '--ids':
        if (!args[i + 1]) {
          throw new Error('--ids requires a comma-separated list');
        }
        options.ids = parseIds(args[++i], options.ids);
        break;
      case '--paths-mode':
        options.pathsMode = true;
        break;
      case '--rotation-angles':
        if (!args[i + 1]) {
          throw new Error('--rotation-angles requires a comma-separated list, e.g. -8,8');
        }
        options.hashVariants.rotationAngles = parseNumberList(args[++i], '--rotation-angles');
        break;
      case '--no-rotation-variants':
        options.hashVariants.rotationAngles = [];
        break;
      case '--warm-luma':
        options.hashVariants.useWarmLuma = true;
        break;
      case '--near-dup-hamming-threshold': {
        if (!args[i + 1]) {
          throw new Error('--near-dup-hamming-threshold requires an integer >= 0');
        }
        const threshold = Number(args[++i]);
        if (!Number.isInteger(threshold) || threshold < 0) {
          throw new Error('--near-dup-hamming-threshold must be an integer >= 0');
        }
        options.hashVariants.nearDupHammingThreshold = threshold;
        break;
      }
      case '--batch-size': {
        if (!args[i + 1]) {
          throw new Error('--batch-size requires a numeric value (use 0 to disable)');
        }
        const raw = Number(args[++i]);
        if (!Number.isFinite(raw) || raw < 0) {
          throw new Error('--batch-size must be >= 0');
        }
        options.batchSize = raw === 0 ? Number.POSITIVE_INFINITY : Math.max(1, Math.floor(raw));
        break;
      }
      case '--paths':
      case '--images':
        if (!args[i + 1]) {
          throw new Error(`${arg} requires a comma-separated list of paths`);
        }
        options.pathsMode = true;
        splitListArg(args[++i]).forEach((token) => options.imageTargets.push(token));
        break;
      case '--path':
      case '--image':
        if (!args[i + 1]) {
          throw new Error(`${arg} requires a single path`);
        }
        options.pathsMode = true;
        options.imageTargets.push(args[++i]);
        break;
      default:
        if (!arg.startsWith('-')) {
          options.pathsMode = true;
          options.imageTargets.push(arg);
        } else {
          console.warn(`⚠️  Unknown argument ignored: ${arg}`);
        }
    }
  }

  if (!options.tasks.hashes) {
    throw new Error('At least one task must be enabled (hash generation).');
  }

  if (options.tasks.hashes && options.algorithms.size === 0) {
    throw new Error('No hash algorithms selected. Use --algorithms phash.');
  }

  if (options.pathsMode) {
    if (options.imageTargets.length === 0) {
      options.imageTargets.push(DEFAULT_IMAGE_DIR);
    }
    if (!options.tasks.hashes) {
      throw new Error('Paths mode requires hash generation to be enabled.');
    }
    options.public = null;
    options.appV2 = null;
    options.recognitionV2 = null;
  }

  return options;
}

function splitListArg(value) {
  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

function chunkArray(items, size) {
  if (!Number.isFinite(size) || size <= 0) {
    return [items.slice()];
  }
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function buildBatchArgs(originalArgs) {
  const filtered = [];
  for (let i = 0; i < originalArgs.length; i++) {
    const token = originalArgs[i];
    if (token === '--ids' || token === '--id' || token === '--batch-size') {
      i += 1;
      continue;
    }
    filtered.push(token);
  }
  return filtered;
}

function parseSummaryStats(output) {
  const hashMatch = output.match(/Hash updates:\s+(\d+)/);
  const skippedMatch = output.match(/Skipped:\s+(\d+)/);
  return {
    hashes: hashMatch ? Number(hashMatch[1]) : 0,
    skipped: skippedMatch ? Number(skippedMatch[1]) : 0,
  };
}

function runChildBatch(childArgs, batchLabel) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, ...childArgs], {
      env: { ...process.env, [BATCH_CHILD_ENV]: '1' },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const failureReason = signal ? `signal ${signal}` : `exit code ${code}`;
        const error = new Error(`Batch ${batchLabel} failed (${failureReason})\n${stderr}`);
        error.code = code;
        error.signal = signal;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

async function runBatchedProcessing(options, targets) {
  const chunkSize = Math.max(1, Math.floor(options.batchSize));
  const batches = chunkArray(targets, chunkSize);
  const baseArgs = buildBatchArgs(ORIGINAL_ARGS);

  console.log(
    `⚙️  Processing ${targets.length} concert(s) in ${batches.length} batch(es) (≤ ${chunkSize} per batch)`
  );
  console.log('Use --batch-size to adjust or 0 to disable batching.');

  let totalHashes = 0;
  let totalSkipped = 0;

  async function processBatchIds(ids, label) {
    console.log(`\n📦 Batch ${label} → ids: ${ids.join(', ')}`);
    const childArgs = [...baseArgs, '--ids', ids.join(',')];

    try {
      const { stdout } = await runChildBatch(childArgs, label);
      const summary = parseSummaryStats(stdout);
      totalHashes += summary.hashes;
      totalSkipped += summary.skipped;
    } catch (error) {
      if (ids.length <= 1) {
        const singleId = ids[0];
        const detail = error?.message || String(error);
        throw new Error(
          `Concert id ${singleId} failed during batched processing. ` +
            `Run with --ids ${singleId} to debug further.\n${detail}`
        );
      }

      const midpoint = Math.ceil(ids.length / 2);
      const left = ids.slice(0, midpoint);
      const right = ids.slice(midpoint);
      console.warn(
        `⚠️  Batch ${label} failed; retrying in smaller groups (${left.length} + ${right.length}).`
      );
      await processBatchIds(left, `${label}.1`);
      await processBatchIds(right, `${label}.2`);
    }
  }

  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];
    const ids = batch.map((concert) => concert.id);
    const label = `${index + 1}/${batches.length}`;
    await processBatchIds(ids, label);
  }

  console.log('\n' + '━'.repeat(60));
  console.log('✅ Batch processing complete');
  console.log(`Hash updates: ${totalHashes}`);
  console.log(`Skipped:      ${totalSkipped}`);
}

async function loadConcertFile(filePath) {
  const contents = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(contents);

  if (
    parsed?.version === 2 &&
    Array.isArray(parsed?.artists) &&
    Array.isArray(parsed?.tracks) &&
    Array.isArray(parsed?.photos) &&
    Array.isArray(parsed?.entries)
  ) {
    const artistsById = new Map(parsed.artists.map((artist) => [artist.id, artist]));
    const tracksById = new Map(parsed.tracks.map((track) => [track.id, track]));
    const photosById = new Map(parsed.photos.map((photo) => [photo.id, photo]));

    const concerts = parsed.entries.flatMap((entry) => {
      const artist = artistsById.get(entry.artistId);
      const track = tracksById.get(entry.trackId);
      if (!artist || !track) {
        return [];
      }

      const photo = entry.photoId ? photosById.get(entry.photoId) : undefined;

      return [
        {
          id: entry.id,
          band: artist.name,
          imageFile: photo?.imageFile,
          recognitionEnabled: entry.recognitionEnabled ?? photo?.recognitionEnabled,
          photoHashes: photo?.photoHashes,
          _photoRef: photo,
        },
      ];
    });

    return {
      parsed,
      concerts,
    };
  }

  throw new Error(`Expected v2 payload in ${filePath}`);
}

async function writeConcertFile(filePath, dataset) {
  for (const concert of dataset.concerts) {
    if (!concert._photoRef) {
      continue;
    }

    if (concert.photoHashes) {
      concert._photoRef.photoHashes = concert.photoHashes;
    } else {
      delete concert._photoRef.photoHashes;
    }
  }

  await writeFile(filePath, `${JSON.stringify(dataset.parsed, null, 2)}\n`);
}

function resolveImagePath(imageFile) {
  if (!imageFile) {
    return null;
  }
  const normalized = imageFile.replace(/^[\\/]+/, '');
  return path.resolve(repoRoot, normalized);
}

function ensurePhotoHashesStructure(concert) {
  if (!concert.photoHashes) {
    concert.photoHashes = {};
  }
  return concert.photoHashes;
}

async function processConcert(concert, options) {
  const status = {
    id: concert.id,
    band: concert.band,
    hashes: false,
    errors: [],
    reason: null,
  };

  if (!options.tasks.hashes) {
    status.reason = 'No tasks enabled';
    return status;
  }

  if (concert.recognitionEnabled === false) {
    status.reason = 'Recognition disabled for this entry';
    return status;
  }

  if (!concert.imageFile) {
    status.reason = 'Missing imageFile path';
    return status;
  }

  const imagePath = resolveImagePath(concert.imageFile);
  if (!imagePath) {
    status.reason = 'Unable to resolve image path';
    return status;
  }

  let cachedImageData;
  const ensureImageData = async () => {
    if (!cachedImageData) {
      cachedImageData = await loadImageData(imagePath);
    }
    return cachedImageData;
  };

  if (options.tasks.hashes) {
    try {
      const imageData = await ensureImageData();
      const hashVariants = generateHashVariants(imageData, DEFAULT_GAMMA_VARIANTS, {
        rotationAngles: options.hashVariants.rotationAngles,
        nearDupHammingThreshold: options.hashVariants.nearDupHammingThreshold,
        useWarmLuma: options.hashVariants.useWarmLuma,
      });
      const hashStore = ensurePhotoHashesStructure(concert);

      if (options.algorithms.has('phash')) {
        hashStore.phash = hashVariants.phash;
        hashStore.cropPhashes = generateCropHashVariants(imageData, DEFAULT_GAMMA_VARIANTS, {
          rotationAngles: options.hashVariants.rotationAngles,
          nearDupHammingThreshold: options.hashVariants.nearDupHammingThreshold,
          useWarmLuma: options.hashVariants.useWarmLuma,
        });
      }

      status.hashes = true;
    } catch (error) {
      status.errors.push(`hash generation failed: ${error.message}`);
    }
  }

  return status;
}

async function collectImageTargets(targets) {
  const files = [];
  const seen = new Set();

  for (const target of targets) {
    const resolvedTarget = path.resolve(process.cwd(), target);
    let targetStat;
    try {
      targetStat = await stat(resolvedTarget);
    } catch {
      console.warn(`⚠️  Skipping missing path: ${target}`);
      continue;
    }

    if (targetStat.isDirectory()) {
      const entries = await readdir(resolvedTarget);
      for (const entry of entries) {
        if (!IMAGE_EXTENSIONS.test(entry)) {
          continue;
        }
        const entryPath = path.join(resolvedTarget, entry);
        if (seen.has(entryPath)) {
          continue;
        }
        seen.add(entryPath);
        files.push({
          absolutePath: entryPath,
          displayPath: path.relative(process.cwd(), entryPath) || entry,
        });
      }
      continue;
    }

    if (targetStat.isFile()) {
      if (!IMAGE_EXTENSIONS.test(resolvedTarget)) {
        console.warn(`⚠️  Skipping non-image file: ${target}`);
        continue;
      }
      if (seen.has(resolvedTarget)) {
        continue;
      }
      seen.add(resolvedTarget);
      files.push({
        absolutePath: resolvedTarget,
        displayPath: path.relative(process.cwd(), resolvedTarget) || target,
      });
      continue;
    }

    console.warn(`⚠️  Skipping unsupported path: ${target}`);
  }

  return files.sort((a, b) => a.displayPath.localeCompare(b.displayPath));
}

function logHashDetails(algorithm, hashes) {
  hashes.forEach((hash, idx) => {
    const label = EXPOSURE_LABELS[idx] ?? `variant ${idx + 1}`;
    console.log(`  ${algorithm.toUpperCase()} (${label}): ${hash}`);
  });
}

async function syncPublicData(publicPath, sourceData, updateState, dryRun) {
  if (!publicPath || updateState.size === 0) {
    return { synced: 0 };
  }

  const publicData = await loadConcertFile(publicPath);
  const sourceMap = new Map(sourceData.concerts.map((concert) => [concert.id, concert]));
  let synced = 0;

  for (const concert of publicData.concerts) {
    const state = updateState.get(concert.id);
    if (!state) {
      continue;
    }

    const source = sourceMap.get(concert.id);
    if (!source) {
      continue;
    }

    if (state.hashes) {
      if (source.photoHashes) {
        concert.photoHashes = source.photoHashes;
      } else {
        delete concert.photoHashes;
      }
    }

    synced += 1;
  }

  if (!dryRun && synced > 0) {
    await writeFile(publicPath, `${JSON.stringify(publicData, null, 2)}\n`);
  }

  return { synced };
}

async function syncAppDataV2(appV2Path, sourceData, updateState, dryRun) {
  if (!appV2Path || updateState.size === 0) {
    return { syncedPhotos: 0, skipped: false };
  }

  let appDataV2;
  try {
    const contents = await readFile(appV2Path, 'utf-8');
    appDataV2 = JSON.parse(contents);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { syncedPhotos: 0, skipped: true };
    }
    throw error;
  }

  if (!Array.isArray(appDataV2?.entries) || !Array.isArray(appDataV2?.photos)) {
    return { syncedPhotos: 0, skipped: true };
  }

  const sourceMap = new Map(sourceData.concerts.map((concert) => [concert.id, concert]));
  const entryByConcertId = new Map(appDataV2.entries.map((entry) => [entry.id, entry]));
  const photoById = new Map(appDataV2.photos.map((photo) => [photo.id, photo]));

  let syncedPhotos = 0;

  for (const [concertId, state] of updateState.entries()) {
    if (!state.hashes) {
      continue;
    }

    const sourceConcert = sourceMap.get(concertId);
    const entry = entryByConcertId.get(concertId);
    if (!sourceConcert || !entry?.photoId) {
      continue;
    }

    const photo = photoById.get(entry.photoId);
    if (!photo) {
      continue;
    }

    if (sourceConcert.photoHashes) {
      photo.photoHashes = sourceConcert.photoHashes;
    } else {
      delete photo.photoHashes;
    }

    syncedPhotos += 1;
  }

  if (!dryRun && syncedPhotos > 0) {
    await writeFile(appV2Path, `${JSON.stringify(appDataV2, null, 2)}\n`);
  }

  return { syncedPhotos, skipped: false };
}

async function syncRecognitionDataV2(recognitionV2Path, sourceData, updateState, dryRun) {
  if (!recognitionV2Path || updateState.size === 0) {
    return { syncedEntries: 0, skipped: false };
  }

  let recognitionV2;
  try {
    const contents = await readFile(recognitionV2Path, 'utf-8');
    recognitionV2 = JSON.parse(contents);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { syncedEntries: 0, skipped: true };
    }
    throw error;
  }

  if (!Array.isArray(recognitionV2?.entries)) {
    return { syncedEntries: 0, skipped: true };
  }

  const sourceMap = new Map(sourceData.concerts.map((concert) => [concert.id, concert]));
  const entryByConcertId = new Map(
    recognitionV2.entries
      .filter((entry) => Number.isInteger(entry?.concertId))
      .map((entry) => [entry.concertId, entry])
  );

  let syncedEntries = 0;

  for (const [concertId, state] of updateState.entries()) {
    if (!state.hashes) {
      continue;
    }

    const sourceConcert = sourceMap.get(concertId);
    const entry = entryByConcertId.get(concertId);
    if (!sourceConcert || !entry) {
      continue;
    }

    const phash = Array.isArray(sourceConcert.photoHashes?.phash)
      ? sourceConcert.photoHashes.phash.filter(
          (hash) => typeof hash === 'string' && hash.length > 0
        )
      : [];

    entry.phash = phash;

    const cropPhashesRaw = sourceConcert.photoHashes?.cropPhashes;
    if (cropPhashesRaw && typeof cropPhashesRaw === 'object') {
      const cropPhashes = {};
      for (const [cropKey, hashes] of Object.entries(cropPhashesRaw)) {
        if (!Array.isArray(hashes)) {
          continue;
        }
        const validHashes = hashes.filter((hash) => typeof hash === 'string' && hash.length > 0);
        if (validHashes.length > 0) {
          cropPhashes[cropKey] = validHashes;
        }
      }

      if (Object.keys(cropPhashes).length > 0) {
        entry.cropPhashes = cropPhashes;
      } else {
        delete entry.cropPhashes;
      }
    } else {
      delete entry.cropPhashes;
    }

    syncedEntries += 1;
  }

  if (!dryRun && syncedEntries > 0) {
    await writeFile(recognitionV2Path, `${JSON.stringify(recognitionV2, null, 2)}\n`);
  }

  return { syncedEntries, skipped: false };
}

function formatTaskSummary(status, options) {
  const parts = [];
  if (status.hashes) {
    parts.push(`hashes(${Array.from(options.algorithms).join('+')})`);
  }
  return parts.join(', ');
}

async function runPathsMode(options) {
  console.log('📸 Photo Signal recognition data updater — paths mode');
  console.log(`Algorithms: ${Array.from(options.algorithms).join(', ')}`);
  console.log(`Rotation angles: ${options.hashVariants.rotationAngles.join(', ') || '(disabled)'}`);
  console.log(`Near-dup dedup threshold: ${options.hashVariants.nearDupHammingThreshold}`);
  console.log('Targets:');
  options.imageTargets.forEach((target) => console.log(`  • ${target}`));
  console.log('━'.repeat(60));

  const images = await collectImageTargets(options.imageTargets);
  if (images.length === 0) {
    console.error('❌ No image files found for the provided targets.');
    return;
  }

  console.log(`Found ${images.length} image(s):\n`);
  const results = [];

  for (const { absolutePath, displayPath } of images) {
    try {
      const imageData = await loadImageData(absolutePath);
      const { width, height } = imageData;
      const hashVariants = generateHashVariants(imageData, DEFAULT_GAMMA_VARIANTS, {
        rotationAngles: options.hashVariants.rotationAngles,
        nearDupHammingThreshold: options.hashVariants.nearDupHammingThreshold,
        useWarmLuma: options.hashVariants.useWarmLuma,
      });
      const photoHashes = {};

      for (const algorithm of options.algorithms) {
        photoHashes[algorithm] = hashVariants[algorithm];
      }

      console.log(`✓ ${displayPath}`);
      for (const algorithm of options.algorithms) {
        logHashDetails(algorithm, photoHashes[algorithm]);
      }
      console.log(`  Size: ${width} × ${height} px\n`);

      results.push({
        file: displayPath,
        dimensions: `${width} × ${height} px`,
        photoHashes,
      });
    } catch (error) {
      console.error(`❌ Failed to process ${displayPath}: ${error.message}`);
    }
  }

  if (results.length === 0) {
    console.log('No hashes were generated.');
    return;
  }

  console.log('━'.repeat(60));
  console.log('\n📋 JSON Output (merge into concerts data):\n');
  const jsonOutput = results.map(({ file, photoHashes }) => ({ file, photoHashes }));
  console.log(JSON.stringify(jsonOutput, null, 2));
  console.log('\n━'.repeat(60));
  console.log('\n✅ Hash generation complete!');
  console.log('💡 Next steps: merge these hashes into your concert entries.\n');
}

async function main() {
  const options = parseArgs();

  if (options.pathsMode) {
    await runPathsMode(options);
    return;
  }

  console.log('📸 Photo Signal recognition data updater');
  console.log(`Input:  ${options.input}`);
  console.log(`Public: ${options.public ?? '(skipped)'}`);
  console.log(`App v2: ${options.appV2 ?? '(skipped)'}`);
  console.log(`Recognition v2: ${options.recognitionV2 ?? '(skipped)'}`);
  console.log(`Tasks: hashes=${options.tasks.hashes ? 'on' : 'off'}`);
  if (options.tasks.hashes) {
    console.log(`Hash algorithms: ${Array.from(options.algorithms).join(', ')}`);
    console.log(
      `Rotation angles: ${options.hashVariants.rotationAngles.join(', ') || '(disabled)'}`
    );
    console.log(`Near-dup dedup threshold: ${options.hashVariants.nearDupHammingThreshold}`);
  }
  if (options.ids && options.ids.size > 0) {
    console.log(`Targeting concert ids: ${Array.from(options.ids).join(', ')}`);
  }
  console.log(options.dryRun ? 'Mode: DRY RUN (no files will be written)' : 'Mode: write');
  console.log('━'.repeat(60));

  const dataset = await loadConcertFile(options.input);
  const targets = options.ids
    ? dataset.concerts.filter((concert) => options.ids.has(concert.id))
    : dataset.concerts;

  if (targets.length === 0) {
    console.log('No concerts matched the provided criteria.');
    return;
  }

  const shouldBatch =
    !options.pathsMode &&
    !options.isBatchChild &&
    Number.isFinite(options.batchSize) &&
    targets.length > options.batchSize;

  if (shouldBatch) {
    await runBatchedProcessing(options, targets);
    return;
  }

  const updateState = new Map();
  let hashCount = 0;
  let skipped = 0;

  for (const concert of targets) {
    const status = await processConcert(concert, options);
    if (status.hashes) {
      updateState.set(concert.id, { hashes: status.hashes });
      if (status.hashes) hashCount += 1;
      console.log(`✓ ${concert.band}`);
      console.log(`  ${formatTaskSummary(status, options)}`);
    } else if (status.errors.length > 0) {
      skipped += 1;
      console.error(`❌ ${concert.band}`);
      status.errors.forEach((message) => console.error(`  ${message}`));
    } else {
      skipped += 1;
      console.warn(`⚪ Skipped ${concert.band} (${status.reason ?? 'no updates'})`);
    }
  }

  if (!options.dryRun) {
    await writeConcertFile(options.input, dataset);
    console.log(`💾 Updated ${options.input}`);
  } else {
    console.log('📝 Dry run complete. Input file not modified.');
  }

  if (options.public) {
    const sync = await syncPublicData(options.public, dataset, updateState, options.dryRun);
    if (sync.synced === 0) {
      console.log('No matching concerts required syncing to public data.');
    } else if (options.dryRun) {
      console.log(`↪ Would sync ${sync.synced} concerts to ${options.public}`);
    } else {
      console.log(`🔁 Synced ${sync.synced} concerts to ${options.public}`);
    }
  }

  if (options.appV2) {
    const syncV2 = await syncAppDataV2(options.appV2, dataset, updateState, options.dryRun);
    if (syncV2.skipped) {
      console.log('No app v2 data file found/synced (skipped).');
    } else if (syncV2.syncedPhotos === 0) {
      console.log('No matching photos required syncing to app v2 data.');
    } else if (options.dryRun) {
      console.log(`↪ Would sync ${syncV2.syncedPhotos} photos to ${options.appV2}`);
    } else {
      console.log(`🔁 Synced ${syncV2.syncedPhotos} photos to ${options.appV2}`);
    }
  }

  if (options.recognitionV2) {
    const syncRecognition = await syncRecognitionDataV2(
      options.recognitionV2,
      dataset,
      updateState,
      options.dryRun
    );
    if (syncRecognition.skipped) {
      console.log('No recognition v2 data file found/synced (skipped).');
    } else if (syncRecognition.syncedEntries === 0) {
      console.log('No matching entries required syncing to recognition v2 data.');
    } else if (options.dryRun) {
      console.log(
        `↪ Would sync ${syncRecognition.syncedEntries} recognition entries to ${options.recognitionV2}`
      );
    } else {
      console.log(
        `🔁 Synced ${syncRecognition.syncedEntries} recognition entries to ${options.recognitionV2}`
      );
    }
  }

  console.log('━'.repeat(60));
  console.log(`Hash updates: ${hashCount}`);
  console.log(`Skipped:      ${skipped}`);
}

main().catch((error) => {
  console.error('Fatal error while updating recognition data:', error);
  process.exit(1);
});
