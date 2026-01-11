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
 *   --prefix=<path>       Key prefix to join with concert IDs and filenames (default: prod/audio)
 *   --check-fallback      Also check fallback URLs
 *   --help                Show this help message
 *
 * Examples:
 *   # Validate production data.json
 *   node scripts/audio-workflow/update/validate-audio-urls.js
 *
 *   # Validate with fallback URLs
 *   node scripts/audio-workflow/update/validate-audio-urls.js --check-fallback
 *
 *   # Validate test data
 *   node scripts/audio-workflow/update/validate-audio-urls.js --source=assets/test-data/concerts.json
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

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  source: 'public/data.json',
  timeout: 10000,
  checkFallback: false,
  baseUrl: '',
  prefix: 'prod/audio',
  help: false,
};

for (const arg of args) {
  if (arg === '--help') {
    options.help = true;
  } else if (arg === '--check-fallback') {
    options.checkFallback = true;
  } else if (arg.startsWith('--source=')) {
    const value = arg.split('=')[1];
    if (!value) {
      console.error('❌ Error: --source requires a value');
      process.exit(1);
    }
    options.source = value;
  } else if (arg.startsWith('--timeout=')) {
    const value = arg.split('=')[1];
    if (!value || isNaN(parseInt(value, 10)) || parseInt(value, 10) <= 0) {
      console.error('❌ Error: --timeout requires a positive integer value');
      process.exit(1);
    }
    options.timeout = parseInt(value, 10);
  } else if (arg.startsWith('--base-url=')) {
    const value = arg.split('=')[1];
    if (!value) {
      console.error('❌ Error: --base-url requires a value');
      process.exit(1);
    }
    options.baseUrl = trimTrailingSlash(value);
  } else if (arg.startsWith('--prefix=')) {
    const value = arg.split('=')[1];
    if (!value) {
      console.error('❌ Error: --prefix requires a value');
      process.exit(1);
    }
    options.prefix = sanitizePrefix(value);
  }
}

// Show help
if (options.help) {
  console.log(`
Audio URL Validation Script

This script validates that all audio URLs in data.json are accessible.

Usage:
  node scripts/audio-workflow/update/validate-audio-urls.js [options]

Options:
  --source=<path>       Path to data.json (default: public/data.json)
  --timeout=<ms>        Request timeout in milliseconds (default: 10000)
  --base-url=<url>      Override audioFile with CDN base URL
  --prefix=<path>       Key prefix for CDN paths (default: prod/audio)
  --check-fallback      Also check fallback URLs
  --help                Show this help message

Examples:
  # Validate production data.json
  node scripts/audio-workflow/update/validate-audio-urls.js

  # Validate with fallback URLs
  node scripts/audio-workflow/update/validate-audio-urls.js --check-fallback

  # Validate test data
  node scripts/audio-workflow/update/validate-audio-urls.js --source=assets/test-data/concerts.json
`);
  process.exit(0);
}

/**
 * Check if a URL is accessible
 * @param {string} url - URL to check
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<object>} Result object with accessibility info
 */
