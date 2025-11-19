#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';

const DEFAULT_CONFIG_PATH = resolve(
  process.cwd(),
  'scripts/audio-workflow/encode/encode.config.json'
);

/**
 * Main entry point for the audio encode script
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    printVersion();
    process.exit(0);
  }

  // Check prerequisites
  if (!args['skip-prereq-check']) {
    checkPrerequisites();
  }

  // Load configuration
  const configPath = args.config ?? DEFAULT_CONFIG_PATH;
  const config = loadConfig(configPath);

  // Resolve paths
  const inputDir = resolvePath(args['input-dir'] ?? config.inputDir ?? '../download/output');
  const outputDir = resolvePath(args['output-dir'] ?? config.outputDir ?? './output');
  const workDir = resolvePath(args['work-dir'] ?? config.workDir ?? './work');

  // Validate input directory
  if (!existsSync(inputDir)) {
    console.error(`❌ Input directory does not exist: ${inputDir}`);
    console.error('   Run the download script first to create input files.');
    process.exit(1);
  }

  // Create output directories
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });

  console.log('🎵 Audio Encode Script');
  console.log('');
  console.log('Configuration:');
  console.log(`  Input:  ${inputDir}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Work:   ${workDir}`);
  console.log(`  Target LUFS: ${config.targetLUFS}`);
  console.log(`  Opus bitrate: ${config.opus.bitrateKbps} kbps`);
  console.log('');

  // Find all downloaded files
  const downloads = findDownloads(inputDir);

  if (downloads.length === 0) {
    console.warn('⚠️  No downloads found in input directory.');
    console.warn('   Run the download script first or check the input directory path.');
    process.exit(0);
  }

  console.log(`Found ${downloads.length} download(s) to process`);
  console.log('');

  const results = [];
  const dryRun = args['dry-run'] ?? false;

  for (const download of downloads) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Processing: ${download.fileName}`);
    console.log('');

    try {
      const result = await processAudioFile(download, config, {
        outputDir,
        workDir,
        dryRun,
      });
      results.push(result);

      console.log(`✅ Successfully processed: ${result.outputFile}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to process ${download.fileName}: ${error.message}`);
      console.error('');
      results.push({
        ...download,
        success: false,
        error: error.message,
      });
    }
  }

  // Generate manifests
  if (!dryRun) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('Generating manifests...');
    console.log('');

    generateAudioIndex(results, outputDir, config);
    generatePhotoAudioMap(results, outputDir);
    generateReport(results, outputDir);

    console.log('✅ Manifests generated');
    console.log('');
  }

  // Summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('📊 Summary:');
  console.log(`  Total:      ${results.length}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed:     ${failed}`);
  console.log('');

  if (failed > 0) {
    console.log('Failed files:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.fileName}: ${r.error}`);
      });
    process.exit(1);
  }

  console.log('✅ All files processed successfully!');
}

/**
 * Find all downloads in the input directory
 */
function findDownloads(inputDir) {
  const downloads = [];
  const files = readdirSync(inputDir);

  for (const file of files) {
    if (file.endsWith('.metadata.json')) {
      const metadataPath = join(inputDir, file);
      let metadata;
      try {
        metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      } catch (err) {
        console.warn(`⚠️  Failed to parse JSON in ${file}: ${err.message}`);
        continue;
      }

      const audioPath = metadata.download?.filePath;
      if (!audioPath || !existsSync(audioPath)) {
        console.warn(`⚠️  Audio file not found for ${file}: ${audioPath}`);
        continue;
      }

      downloads.push({
        metadataPath,
        audioPath,
        fileName: basename(audioPath),
        metadata,
      });
    }
  }

  return downloads;
}

/**
 * Process a single audio file
 */
