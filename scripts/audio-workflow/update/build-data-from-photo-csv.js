#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SOURCE_CSV = 'assets/prod-photographs/prod-photographs-details.csv';
const DEFAULT_AUDIO_INDEX = 'scripts/audio-workflow/encode/output/audio-index.json';
const DEFAULT_OUTPUT = 'public/data.json';
const DEFAULT_BASE_URL = 'https://photo-signal-audio-worker.whoisduck2.workers.dev';
const DEFAULT_PREFIX = 'prod/audio';
const DEFAULT_MIN_SCORE = 0.8;

const BAND_ALIASES = new Map([
  ['witworth', 'whitworth'],
  ['sea n barna', 'sen barna'],
  ['mamalarkey', 'mamalarky'],
]);

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const raw = token.slice(2);
    if (!raw.includes('=')) {
      args[raw] = true;
      continue;
    }
    const separator = raw.indexOf('=');
    const key = raw.slice(0, separator);
    const value = raw.slice(separator + 1);
    args[key] = value;
  }
  return args;
}

function normalizeBand(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bthe\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizePrefix(prefix) {
  if (!prefix) return '';
  return prefix.replace(/^\/+|\/+$/g, '').trim();
}

function trimTrailingSlash(value) {
  if (!value) return value;
  return value.endsWith('/') ? value.replace(/\/+$/, '') : value;
}

function toCsvRows(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const row = parseCsvLine(line);
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? '';
    });
    return obj;
  });
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

function tokenOverlapScore(a, b) {
  const aTokens = new Set(a.split(' ').filter(Boolean));
  const bTokens = new Set(b.split(' ').filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }

  return intersection / Math.max(aTokens.size, bTokens.size);
}

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function similarityScore(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const overlap = tokenOverlapScore(a, b);
  const maxLength = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  const editSimilarity = maxLength > 0 ? 1 - distance / maxLength : 0;

  const compactA = a.replace(/\s+/g, '');
  const compactB = b.replace(/\s+/g, '');
  const compactLength = Math.max(compactA.length, compactB.length);
  const compactDistance = levenshteinDistance(compactA, compactB);
  const compactSimilarity = compactLength > 0 ? 1 - compactDistance / compactLength : 0;

  let score = overlap * 0.5 + editSimilarity * 0.2 + compactSimilarity * 0.3;
  if (a.includes(b) || b.includes(a)) {
    score = Math.max(score, 0.75);
  }
  return Math.max(0, Math.min(1, score));
}

