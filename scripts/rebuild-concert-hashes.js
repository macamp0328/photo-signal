#!/usr/bin/env node

/* eslint-env node */

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateHashesForFile } from './lib/photoHashUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_TEST_DATA = path.resolve(repoRoot, 'assets/test-data/concerts.dev.json');
const DEFAULT_PUBLIC_DATA = path.resolve(repoRoot, 'public/data.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_TEST_DATA,
    public: DEFAULT_PUBLIC_DATA,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input' && args[i + 1]) {
      options.input = path.resolve(process.cwd(), args[++i]);
    } else if (arg === '--public' && args[i + 1]) {
      options.public = path.resolve(process.cwd(), args[++i]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--skip-public') {
      options.public = null;
    } else {
      console.warn(`⚠️  Unknown argument: ${arg}`);
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

function ensurePhotoHashesStructure(concert) {
  if (!concert.photoHashes) {
    concert.photoHashes = {};
  }
  return concert.photoHashes;
}

async function rebuildHashesForConcert(concert) {
  const imagePath = resolveImagePath(concert.imageFile);
  if (!imagePath) {
    console.warn(`⚠️  Skipping concert ${concert.id} (${concert.band}) - missing imageFile`);
    return null;
  }

  try {
    const hashes = await generateHashesForFile(imagePath);
    const hashSet = ensurePhotoHashesStructure(concert);
    hashSet.phash = hashes.phash;
    hashSet.dhash = hashes.dhash;
    concert.photoHash = hashes.phash;
    return {
      id: concert.id,
      band: concert.band,
      imageFile: concert.imageFile,
      phash: hashes.phash,
      dhash: hashes.dhash,
    };
  } catch (error) {
    console.error(`❌ Failed to process ${concert.band} (${concert.imageFile}):`, error.message);
    return null;
  }
}

async function updatePublicData(publicPath, updatedTestData) {
  if (!publicPath) {
    return { updated: false, count: 0 };
  }

  const publicJson = await loadConcertFile(publicPath);
  const testMap = new Map(updatedTestData.concerts.map((concert) => [concert.id, concert]));
  let updatedCount = 0;

  publicJson.concerts.forEach((concert) => {
    const source = testMap.get(concert.id);
    if (!source || !source.photoHashes) {
      return;
    }
    concert.photoHashes = source.photoHashes;
    concert.photoHash = source.photoHashes.phash ?? concert.photoHash;
    updatedCount += 1;
  });

  return { updated: true, count: updatedCount, payload: publicJson };
}

async function main() {
  const options = parseArgs();
  console.log('📸 Rebuilding concert photo hashes');
  console.log(`Test data file: ${options.input}`);
  if (options.public) {
    console.log(`Public data file: ${options.public}`);
  } else {
    console.log('Public data file: (skipped)');
  }
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'write'}`);
  console.log('━'.repeat(60));

  const testData = await loadConcertFile(options.input);
  const updates = [];

  for (const concert of testData.concerts) {
    const result = await rebuildHashesForConcert(concert);
    if (result) {
      updates.push(result);
      console.log(`✓ ${concert.band} (${concert.imageFile})`);
      console.log(`  phash: ${result.phash.join(', ')}`);
      console.log(`  dhash: ${result.dhash.join(', ')}`);
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
  console.log(`Processed concerts: ${testData.concerts.length}`);
  console.log(`Updated hashes: ${updates.length}`);
  if (options.public) {
    console.log(`Public data synced: ${publicSummary.count}`);
  }
  console.log(
    options.dryRun ? 'Dry run complete (no files written).' : 'Hash regeneration complete.'
  );
}

main().catch((error) => {
  console.error('Fatal error while rebuilding hashes:', error);
  process.exit(1);
});
