#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProjectEnv } from './load-local-env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

const DEFAULT_SOURCE = 'public/data.json';
const DEFAULT_AUDIO_PREFIX = 'prod/audio';
const DEFAULT_PHOTO_PREFIX = 'prod/photos';

export function trimTrailingSlash(value) {
  if (!value) return value;
  return value.endsWith('/') ? value.replace(/\/+$/, '') : value;
}

export function sanitizePrefix(prefix) {
  if (!prefix) return '';
  return prefix.replace(/^\/+|\/+$/g, '');
}

export function buildAudioUrl(concert, baseUrl, prefix = DEFAULT_AUDIO_PREFIX) {
  if (!concert?.audioFile) {
    throw new Error('concert must include audioFile');
  }
  const filename = path.basename(concert.audioFile);
  const cleanedBase = trimTrailingSlash(baseUrl);
  const cleanedPrefix = sanitizePrefix(prefix);
  const parts = [cleanedBase, cleanedPrefix, filename].filter(Boolean);
  return parts.join('/').replace(/(?<!:)\/+/g, '/');
}

export function buildPhotoUrl(concert, baseUrl, prefix = DEFAULT_PHOTO_PREFIX) {
  if (!concert?.imageFile) {
    throw new Error('concert must include imageFile');
  }
  const filename = path.basename(concert.imageFile);
  const cleanedBase = trimTrailingSlash(baseUrl);
  const cleanedPrefix = sanitizePrefix(prefix);
  const parts = [cleanedBase, cleanedPrefix, filename].filter(Boolean);
  return parts.join('/').replace(/(?<!:)\/+/g, '/');
}

export function updateConcertWithCdn(
  concert,
  baseUrl,
  audioPrefix = DEFAULT_AUDIO_PREFIX,
  photoPrefix = DEFAULT_PHOTO_PREFIX
) {
  const updatedAudioUrl = concert.audioFile
    ? buildAudioUrl(concert, baseUrl, audioPrefix)
    : concert.audioFile;
  const updatedPhotoUrl = concert.imageFile
    ? buildPhotoUrl(concert, baseUrl, photoPrefix)
    : concert.photoUrl;

  return {
    ...concert,
    audioFile: updatedAudioUrl,
    photoUrl: updatedPhotoUrl,
  };
}

export function applyCdnToData(
  data,
  baseUrl,
  audioPrefix = DEFAULT_AUDIO_PREFIX,
  photoPrefix = DEFAULT_PHOTO_PREFIX
) {
  if (!data?.concerts || !Array.isArray(data.concerts)) {
    throw new Error('Invalid data.json format: missing concerts array');
  }

  const updatedConcerts = data.concerts.map((concert) =>
    updateConcertWithCdn(concert, baseUrl, audioPrefix, photoPrefix)
  );

  return { ...data, concerts: updatedConcerts };
}

export function createBackup(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Cannot create backup: file not found: ${filePath}`);
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup-${timestamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      if (arg.includes('=')) {
        const raw = arg.slice(2);
        const separatorIndex = raw.indexOf('=');
        const key = raw.slice(0, separatorIndex);
        const value = raw.slice(separatorIndex + 1);
        args[key] = value;
      } else {
        args[arg.slice(2)] = true;
      }
    }
  }
  return args;
}

function printHelp() {
  console.log(`Apply Cloudflare Worker CDN URLs to data.json

Usage:
  npm run apply-cdn-to-data -- --base-url=https://audio.example.com --prefix=prod/audio --photo-prefix=prod/photos

Options:
  --source=<path>   Path to data.json (default: ${DEFAULT_SOURCE})
  --base-url=<url>  Base URL for the Cloudflare Worker (required)
  --prefix=<path>   Audio key prefix inside the bucket (default: ${DEFAULT_AUDIO_PREFIX})
  --photo-prefix=<path>  Photo key prefix inside the bucket (default: ${DEFAULT_PHOTO_PREFIX})
  --dry-run         Preview changes without writing the file
  --help            Show this message
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadProjectEnv(projectRoot);

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const removedFlags = ['audio-index', 'prefer-audio-index', 'allow-audio-index-mismatch'];
  const usedRemovedFlags = removedFlags.filter((flag) => args[flag] !== undefined);
  if (usedRemovedFlags.length > 0) {
    console.error(
      `❌ Error: Removed option(s): ${usedRemovedFlags.map((flag) => `--${flag}`).join(', ')}.`
    );
    console.error(
      '   Use the canonical flow: npm run audio:build-data, then npm run apply-cdn-to-data with --base-url/--prefix only.'
    );
    process.exit(1);
  }

  const source = args.source ? String(args.source) : DEFAULT_SOURCE;
  const baseUrl = trimTrailingSlash(
    String(args['base-url'] ?? process.env.R2_BASE_URL ?? process.env.AUDIO_BASE_URL ?? '')
  );
  const audioPrefix = args.prefix ? sanitizePrefix(String(args.prefix)) : DEFAULT_AUDIO_PREFIX;
  const photoPrefix = args['photo-prefix']
    ? sanitizePrefix(String(args['photo-prefix']))
    : DEFAULT_PHOTO_PREFIX;
  const dryRun = Boolean(args['dry-run']);

  if (!baseUrl) {
    console.error('❌ Error: --base-url is required');
    process.exit(1);
  }

  const dataPath = path.resolve(projectRoot, source);
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Error: Source file not found: ${dataPath}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (error) {
    console.error(`❌ Error: Invalid JSON in ${dataPath}`);
    console.error(error);
    process.exit(1);
  }

  let updated;
  try {
    updated = applyCdnToData(parsed, baseUrl, audioPrefix, photoPrefix);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }

  const changes = [];
  for (let i = 0; i < parsed.concerts.length; i++) {
    const before = parsed.concerts[i];
    const after = updated.concerts[i];
    if (before.audioFile !== after.audioFile) {
      changes.push({
        id: before.id,
        band: before.band,
        from: before.audioFile,
        to: after.audioFile,
      });
    }
  }

  console.log('🎧 Apply CDN to data.json');
  console.log(`  Source: ${dataPath}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Audio prefix: ${audioPrefix}`);
  console.log(`  Photo prefix: ${photoPrefix}`);
  console.log(`  Dry run: ${dryRun ? 'yes' : 'no'}`);
  console.log('');

  console.log(`Found ${changes.length} audio entries to update.`);

  if (dryRun) {
    console.log('⚠️  DRY RUN - no files were modified');
    process.exit(0);
  }

  try {
    const backupPath = createBackup(dataPath);
    console.log(`💾 Backup created at ${backupPath}`);
  } catch (error) {
    console.error(`❌ Backup failed: ${error.message}`);
    process.exit(1);
  }

  const output = JSON.stringify(updated, null, 2) + '\n';
  fs.writeFileSync(dataPath, output, 'utf8');
  console.log('✅ data.json updated with CDN URLs');
}
