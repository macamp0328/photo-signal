#!/usr/bin/env node

/**
 * Audio CDN Migration Script
 *
 * This script migrates audio files to a CDN (GitHub Releases or Cloudflare R2)
 * and updates data.json with the new URLs.
 *
 * Usage:
 *   node scripts/audio-workflow/update/migrate-audio-to-cdn.js [options]
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
 *   node scripts/audio-workflow/update/migrate-audio-to-cdn.js --dry-run --base-url=https://github.com/username/repo/releases/download/audio-v1
 *
 *   # Migrate to GitHub Releases
 *   node scripts/audio-workflow/update/migrate-audio-to-cdn.js --base-url=https://github.com/username/repo/releases/download/audio-v1
 *
 *   # Migrate to Cloudflare R2
 *   node scripts/audio-workflow/update/migrate-audio-to-cdn.js --cdn=r2 --base-url=https://audio.example.com
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

/**
 * Load and parse data.json file
 * @param {string} dataPath - Path to data.json file
 * @returns {object} Parsed data.json object
 * @throws {Error} If file not found, invalid JSON, or invalid schema
 */
export function loadDataJson(dataPath) {
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Source file not found: ${dataPath}`);
  }

  const sourceContent = fs.readFileSync(dataPath, 'utf8');

  let data;
  try {
    data = JSON.parse(sourceContent);
  } catch (error) {
    throw new Error(`Invalid JSON in ${dataPath}: ${error.message}`);
  }

  if (!data.concerts || !Array.isArray(data.concerts)) {
    throw new Error('Invalid data.json format: missing concerts array');
  }

  return data;
}

/**
 * Generate CDN URL from audio file path
 * @param {string} audioFile - Original audio file path (e.g., "/audio/concert-1.opus")
 * @param {string} baseUrl - CDN base URL
 * @param {string} provider - CDN provider ("github-release" or "r2")
 * @returns {string} CDN URL
 * @throws {Error} If provider is invalid
 */
export function generateCdnUrl(audioFile, baseUrl, provider) {
  if (!['github-release', 'r2'].includes(provider)) {
    throw new Error(`Invalid CDN provider: ${provider}. Valid options: github-release, r2`);
  }

  const filename = path.basename(audioFile);
  // Remove trailing slash from base URL if present
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBaseUrl}/${filename}`;
}

/**
 * Update concert object with CDN URL
 * @param {object} concert - Concert object to update
 * @param {string} baseUrl - CDN base URL
 * @param {string} provider - CDN provider
 * @returns {object} Updated concert object
 */
export function updateConcert(concert, baseUrl, provider) {
  const originalAudioFile = concert.audioFile;

  // Skip if no audioFile property
  if (!originalAudioFile) {
    return concert;
  }

  // Skip if already migrated (already using remote URL)
  if (originalAudioFile.startsWith('http://') || originalAudioFile.startsWith('https://')) {
    return concert;
  }

  // Generate CDN URL
  const cdnUrl = generateCdnUrl(originalAudioFile, baseUrl, provider);

  // Return updated concert with CDN URL and source
  return {
    ...concert,
    audioFile: cdnUrl,
  };
}

/**
 * Create timestamped backup of a file
 * @param {string} filePath - Path to file to backup
 * @returns {string} Path to backup file
 * @throws {Error} If original file does not exist
 */
