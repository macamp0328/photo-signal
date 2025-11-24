#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import exifr from 'exifr';

const DEFAULT_PHOTO_DIR = path.resolve('assets/prod-photographs');
const DEFAULT_OUTPUT_FILE = path.resolve('assets/test-data/prod-photographs.csv');
const CSV_HEADERS = [
  'id',
  'band',
  'venue',
  'date',
  'audioFile',
  'imageFile',
  'photoTakenAt',
  'shutterSpeed',
  'camera',
  'aperture',
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const photoDir = path.resolve(options.input ?? DEFAULT_PHOTO_DIR);
  const outputFile = path.resolve(options.output ?? DEFAULT_OUTPUT_FILE);
  const baseImagePath = options.imageBasePath ?? '/assets/prod-photographs';

  const files = await readJpegList(photoDir);
  if (files.length === 0) {
    console.warn(`No .jpg files found in ${photoDir}`);
    return;
  }

  const rows = await Promise.all(
    files.map(async (fileName, index) => {
      const filePath = path.join(photoDir, fileName);
      const metadata = await readPhotoMetadata(filePath);

      const row = new Map();
      row.set('id', String(index + 1));
      row.set('band', '');
      row.set('venue', '');
      row.set('date', '');
      row.set('audioFile', '');
      row.set('imageFile', path.posix.join(baseImagePath, fileName));
      row.set('photoTakenAt', metadata.photoTakenAt ?? '');
      row.set('shutterSpeed', metadata.shutterSpeed ?? '');
      row.set('camera', metadata.camera ?? '');
      row.set('aperture', metadata.aperture ?? '');

      return row;
    })
  );

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  const csvContent = buildCsv(rows);
  await fs.writeFile(outputFile, csvContent, 'utf8');
  console.info(`Saved ${rows.length} rows to ${outputFile}`);
}

function parseArgs(argv) {
  const options = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [rawKey, rawValue] = token.slice(2).split('=');
    const key = rawKey.trim();
    const value = rawValue?.trim();
    if (!key) continue;
    if (typeof value === 'undefined') {
      options[key] = true;
    } else {
      options[key] = value;
    }
  }
  return options;
}

async function readJpegList(photoDir) {
  try {
    const entries = await fs.readdir(photoDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jpg'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    throw new Error(`Unable to read directory ${photoDir}: ${error.message}`);
  }
}

async function readPhotoMetadata(filePath) {
  try {
    const exif = await exifr.parse(filePath, [
      'DateTimeOriginal',
      'ExposureTime',
      'Model',
      'Make',
      'FNumber',
    ]);
    if (!exif) {
      return {};
    }

    return {
      photoTakenAt: formatDate(exif.DateTimeOriginal),
      shutterSpeed: formatShutterSpeed(exif.ExposureTime),
      camera: formatCamera(exif.Make, exif.Model),
      aperture: formatAperture(exif.FNumber),
    };
  } catch (error) {
    console.warn(`Failed to parse metadata for ${filePath}: ${error.message}`);
    return {};
  }
}

function formatDate(date) {
  if (!date || Number.isNaN(date?.getTime?.())) {
    return '';
  }
  return date.toISOString();
}

function formatShutterSpeed(exposureTime) {
  if (!exposureTime || typeof exposureTime !== 'number' || !Number.isFinite(exposureTime)) {
    return '';
  }
  if (exposureTime >= 1) {
    return `${exposureTime.toFixed(2)}s`;
  }
  const denominator = Math.round(1 / exposureTime);
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return '';
  }
  return `1/${denominator}`;
}

function formatCamera(make, model) {
  const parts = [make, model]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return parts.join(' ');
}

function formatAperture(fNumber) {
  if (!fNumber || typeof fNumber !== 'number' || !Number.isFinite(fNumber)) {
    return '';
  }
  return `f/${fNumber.toFixed(1)}`;
}

function buildCsv(rows) {
  const headerLine = CSV_HEADERS.join(',');
  const body = rows
    .map((row) => CSV_HEADERS.map((header) => quoteCsvValue(row.get(header) ?? '')).join(','))
    .join('\n');
  return `${headerLine}\n${body}\n`;
}

function quoteCsvValue(value) {
  const stringValue = String(value ?? '');
  if (stringValue === '') {
    return '';
  }
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
