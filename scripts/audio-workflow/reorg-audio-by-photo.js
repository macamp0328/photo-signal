#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_MAPPING = path.resolve('scripts/audio-workflow/encode/output/photo-audio-map.json');
const DEFAULT_OUTPUT_DIR = path.resolve('scripts/audio-workflow/encode/output');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mappingPath = path.resolve(args.mapping ?? DEFAULT_MAPPING);
  const outputDir = path.resolve(args['output-dir'] ?? DEFAULT_OUTPUT_DIR);
  const dryRun = toBoolean(args['dry-run']);

  const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
  const mappings = Array.isArray(mapping.mappings) ? mapping.mappings : [];

  let moved = 0;
  let missing = 0;
  let skipped = 0;

  for (const entry of mappings) {
    const { audioId, photoId } = entry;
    if (!audioId || !photoId) {
      skipped += 1;
      continue;
    }
    const fileName = entry.fileName ?? findFileNameForAudioId(entry, outputDir);
    if (!fileName) {
      missing += 1;
      continue;
    }
    const source = path.join(outputDir, fileName);
    const targetDir = path.join(outputDir, photoId);
    const target = path.join(targetDir, fileName);

    if (source === target) {
      skipped += 1;
      continue;
    }

    if (!(await exists(source))) {
      missing += 1;
      continue;
    }

    if (!dryRun) {
      await fs.mkdir(targetDir, { recursive: true });
      await fs.rename(source, target);
    }
    moved += 1;
    console.info(`${dryRun ? '[dry-run] ' : ''}moved ${fileName} -> ${photoId}/`);
  }

  console.info(`Done. moved=${moved}, skipped=${skipped}, missing=${missing}${dryRun ? ' (dry-run)' : ''}`);
}

function findFileNameForAudioId(entry, outputDir) {
  if (entry.fileName) return entry.fileName;
  const candidate = `ps-${entry.audioId}.opus`;
  return candidate;
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
  const v = String(value).toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});