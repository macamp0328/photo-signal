#!/usr/bin/env node

/**
 * Audio URL Validation Script
 *
 * This script validates that all audio URLs in data.json are accessible
 * and reports any broken links or issues.
 *
 * Usage:
 *   node scripts/audio-workflow/update/validate-audio-urls.js [options]
 *
 * Options:
 *   --source=<path>       Path to data.json (default: public/data.json)
 *   --timeout=<ms>        Request timeout in milliseconds (default: 10000)
 *   --base-url=<url>      Override audioFile with CDN base URL (e.g., Worker hostname)
 *   --prefix=<path>       Key prefix to join with audio filenames (default: prod/audio)
 *   --origin=<origin>     Optional Origin header for CORS-protected endpoints
 *   --shared-secret=<s>   Optional X-PS-Shared-Secret header for worker bypass
 *   --help                Show this help message
 *
 * Examples:
 *   # Validate production data.json
 *   node scripts/audio-workflow/update/validate-audio-urls.js
 *
 *   # Validate test data
 *   node scripts/audio-workflow/update/validate-audio-urls.js --source=public/data.json
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { buildAudioUrl, sanitizePrefix, trimTrailingSlash } from './apply-cdn-to-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const DEFAULT_PREFIX = 'prod/audio';
const DEFAULT_ENCODE_OUTPUT_DIR = 'scripts/audio-workflow/encode/output';

export function normalizeBaseUrl(baseUrl) {
  return trimTrailingSlash(baseUrl);
}

export function normalizePrefix(prefix) {
  return sanitizePrefix(prefix || DEFAULT_PREFIX);
}

export function resolveAudioUrl(audioFile, concertId, baseUrl, prefix = DEFAULT_PREFIX) {
  if (!audioFile) {
    return '';
  }

  if (!baseUrl) {
    return audioFile;
  }

  return buildAudioUrl({ id: concertId, audioFile }, baseUrl, prefix);
}

export function classifyUrlShape(url, prefix = DEFAULT_PREFIX) {
  if (!url) {
    return { type: 'unknown', key: null };
  }

  try {
    const parsed = new URL(url);
    const key = parsed.pathname.replace(/^\/+/, '');
    return classifyPathShape(key, prefix);
  } catch {
    const key = url.replace(/^\/+/, '');
    return classifyPathShape(key, prefix);
  }
}

function classifyPathShape(key, prefix = DEFAULT_PREFIX) {
  const cleanPrefix = sanitizePrefix(prefix);
  if (!cleanPrefix || !key.startsWith(`${cleanPrefix}/`)) {
    return { type: 'non-worker-or-non-prefix', key };
  }

  const suffix = key.slice(cleanPrefix.length + 1);
  const parts = suffix.split('/').filter(Boolean);
  if (parts.length <= 1) {
    return { type: 'flat', key };
  }

  if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
    return { type: 'id-scoped', key, inferredId: Number.parseInt(parts[0], 10) };
  }

  return { type: 'nested-non-numeric', key };
}

export function findConcertById(concerts, concertId) {
  if (!Array.isArray(concerts) || concertId === null || concertId === undefined) {
    return null;
  }

  return concerts.find((concert) => Number(concert.id) === Number(concertId)) ?? null;
}

function normalizeConcertsPayload(data) {
  if (Array.isArray(data?.concerts)) {
    return data.concerts;
  }

  if (
    data?.version === 2 &&
    Array.isArray(data?.artists) &&
    Array.isArray(data?.tracks) &&
    Array.isArray(data?.entries)
  ) {
    const artistsById = new Map(data.artists.map((artist) => [artist.id, artist]));
    const tracksById = new Map(data.tracks.map((track) => [track.id, track]));

    return data.entries.flatMap((entry) => {
      const artist = artistsById.get(entry.artistId);
      const track = tracksById.get(entry.trackId);
      if (!artist || !track) {
        return [];
      }

      return [
        {
          id: entry.id,
          band: artist.name,
          audioFile: track.audioFile,
        },
      ];
    });
  }

  return null;
}

export function findLocalFilesByBasename(fileName, rootDir = DEFAULT_ENCODE_OUTPUT_DIR) {
  if (!fileName) {
    return [];
  }

  const absoluteRoot = path.resolve(projectRoot, rootDir);
  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const results = [];
  const queue = [absoluteRoot];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.name === fileName) {
        results.push(path.relative(projectRoot, fullPath).split(path.sep).join('/'));
      }
    }
  }

  return results.sort();
}

function createRequestHeaders(requestOptions = {}, extraHeaders = {}) {
  const headers = { ...extraHeaders };

  if (requestOptions.origin) {
    headers.Origin = requestOptions.origin;
  }

  if (requestOptions.sharedSecret) {
    headers['X-PS-Shared-Secret'] = requestOptions.sharedSecret;
  }

  return headers;
}

export function checkRemote(url, timeout, requestOptions = {}, method = 'GET', extraHeaders = {}) {
  return new Promise((resolve) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      resolve({
        url,
        method,
        status: 0,
        statusText: 'Not a remote URL',
        accessible: false,
        isLocal: true,
      });
      return;
    }

    const protocol = url.startsWith('https://') ? https : http;
    const headers = createRequestHeaders(requestOptions, extraHeaders);

    const request = protocol.request(url, { timeout, headers, method }, (response) => {
      resolve({
        url,
        method,
        status: response.statusCode,
        statusText: response.statusMessage,
        headers: response.headers,
        accessible: response.statusCode >= 200 && response.statusCode < 400,
        isLocal: false,
      });

      response.resume();
    });

    request.on('error', (error) => {
      resolve({
        url,
        method,
        status: 0,
        statusText: error.message,
        accessible: false,
        isLocal: false,
        error: error.message,
      });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({
        url,
        method,
        status: 0,
        statusText: 'Request timeout',
        accessible: false,
        isLocal: false,
        error: 'Request timeout',
      });
    });

    request.end();
  });
}

export async function probeRemoteAudio(url, timeout, requestOptions = {}) {
  const head = await checkRemote(url, timeout, requestOptions, 'HEAD');
  const range = await checkRemote(url, timeout, requestOptions, 'GET', { Range: 'bytes=0-1023' });
  return { head, range };
}

export function inferLikelyFailure(result) {
  if (result.accessible) {
    return 'URL is reachable.';
  }

  if (result.status === 403) {
    return 'Likely CORS allowlist issue (Origin not in ALLOWED_ORIGINS) or shared-secret mismatch.';
  }

  if (result.status === 404) {
    return 'Likely object key mismatch: dataset URL path does not match uploaded R2 key.';
  }

  if (result.status === 0 && /timeout/i.test(result.statusText || '')) {
    return 'Network timeout reaching endpoint.';
  }

  return 'Unknown failure. Check worker logs, object key, and response headers.';
}

/**
 * Check if a URL is accessible
 * @param {string} url - URL to check
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<object>} Result object with accessibility info
 */