export function checkUrl(url, timeout) {
  return new Promise((resolve) => {
    // Handle local file paths
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const result = checkLocalFile(url);
      resolve(result);
      return;
    }

    // Handle remote URLs
    const protocol = url.startsWith('https://') ? https : http;

    const request = protocol.get(url, { timeout }, (response) => {
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
    report += `2. Verify CDN URLs are correct in data.json\n`;
    report += `3. Ensure CDN allows public access (CORS enabled)\n`;
    report += `4. Check network connectivity\n`;
  }

  return report;
}

export function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return '';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export function normalizePrefix(prefix) {
  if (!prefix) return '';
  const trimmed = prefix.trim();
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function resolveAudioUrl(rawUrl, concertId, baseUrl, prefix) {
  if (!rawUrl) return null;

  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPrefix = normalizePrefix(prefix);

  if (!normalizedBase) {
    return rawUrl;
  }

  const pathPart = buildPathWithPrefix(rawUrl, concertId, normalizedPrefix);
  return `${normalizedBase}/${pathPart}`;
}

function buildPathWithPrefix(rawUrl, concertId, prefix) {
  const pathOnly = stripToPath(rawUrl);
  if (!prefix) {
    return pathOnly.replace(/^\/+/, '');
  }

  const normalizedPrefix = `${prefix}/`;

  if (pathOnly.startsWith(normalizedPrefix)) {
    return pathOnly;
  }

  const prefixIndex = pathOnly.indexOf(normalizedPrefix);
  if (prefixIndex !== -1) {
    return pathOnly.slice(prefixIndex);
  }

  const filename = path.basename(pathOnly) || `concert-${concertId}.opus`;
  return `${prefix}/${concertId}/${filename}`;
}

function stripToPath(value) {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    const parsed = new URL(value);
    return parsed.pathname.replace(/^\/+/, '');
  }

  return value.replace(/^\/+/, '');
}

// Only run CLI logic when executed directly (not when imported as a module)
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    source: 'public/data.json',
    timeout: 10000,
    checkFallback: false,
    baseUrl: '',
    prefix: 'prod/audio',
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help') {
      options.help = true;
    } else if (arg === '--check-fallback') {
      options.checkFallback = true;
    } else if (arg.startsWith('--source=')) {
      const value = arg.split('=')[1];
      if (!value) {
        console.error('❌ Error: --source requires a value');
        process.exit(1);
      }
      options.source = value;
    } else if (arg.startsWith('--timeout=')) {
      const value = arg.split('=')[1];
      if (!value || isNaN(parseInt(value, 10)) || parseInt(value, 10) <= 0) {
        console.error('❌ Error: --timeout requires a positive integer value');
        process.exit(1);
      }
      options.timeout = parseInt(value, 10);
    } else if (arg.startsWith('--base-url=')) {
      const value = arg.split('=')[1];
      if (!value) {
        console.error('❌ Error: --base-url requires a value');
        process.exit(1);
      }
      options.baseUrl = trimTrailingSlash(value);
    } else if (arg.startsWith('--prefix=')) {
      const value = arg.split('=')[1];
      if (!value) {
        console.error('❌ Error: --prefix requires a value');
        process.exit(1);
      }
      options.prefix = sanitizePrefix(value);
    }
  }

  // Show help
  if (options.help) {
    console.log(`
Audio URL Validation Script

This script validates that all audio URLs in data.json are accessible.

Usage:
  node scripts/audio-workflow/update/validate-audio-urls.js [options]

Options:
  --source=<path>       Path to data.json (default: public/data.json)
  --timeout=<ms>        Request timeout in milliseconds (default: 10000)
  --base-url=<url>      Override audioFile with CDN base URL
  --prefix=<path>       Key prefix for CDN paths (default: prod/audio)
  --check-fallback      Also check fallback URLs
  --base-url=<url>      Override base URL (e.g., https://audio.example.com)
  --prefix=<path>       Override key prefix (default: prod/audio)
  --help                Show this help message

Examples:
  # Validate production data.json
  node scripts/audio-workflow/update/validate-audio-urls.js

  # Validate with fallback URLs
  node scripts/audio-workflow/update/validate-audio-urls.js --check-fallback

  # Validate test data
  node scripts/audio-workflow/update/validate-audio-urls.js --source=assets/test-data/concerts.json

  # Validate against a CDN base
  node scripts/audio-workflow/update/validate-audio-urls.js --base-url=https://audio.example.com --prefix=prod/audio
`);
    process.exit(0);
  }

  // Main validation logic
  async function validateAudioUrls() {
    console.log('🎵 Audio URL Validation Script\n');
    console.log('Configuration:');
    console.log(`  Source: ${options.source}`);
    console.log(`  Timeout: ${options.timeout}ms`);
    console.log(`  Check Fallback: ${options.checkFallback ? 'Yes' : 'No'}\n`);
    if (options.baseUrl) {
      console.log(`  Base URL: ${options.baseUrl}`);
      console.log(`  Prefix: ${options.prefix}`);
      console.log('');
    }

    // Read source data.json
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

    if (!data.concerts || !Array.isArray(data.concerts)) {
      console.error('❌ Error: Invalid data.json format (missing concerts array)');
      process.exit(1);
    }

    console.log(`✓ Found ${data.concerts.length} concerts\n`);

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

      const primaryResult = await checkUrl(targetUrl, options.timeout);
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

      // Check fallback URL if requested
      if (options.checkFallback && concert.audioFileFallback) {
        const fallbackUrl = resolveAudioUrl(
          concert.audioFileFallback,
          concert.id,
          options.baseUrl,
          options.prefix
        );

        const fallbackResult = await checkUrl(fallbackUrl, options.timeout);
        results.push({
          concert,
          type: 'fallback',
          result: fallbackResult,
        });

        const fallbackIcon = fallbackResult.accessible ? '✓' : '✗';
        console.log(`  ${fallbackIcon} Fallback: ${fallbackUrl}`);
        console.log(`            Status: ${fallbackResult.status} ${fallbackResult.statusText}`);
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
      console.log('2. Verify CDN URLs are correct in data.json');
      console.log('3. Ensure CDN allows public access (CORS enabled)');
      console.log('4. Check network connectivity');
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
