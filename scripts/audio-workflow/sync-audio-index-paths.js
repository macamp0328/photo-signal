#!/usr/bin/env node

import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_AUDIO_INDEX = path.resolve('scripts/audio-workflow/encode/output/audio-index.json');
const DEFAULT_MAPPING = path.resolve('scripts/audio-workflow/encode/output/photo-audio-map.json');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const audioIndexPath = path.resolve(args.audio ?? DEFAULT_AUDIO_INDEX);
  const mappingPath = path.resolve(args.mapping ?? DEFAULT_MAPPING);

  const audioIndex = JSON.parse(await fs.readFile(audioIndexPath, 'utf8'));
  const mappings = loadMapping(mappingPath);

  const tracks = Array.isArray(audioIndex.tracks) ? audioIndex.tracks : [];

  let updated = 0;
  for (const track of tracks) {
    const photoId = mappings.get(track.id) ?? track.photoId ?? null;
    const fileName = track.fileName ?? `ps-${track.id}.opus`;
    const filePath = photoId ? `${photoId}/${fileName}` : fileName;

    if (track.photoId !== photoId || track.filePath !== filePath) {
      track.photoId = photoId;
      track.filePath = filePath;
      updated += 1;
    }
  }

  audioIndex.generatedAt = new Date().toISOString();
  await fs.writeFile(audioIndexPath, JSON.stringify(audioIndex, null, 2), 'utf8');
  console.info(`Updated ${updated} track entries in ${audioIndexPath}`);
}

function loadMapping(mappingPath) {
  const json = JSON.parse(readFileSyncSafe(mappingPath));
  const list = Array.isArray(json.mappings) ? json.mappings : [];
  return new Map(list.map((m) => [m.audioId, m.photoId ?? null]));
}

function readFileSyncSafe(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});