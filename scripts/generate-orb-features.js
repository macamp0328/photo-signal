#!/usr/bin/env node

/* eslint-env node */

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadImageData } from './lib/photoHashUtils.js';
import {
  DEFAULT_ORB_CONFIG,
  extractORBFeatures,
  serializeORBFeatures,
} from './lib/orbFeatureUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_TEST_DATA = path.resolve(repoRoot, 'assets/test-data/concerts.json');
const DEFAULT_PUBLIC_DATA = path.resolve(repoRoot, 'public/data.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_TEST_DATA,
    public: DEFAULT_PUBLIC_DATA,
    dryRun: false,
    config: { ...DEFAULT_ORB_CONFIG },
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
      case '--max-features':
        if (!args[i + 1]) {
          throw new Error('--max-features requires a number');
        }
        options.config.maxFeatures = Number(args[++i]);
        if (Number.isNaN(options.config.maxFeatures)) {
          throw new Error('--max-features must be a valid number');
        }
        break;
      case '--fast-threshold':
        if (!args[i + 1]) {
          throw new Error('--fast-threshold requires a number');
        }
        options.config.fastThreshold = Number(args[++i]);
        if (Number.isNaN(options.config.fastThreshold)) {
          throw new Error('--fast-threshold must be a valid number');
        }
        break;
      case '--min-match-count':
        if (!args[i + 1]) {
          throw new Error('--min-match-count requires a number');
        }
        options.config.minMatchCount = Number(args[++i]);
        if (Number.isNaN(options.config.minMatchCount)) {
          throw new Error('--min-match-count must be a valid number');
        }
        break;
      case '--match-ratio-threshold':
        if (!args[i + 1]) {
          throw new Error('--match-ratio-threshold requires a number');
        }
        options.config.matchRatioThreshold = Number(args[++i]);
        if (Number.isNaN(options.config.matchRatioThreshold)) {
          throw new Error('--match-ratio-threshold must be a valid number');
        }
        break;
      default:
        console.warn(`⚠️  Unknown argument: ${arg}`);
        break;
    }
  }

  return options;
}

async function loadConcertFile(filePath) {
  const contents = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(contents);
  if (!Array.isArray(parsed.concerts)) {
    throw new Error(`Expected concerts array in ${filePath}`);
  }
  return parsed;
}

function resolveImagePath(imageFile) {
  if (!imageFile) {
    return null;
  }
  const normalized = imageFile.replace(/^\//, '');
  return path.resolve(repoRoot, normalized);
}

async function generateOrbForConcert(concert, config) {
  const imagePath = resolveImagePath(concert.imageFile);
  if (!imagePath) {
    console.warn(`⚠️  Skipping concert ${concert.id} (${concert.band}) - missing imageFile`);
    return null;
  }

  try {
    const imageData = await loadImageData(imagePath);
    const features = extractORBFeatures(imageData, config);
    const payload = serializeORBFeatures(imageData, features, config);
    concert.orbFeatures = payload;
    return {
      id: concert.id,
      band: concert.band,
      keypoints: payload.keypoints.length,
      descriptors: payload.descriptors.length,
      imageFile: concert.imageFile,
    };
  } catch (error) {
    console.error(`❌ Failed to process ${concert.band} (${concert.imageFile}):`, error.message);
    return null;
  }
}

async function updatePublicData(publicPath, sourceData) {
  if (!publicPath) {
    return { updated: false, count: 0 };
  }

  const publicJson = await loadConcertFile(publicPath);
  const sourceMap = new Map(sourceData.concerts.map((concert) => [concert.id, concert]));
  let updated = 0;

  publicJson.concerts.forEach((concert) => {
    const source = sourceMap.get(concert.id);
    if (!source || !source.orbFeatures) {
      return;
    }
    concert.orbFeatures = source.orbFeatures;
    updated += 1;
  });

  return { updated: true, count: updated, payload: publicJson };
}

async function main() {
  const options = parseArgs();
  console.log('🧠 Generating ORB feature payloads');
  console.log(`Input data: ${options.input}`);
  console.log(`Public data: ${options.public ?? '(skipped)'}`);
  console.log(
    `Config: maxFeatures=${options.config.maxFeatures}, fastThreshold=${options.config.fastThreshold}`
  );
  console.log(
    `        minMatchCount=${options.config.minMatchCount}, matchRatioThreshold=${options.config.matchRatioThreshold}`
  );
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'write'}`);
  console.log('━'.repeat(60));

  const testData = await loadConcertFile(options.input);
  const updates = [];

  for (const concert of testData.concerts) {
    const result = await generateOrbForConcert(concert, options.config);
    if (result) {
      updates.push(result);
      console.log(`✓ ${result.band}`);
      console.log(`  Image: ${result.imageFile}`);
      console.log(`  Keypoints: ${result.keypoints}`);
    }
  }

  if (!options.dryRun) {
    await writeFile(options.input, `${JSON.stringify(testData, null, 2)}\n`);
  }

  let publicSummary = { updated: false, count: 0 };
  if (options.public) {
    publicSummary = await updatePublicData(options.public, testData);
    if (!options.dryRun && publicSummary.updated && publicSummary.payload) {
      await writeFile(options.public, `${JSON.stringify(publicSummary.payload, null, 2)}\n`);
    }
  }

  console.log('━'.repeat(60));
  console.log(`Concerts processed: ${testData.concerts.length}`);
  console.log(`Payloads generated: ${updates.length}`);
  if (options.public) {
    console.log(`Public data synced: ${publicSummary.count}`);
  }
  console.log(
    options.dryRun ? 'ORB generation dry run complete.' : 'ORB feature generation complete.'
  );
}

main().catch((error) => {
  console.error('Fatal error while generating ORB features:', error);
  process.exit(1);
});
