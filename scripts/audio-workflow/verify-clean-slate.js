#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_DATA = path.resolve('public/data.app.v2.json');
const DEFAULT_AUDIO_INDEX = path.resolve('scripts/audio-workflow/encode/output/audio-index.json');
const DEFAULT_PHOTO_DETAILS = path.resolve('assets/prod-photographs/prod-photographs-details.csv');
const DEFAULT_PREFIX = 'prod/audio';
const DEFAULT_REPORT = path.resolve('scripts/audio-workflow/output/clean-slate-verify-report.json');

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }
    if (arg.includes('=')) {
      const normalized = arg.slice(2);
      const separatorIndex = normalized.indexOf('=');
      const key = normalized.slice(0, separatorIndex);
      const value = normalized.slice(separatorIndex + 1);
      parsed[key] = value;
    } else {
      parsed[arg.slice(2)] = 'true';
    }
  }
  return parsed;
}

function sanitizePrefix(prefix) {
  if (!prefix) {
    return '';
  }
  return prefix.replace(/^\/+|\/+$/g, '');
}

function normalizeBand(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function loadCsvRows(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });
}

function loadJson(filePath, fieldName, options = {}) {
  if (!fs.existsSync(filePath)) {
    if (options.optional) {
      return null;
    }
    throw new Error(`Missing ${fieldName}: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON in ${fieldName} (${filePath}): ${error.message}`);
  }
}

function normalizeConcertsPayload(data) {
  if (
    data?.version === 2 &&
    Array.isArray(data?.artists) &&
    Array.isArray(data?.tracks) &&
    Array.isArray(data?.photos) &&
    Array.isArray(data?.entries)
  ) {
    const artistsById = new Map(data.artists.map((artist) => [artist.id, artist]));
    const tracksById = new Map(data.tracks.map((track) => [track.id, track]));
    const photosById = new Map(data.photos.map((photo) => [photo.id, photo]));

    return data.entries.flatMap((entry) => {
      const artist = artistsById.get(entry.artistId);
      const track = tracksById.get(entry.trackId);
      if (!artist || !track) {
        return [];
      }

      const photo = entry.photoId ? photosById.get(entry.photoId) : undefined;

      return [
        {
          id: entry.id,
          band: artist.name,
          audioFile: track.audioFile,
          imageFile: photo?.imageFile ?? '',
          recognitionEnabled: entry.recognitionEnabled ?? photo?.recognitionEnabled,
        },
      ];
    });
  }

  return null;
}

function toPathname(urlOrPath) {
  try {
    return new URL(urlOrPath).pathname;
  } catch {
    return urlOrPath;
  }
}

function extractFileName(urlOrPath) {
  const pathname = toPathname(urlOrPath);
  return path.posix.basename(pathname);
}