async function processAudioFile(download, config, options) {
  const { outputDir, workDir, dryRun } = options;

  // Extract metadata
  const track = download.metadata.track ?? {};

  const band = sanitizeString(track.artist ?? 'Unknown Artist');
  const title = sanitizeString(track.title ?? 'Unknown Title');
  const date = extractDate(track);
  const venue = extractVenue(track);

  // Generate slug and filenames
  const slug = generateSlug(date, band, venue);
  const outputFileName = `ps-${slug}.opus`;

  console.log(`  Band:  ${band}`);
  console.log(`  Title: ${title}`);
  console.log(`  Date:  ${date}`);
  console.log(`  Venue: ${venue}`);
  console.log(`  Slug:  ${slug}`);
  console.log('');

  if (dryRun) {
    console.log('  [DRY RUN] Would process this file');
    return {
      ...download,
      success: true,
      slug,
      outputFile: outputFileName,
      dryRun: true,
    };
  }

  // Step 1: Convert to intermediate WAV
  const wavPath = join(workDir, `${slug}.wav`);
  console.log('  1. Converting to WAV...');
  await convertToWav(download.audioPath, wavPath);

  // Step 2: Measure loudness (first pass)
  console.log('  2. Measuring loudness...');
  const loudnessStats = await measureLoudness(wavPath, config);
  console.log(`     Integrated: ${loudnessStats.input_i.toFixed(1)} LUFS`);
  console.log(`     True Peak:  ${loudnessStats.input_tp.toFixed(1)} dB`);

  // Step 3: Normalize loudness (second pass)
  const normalizedWavPath = join(workDir, `${slug}-normalized.wav`);
  console.log('  3. Normalizing loudness...');
  await normalizeLoudness(wavPath, normalizedWavPath, config, loudnessStats);

  // Step 4: Apply fades
  const fadedWavPath = join(workDir, `${slug}-faded.wav`);
  console.log('  4. Applying fades...');
  const duration = await getAudioDuration(normalizedWavPath);
  await applyFades(normalizedWavPath, fadedWavPath, config, duration);

  // Step 5: Encode to Opus
  const outputPath = join(outputDir, outputFileName);
  console.log('  5. Encoding to Opus...');
  await encodeToOpus(fadedWavPath, outputPath, config, {
    band,
    title: `${band} — ${venue} (${date})`,
    venue,
    date,
  });

  // Step 6: Calculate checksum
  console.log('  6. Calculating checksum...');
  const checksum = calculateChecksum(outputPath);

  // Step 7: Cleanup intermediate files
  console.log('  7. Cleaning up...');
  rmSync(wavPath, { force: true });
  rmSync(normalizedWavPath, { force: true });
  rmSync(fadedWavPath, { force: true });

  return {
    ...download,
    success: true,
    slug,
    outputFile: outputFileName,
    outputPath,
    band,
    title,
    venue,
    date,
    durationMs: Math.round(duration * 1000),
    lufsIntegrated: loudnessStats.input_i,
    truePeakDb: loudnessStats.input_tp,
    lra: loudnessStats.input_lra,
    checksum,
    bitrateKbps: config.opus.bitrateKbps,
  };
}

/**
 * Convert audio to WAV format
 */
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i',
      inputPath,
      '-ar',
      '48000', // 48kHz sample rate
      '-ac',
      '2', // stereo
      '-sample_fmt',
      's32', // 32-bit signed integer
      '-y',
      outputPath,
    ];

    const ffmpeg = spawn('ffmpeg', args, { stdio: 'pipe' });
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Measure loudness using ffmpeg loudnorm filter (first pass)
 */
function measureLoudness(inputPath, config) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i',
      inputPath,
      '-af',
      `loudnorm=I=${config.targetLUFS}:TP=${config.truePeakLimit}:LRA=${config.lraTarget}:print_format=json`,
      '-f',
      'null',
      '-',
    ];

    const ffmpeg = spawn('ffmpeg', args, { stdio: 'pipe' });
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }

      // Extract JSON from stderr
      const jsonMatch = stderr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        reject(new Error('Failed to extract loudness stats from ffmpeg output'));
        return;
      }

      try {
        const stats = JSON.parse(jsonMatch[0]);
        resolve(stats);
      } catch (error) {
        reject(new Error(`Failed to parse loudness stats: ${error.message}`));
      }
    });
  });
}

/**
 * Normalize loudness using measured stats (second pass)
 */
function normalizeLoudness(inputPath, outputPath, config, stats) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i',
      inputPath,
      '-af',
      `loudnorm=I=${config.targetLUFS}:TP=${config.truePeakLimit}:LRA=${config.lraTarget}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true:print_format=summary`,
      '-ar',
      '48000',
      '-y',
      outputPath,
    ];

    const ffmpeg = spawn('ffmpeg', args, { stdio: 'pipe' });
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get audio duration in seconds
 */
function getAudioDuration(inputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ];

    const ffprobe = spawn('ffprobe', args, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
      } else {
        const duration = parseFloat(stdout.trim());
        resolve(duration);
      }
    });
  });
}

/**
 * Apply fade in/out effects
 */
