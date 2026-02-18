#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_CSV = path.resolve('assets/prod-photographs/photo-audio-map.csv');
const DEFAULT_AUDIO_INDEX = path.resolve('scripts/audio-workflow/encode/output/audio-index.json');
const DEFAULT_OUTPUT = path.resolve('scripts/audio-workflow/encode/output/photo-audio-map.json');

async function main() {
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CSV;
  const audioIndexPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_AUDIO_INDEX;
  const outputPath = process.argv[4] ? path.resolve(process.argv[4]) : DEFAULT_OUTPUT;

  const mappings = await loadDeterministicMappings(csvPath);
  const tracks = await loadTracks(audioIndexPath);

  const mappedEntries = tracks.map((track) => {
    const mapping = mappings.get(track.id);
    return {
      audioId: track.id,
      photoId: mapping ?? null,
      band: track.band,
      album: track.album ?? null,
      date: track.date ?? null,
      releaseDate: track.releaseDate ?? null,
      genre: track.genre ?? null,
      recordLabel: track.recordLabel ?? null,
    };
  });

  const json = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    note: 'Generated from photo-audio-map.csv (status == matched_single)',
    mappings: mappedEntries,
  };

  await fs.writeFile(outputPath, JSON.stringify(json, null, 2), 'utf8');
  console.info(`Wrote ${mappedEntries.length} mappings to ${outputPath}`);
  console.info(
    `Mapped ${Array.from(mappings.keys()).length} audioIds; others left as null photoId`
  );
}

async function loadDeterministicMappings(csvPath) {
  const content = await fs.readFile(csvPath, 'utf8');
  const rows = parseCsv(content);
  const headers = rows.shift() ?? [];
  const headerIndex = Object.fromEntries(headers.map((h, i) => [h, i]));

  const result = new Map();
  for (const row of rows) {
    const status = value(row, headerIndex, 'status');
    if (status !== 'matched_single') continue;
    const audioId = value(row, headerIndex, 'audioId');
    const photoId = value(row, headerIndex, 'photoId');
    if (!audioId || !photoId) continue;
    result.set(audioId, photoId);
  }
  return result;
}

async function loadTracks(audioIndexPath) {
  const json = JSON.parse(await fs.readFile(audioIndexPath, 'utf8'));
  if (!Array.isArray(json.tracks)) return [];
  return json.tracks;
}

function value(row, headerIndex, key) {
  const idx = headerIndex[key];
  return typeof idx === 'number' ? (row[idx] ?? '') : '';
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
  return lines.map(parseCsvLine);
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