function groupBy(items, keySelector) {
  const grouped = new Map();
  for (const item of items) {
    const key = keySelector(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return grouped;
}

function pickBestTrack(concertNormBand, tracks, minScore) {
  let best = null;
  for (const track of tracks) {
    const score = similarityScore(concertNormBand, track.normBand);
    if (!best || score > best.score || (score === best.score && track.id < best.track.id)) {
      best = { track, score };
    }
  }

  if (!best || best.score < minScore) {
    return null;
  }

  return best;
}

function toNumberString(value) {
  if (!value) return '';
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? String(parsed) : '';
}

function normalizeShutterSpeed(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.startsWith('="') && value.endsWith('"')) {
    return value.slice(2, -1);
  }
  return value;
}

function formatAudioUrl(baseUrl, prefix, fileName) {
  const cleanBase = trimTrailingSlash(baseUrl);
  const cleanPrefix = sanitizePrefix(prefix);
  return [cleanBase, cleanPrefix, fileName]
    .filter(Boolean)
    .join('/')
    .replace(/(?<!:)\/+/g, '/');
}

function printHelp() {
  console.log(`Build public/data.json from photo CSV and audio metadata.

Usage:
  node scripts/audio-workflow/update/build-data-from-photo-csv.js [options]

Options:
  --source-csv=<path>   Photo source CSV (default: ${DEFAULT_SOURCE_CSV})
  --audio-index=<path>  Audio index JSON (default: ${DEFAULT_AUDIO_INDEX})
  --output=<path>       Output data.json path (default: ${DEFAULT_OUTPUT})
  --base-url=<url>      Audio base URL (default: ${DEFAULT_BASE_URL})
  --prefix=<path>       Audio key prefix (default: ${DEFAULT_PREFIX})
  --min-score=<0..1>    Fuzzy match threshold (default: ${DEFAULT_MIN_SCORE})
  --dry-run             Compute + report only, do not write output
  --help                Show this message
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const sourceCsvPath = path.resolve(
    process.cwd(),
    String(args['source-csv'] ?? DEFAULT_SOURCE_CSV)
  );
  const audioIndexPath = path.resolve(
    process.cwd(),
    String(args['audio-index'] ?? DEFAULT_AUDIO_INDEX)
  );
  const outputPath = path.resolve(process.cwd(), String(args.output ?? DEFAULT_OUTPUT));
  const baseUrl = trimTrailingSlash(String(args['base-url'] ?? DEFAULT_BASE_URL));
  const prefix = sanitizePrefix(String(args.prefix ?? DEFAULT_PREFIX));
  const minScore = Number.parseFloat(String(args['min-score'] ?? DEFAULT_MIN_SCORE));
  const dryRun = Boolean(args['dry-run']);

  if (!fs.existsSync(sourceCsvPath)) {
    throw new Error(`Source CSV not found: ${sourceCsvPath}`);
  }
  if (!fs.existsSync(audioIndexPath)) {
    throw new Error(`Audio index not found: ${audioIndexPath}`);
  }
  if (!baseUrl) {
    throw new Error('--base-url must not be empty');
  }
  if (Number.isNaN(minScore) || minScore < 0 || minScore > 1) {
    throw new Error(`--min-score must be between 0 and 1 (received ${String(args['min-score'])})`);
  }

  const photoRows = toCsvRows(fs.readFileSync(sourceCsvPath, 'utf8'));
  const audioIndex = JSON.parse(fs.readFileSync(audioIndexPath, 'utf8'));
  const tracks = (Array.isArray(audioIndex?.tracks) ? audioIndex.tracks : [])
    .filter((track) => track?.band && track?.fileName)
    .map((track) => ({
      id: String(track.id ?? ''),
      band: String(track.band),
      fileName: String(track.fileName),
      normBand: normalizeBand(String(track.band)),
    }))
    .filter((track) => track.normBand !== '');

  const tracksByNormBand = groupBy(tracks, (track) => track.normBand);
  for (const bucket of tracksByNormBand.values()) {
    bucket.sort((a, b) => a.id.localeCompare(b.id));
  }

  const photoRowsByNormBand = groupBy(photoRows, (row) => normalizeBand(row.band));
  for (const bucket of photoRowsByNormBand.values()) {
    bucket.sort((a, b) => Number(a.id) - Number(b.id));
  }

  let exactMatches = 0;
  let fuzzyMatches = 0;
  let unmatched = 0;

  const concerts = photoRows
    .map((row) => {
      const id = Number.parseInt(String(row.id ?? ''), 10);
      if (!Number.isInteger(id)) {
        return null;
      }

      const sourceBand = String(row.band ?? '').trim();
      const rawNormBand = normalizeBand(sourceBand);
      const normBand = BAND_ALIASES.get(rawNormBand) ?? rawNormBand;
      const exactCandidates = tracksByNormBand.get(normBand) ?? [];
      let selectedTrack = null;

      if (normBand && exactCandidates.length > 0) {
        const siblingRows = photoRowsByNormBand.get(normBand) ?? [row];
        const indexInGroup = siblingRows.findIndex((entry) => Number(entry.id) === id);
        const selectedIndex = indexInGroup >= 0 ? indexInGroup % exactCandidates.length : 0;
        selectedTrack = exactCandidates[selectedIndex];
        exactMatches += 1;
      } else if (normBand) {
        const fuzzy = pickBestTrack(normBand, tracks, minScore);
        if (fuzzy) {
          selectedTrack = fuzzy.track;
          fuzzyMatches += 1;
        } else {
          unmatched += 1;
        }
      } else {
        unmatched += 1;
      }

      const selectedFile = selectedTrack?.fileName ?? 'concert-4.opus';

      return {
        id,
        band: sourceBand,
        venue: String(row.venue ?? ''),
        date: String(row.date ?? ''),
        audioFile: formatAudioUrl(baseUrl, prefix, selectedFile),
        imageFile: String(row.imageFile ?? ''),
        photoHashes: {},
        camera: String(row.camera ?? ''),
        focalLength: String(row.focalLength ?? ''),
        aperture: String(row.aperture ?? ''),
        shutterSpeed: normalizeShutterSpeed(row.shutterSpeed),
        iso: toNumberString(row.iso),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);

  const output = { concerts };

  console.log('🧱 Build data.json from photo CSV');
  console.log(`  Source CSV: ${path.relative(process.cwd(), sourceCsvPath)}`);
  console.log(`  Audio index: ${path.relative(process.cwd(), audioIndexPath)}`);
  console.log(`  Output: ${path.relative(process.cwd(), outputPath)}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Prefix: ${prefix}`);
  console.log(`  Min score: ${minScore}`);
  console.log(`  Concerts: ${concerts.length}`);
  console.log(`  Exact matches: ${exactMatches}`);
  console.log(`  Fuzzy matches: ${fuzzyMatches}`);
  console.log(`  Unmatched: ${unmatched}`);

  if (dryRun) {
    console.log('⚠️  DRY RUN - no files were modified');
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log('✅ Wrote data.json');
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
}
