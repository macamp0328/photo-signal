#!/usr/bin/env node

/* eslint-env node */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadImageData,
  generateHashVariants,
  DEFAULT_EXPOSURE_OFFSETS,
} from './lib/photoHashUtils.js';
import {
  DEFAULT_ORB_CONFIG,
  extractORBFeatures,
  serializeORBFeatures,
} from './lib/orbFeatureUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_TEST_DATA = path.resolve(repoRoot, 'assets/test-data/concerts.dev.json');
const DEFAULT_PUBLIC_DATA = path.resolve(repoRoot, 'public/data.json');
const DEFAULT_IMAGE_DIR = path.resolve(repoRoot, 'assets/test-images');
const VALID_ALGORITHMS = new Set(['phash', 'dhash']);
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp)$/i;
const EXPOSURE_LABELS = ['dark', 'normal', 'bright'];

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

function applyNumericOption(target, key, nextValue) {
  if (nextValue === undefined) {
    throw new Error(`--${key} requires a numeric value`);
  }
  const parsed = Number(nextValue);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${key} must be a valid number`);
  }
  target[key] = parsed;
  return parsed;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_TEST_DATA,
    public: DEFAULT_PUBLIC_DATA,
    dryRun: false,
    tasks: {
      hashes: true,
      orb: true,
    },
    algorithms: new Set(VALID_ALGORITHMS),
    ids: null,
    orbConfig: { ...DEFAULT_ORB_CONFIG },
    pathsMode: false,
    imageTargets: [],
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
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--hashes-only':
        options.tasks.hashes = true;
        options.tasks.orb = false;
        break;
      case '--orb-only':
        options.tasks.hashes = false;
        options.tasks.orb = true;
        break;
      case '--no-hashes':
        options.tasks.hashes = false;
        break;
      case '--no-orb':
        options.tasks.orb = false;
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
      case '--max-features':
        applyNumericOption(options.orbConfig, 'maxFeatures', args[++i]);
        break;
      case '--fast-threshold':
        applyNumericOption(options.orbConfig, 'fastThreshold', args[++i]);
        break;
      case '--min-match-count':
        applyNumericOption(options.orbConfig, 'minMatchCount', args[++i]);
        break;
      case '--match-ratio-threshold':
        applyNumericOption(options.orbConfig, 'matchRatioThreshold', args[++i]);
        break;
      case '--scale-factor':
        applyNumericOption(options.orbConfig, 'scaleFactor', args[++i]);
        break;
      case '--edge-threshold':
        applyNumericOption(options.orbConfig, 'edgeThreshold', args[++i]);
        break;
      case '--paths-mode':
        options.pathsMode = true;
        break;
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

  if (!options.tasks.hashes && !options.tasks.orb) {
    throw new Error('At least one task must be enabled (hashes and/or ORB).');
  }

  if (options.tasks.hashes && options.algorithms.size === 0) {
    throw new Error('No hash algorithms selected. Use --algorithms to choose phash and/or dhash.');
  }

  if (options.pathsMode) {
    if (options.imageTargets.length === 0) {
      options.imageTargets.push(DEFAULT_IMAGE_DIR);
    }
    if (!options.tasks.hashes) {
      throw new Error('Paths mode requires hash generation to be enabled.');
    }
    options.public = null;
    options.tasks.orb = false;
  }

  return options;
}

function splitListArg(value) {
  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

async function loadConcertFile(filePath) {
  const contents = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(contents);
  if (!Array.isArray(parsed.concerts)) {
    throw new Error(`Expected "concerts" array in ${filePath}`);
  }
  return parsed;
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
    orb: false,
    errors: [],
    reason: null,
  };

  if (!options.tasks.hashes && !options.tasks.orb) {
    status.reason = 'No tasks enabled';
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
      const hashVariants = generateHashVariants(imageData, DEFAULT_EXPOSURE_OFFSETS);
      const hashStore = ensurePhotoHashesStructure(concert);

      if (options.algorithms.has('phash')) {
        hashStore.phash = hashVariants.phash;
      }

      if (options.algorithms.has('dhash')) {
        hashStore.dhash = hashVariants.dhash;
      }

      status.hashes = true;
    } catch (error) {
      status.errors.push(`hash generation failed: ${error.message}`);
    }
  }

  if (options.tasks.orb) {
    try {
      const imageData = await ensureImageData();
      const features = extractORBFeatures(imageData, options.orbConfig);
      concert.orbFeatures = serializeORBFeatures(imageData, features, options.orbConfig);
      status.orb = true;
    } catch (error) {
      status.errors.push(`ORB generation failed: ${error.message}`);
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

    if (state.orb) {
      if (source.orbFeatures) {
        concert.orbFeatures = source.orbFeatures;
      } else {
        delete concert.orbFeatures;
      }
    }

    synced += 1;
  }

  if (!dryRun && synced > 0) {
    await writeFile(publicPath, `${JSON.stringify(publicData, null, 2)}\n`);
  }

  return { synced };
}

function formatTaskSummary(status, options) {
  const parts = [];
  if (status.hashes) {
    parts.push(`hashes(${Array.from(options.algorithms).join('+')})`);
  }
  if (status.orb) {
    parts.push('orb');
  }
  return parts.join(', ');
}

async function runPathsMode(options) {
  console.log('📸 Photo Signal recognition data updater — paths mode');
  console.log(`Algorithms: ${Array.from(options.algorithms).join(', ')}`);
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
      const hashVariants = generateHashVariants(imageData, DEFAULT_EXPOSURE_OFFSETS);
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
  console.log(
    `Tasks: hashes=${options.tasks.hashes ? 'on' : 'off'}, orb=${options.tasks.orb ? 'on' : 'off'}`
  );
  if (options.tasks.hashes) {
    console.log(`Hash algorithms: ${Array.from(options.algorithms).join(', ')}`);
  }
  if (options.tasks.orb) {
    console.log(
      `ORB config: maxFeatures=${options.orbConfig.maxFeatures}, fastThreshold=${options.orbConfig.fastThreshold}, matchRatio=${options.orbConfig.matchRatioThreshold}`
    );
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

  const updateState = new Map();
  let hashCount = 0;
  let orbCount = 0;
  let skipped = 0;

  for (const concert of targets) {
    const status = await processConcert(concert, options);
    if (status.hashes || status.orb) {
      updateState.set(concert.id, { hashes: status.hashes, orb: status.orb });
      if (status.hashes) hashCount += 1;
      if (status.orb) orbCount += 1;
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
    await writeFile(options.input, `${JSON.stringify(dataset, null, 2)}\n`);
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

  console.log('━'.repeat(60));
  console.log(`Hash updates: ${hashCount}`);
  console.log(`ORB updates:  ${orbCount}`);
  console.log(`Skipped:      ${skipped}`);
}

main().catch((error) => {
  console.error('Fatal error while updating recognition data:', error);
  process.exit(1);
});