function startsWithHttp(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function hasExpectedPrefix(pathname, expectedPrefix) {
  const normalizedPrefix = sanitizePrefix(expectedPrefix);
  const cleanPath = pathname.replace(/^\/+/, '');
  const expectedStart = `${normalizedPrefix}/`;
  return cleanPath.startsWith(expectedStart);
}

function collectPlaceholderHits(audioUrl) {
  const patterns = [
    /\/assets\/test-data\//i,
    /\/assets\/test-audio\//i,
    /\/assets\/example-real-songs\//i,
    /localhost[:/]/i,
    /concert(?:-song)?-\d+\.opus$/i,
  ];

  return patterns.filter((pattern) => pattern.test(audioUrl)).map((pattern) => pattern.toString());
}

function buildExpectedUrlSuffix(prefix, fileName) {
  return `/${sanitizePrefix(prefix)}/${fileName}`.replace(/\/+/g, '/');
}

function verifyConcertRows({ concerts, photoRowsById, expectedPrefix, audioIndexByPhotoId }) {
  const urlMismatches = [];
  const mappingMismatches = [];
  const placeholderHits = [];

  const photoRowsByImageFile = new Map();
  for (const row of photoRowsById.values()) {
    const imageFile = String(row.imageFile ?? '');
    if (!imageFile) continue;
    if (!photoRowsByImageFile.has(imageFile)) {
      photoRowsByImageFile.set(imageFile, []);
    }
    photoRowsByImageFile.get(imageFile).push(row);
  }

  for (const concert of concerts) {
    const csvRow = photoRowsById.get(String(concert.id));
    const audioFile = concert.audioFile ?? '';

    if (!startsWithHttp(audioFile)) {
      urlMismatches.push({
        id: concert.id,
        band: concert.band,
        issue: 'audioFile-not-remote-url',
        actual: audioFile,
      });
      continue;
    }

    const pathname = toPathname(audioFile);
    const fileName = extractFileName(audioFile);
    if (!hasExpectedPrefix(pathname, expectedPrefix)) {
      urlMismatches.push({
        id: concert.id,
        band: concert.band,
        issue: 'non-prefixed-path',
        actual: pathname,
        expectedSuffix: buildExpectedUrlSuffix(expectedPrefix, fileName),
      });
    }

    const placeholders = collectPlaceholderHits(audioFile);
    if (placeholders.length > 0) {
      placeholderHits.push({
        id: concert.id,
        band: concert.band,
        audioFile,
        matchedPatterns: placeholders,
      });
    }

    const isRecognitionEnabled = concert.recognitionEnabled !== false;

    if (csvRow) {
      const expectedBand = csvRow.band ?? '';
      if (normalizeBand(expectedBand) !== normalizeBand(concert.band)) {
        mappingMismatches.push({
          id: concert.id,
          issue: 'band-mismatch-with-photo-details',
          dataJsonBand: concert.band,
          photoDetailsBand: expectedBand,
        });
      }

      if ((csvRow.imageFile ?? '') !== (concert.imageFile ?? '')) {
        mappingMismatches.push({
          id: concert.id,
          issue: 'image-file-mismatch-with-photo-details',
          dataJsonImageFile: concert.imageFile ?? '',
          photoDetailsImageFile: csvRow.imageFile ?? '',
        });
      }
    } else {
      const candidateRows = photoRowsByImageFile.get(String(concert.imageFile ?? '')) ?? [];
      const hasMatchingBandImage = candidateRows.some(
        (row) => normalizeBand(row.band ?? '') === normalizeBand(concert.band ?? '')
      );

      if (isRecognitionEnabled || !hasMatchingBandImage) {
        mappingMismatches.push({
          id: concert.id,
          issue: 'missing-photo-details-row',
          recognitionEnabled: isRecognitionEnabled,
          imageFile: concert.imageFile ?? '',
          band: concert.band ?? '',
        });
      }
    }

    const audioTrack = audioIndexByPhotoId.get(String(concert.id));
    if (audioTrack) {
      const expectedFile = audioTrack.fileName || extractFileName(audioTrack.filePath || '');
      if (expectedFile && expectedFile !== fileName) {
        mappingMismatches.push({
          id: concert.id,
          issue: 'audio-filename-mismatch-with-audio-index',
          dataJsonFile: fileName,
          audioIndexFile: expectedFile,
          audioTrackId: audioTrack.id,
        });
      }
    }
  }

  return {
    urlMismatches,
    mappingMismatches,
    placeholderHits,
  };
}

function indexAudioByPhotoId(tracks) {
  const index = new Map();
  const duplicates = [];

  for (const track of tracks) {
    if (!track.photoId) {
      continue;
    }

    const photoId = String(track.photoId);
    if (index.has(photoId)) {
      duplicates.push({
        photoId,
        existingTrackId: index.get(photoId).id,
        duplicateTrackId: track.id,
      });
      continue;
    }

    index.set(photoId, track);
  }

  return {
    index,
    duplicates,
  };
}

function printSummary(report) {
  console.log('🔎 Clean-slate verification report');
  console.log(`  Concerts checked: ${report.summary.concertsChecked}`);
  console.log(`  URL mismatches: ${report.summary.urlMismatches}`);
  console.log(`  Mapping mismatches (critical): ${report.summary.mappingMismatches}`);
  console.log(`  Mapping mismatches (audio-index): ${report.summary.audioIndexMappingMismatches}`);
  console.log(`  Placeholder URL hits: ${report.summary.placeholderHits}`);
  console.log(`  Duplicate photo mappings: ${report.summary.duplicatePhotoMappings}`);
  console.log(`  Missing CSV ids: ${report.summary.missingPhotoDetailsIds}`);
  console.log(`  Missing dataset ids: ${report.summary.missingDataJsonIds}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = path.resolve(args.source ?? DEFAULT_DATA);
  const audioIndexPath = path.resolve(args['audio-index'] ?? DEFAULT_AUDIO_INDEX);
  const photoDetailsPath = path.resolve(args['photo-details'] ?? DEFAULT_PHOTO_DETAILS);
  const expectedPrefix = sanitizePrefix(args.prefix ?? DEFAULT_PREFIX);
  const reportPath = path.resolve(args.report ?? DEFAULT_REPORT);

  const data = loadJson(sourcePath, 'dataset');
  const audioIndex = loadJson(audioIndexPath, 'audio index', { optional: true });
  const photoRows = loadCsvRows(photoDetailsPath);

  const concerts = normalizeConcertsPayload(data);
  if (!concerts) {
    throw new Error('dataset JSON missing v2 entries');
  }

  const photoRowsById = new Map(photoRows.map((row) => [String(row.id), row]));
  const { index: audioIndexByPhotoId, duplicates } = indexAudioByPhotoId(audioIndex?.tracks ?? []);

  const verification = verifyConcertRows({
    concerts,
    photoRowsById,
    expectedPrefix,
    audioIndexByPhotoId,
  });

  const audioIndexMappingMismatches = verification.mappingMismatches.filter(
    (entry) => entry.issue === 'audio-filename-mismatch-with-audio-index'
  );
  const criticalMappingMismatches = verification.mappingMismatches.filter(
    (entry) => entry.issue !== 'audio-filename-mismatch-with-audio-index'
  );

  const recognitionConcerts = concerts.filter((concert) => concert.recognitionEnabled !== false);

  const dataIds = new Set(recognitionConcerts.map((concert) => String(concert.id)));
  const photoIds = new Set(photoRows.map((row) => String(row.id)));
  const missingPhotoDetailsIds = Array.from(dataIds).filter((id) => !photoIds.has(id));
  const missingDataJsonIds = Array.from(photoIds).filter((id) => !dataIds.has(id));

  const report = {
    generatedAt: new Date().toISOString(),
    inputs: {
      sourcePath: path.relative(process.cwd(), sourcePath),
      audioIndexPath: path.relative(process.cwd(), audioIndexPath),
      photoDetailsPath: path.relative(process.cwd(), photoDetailsPath),
      expectedPrefix,
      audioIndexPresent: Boolean(audioIndex),
    },
    summary: {
      concertsChecked: concerts.length,
      urlMismatches: verification.urlMismatches.length,
      mappingMismatches: criticalMappingMismatches.length,
      audioIndexMappingMismatches: audioIndexMappingMismatches.length,
      placeholderHits: verification.placeholderHits.length,
      duplicatePhotoMappings: duplicates.length,
      missingPhotoDetailsIds: missingPhotoDetailsIds.length,
      missingDataJsonIds: missingDataJsonIds.length,
    },
    mismatches: {
      url: verification.urlMismatches,
      mapping: criticalMappingMismatches,
      audioIndexMapping: audioIndexMappingMismatches,
      placeholders: verification.placeholderHits,
      duplicatePhotoMappings: duplicates,
      missingPhotoDetailsIds,
      missingDataJsonIds,
    },
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  printSummary(report);
  console.log(`📝 Detailed report: ${path.relative(process.cwd(), reportPath)}`);

  const hasFailures =
    report.summary.urlMismatches > 0 ||
    report.summary.mappingMismatches > 0 ||
    report.summary.missingPhotoDetailsIds > 0 ||
    report.summary.missingDataJsonIds > 0;

  if (hasFailures) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