function applyFades(inputPath, outputPath, config, duration) {
  return new Promise((resolve, reject) => {
    const fadeIn = config.fades.fadeInSeconds;
    const fadeOut = config.fades.fadeOutSeconds;
    const fadeOutStart = Math.max(0, duration - fadeOut);

    const args = [
      '-i',
      inputPath,
      '-af',
      `afade=t=in:ss=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut}`,
      '-y',
      outputPath,
    ];

    const ffmpeg = spawn('ffmpeg', args, { stdio: 'pipe' });
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Encode to Opus format with metadata
 */
function encodeToOpus(inputPath, outputPath, config, metadata) {
  return new Promise((resolve, reject) => {
    const defaults = config.metadataDefaults;

    const args = [
      '-i',
      inputPath,
      '-c:a',
      'libopus',
      '-b:a',
      `${config.opus.bitrateKbps}k`,
      '-vbr',
      'on',
      '-compression_level',
      config.opus.complexity.toString(),
      '-frame_duration',
      config.opus.frameSizeMs.toString(),
      '-metadata',
      `title=${metadata.title}`,
      '-metadata',
      `artist=${metadata.band}`,
      '-metadata',
      `album=${defaults.album}`,
      '-metadata',
      `date=${metadata.date}`,
      '-metadata',
      `genre=${defaults.genre}`,
      '-metadata',
      `copyright=${defaults.copyright}`,
      '-metadata',
      `comment=Encoded for Photo Signal`,
      '-metadata',
      `website=${defaults.website}`,
    ];

    if (metadata.venue) {
      args.push('-metadata', `location=${metadata.venue}`);
    }

    args.push('-y', outputPath);

    const ffmpeg = spawn('ffmpeg', args, { stdio: 'pipe' });
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Calculate SHA256 checksum
 */
function calculateChecksum(filePath) {
  const fileBuffer = readFileSync(filePath);
  const hash = createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');
}

/**
 * Generate audio index manifest
 */
function generateAudioIndex(results, outputDir, config) {
  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    config: {
      targetLUFS: config.targetLUFS,
      truePeakLimit: config.truePeakLimit,
      opusBitrate: config.opus.bitrateKbps,
    },
    tracks: results
      .filter((r) => r.success && !r.dryRun)
      .map((r) => ({
        id: r.slug,
        band: r.band,
        venue: r.venue,
        date: r.date,
        durationMs: r.durationMs,
        bitrateKbps: r.bitrateKbps,
        sampleRate: 48000,
        lufsIntegrated: r.lufsIntegrated,
        truePeakDb: r.truePeakDb,
        lra: r.lra,
        checksum: r.checksum,
        fileName: r.outputFile,
        cdnPath: null, // To be filled by upload script
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };

  const indexPath = join(outputDir, 'audio-index.json');
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`  ✓ Audio index: ${indexPath}`);
}

/**
 * Generate photo-audio map
 */
function generatePhotoAudioMap(results, outputDir) {
  const map = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    note: 'Photo ID mapping to be implemented when photo manifest is available',
    mappings: results
      .filter((r) => r.success && !r.dryRun)
      .map((r) => ({
        audioId: r.slug,
        photoId: null, // To be linked with photo manifest
        band: r.band,
        venue: r.venue,
        date: r.date,
      })),
  };

  const mapPath = join(outputDir, 'photo-audio-map.json');
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  console.log(`  ✓ Photo-audio map: ${mapPath}`);
}

/**
 * Generate human-readable report
 */
function generateReport(results, outputDir) {
  const successful = results.filter((r) => r.success && !r.dryRun);
  const failed = results.filter((r) => !r.success);

  let report = '# Audio Encoding Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '## Summary\n\n';
  report += `- Total files: ${results.length}\n`;
  report += `- Successful: ${successful.length}\n`;
  report += `- Failed: ${failed.length}\n\n`;

  if (successful.length > 0) {
    report += '## Successful Encodings\n\n';
    report += '| Slug | Band | Venue | Date | LUFS | Duration |\n';
    report += '|------|------|-------|------|------|----------|\n';

    for (const r of successful) {
      const mins = Math.floor(r.durationMs / 60000);
      const secs = Math.floor((r.durationMs % 60000) / 1000);
      report += `| ${r.slug} | ${r.band} | ${r.venue} | ${r.date} | ${r.lufsIntegrated.toFixed(1)} | ${mins}:${secs.toString().padStart(2, '0')} |\n`;
    }
    report += '\n';
  }

  if (failed.length > 0) {
    report += '## Failed Encodings\n\n';
    for (const r of failed) {
      report += `- **${r.fileName}**: ${r.error}\n`;
    }
    report += '\n';
  }

  report += '## Quality Checklist\n\n';
  report += '- [ ] All files encoded to Opus format\n';
  report += '- [ ] LUFS within ±0.3 of target (-14.0)\n';
  report += '- [ ] True peak below -1.5 dB\n';
  report += '- [ ] Metadata fields populated\n';
  report += '- [ ] Filenames follow naming convention\n';
  report += '- [ ] Checksums calculated\n';
  report += '- [ ] Photo ID mapping pending\n';

  const reportPath = join(outputDir, 'encode-report.md');
  writeFileSync(reportPath, report);
  console.log(`  ✓ Report: ${reportPath}`);
}

/**
 * Helper functions
 */

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    console.warn(`⚠️  Config file not found: ${configPath}`);
    console.warn('   Using default values');
    return getDefaultConfig();
  }

  try {
    const contents = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(contents);
    console.log(`🛠️  Loaded config from ${configPath}`);
    return config;
  } catch (error) {
    console.warn(`⚠️  Could not read ${configPath}: ${error.message}`);
    console.warn('   Using default values');
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    targetLUFS: -14,
    truePeakLimit: -1.5,
    lraTarget: 11,
    opus: {
      bitrateKbps: 160,
      complexity: 10,
      frameSizeMs: 20,
    },
    fades: {
      fadeInSeconds: 0.5,
      fadeOutSeconds: 1.0,
    },
    metadataDefaults: {
      album: 'Photo Signal Playlist',
      genre: 'Live Recording',
      copyright: 'Photo Signal',
      website: 'https://photosignal.app',
    },
  };
}

function resolvePath(path) {
  if (!path) return undefined;
  return path.startsWith('/') ? path : resolve(process.cwd(), path);
}

function checkPrerequisites() {
  const ffmpegCheck = spawnSync('ffmpeg', ['-version'], { stdio: 'pipe' });
  if (ffmpegCheck.error || ffmpegCheck.status !== 0) {
    console.error('❌ ffmpeg is not installed or not in PATH');
    console.error('   Install ffmpeg: https://ffmpeg.org/download.html');
    process.exit(1);
  }

  const ffprobeCheck = spawnSync('ffprobe', ['-version'], { stdio: 'pipe' });
  if (ffprobeCheck.error || ffprobeCheck.status !== 0) {
    console.error('❌ ffprobe is not installed or not in PATH');
    console.error('   ffprobe comes with ffmpeg installation');
    process.exit(1);
  }
}

function sanitizeString(str) {
  return str.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
}

function generateSlug(date, band, venue) {
  const dateSlug = date.replace(/-/g, '');
  const bandSlug = slugify(band);
  const venueSlug = slugify(venue);
  return `${dateSlug}-${bandSlug}-${venueSlug}`;
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractDate(track) {
  // Try to extract from title or description
  const text = `${track.title} ${track.album || ''}`;
  const dateMatch = text.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  }

  // Fallback to unknown
  return 'unknown';
}

function extractVenue(track) {
  // Try to extract venue from title
  // Common pattern: "Artist - Venue (Date)" or "Artist @ Venue"
  const title = track.title || '';

  // Try @ pattern
  const atMatch = title.match(/@\s*([^()\d]+)/);
  if (atMatch) {
    return sanitizeString(atMatch[1]);
  }

  // Try - pattern
  const dashMatch = title.match(/-\s*([^()\d]+)/);
  if (dashMatch) {
    return sanitizeString(dashMatch[1]);
  }

  return 'Unknown Venue';
}

function printHelp() {
  console.log(`
Usage: npm run encode-audio -- [options]

Options:
  --input-dir <path>       Directory containing downloads (default: from config)
  --output-dir <path>      Directory for encoded output (default: from config)
  --work-dir <path>        Directory for temporary files (default: from config)
  --config <path>          Path to config file (default: encode.config.json)
  --skip-prereq-check      Skip ffmpeg availability check
  --dry-run                Preview without encoding
  --help                   Show this help message
  --version                Show version

Examples:
  # Encode all downloads in default directory
  npm run encode-audio

  # Encode with custom input directory
  npm run encode-audio -- --input-dir ~/Downloads/music

  # Dry run to preview
  npm run encode-audio -- --dry-run

Configuration:
  Edit scripts/audio-workflow/encode/encode.config.json to set:
  - Target LUFS, true peak, LRA
  - Opus bitrate and complexity
  - Fade in/out durations
  - Default metadata values
  - Default paths
`);
}

function printVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8')
    );
    console.log(`encode-audio v${pkg.version}`);
  } catch {
    console.log('encode-audio');
  }
}

// Run main function
main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