export function checkUrl(url, timeout, requestOptions = {}) {
  return new Promise((resolve) => {
    // Handle local file paths
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const result = checkLocalFile(url);
      resolve(result);
      return;
    }

    // Handle remote URLs
    const protocol = url.startsWith('https://') ? https : http;
    const headers = {};

    if (requestOptions.origin) {
      headers.Origin = requestOptions.origin;
    }

    if (requestOptions.sharedSecret) {
      headers['X-PS-Shared-Secret'] = requestOptions.sharedSecret;
    }

    const request = protocol.get(url, { timeout, headers }, (response) => {
      resolve({
        url,
        status: response.statusCode,
        statusText: response.statusMessage,
        accessible: response.statusCode >= 200 && response.statusCode < 400,
        isLocal: false,
      });
      // Consume response to free up memory
      response.resume();
    });

    request.on('error', (error) => {
      resolve({
        url,
        status: 0,
        statusText: error.message,
        accessible: false,
        isLocal: false,
        error: error.message,
      });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({
        url,
        status: 0,
        statusText: 'Request timeout',
        accessible: false,
        isLocal: false,
        error: 'Request timeout',
      });
    });
  });
}

/**
 * Check if a local file exists
 * @param {string} url - Local file path or URL-style path
 * @returns {object} Result object with file existence info
 */
export function checkLocalFile(url) {
  try {
    // For local paths starting with '/', treat them as relative to 'public/' directory
    // e.g., '/audio/concert-1.opus' -> 'public/audio/concert-1.opus'
    const relativePath = url.startsWith('/') ? url.substring(1) : url;
    const localPath = path.resolve(projectRoot, 'public', relativePath);
    const exists = fs.existsSync(localPath);
    return {
      url,
      status: exists ? 200 : 404,
      statusText: exists ? 'OK (local file)' : 'Not Found (local file)',
      accessible: exists,
      isLocal: true,
      ...(exists ? {} : { error: 'File not found' }),
    };
  } catch (error) {
    return {
      url,
      status: 0,
      statusText: error.message,
      accessible: false,
      isLocal: true,
      error: error.message,
    };
  }
}

