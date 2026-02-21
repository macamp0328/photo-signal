#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SOURCE = 'public/data.json';
const DEFAULT_SOURCE_CSV = 'assets/prod-photographs/prod-photographs-details.csv';
const DEFAULT_AUDIO_INDEX = 'scripts/audio-workflow/encode/output/audio-index.json';
const DEFAULT_MIN_SCORE = 0.45;
const DEFAULT_REPORT_JSON = 'scripts/audio-workflow/output/mapping-report.json';
const DEFAULT_REPORT_CSV = 'scripts/audio-workflow/output/mapping-report.csv';
const BAND_ALIASES = new Map([
  ['witworth', 'whitworth'],
  ['sea n barna', 'sen barna'],
  ['mamalarkey', 'mamalarky'],
  ['thao and get down stay down', 'thao'],
  ['arya', 'araya'],
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

function resolveBandAlias(value) {
  return BAND_ALIASES.get(value) ?? value;
}

function tokenize(normalizedBand) {
  if (!normalizedBand) return [];
  return normalizedBand.split(' ').filter(Boolean);
}

function tokenOverlapScore(a, b) {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
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
  const compactMaxLength = Math.max(compactA.length, compactB.length);
  const compactDistance = levenshteinDistance(compactA, compactB);
  const compactEditSimilarity = compactMaxLength > 0 ? 1 - compactDistance / compactMaxLength : 0;

  let score = overlap * 0.5 + editSimilarity * 0.2 + compactEditSimilarity * 0.3;
  if (a.includes(b) || b.includes(a)) {
    score = Math.max(score, 0.75);
  }
  return Math.max(0, Math.min(1, score));
}

function groupBy(items, keySelector) {
  const map = new Map();
  for (const item of items) {
    const key = keySelector(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function replaceFileName(audioUrl, fileName) {
  if (!audioUrl || !fileName) return audioUrl;
  const lastSlash = audioUrl.lastIndexOf('/');
  if (lastSlash === -1) return fileName;
  return `${audioUrl.slice(0, lastSlash + 1)}${fileName}`;
}

/**
 * Find audio tracks from the index that do not appear in any concert's audioFile.
 *
 * Useful for detecting songs that exist in the audio index but have been dropped
 * from data.json (e.g. a band with more tracks than photo rows).
 *
 * @param {object[]} concerts  - Concert entries from data.json
 * @param {object[]} tracks    - Tracks from audio-index (must have .fileName)
 * @returns {object[]} Tracks whose fileName does not appear in any concert audioFile
 */
export function findUnmappedTracks(concerts, tracks) {
  const coveredFileNames = new Set(
    concerts
      .filter((c) => c.audioFile)
      .map((c) => {
        const lastSlash = c.audioFile.lastIndexOf('/');
        return lastSlash === -1 ? c.audioFile : c.audioFile.slice(lastSlash + 1);
      })
  );
  return tracks.filter((track) => track.fileName && !coveredFileNames.has(track.fileName));
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

function pickBestTrackAny(concertNormBand, tracks) {
  let best = null;
  for (const track of tracks) {
    const score = similarityScore(concertNormBand, track.normBand);
    if (!best || score > best.score || (score === best.score && track.id < best.track.id)) {
      best = { track, score };
    }
  }
  return best;
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

function csvObjects(content) {
  const records = parseCsv(content);
  if (records.length === 0) return [];

  const headers = records[0].map((header) => header.trim());
  return records.slice(1).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index] ?? '';
    });
    return object;
  });
}

function quoteCsv(value) {
  const text = String(value ?? '');
  if (text.length === 0) return '';
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toCsv(rows, headers) {
  const headerLine = headers.join(',');
  const body = rows
    .map((row) => headers.map((header) => quoteCsv(row[header])).join(','))
    .join('\n');
  return `${headerLine}\n${body}\n`;
}

function printHelp() {
  console.log(`Remap data.json audio files by fuzzy band matching

Usage:
  npm run audio:remap-by-band -- [options]

Options:
  --source=<path>        Path to data.json (default: ${DEFAULT_SOURCE})
  --source-csv=<path>    Path to prod photo details CSV source of truth (default: ${DEFAULT_SOURCE_CSV})
  --audio-index=<path>   Path to audio-index.json (default: ${DEFAULT_AUDIO_INDEX})
  --min-score=<0..1>     Minimum fuzzy score for a match (default: ${DEFAULT_MIN_SCORE})
  --report-json=<path>   Write detailed JSON report (default path when --report is used: ${DEFAULT_REPORT_JSON})
  --report-csv=<path>    Write tabular CSV report (default path when --report is used: ${DEFAULT_REPORT_CSV})
  --report               Write both report files to default output paths
  --dry-run              Print results without writing data.json
  --help                 Show help
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const sourcePath = path.resolve(process.cwd(), String(args.source ?? DEFAULT_SOURCE));
  const sourceCsvPath = path.resolve(
    process.cwd(),
    String(args['source-csv'] ?? DEFAULT_SOURCE_CSV)
  );
  const audioIndexPath = path.resolve(
    process.cwd(),
    String(args['audio-index'] ?? DEFAULT_AUDIO_INDEX)
  );
  const shouldWriteDefaultReports = Boolean(args.report);
  const reportJsonPath = shouldWriteDefaultReports
    ? path.resolve(process.cwd(), DEFAULT_REPORT_JSON)
    : args['report-json']
      ? path.resolve(process.cwd(), String(args['report-json']))
      : null;
  const reportCsvPath = shouldWriteDefaultReports
    ? path.resolve(process.cwd(), DEFAULT_REPORT_CSV)
    : args['report-csv']
      ? path.resolve(process.cwd(), String(args['report-csv']))
      : null;
  const minScore = Number.parseFloat(String(args['min-score'] ?? DEFAULT_MIN_SCORE));
  const dryRun = Boolean(args['dry-run']);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`data source file not found: ${sourcePath}`);
  }
  if (!fs.existsSync(sourceCsvPath)) {
    throw new Error(`source CSV file not found: ${sourceCsvPath}`);
  }
  if (!fs.existsSync(audioIndexPath)) {
    throw new Error(`audio-index file not found: ${audioIndexPath}`);
  }
  if (Number.isNaN(minScore) || minScore < 0 || minScore > 1) {
    throw new Error(`--min-score must be between 0 and 1 (received ${String(args['min-score'])})`);
  }

  const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const photoSourceRows = csvObjects(fs.readFileSync(sourceCsvPath, 'utf8'));
  const audioIndex = JSON.parse(fs.readFileSync(audioIndexPath, 'utf8'));
  const concerts = Array.isArray(data?.concerts) ? data.concerts : [];
  const photoRowsById = new Map(
    photoSourceRows.map((row) => [Number.parseInt(String(row.id ?? ''), 10), row])
  );

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
  for (const groupedTracks of tracksByNormBand.values()) {
    groupedTracks.sort((a, b) => a.id.localeCompare(b.id));
  }

  const photoRowsByNormBand = groupBy(photoSourceRows, (row) =>
    resolveBandAlias(normalizeBand(row.band))
  );
  for (const rows of photoRowsByNormBand.values()) {
    rows.sort((a, b) => Number(a.id) - Number(b.id));
  }

  let exactMatches = 0;
  let fuzzyMatches = 0;
  let unmatched = 0;
  let updated = 0;
  let missingSourceRows = 0;
  const lowConfidence = [];
  const reportRows = [];

  const updatedConcerts = concerts.map((concert) => {
    const sourceRow = photoRowsById.get(Number(concert.id));
    if (!sourceRow) {
      missingSourceRows += 1;
      unmatched += 1;
      reportRows.push({
        id: concert.id,
        imageFile: concert.imageFile,
        sourceBand: '',
        sourceVenue: '',
        status: 'unmatched_missing_source_row',
        matchType: 'none',
        score: '',
        mappedAudioFile: '',
        mappedAudioBand: '',
        closestAudioFile: '',
        closestAudioBand: '',
        closestScore: '',
        currentAudioFile: concert.audioFile,
      });
      return concert;
    }

    const sourceBand = String(sourceRow.band ?? '').trim();
    const sourceVenue = String(sourceRow.venue ?? '');
    const normBand = resolveBandAlias(normalizeBand(sourceBand));
    if (!normBand) {
      unmatched += 1;
      reportRows.push({
        id: concert.id,
        imageFile: concert.imageFile,
        sourceBand,
        sourceVenue,
        status: 'unmatched_missing_band',
        matchType: 'none',
        score: '',
        mappedAudioFile: '',
        mappedAudioBand: '',
        closestAudioFile: '',
        closestAudioBand: '',
        closestScore: '',
        currentAudioFile: concert.audioFile,
      });
      return concert;
    }

    const exactCandidates = tracksByNormBand.get(normBand) ?? [];
    const suggestedBest = pickBestTrackAny(normBand, tracks);
    let selectedTrack = null;
    let selectedScore = 0;
    let isExact = false;

    if (exactCandidates.length > 0) {
      const siblingRows = photoRowsByNormBand.get(normBand) ?? [sourceRow];
      const indexInGroup = siblingRows.findIndex((item) => Number(item.id) === Number(concert.id));
      const selectedIndex = indexInGroup >= 0 ? indexInGroup % exactCandidates.length : 0;
      selectedTrack = exactCandidates[selectedIndex];
      selectedScore = 1;
      isExact = true;
    } else {
      const best = pickBestTrack(normBand, tracks, minScore);
      if (!best) {
        unmatched += 1;
        reportRows.push({
          id: concert.id,
          imageFile: concert.imageFile,
          sourceBand,
          sourceVenue,
          status: 'unmatched_no_audio_match',
          matchType: 'none',
          score: '',
          mappedAudioFile: '',
          mappedAudioBand: '',
          closestAudioFile: suggestedBest?.track?.fileName ?? '',
          closestAudioBand: suggestedBest?.track?.band ?? '',
          closestScore: suggestedBest ? Number(suggestedBest.score.toFixed(3)) : '',
          currentAudioFile: concert.audioFile,
        });
        return concert;
      }
      selectedTrack = best.track;
      selectedScore = best.score;
    }

    if (isExact) {
      exactMatches += 1;
    } else {
      fuzzyMatches += 1;
    }

    if (selectedScore < 0.75) {
      lowConfidence.push({
        concertId: concert.id,
        concertBand: sourceBand,
        mappedBand: selectedTrack.band,
        fileName: selectedTrack.fileName,
        score: Number(selectedScore.toFixed(3)),
      });
    }

    const nextAudioFile = replaceFileName(concert.audioFile, selectedTrack.fileName);
    if (nextAudioFile !== concert.audioFile) {
      updated += 1;
    }

    reportRows.push({
      id: concert.id,
      imageFile: concert.imageFile,
      sourceBand,
      sourceVenue,
      status: isExact ? 'matched_exact' : 'matched_fuzzy',
      matchType: isExact ? 'exact' : 'fuzzy',
      score: Number(selectedScore.toFixed(3)),
      mappedAudioFile: selectedTrack.fileName,
      mappedAudioBand: selectedTrack.band,
      closestAudioFile: '',
      closestAudioBand: '',
      closestScore: '',
      currentAudioFile: concert.audioFile,
    });

    return {
      ...concert,
      audioFile: nextAudioFile,
    };
  });

  const nextData = {
    ...data,
    concerts: updatedConcerts,
  };

  console.log('🎯 Remap audio by band');
  console.log(`  Source: ${path.relative(process.cwd(), sourcePath)}`);
  console.log(`  Source CSV: ${path.relative(process.cwd(), sourceCsvPath)}`);
  console.log(`  Audio index: ${path.relative(process.cwd(), audioIndexPath)}`);
  console.log('  Uses audio metadata only (ignores audio-index photoId)');
  console.log(`  Min score: ${minScore}`);
  console.log(`  Dry run: ${dryRun ? 'yes' : 'no'}`);
  console.log('');
  console.log(`Concerts: ${concerts.length}`);
  console.log(`Source photo rows: ${photoSourceRows.length}`);
  console.log(`Missing source rows by id: ${missingSourceRows}`);
  console.log(`Updated audio URLs: ${updated}`);
  console.log(`Exact band matches: ${exactMatches}`);
  console.log(`Fuzzy band matches: ${fuzzyMatches}`);
  console.log(`Unmatched bands: ${unmatched}`);

  if (reportJsonPath || reportCsvPath) {
    const reportSummary = {
      generatedAt: new Date().toISOString(),
      source: path.relative(process.cwd(), sourcePath),
      sourceCsv: path.relative(process.cwd(), sourceCsvPath),
      audioIndex: path.relative(process.cwd(), audioIndexPath),
      minScore,
      concerts: concerts.length,
      exactMatches,
      fuzzyMatches,
      unmatched,
      missingSourceRows,
    };

    if (reportJsonPath) {
      fs.mkdirSync(path.dirname(reportJsonPath), { recursive: true });
      const reportJson = {
        ...reportSummary,
        rows: reportRows,
      };
      fs.writeFileSync(reportJsonPath, `${JSON.stringify(reportJson, null, 2)}\n`, 'utf8');
      console.log(`Report JSON: ${path.relative(process.cwd(), reportJsonPath)}`);
    }

    if (reportCsvPath) {
      fs.mkdirSync(path.dirname(reportCsvPath), { recursive: true });
      const csvHeaders = [
        'id',
        'imageFile',
        'sourceBand',
        'sourceVenue',
        'status',
        'matchType',
        'score',
        'mappedAudioFile',
        'mappedAudioBand',
        'closestAudioFile',
        'closestAudioBand',
        'closestScore',
        'currentAudioFile',
      ];
      fs.writeFileSync(reportCsvPath, toCsv(reportRows, csvHeaders), 'utf8');
      console.log(`Report CSV: ${path.relative(process.cwd(), reportCsvPath)}`);
    }
  }

  if (lowConfidence.length > 0) {
    console.log('');
    console.log('Low-confidence mappings (< 0.75):');
    for (const entry of lowConfidence.slice(0, 20)) {
      console.log(
        `  - #${entry.concertId} "${entry.concertBand}" -> "${entry.mappedBand}" (${entry.score})`
      );
    }
    if (lowConfidence.length > 20) {
      console.log(`  ... and ${lowConfidence.length - 20} more`);
    }
  }

  // Report tracks that are in the audio index but not referenced in any concert
  const unmappedTracks = findUnmappedTracks(updatedConcerts, tracks);
  if (unmappedTracks.length > 0) {
    console.log('');
    console.log(
      `⚠️  Unmapped audio tracks (in index but not in data.json): ${unmappedTracks.length}`
    );
    console.log(
      '   These songs will not play in any playlist. Run audio:build-data to include them.'
    );
    for (const track of unmappedTracks.slice(0, 20)) {
      console.log(`  - "${track.band}" — ${track.fileName}`);
    }
    if (unmappedTracks.length > 20) {
      console.log(`  ... and ${unmappedTracks.length - 20} more`);
    }
  }

  if (dryRun) {
    return;
  }

  fs.writeFileSync(sourcePath, `${JSON.stringify(nextData, null, 2)}\n`, 'utf8');
  console.log('✅ Updated data.json with remapped audio files');
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
}