export function createBackup(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Cannot create backup: file not found: ${filePath}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup-${timestamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

/**
 * Validate migration to ensure no data loss
 * @param {object} original - Original data object
 * @param {object} updated - Updated data object
 * @throws {Error} If validation fails
 */
export function validateMigration(original, updated) {
  // Check concert count
  if (original.concerts.length !== updated.concerts.length) {
    throw new Error(
      `Concert count mismatch: original has ${original.concerts.length}, updated has ${updated.concerts.length}`
    );
  }

  // Check that all original fields are preserved in each concert
  for (let i = 0; i < original.concerts.length; i++) {
    const originalConcert = original.concerts[i];
    const updatedConcert = updated.concerts[i];

    // Check that all original fields still exist
    for (const key of Object.keys(originalConcert)) {
      if (!(key in updatedConcert)) {
        throw new Error(
          `Required field "${key}" missing from concert #${originalConcert.id} after migration`
        );
      }
    }
  }
}

// Only run CLI logic when executed directly (not when imported as a module)
if (import.meta.url === `file://${process.argv[1]}`) {
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
      const value = arg.split('=')[1];
      if (!value) {
        console.error('❌ Error: --source requires a value');
        process.exit(1);
      }
      options.source = value;
    } else if (arg.startsWith('--cdn=')) {
      const value = arg.split('=')[1];
      if (!value) {
        console.error('❌ Error: --cdn requires a value');
        process.exit(1);
      }
      options.cdn = value;
    } else if (arg.startsWith('--base-url=')) {
      const value = arg.split('=')[1];
      if (!value) {
        console.error('❌ Error: --base-url requires a value');
        process.exit(1);
      }
      options.baseUrl = value;
    }
  }

  // Show help
  if (options.help) {
    console.log(`
Audio CDN Migration Script

This script migrates audio files to a CDN and updates data.json with the new URLs.

Usage:
  node scripts/audio-workflow/update/migrate-audio-to-cdn.js [options]

Options:
  --source=<path>       Path to source data.json (default: public/data.json)
  --cdn=<provider>      CDN provider: github-release | r2 (default: github-release)
  --base-url=<url>      Base URL for CDN files (required)
  --dry-run             Preview changes without writing files
  --help                Show this help message

Examples:
  # Dry run with GitHub Releases
  node scripts/audio-workflow/update/migrate-audio-to-cdn.js --dry-run --base-url=https://github.com/username/repo/releases/download/audio-v1

  # Migrate to GitHub Releases
  node scripts/audio-workflow/update/migrate-audio-to-cdn.js --base-url=https://github.com/username/repo/releases/download/audio-v1

  # Migrate to Cloudflare R2
  node scripts/audio-workflow/update/migrate-audio-to-cdn.js --cdn=r2 --base-url=https://audio.example.com
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

    console.log(`📂 Reading source file: ${sourcePath}`);

    let data;
    try {
      data = loadDataJson(sourcePath);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }

    console.log(`✓ Found ${data.concerts.length} concerts\n`);

    // Store original data for validation
    const originalData = JSON.parse(JSON.stringify(data));

    // Process each concert
    let migratedCount = 0;
    let skippedCount = 0;
    const changes = [];

    for (let i = 0; i < data.concerts.length; i++) {
      const concert = data.concerts[i];
      const originalAudioFile = concert.audioFile;

      // Check if already migrated
      if (originalAudioFile.startsWith('http://') || originalAudioFile.startsWith('https://')) {
        console.log(
          `⏭️  Concert #${concert.id} (${concert.band}): Already using remote URL, skipping`
        );
        skippedCount++;
        continue;
      }

      // Update concert using extracted function
      const updatedConcert = updateConcert(concert, options.baseUrl, options.cdn);

      // Replace concert in array
      data.concerts[i] = updatedConcert;

        changes.push({
          id: concert.id,
          band: concert.band,
          original: originalAudioFile,
          cdn: updatedConcert.audioFile,
        });

      console.log(`✓ Concert #${concert.id} (${concert.band}):`);
      console.log(`    Original: ${originalAudioFile}`);
      console.log(`    CDN URL:  ${updatedConcert.audioFile}`);
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
      // Validate migration before writing
      try {
        validateMigration(originalData, data);
      } catch (error) {
        console.error(`❌ Validation failed: ${error.message}`);
        console.error('   Migration aborted to prevent data loss');
        process.exit(1);
      }

      // Create backup using extracted function
      try {
        const backupPath = createBackup(sourcePath);
        console.log(`💾 Creating backup: ${backupPath}`);
      } catch (error) {
        console.error(`❌ Backup failed: ${error.message}`);
        process.exit(1);
      }

      // Write updated data.json
      const outputContent = JSON.stringify(data, null, 2) + '\n';
      fs.writeFileSync(sourcePath, outputContent, 'utf8');
      console.log(`✅ Updated data.json: ${sourcePath}\n`);

      console.log('Next Steps:');
      console.log('1. Upload audio files to your CDN:');
      if (options.cdn === 'github-release') {
        console.log('   - Go to: https://github.com/username/repo/releases');
        console.log('   - Create a new release (e.g., "audio-v1")');
        console.log('   - Upload Opus files from public/audio/ directory');
      } else if (options.cdn === 'r2') {
        console.log('   - Use Cloudflare dashboard or wrangler CLI');
        console.log('   - Upload files to your R2 bucket');
        console.log('   - Configure public access and CORS');
      }
      console.log('\n2. Test the migration:');
      console.log('   npm run dev');
      console.log('   Open the app and verify audio plays from CDN');
      console.log('\n3. Validate all URLs:');
      console.log('   node scripts/audio-workflow/update/validate-audio-urls.js');
      console.log('\n4. Once confirmed, remove local Opus files from git:');
      console.log('   git rm public/audio/*.opus');
      console.log('   git commit -m "chore: remove production audio files (now on CDN)"');
      console.log('\n5. Update .gitignore to exclude future production audio files:');
      console.log(
        '   # ⚠️ Review your .gitignore manually. Do NOT ignore all Opus files if you want to keep demo files.'
      );
      console.log(
        '   # For example, you can add a pattern for production files only, or follow the existing .gitignore comments.'
      );
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
}
