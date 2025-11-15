#!/usr/bin/env node

/**
 * Audio CDN Migration Script
 *
 * This script migrates audio files to a CDN (GitHub Releases or Cloudflare R2)
 * and updates data.json with the new URLs while preserving local fallbacks.
 *
 * Usage:
 *   node scripts/migrate-audio-to-cdn.js [options]
 *
 * Options:
 *   --source=<path>       Path to source data.json (default: public/data.json)
 *   --cdn=<provider>      CDN provider: github-release | r2 (default: github-release)
 *   --base-url=<url>      Base URL for CDN files
 *   --dry-run             Preview changes without writing files
 *   --help                Show this help message
 *
 * Examples:
 *   # Dry run with GitHub Releases
 *   node scripts/migrate-audio-to-cdn.js --dry-run --base-url=https://github.com/username/repo/releases/download/audio-v1
 *
 *   # Migrate to GitHub Releases
 *   node scripts/migrate-audio-to-cdn.js --base-url=https://github.com/username/repo/releases/download/audio-v1
 *
 *   # Migrate to Cloudflare R2
 *   node scripts/migrate-audio-to-cdn.js --cdn=r2 --base-url=https://audio.example.com
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  source: 'public/data.json',
  cdn: 'github-release',
  baseUrl: '',
  dryRun: false,
  help: false,
};

for (const arg of args) {
  if (arg === '--help') {
    options.help = true;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg.startsWith('--source=')) {
    options.source = arg.split('=')[1];
  } else if (arg.startsWith('--cdn=')) {
    options.cdn = arg.split('=')[1];
  } else if (arg.startsWith('--base-url=')) {
    options.baseUrl = arg.split('=')[1];
  }
}

// Show help
if (options.help) {
  console.log(`
Audio CDN Migration Script

This script migrates audio files to a CDN and updates data.json with the new URLs.

Usage:
  node scripts/migrate-audio-to-cdn.js [options]

Options:
  --source=<path>       Path to source data.json (default: public/data.json)
  --cdn=<provider>      CDN provider: github-release | r2 (default: github-release)
  --base-url=<url>      Base URL for CDN files (required)
  --dry-run             Preview changes without writing files
  --help                Show this help message

Examples:
  # Dry run with GitHub Releases
  node scripts/migrate-audio-to-cdn.js --dry-run --base-url=https://github.com/username/repo/releases/download/audio-v1

  # Migrate to GitHub Releases
  node scripts/migrate-audio-to-cdn.js --base-url=https://github.com/username/repo/releases/download/audio-v1

  # Migrate to Cloudflare R2
  node scripts/migrate-audio-to-cdn.js --cdn=r2 --base-url=https://audio.example.com
`);
  process.exit(0);
}

// Validate options
if (!options.baseUrl) {
  console.error('❌ Error: --base-url is required');
  console.error('   Run with --help for usage information');
  process.exit(1);
}

if (!['github-release', 'r2'].includes(options.cdn)) {
  console.error(`❌ Error: Invalid CDN provider "${options.cdn}"`);
  console.error('   Valid options: github-release, r2');
  process.exit(1);
}

// Main migration logic
async function migrateAudioFiles() {
  console.log('🎵 Audio CDN Migration Script\n');
  console.log('Configuration:');
  console.log(`  Source: ${options.source}`);
  console.log(`  CDN Provider: ${options.cdn}`);
  console.log(`  Base URL: ${options.baseUrl}`);
  console.log(`  Dry Run: ${options.dryRun ? 'Yes' : 'No'}\n`);

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

  // Process each concert
  let migratedCount = 0;
  let skippedCount = 0;
  const changes = [];

  for (const concert of data.concerts) {
    const originalAudioFile = concert.audioFile;

    // Skip if already migrated
    if (originalAudioFile.startsWith('http://') || originalAudioFile.startsWith('https://')) {
      console.log(
        `⏭️  Concert #${concert.id} (${concert.band}): Already using remote URL, skipping`
      );
      skippedCount++;
      continue;
    }

    // Extract filename from path (e.g., "/audio/concert-1.mp3" -> "concert-1.mp3")
    const filename = path.basename(originalAudioFile);

    // Build CDN URL
    const cdnUrl = `${options.baseUrl}/${filename}`;

    // Store original path as fallback
    const fallbackUrl = originalAudioFile;

    // Update concert data
    concert.audioFile = cdnUrl;
    concert.audioFileFallback = fallbackUrl;
    concert.audioFileSource = options.cdn;

    changes.push({
      id: concert.id,
      band: concert.band,
      original: originalAudioFile,
      cdn: cdnUrl,
      fallback: fallbackUrl,
    });

    console.log(`✓ Concert #${concert.id} (${concert.band}):`);
    console.log(`    Original: ${originalAudioFile}`);
    console.log(`    CDN URL:  ${cdnUrl}`);
    console.log(`    Fallback: ${fallbackUrl}`);
    console.log();

    migratedCount++;
  }

  // Summary
  console.log('═'.repeat(70));
  console.log('📊 Migration Summary:\n');
  console.log(`  Migrated: ${migratedCount} concerts`);
  console.log(`  Skipped:  ${skippedCount} concerts (already using remote URLs)`);
  console.log(`  Total:    ${data.concerts.length} concerts\n`);

  // Write output
  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE: No files were modified\n');
    console.log('To apply these changes, run without --dry-run flag\n');
  } else {
    // Create backup
    const backupPath = `${sourcePath}.backup`;
    console.log(`💾 Creating backup: ${backupPath}`);
    fs.copyFileSync(sourcePath, backupPath);

    // Write updated data.json
    const outputContent = JSON.stringify(data, null, 2) + '\n';
    fs.writeFileSync(sourcePath, outputContent, 'utf8');
    console.log(`✅ Updated data.json: ${sourcePath}\n`);

    console.log('Next Steps:');
    console.log('1. Upload audio files to your CDN:');
    if (options.cdn === 'github-release') {
      console.log('   - Go to: https://github.com/username/repo/releases');
      console.log('   - Create a new release (e.g., "audio-v1")');
      console.log('   - Upload MP3 files from public/audio/ directory');
    } else if (options.cdn === 'r2') {
      console.log('   - Use Cloudflare dashboard or wrangler CLI');
      console.log('   - Upload files to your R2 bucket');
      console.log('   - Configure public access and CORS');
    }
    console.log('\n2. Test the migration:');
    console.log('   npm run dev');
    console.log('   Open the app and verify audio plays from CDN');
    console.log('\n3. Validate all URLs:');
    console.log('   node scripts/validate-audio-urls.js');
    console.log('\n4. Once confirmed, remove local MP3s from git:');
    console.log('   git rm public/audio/*.mp3');
    console.log('   git commit -m "chore: remove production audio files (now on CDN)"');
    console.log('\n5. Update .gitignore to exclude future audio files:');
    console.log('   echo "public/audio/*.mp3" >> .gitignore');
    console.log();
  }

  // Show detailed changes in JSON format
  if (changes.length > 0) {
    console.log('📋 Detailed Changes (JSON):');
    console.log(JSON.stringify(changes, null, 2));
    console.log();
  }
}

// Run migration
migrateAudioFiles().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