/**
 * Calculate statistics from validation results
 * @param {Array} results - Array of validation results
 * @returns {object} Statistics object
 */
export function calculateStats(results) {
  if (results.length === 0) {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      successRate: 0,
    };
  }

  const successful = results.filter((r) => r.accessible).length;
  const failed = results.length - successful;
  const successRate = (successful / results.length) * 100;

  return {
    total: results.length,
    successful,
    failed,
    successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal place
  };
}

/**
 * Generate a report from validation statistics
 * @param {object} stats - Statistics object from calculateStats
 * @returns {string} Formatted report
 */
export function generateReport(stats) {
  const { total, successful, failed, successRate } = stats;

  if (successRate === 100) {
    return `✅ All audio URLs are accessible!\n\nSuccess Rate: ${successRate.toFixed(1)}%\nTotal: ${total}\nSuccessful: ${successful}\nFailed: ${failed}`;
  }

  let report = `⚠️  Validation Report\n\n`;
  report += `Success Rate: ${successRate.toFixed(1)}%\n`;
  report += `Total URLs Checked: ${total}\n`;
  report += `Successful: ${successful}\n`;
  report += `Failed: ${failed}\n\n`;

  if (failed > 0) {
    report += `Recommendations:\n`;
    report += `1. Check that audio files are uploaded to the CDN\n`;
    report += `2. Verify CDN URLs are correct in the dataset artifact\n`;
    report += `3. Ensure CDN allows public access (CORS enabled)\n`;
    report += `4. Check network connectivity\n`;
  }

  return report;
}

