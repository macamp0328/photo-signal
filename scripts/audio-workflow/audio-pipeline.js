#!/usr/bin/env node

/**
 * audio-pipeline.js — End-to-end audio pipeline orchestrator
 *
 * Runs the full pipeline (download → encode → upload → build-data) from a single command.
 * All you need is a YouTube Music playlist URL and the prod-photographs-details.csv file.
 *
 * Usage:
 *   node scripts/audio-workflow/audio-pipeline.js [options]
 *   npm run audio:pipeline -- [options]
 *
 * Quick start:
 *   1. Create audio-pipeline.config.json (see --help for config format)
 *   2. Run: npm run audio:pipeline
 *   3. Follow the on-screen instructions after it completes
 *
 * Config file (audio-pipeline.config.json at project root):
 *   {
 *     "playlistUrl": "https://music.youtube.com/playlist?list=...",
 *     "csvPath": "assets/prod-photographs/prod-photographs-details.csv",
 *     "baseUrl": "https://photo-signal-audio-worker.whoisduck2.workers.dev",
 *     "prefix": "prod/audio"
 *   }
 *
 * R2 upload credentials are read from environment variables:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   (upload phase is skipped if any are missing — safe for local-only runs)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIG_FILE = path.resolve(process.cwd(), 'audio-pipeline.config.json');

const DEFAULT_CSV_PATH = 'assets/prod-photographs/prod-photographs-details.csv';
const DEFAULT_BASE_URL = 'https://photo-signal-audio-worker.whoisduck2.workers.dev';
const DEFAULT_PREFIX = 'prod/audio';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const raw = token.slice(2);
    if (!raw.includes('=')) {
      args[raw] = true;
      continue;
    }
    const sep = raw.indexOf('=');
    args[raw.slice(0, sep)] = raw.slice(sep + 1);
  }
  return args;
}

function toBoolean(value) {
  if (value === undefined || value === null) return false;
  return ['true', '1', 'yes', 'y'].includes(String(value).toLowerCase());
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.warn(`⚠️  Could not parse config file ${configPath}: ${err.message}`);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Credential detection
// ---------------------------------------------------------------------------

function detectR2Credentials() {
  const env = process.env;
  return {
    accountId: env.R2_ACCOUNT_ID ?? null,
    accessKeyId: env.R2_ACCESS_KEY_ID ?? null,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? null,
    bucket: env.R2_BUCKET_NAME ?? null,
  };
}

function hasR2Credentials(creds) {
  return Boolean(creds.accountId && creds.accessKeyId && creds.secretAccessKey);
}

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

function run(command, label, dryRun) {
  console.log('');
  console.log(`▶  ${label}`);
  console.log(`   ${command}`);

  if (dryRun) {
    console.log('   [dry-run — skipped]');
    return true;
  }

  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
    env: process.env,
  });

  const exitCode = typeof result.status === 'number' ? result.status : 1;
  if (exitCode !== 0) {
    console.error(`\n❌  Phase failed: ${label} (exit code ${exitCode})`);
    return false;
  }

  console.log(`✅  Done: ${label}`);
  return true;
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
audio-pipeline — end-to-end audio pipeline (download → encode → upload → build-data)

Usage:
  npm run audio:pipeline -- [options]

Options:
  --playlist-url=<url>    YouTube Music playlist URL to download
                          (overrides config file and download-yt-song.config.json)
  --csv=<path>            Path to prod-photographs-details.csv
                          (default: ${DEFAULT_CSV_PATH})
  --base-url=<url>        Audio CDN worker base URL
                          (default: ${DEFAULT_BASE_URL})
  --prefix=<path>         R2 key prefix (default: ${DEFAULT_PREFIX})
  --skip-download         Skip the download phase (reuse existing downloads)
  --skip-encode           Skip the encode phase (reuse existing encoded files)
  --skip-upload           Skip the upload phase (build data.json without uploading)
  --dry-run               Print commands without running them
  --help                  Show this message

Config file (audio-pipeline.config.json at project root):
  {
    "playlistUrl": "https://music.youtube.com/playlist?list=...",
    "csvPath": "assets/prod-photographs/prod-photographs-details.csv",
    "baseUrl": "https://photo-signal-audio-worker.whoisduck2.workers.dev",
    "prefix": "prod/audio"
  }

R2 upload credentials (read from environment — upload is skipped if missing):
  R2_ACCOUNT_ID           Cloudflare account ID
  R2_ACCESS_KEY_ID        R2 access key ID
  R2_SECRET_ACCESS_KEY    R2 secret access key
  R2_BUCKET_NAME          R2 bucket name (default: photo-signal-audio)

Examples:
  # First-time full run (reads playlist URL from config file):
  npm run audio:pipeline

  # Override playlist URL on the command line:
  npm run audio:pipeline -- --playlist-url="https://music.youtube.com/playlist?list=..."

  # Re-run encode + build-data only (skip download & upload):
  npm run audio:pipeline -- --skip-download --skip-upload

  # Preview what commands would run:
  npm run audio:pipeline -- --dry-run
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (toBoolean(args.help)) {
    printHelp();
    return;
  }

  // Load config file, then let CLI args override
  const fileConfig = loadConfig(CONFIG_FILE);
  const dryRun = toBoolean(args['dry-run']);
  const skipDownload = toBoolean(args['skip-download']);
  const skipEncode = toBoolean(args['skip-encode']);
  const skipUpload = toBoolean(args['skip-upload']);

  // Resolve settings (CLI > config file > defaults)
  const playlistUrl = args['playlist-url'] ?? fileConfig.playlistUrl ?? null;
  const csvPath = args.csv ?? fileConfig.csvPath ?? DEFAULT_CSV_PATH;
  const baseUrl = args['base-url'] ?? fileConfig.baseUrl ?? DEFAULT_BASE_URL;
  const prefix = args.prefix ?? fileConfig.prefix ?? DEFAULT_PREFIX;

  // Detect R2 credentials
  const r2Creds = detectR2Credentials();
  const canUpload = !skipUpload && hasR2Credentials(r2Creds);

  // Determine phases
  const phases = [];
  if (!skipDownload) phases.push('download');
  if (!skipEncode) phases.push('encode');
  if (canUpload) phases.push('upload');
  if (!canUpload && !skipUpload) phases.push('build-data (local, no upload)');
  phases.push('build-data');

  // Print plan
  console.log('');
  console.log('🎵  Photo Signal — Audio Pipeline');
  console.log('──────────────────────────────────────────────────────');

  if (playlistUrl) {
    console.log(`   Playlist URL : ${playlistUrl}`);
  } else {
    console.log(`   Playlist URL : (from download-yt-song.config.json — no override provided)`);
  }

  console.log(`   CSV path     : ${csvPath}`);
  console.log(`   Base URL     : ${baseUrl}`);
  console.log(`   Prefix       : ${prefix}`);
  console.log(
    `   Upload       : ${canUpload ? 'yes (R2 credentials found)' : 'skipped (no R2 credentials)'}`
  );
  console.log(`   Dry run      : ${dryRun ? 'yes' : 'no'}`);
  console.log('');

  if (!skipUpload && !canUpload) {
    const missing = [];
    if (!r2Creds.accountId) missing.push('R2_ACCOUNT_ID');
    if (!r2Creds.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!r2Creds.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    console.log(`⚠️   Upload skipped — missing env vars: ${missing.join(', ')}`);
    console.log(`     Set them to enable R2 upload. See .env.example for details.\n`);
  }

  if (!fs.existsSync(path.resolve(process.cwd(), csvPath))) {
    console.error(`❌  CSV file not found: ${csvPath}`);
    console.error(`     Provide --csv=<path> or add "csvPath" to audio-pipeline.config.json.`);
    process.exit(1);
  }

  // ── Phase 1: Download ──────────────────────────────────────────────────
  if (!skipDownload) {
    const downloadCmd = playlistUrl
      ? `npm run download-song -- --playlist-url=${JSON.stringify(playlistUrl)}`
      : 'npm run download-song';

    const ok = run(downloadCmd, 'Download songs from YouTube Music', dryRun);
    if (!ok) process.exit(1);
  } else {
    console.log('\n⏭   Download phase skipped (--skip-download)');
  }

  // ── Phase 2: Encode ────────────────────────────────────────────────────
  if (!skipEncode) {
    const ok = run('npm run encode-audio', 'Encode to Opus (EBU R128 loudness normalised)', dryRun);
    if (!ok) process.exit(1);
  } else {
    console.log('\n⏭   Encode phase skipped (--skip-encode)');
  }

  // ── Phase 3: Upload ────────────────────────────────────────────────────
  if (canUpload) {
    const ok = run(
      'npm run upload-audio -- --skip-existing',
      'Upload encoded files to Cloudflare R2',
      dryRun
    );
    if (!ok) process.exit(1);
  }

  // ── Phase 4: Build data.json ───────────────────────────────────────────
  {
    const buildDataCmd = [
      'npm run audio:build-data --',
      `--csv=${csvPath}`,
      `--base-url=${baseUrl}`,
      `--prefix=${prefix}`,
    ].join(' ');

    const ok = run(buildDataCmd, 'Build public/data.json from CSV + audio index', dryRun);
    if (!ok) process.exit(1);
  }

  // ── Done ──────────────────────────────────────────────────────────────
  console.log('');
  console.log('──────────────────────────────────────────────────────');
  console.log('✅  Pipeline complete!');
  console.log('');
  console.log('📋  What was produced:');
  console.log('     public/data.json — concert metadata with audio URLs');
  if (!canUpload) {
    console.log('');
    console.log('⚠️   Audio files were NOT uploaded to R2.');
    console.log('     The app will not play audio until you upload.');
    console.log('     To upload, set R2 credentials and re-run:');
    console.log('       npm run audio:pipeline -- --skip-download --skip-encode');
  }
  console.log('');
  console.log('📸  One manual step remaining (requires a browser):');
  console.log('     npm run hashes:refresh');
  console.log('');
  console.log('     This generates perceptual hashes for new photos so the camera');
  console.log('     can recognise them. Run it in the dev server (npm run dev).');
  console.log('     See docs/PHOTO_RECOGNITION_DEEP_DIVE.md for details.');
  console.log('');
}

main().catch((err) => {
  console.error(`\n❌  ${err.message}`);
  process.exit(1);
});
