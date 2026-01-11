#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_PHOTO_CSV = path.resolve('assets/test-data/prod-photographs.csv');
const DEFAULT_AUDIO_INDEX = path.resolve('scripts/audio-workflow/encode/output/audio-index.json');
const DEFAULT_OUTPUT = path.resolve('assets/test-data/photo-audio-map.csv');

const OUTPUT_HEADERS = [
  'status',
  'bandNormalized',
  'photoId',
  'photoBand',
  'photoImageFile',
  'audioId',
  'audioFileName',
  'audioBand',
  'notes',
];

async function main() {
  const photoCsvPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_PHOTO_CSV;
  const audioIndexPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_AUDIO_INDEX;
  const outputPath = process.argv[4] ? path.resolve(process.argv[4]) : DEFAULT_OUTPUT;

  const photos = await loadPhotoCsv(photoCsvPath);
  const tracks = await loadAudioIndex(audioIndexPath);

  const photoGroups = groupByNormalizedBand(photos, (p) => p.band);
  const trackGroups = groupByNormalizedBand(tracks, (t) => t.band);

  const rows = [];

  for (const photo of photos) {
    const normBand = normalizeBand(photo.band);
    const candidates = normBand ? (trackGroups.get(normBand) ?? []) : [];
    const siblingPhotos = normBand ? (photoGroups.get(normBand) ?? []) : [];

    if (!photo.band) {
      rows.push(buildRow('missing_photo_band', normBand, photo, null, 'Add band to photo row'));
      continue;
    }

    if (candidates.length === 0) {
      rows.push(buildRow('no_audio_match', normBand, photo, null, 'No audio with matching band'));
      continue;
    }

    if (candidates.length === 1 && siblingPhotos.length === 1) {
      rows.push(buildRow('matched_single', normBand, photo, candidates[0]));
      continue;
    }

    if (candidates.length > 1 && siblingPhotos.length === 1) {
      rows.push(
        buildRow(
          'ambiguous_multi_audio',
          normBand,
          photo,
          null,
          `Choose audioId from: ${candidates.map((t) => t.id).join('; ')}`
        )
      );
      continue;
    }

    if (siblingPhotos.length > 1 && candidates.length === 1) {
      rows.push(
        buildRow(
          'ambiguous_multi_photo',
          normBand,
          photo,
          candidates[0],
          'Multiple photos share this band; confirm correct photoId'
        )
      );
      continue;
    }

    rows.push(
      buildRow(
        'ambiguous_multi_both',
        normBand,
        photo,
        null,
        `Photos: ${siblingPhotos.map((p) => p.id).join('; ')} | Audio: ${candidates
          .map((t) => t.id)
          .join('; ')}`
      )
    );
  }

  for (const track of tracks) {
    const normBand = normalizeBand(track.band);
    const hasPhoto = normBand ? photoGroups.has(normBand) : false;
    if (!hasPhoto) {
      rows.push(
        buildRow('no_photo_for_audio', normBand, null, track, 'Add photo row for this band')
      );
    }
  }

  const csv = buildCsv(rows, OUTPUT_HEADERS);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, csv, 'utf8');
  console.info(`Wrote ${rows.length} rows to ${outputPath}`);
}

function buildRow(status, bandNormalized, photo, track, notes = '') {
  return {
    status,
    bandNormalized: bandNormalized ?? '',
    photoId: photo?.id ?? '',
    photoBand: photo?.band ?? '',
    photoImageFile: photo?.imageFile ?? '',
    audioId: track?.id ?? '',
    audioFileName: track?.fileName ?? '',
    audioBand: track?.band ?? '',
    notes,
  };
}

async function loadPhotoCsv(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const records = parseCsv(content);
  if (records.length === 0) return [];
  const headers = records[0].map((h) => h.trim());
  return records.slice(1).map((row) => objectFromRow(headers, row));
}

async function loadAudioIndex(filePath) {
  const json = JSON.parse(await fs.readFile(filePath, 'utf8'));
  return Array.isArray(json.tracks) ? json.tracks : [];
}

function objectFromRow(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] ?? '';
  });
  return obj;
}

function groupByNormalizedBand(items, bandSelector) {
  const map = new Map();
  for (const item of items) {
    const norm = normalizeBand(bandSelector(item));
    if (!norm) continue;
    if (!map.has(norm)) map.set(norm, []);
    map.get(norm).push(item);
  }
  return map;
}

function normalizeBand(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
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

function buildCsv(rows, headers) {
  const headerLine = headers.join(',');
  const body = rows
    .map((row) => headers.map((key) => quoteCsvValue(row[key])).join(','))
    .join('\n');
  return `${headerLine}\n${body}\n`;
}

function quoteCsvValue(value) {
  const stringValue = String(value ?? '');
  if (stringValue === '') return '';
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
