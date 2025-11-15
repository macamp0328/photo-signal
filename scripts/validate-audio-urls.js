#!/usr/bin/env node

/**
 * Audio URL Validation Script
 *
 * This script validates that all audio URLs in data.json are accessible
 * and reports any broken links or issues.
 *
 * Usage:
 *   node scripts/validate-audio-urls.js [options]
 *
 * Options:
 *   --source=<path>       Path to data.json (default: public/data.json)
 *   --timeout=<ms>        Request timeout in milliseconds (default: 10000)
 *   --check-fallback      Also check fallback URLs
 *   --help                Show this help message
 *
 * Examples:
 *   # Validate production data.json
 *   node scripts/validate-audio-urls.js
 *
 *   # Validate with fallback URLs
 *   node scripts/validate-audio-urls.js --check-fallback
 *
 *   # Validate test data
 *   node scripts/validate-audio-urls.js --source=assets/test-data/concerts.json
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  source: 'public/data.json',
  timeout: 10000,
  checkFallback: false,
  help: false,
};

for (const arg of args) {
  if (arg === '--help') {
    options.help = true;
  } else if (arg === '--check-fallback') {
    options.checkFallback = true;
  } else if (arg.startsWith('--source=')) {
    options.source = arg.split('=')[1];
  } else if (arg.startsWith('--timeout=')) {
    options.timeout = parseInt(arg.split('=')[1], 10);
  }
}

// Show help
if (options.help) {
  console.log(`
Audio URL Validation Script

This script validates that all audio URLs in data.json are accessible.

Usage:
  node scripts/validate-audio-urls.js [options]

Options:
  --source=<path>       Path to data.json (default: public/data.json)
  --timeout=<ms>        Request timeout in milliseconds (default: 10000)
  --check-fallback      Also check fallback URLs
  --help                Show this help message

Examples:
  # Validate production data.json
  node scripts/validate-audio-urls.js

  # Validate with fallback URLs
  node scripts/validate-audio-urls.js --check-fallback

  # Validate test data
  node scripts/validate-audio-urls.js --source=assets/test-data/concerts.json
`);
  process.exit(0);
}

/**
 * Check if a URL is accessible
 */
function checkUrl(url, timeout) {
  return new Promise((resolve) => {
    // Handle local file paths
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // For local paths starting with '/', treat them as relative to 'public/' directory
      // e.g., '/audio/concert-1.mp3' -> 'public/audio/concert-1.mp3'
      const relativePath = url.startsWith('/') ? url.substring(1) : url;
      const localPath = path.resolve(projectRoot, 'public', relativePath);
      const exists = fs.existsSync(localPath);
      resolve({
        url,
        status: exists ? 200 : 404,
        statusText: exists ? 'OK (local file)' : 'Not Found (local file)',
        accessible: exists,
        isLocal: true,
      });
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
      });
    });
  });
}

// Main validation logic
async function validateAudioUrls() {
  console.log('🎵 Audio URL Validation Script\n');
  console.log('Configuration:');
  console.log(`  Source: ${options.source}`);
  console.log(`  Timeout: ${options.timeout}ms`);
  console.log(`  Check Fallback: ${options.checkFallback ? 'Yes' : 'No'}\n`);

  // Read source data.json
  const sourcePath = path.resolve(projectRoot, options.source);

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Error: Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  console.log(`📂 Reading source file: ${sourcePath}`);
  const sourceContent = fs.readFileSync(sourcePath, 'utf8');
  const data = JSON.parse(sourceContent);

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

    // Check primary URL
    const primaryResult = await checkUrl(concert.audioFile, options.timeout);
    results.push({
      concert,
      type: 'primary',
      result: primaryResult,
    });

    const primaryIcon = primaryResult.accessible ? '✓' : '✗';
    console.log(`  ${primaryIcon} Primary:  ${concert.audioFile}`);
    console.log(`            Status: ${primaryResult.status} ${primaryResult.statusText}`);

    if (primaryResult.accessible) {
      successCount++;
    } else {
      failureCount++;
    }

    // Check fallback URL if requested
    if (options.checkFallback && concert.audioFileFallback) {
      const fallbackResult = await checkUrl(concert.audioFileFallback, options.timeout);
      results.push({
        concert,
        type: 'fallback',
        result: fallbackResult,
      });

      const fallbackIcon = fallbackResult.accessible ? '✓' : '✗';
      console.log(`  ${fallbackIcon} Fallback: ${concert.audioFileFallback}`);
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
