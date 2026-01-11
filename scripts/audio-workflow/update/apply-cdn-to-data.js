#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_DATA = path.resolve('public/data.json');
const DEFAULT_AUDIO_INDEX = path.resolve('scripts/audio-workflow/encode/output/audio-index.json');

const ENV_BASE_URL = process.env.R2_BASE_URL;
const ENV_PREFIX = process.env.R2_PREFIX ?? 'prod/audio';

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return '';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function normalizePrefix(prefix) {
  if (!prefix) return '';
  const trimmed = prefix.trim();
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
}

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [rawKey, rawValue] = token.slice(2).split('=');
    const key = rawKey.trim();
    if (!key) continue;
    if (typeof rawValue === 'undefined') {
      args[key] = true;
    } else {
      args[key] = rawValue.trim();
    }
  }
  return args;
}

function toBoolean(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
}

function stripToPath(value) {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    const parsed = new URL(value);
    return parsed.pathname.replace(/^\/+/, '');
  }
  return value.replace(/^\/+/, '');
}

function deriveKeyFromIndex(audioIndexMap, concertId, prefix) {
  if (!audioIndexMap.size) return null;
  const entry = audioIndexMap.get(String(concertId));
  if (!entry) return null;
  const normalizedPrefix = normalizePrefix(prefix);
  const filePath = stripToPath(entry);

  if (!normalizedPrefix) return filePath;

  const needle = `${normalizedPrefix}/`;
  if (filePath.startsWith(needle)) return filePath;

  const prefixIndex = filePath.indexOf(needle);
  if (prefixIndex !== -1) return filePath.slice(prefixIndex);

  return `${normalizedPrefix}/${filePath}`;
}

function deriveKeyFromAudio(concert, prefix) {
  const normalizedPrefix = normalizePrefix(prefix);
  const sourceUrl = concert.audioFile || concert.audioFileFallback;
  if (!sourceUrl) return null;

  const pathOnly = stripToPath(sourceUrl);
  if (!normalizedPrefix) return pathOnly;

  const needle = `${normalizedPrefix}/`;
  if (pathOnly.startsWith(needle)) {
    return pathOnly;
  }

  const prefixIndex = pathOnly.indexOf(needle);
  if (prefixIndex !== -1) {
    return pathOnly.slice(prefixIndex);
  }

  const filename = path.basename(pathOnly) || `concert-${concert.id}.opus`;
  return `${normalizedPrefix}/${concert.id}/${filename}`;
}

function loadAudioIndex(audioIndexPath) {
  if (!fs.existsSync(audioIndexPath)) return new Map();
  const content = fs.readFileSync(audioIndexPath, 'utf8');
  const parsed = JSON.parse(content);
  const tracks = Array.isArray(parsed.tracks) ? parsed.tracks : [];

  const map = new Map();
  for (const track of tracks) {
    const photoId = track.photoId ?? track.id;
    if (!photoId) continue;
    const filePath = track.filePath ?? track.fileName;
    if (!filePath) continue;
    map.set(String(photoId), filePath);
  }

  return map;
}

function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup-${timestamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function updateConcert(concert, baseUrl, prefix, audioIndexMap) {
  const key =
    deriveKeyFromIndex(audioIndexMap, concert.id, prefix) ?? deriveKeyFromAudio(concert, prefix);

  if (!key) {
    return { updated: false, concert, reason: 'missing-key' };
  }

  const nextAudioUrl = `${baseUrl}/${key}`;
  const fallback = concert.audioFileFallback || concert.audioFile;

  const merged = {
    ...concert,
    audioFile: nextAudioUrl,
    ...(fallback ? { audioFileFallback: fallback } : {}),
    audioFileSource: 'r2-worker',
  };

  const changed =
    concert.audioFile !== merged.audioFile ||
    concert.audioFileFallback !== merged.audioFileFallback ||
    concert.audioFileSource !== merged.audioFileSource;

  return { updated: changed, concert: merged, reason: changed ? 'updated' : 'unchanged' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const dataPath = path.resolve(args.data ?? DEFAULT_DATA);
  const audioIndexPath = path.resolve(args.audio ?? DEFAULT_AUDIO_INDEX);
  const baseUrl = normalizeBaseUrl(args['base-url'] ?? ENV_BASE_URL);
  const prefix = normalizePrefix(args.prefix ?? ENV_PREFIX);
  const dryRun = toBoolean(args['dry-run']);

  if (!baseUrl) {
    throw new Error('Missing base URL. Pass --base-url or set R2_BASE_URL.');
  }

  const dataRaw = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(dataRaw);
  if (!Array.isArray(data.concerts)) {
    throw new Error('Invalid data.json: missing concerts array');
  }

  const audioIndexMap = loadAudioIndex(audioIndexPath);

  console.log('🎵 Applying CDN base to data.json');
  console.log(`  Source: ${dataPath}`);
  console.log(`  Audio index: ${audioIndexMap.size ? audioIndexPath : 'not found (skipping)'}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Prefix: ${prefix || '(none)'}`);
  console.log(`  Dry Run: ${dryRun ? 'Yes' : 'No'}\n`);

  let updated = 0;
  let unchanged = 0;
  let missing = 0;

  const nextConcerts = [];

  for (const concert of data.concerts) {
    const result = updateConcert(concert, baseUrl, prefix, audioIndexMap);
    nextConcerts.push(result.concert);

    if (result.reason === 'missing-key') {
      missing += 1;
    } else if (result.updated) {
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  if (dryRun) {
    console.info(`✅ Dry run complete — ${updated} concerts would be updated (${missing} missing keys).`);
    return;
  }

  const backupPath = createBackup(dataPath);
  fs.writeFileSync(dataPath, JSON.stringify({ ...data, concerts: nextConcerts }, null, 2) + '\n');

  console.info(`✅ Updated data.json and created backup at ${backupPath}`);
  console.info(`   Updated concerts: ${updated}`);
  console.info(`   Unchanged concerts: ${unchanged}`);
  console.info(`   Missing keys: ${missing}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});