// Only run CLI logic when executed directly (not when imported as a module)
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    source: 'public/data.app.v2.json',
    timeout: 10000,
    baseUrl: '',
    prefix: 'prod/audio',
    origin: '',
    sharedSecret: '',
    trace: false,
    concertId: null,
    onlyConcertIds: null,
    help: false,
  };

  const readArgValue = (input) => {
    const separatorIndex = input.indexOf('=');
    if (separatorIndex === -1) {
      return '';
    }
    return input.slice(separatorIndex + 1);
  };

  for (const arg of args) {
    if (arg === '--help') {
      options.help = true;
    } else if (arg.startsWith('--source=')) {
      const value = readArgValue(arg);
      if (!value) {
        console.error('❌ Error: --source requires a value');
        process.exit(1);
      }
      options.source = value;
    } else if (arg.startsWith('--timeout=')) {
      const value = readArgValue(arg);
      if (!value || isNaN(parseInt(value, 10)) || parseInt(value, 10) <= 0) {
        console.error('❌ Error: --timeout requires a positive integer value');
        process.exit(1);
      }
      options.timeout = parseInt(value, 10);
    } else if (arg.startsWith('--base-url=')) {
      const value = readArgValue(arg);
      if (!value) {
        console.error('❌ Error: --base-url requires a value');
        process.exit(1);
      }
      options.baseUrl = trimTrailingSlash(value);
    } else if (arg.startsWith('--prefix=')) {
      const value = readArgValue(arg);
      if (!value) {
        console.error('❌ Error: --prefix requires a value');
        process.exit(1);
      }
      options.prefix = sanitizePrefix(value);
    } else if (arg.startsWith('--origin=')) {
      const value = readArgValue(arg);
      if (!value) {
        console.error('❌ Error: --origin requires a value');
        process.exit(1);
      }
      options.origin = value;
    } else if (arg.startsWith('--shared-secret=')) {
      const value = readArgValue(arg);
      if (!value) {
        console.error('❌ Error: --shared-secret requires a value');
        process.exit(1);
      }
      options.sharedSecret = value;
    } else if (arg === '--trace') {
      options.trace = true;
    } else if (arg.startsWith('--concert-id=')) {
      const value = readArgValue(arg);
      const parsed = Number.parseInt(value, 10);
      if (!value || Number.isNaN(parsed)) {
        console.error('❌ Error: --concert-id requires an integer value');
        process.exit(1);
      }
      options.concertId = parsed;
    } else if (arg.startsWith('--only-concert-ids=')) {
      const value = readArgValue(arg);
      const parsed = value
        .split(',')
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isInteger(entry));

      if (!value || parsed.length === 0) {
        console.error('❌ Error: --only-concert-ids requires a comma-separated list of integers');
        process.exit(1);
      }

      options.onlyConcertIds = new Set(parsed);
    }
  }

  // Show help
  if (options.help) {
    console.log(`
Audio URL Validation Script

This script validates that all audio URLs in the runtime dataset are accessible.

Usage:
  node scripts/audio-workflow/update/validate-audio-urls.js [options]

Options:
  --source=<path>       Path to dataset JSON (default: public/data.app.v2.json)
  --timeout=<ms>        Request timeout in milliseconds (default: 10000)
  --base-url=<url>      Override audioFile with CDN base URL
  --prefix=<path>       Key prefix for CDN paths (default: prod/audio)
  --trace               Print deep diagnostics for one concert
  --concert-id=<id>     Concert ID to trace (default: first concert with audio)
  --only-concert-ids=<ids> Limit validation to comma-separated concert IDs
  --origin=<origin>     Optional Origin header for CORS-protected endpoints
  --shared-secret=<s>   Optional X-PS-Shared-Secret header for worker bypass
  --help                Show this help message

Examples:
  # Validate production dataset
  node scripts/audio-workflow/update/validate-audio-urls.js

  # Validate legacy payload explicitly
  node scripts/audio-workflow/update/validate-audio-urls.js --source=public/data.json

  # Validate against a CDN base
  node scripts/audio-workflow/update/validate-audio-urls.js --base-url=https://audio.example.com --prefix=prod/audio

  # Validate Cloudflare Worker URLs with CORS origin
  node scripts/audio-workflow/update/validate-audio-urls.js --origin=http://localhost:5173

  # Deep trace one concert end-to-end
  node scripts/audio-workflow/update/validate-audio-urls.js --trace --concert-id=1 --origin=https://www.whoisduck2.com
`);
    process.exit(0);
  }

  // Main validation logic
  async function validateAudioUrls() {
    console.log('🎵 Audio URL Validation Script\n');
    console.log('Configuration:');
    console.log(`  Source: ${options.source}`);
    console.log(`  Timeout: ${options.timeout}ms`);
    console.log('');
    if (options.baseUrl) {
      console.log(`  Base URL: ${options.baseUrl}`);
      console.log(`  Prefix: ${options.prefix}`);
      console.log('');
    }

    if (options.origin) {
      console.log(`  Origin header: ${options.origin}`);
      console.log('');
    }

    if (options.sharedSecret) {
      console.log('  Shared secret header: configured');
      console.log('');
    }

    if (options.trace) {
      console.log(
        `  Trace mode: enabled${options.concertId ? ` (concert ${options.concertId})` : ''}`
      );
      console.log('');
    }

    // Read source dataset
    const sourcePath = path.resolve(projectRoot, options.source);

    if (!fs.existsSync(sourcePath)) {
      console.error(`❌ Error: Source file not found: ${sourcePath}`);
      process.exit(1);
    }

    console.log(`📂 Reading source file: ${sourcePath}`);
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');

    let data;
    try {
      data = JSON.parse(sourceContent);
    } catch (error) {
      console.error(`❌ Error: Invalid JSON in ${sourcePath}`);
      console.error(`   ${error.message}`);
      process.exit(1);
    }

    const concerts = normalizeConcertsPayload(data);
    if (!concerts) {
      console.error('❌ Error: Invalid dataset format (missing v2 entries or legacy concerts)');
      process.exit(1);
    }

    data.concerts = concerts;

    if (options.onlyConcertIds?.size) {
      data.concerts = data.concerts.filter((concert) =>
        options.onlyConcertIds.has(Number(concert.id))
      );
      console.log(`  Concert ID filter: ${Array.from(options.onlyConcertIds).join(', ')}`);
    }

    console.log(`✓ Found ${data.concerts.length} concerts\n`);

    if (options.trace) {
      const traceConcert =
        findConcertById(data.concerts, options.concertId) ??
        data.concerts.find((concert) => concert.audioFile) ??
        null;

      if (!traceConcert) {
        console.error('❌ No concert with audioFile found to trace.');
        process.exit(1);
      }

      const targetUrl = options.baseUrl
        ? buildAudioUrl(traceConcert, options.baseUrl, options.prefix)
        : traceConcert.audioFile;
      const basename = path.basename(targetUrl || '');
      const localMatches = findLocalFilesByBasename(basename);
      const shape = classifyUrlShape(targetUrl, options.prefix);

      console.log('🧭 Trace Mode:');
      console.log(`  Concert ID: ${traceConcert.id}`);
      console.log(`  Band: ${traceConcert.band}`);
      console.log(`  Source audioFile: ${traceConcert.audioFile}`);
      console.log(`  Resolved URL: ${targetUrl}`);
      console.log(`  URL shape: ${shape.type}`);
      if (shape.key) {
        console.log(`  Worker key candidate: ${shape.key}`);
      }
      console.log(`  Local basename: ${basename || '(empty)'}`);
      console.log(
        `  Local encode matches: ${localMatches.length > 0 ? localMatches.join(', ') : '(none found)'}`
      );

      const primaryResult = await checkUrl(targetUrl, options.timeout, {
        origin: options.origin,
        sharedSecret: options.sharedSecret,
      });
      console.log(`  Primary GET: ${primaryResult.status} ${primaryResult.statusText}`);
      console.log(`  Primary diagnosis: ${inferLikelyFailure(primaryResult)}`);

      if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        const remoteProbe = await probeRemoteAudio(targetUrl, options.timeout, {
          origin: options.origin,
          sharedSecret: options.sharedSecret,
        });

        console.log(`  HEAD probe: ${remoteProbe.head.status} ${remoteProbe.head.statusText}`);
        console.log(
          `    Access-Control-Allow-Origin: ${remoteProbe.head.headers?.['access-control-allow-origin'] ?? '(missing)'}`
        );
        console.log(
          `    Accept-Ranges: ${remoteProbe.head.headers?.['accept-ranges'] ?? '(missing)'}`
        );
        console.log(
          `    Content-Type: ${remoteProbe.head.headers?.['content-type'] ?? '(missing)'}`
        );
        console.log(`  Range probe: ${remoteProbe.range.status} ${remoteProbe.range.statusText}`);
        console.log(
          `    Content-Range: ${remoteProbe.range.headers?.['content-range'] ?? '(missing)'}`
        );
      }

      console.log('');
    }

    // Validate each concert's audio URL
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const concert of data.concerts) {
      console.log(`Checking Concert #${concert.id}: ${concert.band}`);

      if (!concert.audioFile) {
        console.log('  ⏭️  Skipping: no audioFile found\n');
        continue;
      }

      if (options.baseUrl && !concert.id) {
        console.log('  ⏭️  Skipping: concert is missing id required for CDN path\n');
        continue;
      }

      // Check primary URL
      const targetUrl = options.baseUrl
        ? buildAudioUrl(concert, options.baseUrl, options.prefix)
        : concert.audioFile;

      const primaryResult = await checkUrl(targetUrl, options.timeout, {
        origin: options.origin,
        sharedSecret: options.sharedSecret,
      });
      results.push({
        concert,
        type: 'primary',
        result: primaryResult,
      });

      const primaryIcon = primaryResult.accessible ? '✓' : '✗';
      console.log(`  ${primaryIcon} Primary:  ${targetUrl}`);
      console.log(`            Status: ${primaryResult.status} ${primaryResult.statusText}`);

      if (primaryResult.accessible) {
        successCount++;
      } else {
        failureCount++;
      }

      console.log();
    }

    // Summary
    console.log('═'.repeat(70));
    console.log('📊 Validation Summary:\n');

    const totalChecked = successCount + failureCount;
    const successRate = totalChecked > 0 ? ((successCount / totalChecked) * 100).toFixed(1) : 0;

    console.log(`  Total URLs Checked: ${totalChecked}`);
    console.log(`  Successful: ${successCount} (${successRate}%)`);
    console.log(`  Failed:     ${failureCount}`);
    console.log();

    // Show failed URLs
    const failures = results.filter((r) => !r.result.accessible);
    if (failures.length > 0) {
      console.log('❌ Failed URLs:\n');
      for (const failure of failures) {
        console.log(`  Concert #${failure.concert.id}: ${failure.concert.band}`);
        console.log(`    URL: ${failure.result.url}`);
        console.log(`    Status: ${failure.result.status} ${failure.result.statusText}`);
        console.log();
      }

      console.log('Recommendations:');
      console.log('1. Check that audio files are uploaded to the CDN');
      console.log('2. Verify CDN URLs are correct in the dataset artifact');
      console.log('3. Ensure CDN allows public access (CORS enabled)');
      console.log('4. Retry with --origin=<allowed-origin> for CORS-protected workers');
      console.log(
        '5. Re-run with --trace to inspect key shape, local file match, CORS, and range headers'
      );
      console.log('6. Check network connectivity');
      console.log();

      process.exit(1);
    } else {
      console.log('✅ All audio URLs are accessible!');
      console.log();
      process.exit(0);
    }
  }

  // Run validation
  validateAudioUrls().catch((error) => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}
