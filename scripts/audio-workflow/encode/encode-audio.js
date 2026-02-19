#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';

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

  const metadataOverridesPath = resolvePath(
    args['metadata-overrides'] ?? config.metadataOverridesPath ?? null
  );
  const metadataOverrides = loadMetadataOverrides(metadataOverridesPath);

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
  console.log(`  Opus bitrate ceiling: ${config.opus.bitrateKbps} kbps`);
  if (config?.opus?.minBitrateFloorKbps) {
    console.log(`  Opus bitrate floor: ${config.opus.minBitrateFloorKbps} kbps`);
  }
  console.log(`  Opus VBR mode: ${normalizeOpusVbrMode(config?.opus?.vbrMode)}`);
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
        metadataOverrides,
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
  const metadataFiles = files.filter((file) => file.endsWith('.metadata.json'));
  const infoFiles = files.filter((file) => file.endsWith('.info.json'));

  const useInfoFallback = metadataFiles.length === 0 && infoFiles.length > 0;
  if (useInfoFallback) {
    console.warn(
      '⚠️  No .metadata.json files found; attempting to parse .info.json files directly.'
    );
  }

  const filesToProcess = metadataFiles.length > 0 ? metadataFiles : infoFiles;

  for (const file of filesToProcess) {
    const fullPath = join(inputDir, file);
    let metadata;

    if (file.endsWith('.metadata.json')) {
      try {
        metadata = JSON.parse(readFileSync(fullPath, 'utf-8'));
      } catch (err) {
        console.warn(`⚠️  Failed to parse JSON in ${file}: ${err.message}`);
        continue;
      }
    } else {
      metadata = buildMetadataFromInfo(fullPath);
      if (!metadata) {
        continue;
      }
    }

    const audioPath = metadata.download?.filePath;
    if (!audioPath || !existsSync(audioPath)) {
      console.warn(`⚠️  Audio file not found for ${file}: ${audioPath ?? 'unknown path'}`);
      continue;
    }

    downloads.push({
      metadataPath: fullPath,
      audioPath,
      fileName: basename(audioPath),
      metadata,
    });
  }

  if (downloads.length === 0 && filesToProcess.length === 0) {
    console.warn('⚠️  No metadata or info files found in the input directory.');
  }

  return downloads;
}

const AUDIO_EXTENSIONS = ['opus', 'webm', 'm4a', 'mp3', 'wav', 'flac', 'ogg', 'oga', 'aac'];

function buildMetadataFromInfo(infoPath) {
  let info;
  try {
    info = JSON.parse(readFileSync(infoPath, 'utf-8'));
  } catch (error) {
    console.warn(`⚠️  Failed to parse info JSON ${basename(infoPath)}: ${error.message}`);
    return null;
  }

  const audioPath = resolveAudioPathFromInfo(infoPath);
  if (!audioPath) {
    console.warn(
      `⚠️  Could not locate a downloaded audio file for ${basename(infoPath)}. Expected one of: ${AUDIO_EXTENSIONS.join(', ')}`
    );
    return null;
  }

  const artist =
    info.artist ??
    (Array.isArray(info.artists) ? info.artists.join(', ') : undefined) ??
    info.uploader ??
    info.channel ??
    'Unknown Artist';

  const title = info.title ?? info.fulltitle ?? basename(audioPath);
  const album = info.album ?? info.playlist_title ?? info.track ?? undefined;

  return {
    track: {
      id: info.id ?? info.display_id ?? null,
      title,
      album,
      artist,
      description: info.description ?? null,
      releaseDate: info.release_date ?? null,
      uploadDate: info.upload_date ?? null,
      uploader: info.uploader ?? null,
      playlistIndex: info.playlist_index ?? null,
      durationSeconds: info.duration ?? null,
      thumbnails: info.thumbnails ?? [],
      webpageUrl: info.webpage_url ?? info.original_url ?? null,
      tags: info.tags ?? null,
      categories: info.categories ?? null,
    },
    download: {
      filePath: audioPath,
      fileName: basename(audioPath),
      ext: audioPath.split('.').pop() ?? null,
      codec: info.acodec ?? null,
      bitrateKbps: info.abr ?? null,
    },
    playlist: {
      url: info.playlist_webpage_url ?? info.playlist_url ?? null,
      id: info.playlist_id ?? null,
      title: info.playlist_title ?? info.playlist ?? null,
      index: info.playlist_index ?? null,
    },
    infoSource: {
      path: infoPath,
    },
  };
}

function resolveAudioPathFromInfo(infoPath) {
  const basePath = infoPath.replace(/\.info\.json$/, '');

  for (const ext of AUDIO_EXTENSIONS) {
    const candidate = `${basePath}.${ext}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback: search directory for a file that shares the base name but different extension
  const dir = dirname(infoPath);
  const baseName = basename(basePath);
  try {
    const siblings = readdirSync(dir);
    const match = siblings.find((file) => {
      if (!file.startsWith(`${baseName}.`) || file.endsWith('.info.json')) {
        return false;
      }

      const ext = file.split('.').pop()?.toLowerCase();
      return ext ? AUDIO_EXTENSIONS.includes(ext) : false;
    });
    if (match) {
      return join(dir, match);
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Process a single audio file
 */
async function processAudioFile(download, config, options) {
  const { outputDir, workDir, dryRun, metadataOverrides } = options;

  const metadata = applyMetadataOverrides(download.metadata, download, metadataOverrides);
  const track = metadata.track ?? {};
  const photoId = resolvePhotoIdFromMetadata(metadata);

  const band = determineBandName(metadata);
  const title = sanitizeString(track.title ?? 'Unknown Title');
  const date = extractDate(metadata);
  const albumSource = track.album ?? metadata.playlist?.title ?? metadata.playlist?.album;
  const album = sanitizeString(albumSource ?? 'Unknown Album') || 'Unknown Album';
  const releaseDate = extractReleaseDate(metadata);
  const musicDetails = extractMusicDetails(metadata, config.metadataDefaults);
  const genre = musicDetails.genre ?? config.metadataDefaults?.genre ?? null;

  // Generate slug and filenames
  const slug = generateSlug(band, title, album);
  const outputFileName = `ps-${slug}.opus`;

  console.log(`  Band:  ${band}`);
  console.log(`  Title: ${title}`);
  console.log(`  Date:  ${date}`);
  console.log(`  Album: ${album}`);
  console.log(`  Release Date: ${releaseDate ?? 'unknown'}`);
  console.log(`  Genre: ${genre ?? 'unknown'}`);
  if (musicDetails.recordLabel || musicDetails.distributor) {
    console.log(
      `  Label: ${musicDetails.recordLabel ?? 'unknown'}${
        musicDetails.distributor ? ` via ${musicDetails.distributor}` : ''
      }`
    );
  }
  console.log(`  Slug:  ${slug}`);
  console.log('');

  const bitrateInfo = await determineTargetBitrate(download, config);
  if (bitrateInfo.sourceBitrateKbps) {
    const label = bitrateInfo.sourceBitrateSource ?? 'metadata';
    console.log(`  Source bitrate: ~${bitrateInfo.sourceBitrateKbps} kbps (${label})`);
  } else {
    console.log('  Source bitrate: unknown (defaulting to ceiling)');
  }
  console.log(
    `  Target Opus bitrate: ${bitrateInfo.targetBitrateKbps} kbps (≤ ${config.opus.bitrateKbps} kbps)`
  );
  console.log('');

  if (dryRun) {
    console.log('  [DRY RUN] Would process this file');
    return {
      ...download,
      success: true,
      photoId,
      slug,
      outputFile: outputFileName,
      bitrateKbps: bitrateInfo.targetBitrateKbps,
      sourceBitrateKbps: bitrateInfo.sourceBitrateKbps,
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
  await encodeToOpus(
    fadedWavPath,
    outputPath,
    config,
    {
      band,
      title: `${band} — ${date}`,
      date,
      album,
      releaseDate,
      genre,
      recordLabel: musicDetails.recordLabel,
      distributor: musicDetails.distributor,
    },
    bitrateInfo.targetBitrateKbps
  );

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
    photoId,
    slug,
    outputFile: outputFileName,
    outputPath,
    band,
    title,
    album,
    date,
    releaseDate,
    durationMs: Math.round(duration * 1000),
    lufsIntegrated: loudnessStats.input_i,
    truePeakDb: loudnessStats.input_tp,
    lra: loudnessStats.input_lra,
    checksum,
    bitrateKbps: bitrateInfo.targetBitrateKbps,
    sourceBitrateKbps: bitrateInfo.sourceBitrateKbps,
    bitrateSource: bitrateInfo.sourceBitrateSource,
    genre,
    recordLabel: musicDetails.recordLabel,
    distributor: musicDetails.distributor,
    tags: musicDetails.tags,
    categories: musicDetails.categories,
    credits: musicDetails.credits,
  };
}

function resolvePhotoIdFromMetadata(metadata) {
  const candidates = [
    metadata?.photoId,
    metadata?.playlist?.index,
    metadata?.track?.playlistIndex,
    metadata?.track?.playlist_index,
  ];

  for (const candidate of candidates) {
    const parsed = Number.parseInt(String(candidate ?? ''), 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
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
      '-c:a',
      'pcm_s32le',
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
        resolve(coerceLoudnessStats(stats));
      } catch (error) {
        reject(new Error(`Failed to parse loudness stats: ${error.message}`));
      }
    });
  });
}

/**
 * Parse LUFS values from ffmpeg loudnorm output
 * @param {string} ffmpegOutput - Raw ffmpeg output containing JSON stats
 * @returns {object|null} Parsed LUFS statistics or null if parsing fails
 */
export function parseLUFS(ffmpegOutput) {
  // Extract JSON from output
  const jsonMatch = ffmpegOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    const stats = JSON.parse(jsonMatch[0]);
    return coerceLoudnessStats(stats);
  } catch {
    return null;
  }
}

function coerceLoudnessStats(stats) {
  const numericKeys = [
    'input_i',
    'input_tp',
    'input_lra',
    'input_thresh',
    'output_i',
    'output_tp',
    'output_lra',
    'output_thresh',
    'target_offset',
  ];
  for (const key of numericKeys) {
    if (stats[key] !== undefined && stats[key] !== null) {
      const parsed = Number(stats[key]);
      stats[key] = Number.isNaN(parsed) ? stats[key] : parsed;
    }
  }

  return stats;
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
function encodeToOpus(inputPath, outputPath, config, metadata, targetBitrateKbps) {
  return new Promise((resolve, reject) => {
    const defaults = config.metadataDefaults;
    const albumTag =
      metadata.album && metadata.album !== 'Unknown Album' ? metadata.album : defaults.album;
    const genreTag = metadata.genre ?? defaults.genre;
    const bitrate = targetBitrateKbps ?? config.opus.bitrateKbps;
    const vbrMode = normalizeOpusVbrMode(config?.opus?.vbrMode);

    const args = [
      '-i',
      inputPath,
      '-c:a',
      'libopus',
      '-b:a',
      `${bitrate}k`,
      '-vbr',
      vbrMode,
      '-compression_level',
      config.opus.complexity.toString(),
      '-frame_duration',
      config.opus.frameSizeMs.toString(),
      '-metadata',
      `title=${metadata.title}`,
      '-metadata',
      `artist=${metadata.band}`,
      '-metadata',
      `album=${albumTag}`,
      '-metadata',
      `date=${metadata.date}`,
    ];

    if (genreTag) {
      args.push('-metadata', `genre=${genreTag}`);
    }

    args.push('-metadata', `copyright=${defaults.copyright}`);
    args.push('-metadata', `comment=Encoded for Photo Signal`);
    args.push('-metadata', `website=${defaults.website}`);

    if (metadata.recordLabel) {
      args.push('-metadata', `publisher=${metadata.recordLabel}`);
    }

    if (metadata.distributor) {
      args.push('-metadata', `label=${metadata.distributor}`);
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

async function determineTargetBitrate(download, config) {
  const maxBitrate = config?.opus?.bitrateKbps ?? 160;
  const minFloor = config?.opus?.minBitrateFloorKbps ?? 96;

  const metadataBitrate = coerceBitrate(download?.metadata?.download?.bitrateKbps);
  let sourceBitrateKbps = metadataBitrate;
  let sourceBitrateSource = metadataBitrate ? 'metadata' : null;

  if (!sourceBitrateKbps) {
    sourceBitrateKbps = await probeBitrateKbps(download?.audioPath);
    sourceBitrateSource = sourceBitrateKbps ? 'ffprobe' : null;
  }

  const roundedSource = sourceBitrateKbps ? Math.round(sourceBitrateKbps) : null;

  let targetBitrateKbps = maxBitrate;
  if (roundedSource && roundedSource > 0) {
    targetBitrateKbps = Math.min(maxBitrate, roundedSource);
    if (roundedSource < minFloor) {
      targetBitrateKbps = roundedSource;
    } else if (targetBitrateKbps < minFloor) {
      targetBitrateKbps = minFloor;
    }
  } else if (targetBitrateKbps < minFloor) {
    targetBitrateKbps = minFloor;
  }

  return {
    sourceBitrateKbps: roundedSource,
    sourceBitrateSource,
    targetBitrateKbps,
  };
}

function coerceBitrate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function probeBitrateKbps(filePath) {
  if (!filePath) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const args = [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=bit_rate',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
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
        console.warn(
          `⚠️  ffprobe failed to read bitrate for ${basename(filePath)}: ${stderr.trim()}`
        );
        resolve(null);
        return;
      }

      const bitsPerSecond = Number(stdout.trim());
      if (Number.isFinite(bitsPerSecond) && bitsPerSecond > 0) {
        resolve(bitsPerSecond / 1000);
        return;
      }

      const formatArgs = [
        '-v',
        'error',
        '-show_entries',
        'format=bit_rate,size,duration',
        '-of',
        'default=noprint_wrappers=1',
        filePath,
      ];

      const formatProbe = spawn('ffprobe', formatArgs, { stdio: 'pipe' });
      let formatStdout = '';
      let formatStderr = '';

      formatProbe.stdout.on('data', (data) => {
        formatStdout += data.toString();
      });

      formatProbe.stderr.on('data', (data) => {
        formatStderr += data.toString();
      });

      formatProbe.on('close', (formatCode) => {
        if (formatCode !== 0) {
          if (formatStderr.trim()) {
            console.warn(
              `⚠️  ffprobe format stats failed for ${basename(filePath)}: ${formatStderr.trim()}`
            );
          }
          resolve(null);
          return;
        }

        const parsed = parseFfprobeFormatStats(formatStdout);
        if (Number.isFinite(parsed.bitRateBps) && parsed.bitRateBps > 0) {
          resolve(parsed.bitRateBps / 1000);
          return;
        }

        if (
          Number.isFinite(parsed.sizeBytes) &&
          parsed.sizeBytes > 0 &&
          Number.isFinite(parsed.durationSeconds) &&
          parsed.durationSeconds > 0
        ) {
          const estimatedBitsPerSecond = (parsed.sizeBytes * 8) / parsed.durationSeconds;
          resolve(estimatedBitsPerSecond / 1000);
          return;
        }

        resolve(null);
      });
    });
  });
}

function parseFfprobeFormatStats(output) {
  const result = {
    bitRateBps: null,
    sizeBytes: null,
    durationSeconds: null,
  };

  const lines = String(output ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const [rawKey, rawValue] = line.split('=', 2);
    if (!rawKey || rawValue === undefined) {
      continue;
    }

    const key = rawKey.trim().toLowerCase();
    const value = rawValue.trim();

    if (key === 'bit_rate') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.bitRateBps = parsed;
      }
      continue;
    }

    if (key === 'size') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.sizeBytes = parsed;
      }
      continue;
    }

    if (key === 'duration') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.durationSeconds = parsed;
      }
    }
  }

  return result;
}

function normalizeOpusVbrMode(value) {
  const normalized = String(value ?? 'constrained').toLowerCase();
  if (normalized === 'on' || normalized === 'off' || normalized === 'constrained') {
    return normalized;
  }
  return 'constrained';
}

/**
 * Generate audio index manifest from processing results
 * @param {Array} results - Array of processing results
 * @param {object} config - Encoding configuration
 * @returns {object} Audio index manifest
 */
export function createAudioIndex(results, config = {}) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    config: {
      targetLUFS: config.targetLUFS ?? null,
      truePeakLimit: config.truePeakLimit ?? null,
      opusBitrate: config.opus?.bitrateKbps ?? null,
      opusBitrateFloor: config.opus?.minBitrateFloorKbps ?? null,
    },
    tracks: results
      .filter((r) => r.success && !r.dryRun)
      .map((r) => ({
        id: r.slug,
        photoId: r.photoId ?? null,
        band: r.band,
        songTitle: r.title,
        album: r.album,
        date: r.date,
        releaseDate: r.releaseDate,
        genre: r.genre,
        recordLabel: r.recordLabel,
        distributor: r.distributor,
        tags: r.tags ?? [],
        categories: r.categories ?? [],
        credits: r.credits ?? {},
        durationMs: r.durationMs,
        bitrateKbps: r.bitrateKbps,
        sourceBitrateKbps: r.sourceBitrateKbps ?? null,
        sourceBitrateSource: r.bitrateSource ?? null,
        sampleRate: 48000,
        lufsIntegrated: r.lufsIntegrated,
        truePeakDb: r.truePeakDb,
        lra: r.lra,
        fileName: r.outputFile,
        checksum: r.checksum,
      })),
  };
}

function generateAudioIndex(results, outputDir, config) {
  const index = createAudioIndex(results, config);

  const indexPath = join(outputDir, 'audio-index.json');
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`  ✓ Audio index: ${indexPath}`);
}

/**
 * Generate photo-audio mapping manifest from processing results
 * @param {Array} results - Array of processing results
 * @returns {object} Photo-audio mapping manifest
 */
export function createPhotoAudioMap(results) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    note: 'Photo ID mapping is inferred from playlist index metadata when available.',
    mappings: results
      .filter((r) => r.success && !r.dryRun)
      .map((r) => ({
        audioId: r.slug,
        photoId: r.photoId ?? null,
        band: r.band,
        album: r.album,
        date: r.date,
        releaseDate: r.releaseDate,
        genre: r.genre,
        recordLabel: r.recordLabel,
      })),
  };
}

function generatePhotoAudioMap(results, outputDir) {
  const map = createPhotoAudioMap(results);

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
    report += '| Slug | Band | Date | Bitrate | LUFS | Duration |\n';
    report += '|------|------|------|---------|------|----------|\n';

    for (const r of successful) {
      const mins = Math.floor(r.durationMs / 60000);
      const secs = Math.floor((r.durationMs % 60000) / 1000);
      const bitrateLabel = r.bitrateKbps ? `${r.bitrateKbps} kbps` : 'n/a';
      report += `| ${r.slug} | ${r.band} | ${r.date} | ${bitrateLabel} | ${r.lufsIntegrated.toFixed(1)} | ${mins}:${secs.toString().padStart(2, '0')} |\n`;
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
  report += '- [ ] Spot-check ffprobe bitrate matches audio-index\n';
  report += '- [ ] Checksums calculated\n';
  report += '- [ ] Photo ID mapping verified\n';

  const reportPath = join(outputDir, 'encode-report.md');
  writeFileSync(reportPath, report);
  console.log(`  ✓ Report: ${reportPath}`);
}

function loadMetadataOverrides(path) {
  if (!path) {
    return null;
  }

  if (!existsSync(path)) {
    return null;
  }

  try {
    const contents = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(contents);
    console.log(`🧩 Loaded metadata overrides from ${path}`);
    return {
      byTrackId: parsed.byTrackId ?? {},
      byFileName: parsed.byFileName ?? {},
    };
  } catch (error) {
    console.warn(`⚠️  Could not read metadata overrides from ${path}: ${error.message}`);
    return null;
  }
}

function applyMetadataOverrides(metadata, download, overrides) {
  if (!overrides) {
    return metadata;
  }

  const trackId = metadata?.track?.id;
  const override = normalizeOverrideObject(
    (trackId && overrides.byTrackId?.[trackId]) ?? overrides.byFileName?.[download.fileName] ?? null
  );

  if (!override) {
    return metadata;
  }

  return mergeMetadataObjects(metadata, override);
}

function mergeMetadataObjects(base = {}, override = {}) {
  const merged = {
    ...base,
    track: { ...(base.track ?? {}) },
    download: { ...(base.download ?? {}) },
    playlist: { ...(base.playlist ?? {}) },
  };

  if (override.track) {
    merged.track = { ...merged.track, ...override.track };
  }

  if (override.download) {
    merged.download = { ...merged.download, ...override.download };
  }

  if (override.playlist) {
    merged.playlist = { ...merged.playlist, ...override.playlist };
  }

  const reserved = new Set(['track', 'download', 'playlist']);
  for (const [key, value] of Object.entries(override)) {
    if (reserved.has(key)) {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...(merged[key] ?? {}), ...value };
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

function normalizeOverrideObject(override) {
  if (!override) {
    return null;
  }

  if (typeof override === 'string') {
    return { track: { artist: override } };
  }

  if (typeof override !== 'object') {
    return null;
  }

  const clone = { ...override };
  const track = { ...(clone.track ?? {}) };

  if (clone.date) {
    track.performanceDate = clone.date;
    delete clone.date;
  }

  if (clone.band) {
    track.artist = clone.band;
    delete clone.band;
  }

  if (clone.title) {
    track.title = clone.title;
    delete clone.title;
  }

  if (clone.album) {
    track.album = clone.album;
    delete clone.album;
  }

  if (Object.keys(track).length > 0) {
    clone.track = track;
  }

  return clone;
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
      minBitrateFloorKbps: 96,
      vbrMode: 'constrained',
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
  return str
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENRE_KEYWORDS = [
  { pattern: /\bindie\b/i, label: 'Indie' },
  { pattern: /\bpsychedelic\b/i, label: 'Psychedelic' },
  { pattern: /\bshoegaze\b/i, label: 'Shoegaze' },
  { pattern: /\bgarage\b/i, label: 'Garage' },
  { pattern: /\bfunk\b/i, label: 'Funk' },
  { pattern: /\bsoul\b/i, label: 'Soul' },
  { pattern: /\br&b\b/i, label: 'R&B' },
  { pattern: /\bhip\s*hop\b/i, label: 'Hip Hop' },
  { pattern: /\brap\b/i, label: 'Rap' },
  { pattern: /\bjazz\b/i, label: 'Jazz' },
  { pattern: /\bblues\b/i, label: 'Blues' },
  { pattern: /\bfolk\b/i, label: 'Folk' },
  { pattern: /\bcountry\b/i, label: 'Country' },
  { pattern: /\bamericana\b/i, label: 'Americana' },
  { pattern: /\balt\.?\s*rock\b/i, label: 'Alternative Rock' },
  { pattern: /\brock\b/i, label: 'Rock' },
  { pattern: /\bmetal\b/i, label: 'Metal' },
  { pattern: /\bpost[-\s]?punk\b/i, label: 'Post-punk' },
  { pattern: /\bpost[-\s]?rock\b/i, label: 'Post-rock' },
  { pattern: /\belectronic\b/i, label: 'Electronic' },
  { pattern: /\bhouse\b/i, label: 'House' },
  { pattern: /\btechno\b/i, label: 'Techno' },
  { pattern: /\bambient\b/i, label: 'Ambient' },
  { pattern: /\bnoise\b/i, label: 'Noise' },
  { pattern: /\bexperimental\b/i, label: 'Experimental' },
  { pattern: /\bLatin\b/i, label: 'Latin' },
  { pattern: /\bcumbia\b/i, label: 'Cumbia' },
  { pattern: /\breggae\b/i, label: 'Reggae' },
];

function determineBandName(metadata) {
  const track = metadata?.track ?? {};
  const ytInfo = metadata?.ytInfo ?? {};

  const candidates = [
    ...(Array.isArray(ytInfo.artists) ? ytInfo.artists : []),
    ...(Array.isArray(track.artists) ? track.artists : []),
    track.artist,
    ytInfo.artist,
    ytInfo.channel,
    track.uploader,
    ytInfo.uploader,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const cleaned = cleanBandCandidate(candidate);
    if (cleaned) {
      return cleaned;
    }
  }

  return 'Unknown Artist';
}

function cleanBandCandidate(name) {
  if (!name) {
    return null;
  }

  let normalized = name
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/ - Topic$/i, '')
    .replace(/\s+Official$/i, '')
    .replace(/\s*\(Official.*?\)$/i, '')
    .replace(/\s+\(feat\..*$/i, '')
    .replace(/\s+feat\..*$/i, '')
    .replace(/\s+ft\..*$/i, '')
    .replace(/\s+with\s+.+$/i, '')
    .replace(/\s+x\s+.+$/i, '')
    .replace(/·.+$/, '')
    .replace(/\|.+$/, '')
    .trim();

  if (normalized.includes(',')) {
    const [first] = normalized.split(',');
    if (first) {
      normalized = first.trim();
    }
  }

  if (!normalized) {
    return null;
  }

  const sanitized = sanitizeString(normalized);
  return sanitized || null;
}

function extractMusicDetails(metadata, defaults = {}) {
  const track = metadata?.track ?? {};
  const ytInfo = metadata?.ytInfo ?? {};
  const description = track.description ?? ytInfo.description ?? '';
  const parsed = parseDescriptionForCredits(description);

  const trackTags = Array.isArray(track.tags) ? track.tags : track.tags ? [track.tags] : [];
  const ytTags = Array.isArray(ytInfo.tags) ? ytInfo.tags : ytInfo.tags ? [ytInfo.tags] : [];
  const trackCategories = Array.isArray(track.categories)
    ? track.categories
    : track.categories
      ? [track.categories]
      : [];
  const ytCategories = Array.isArray(ytInfo.categories)
    ? ytInfo.categories
    : ytInfo.categories
      ? [ytInfo.categories]
      : [];

  const tags = dedupeStrings([...trackTags, ...ytTags]);
  const categories = dedupeStrings([...trackCategories, ...ytCategories]);

  const genreFromMetadata =
    track.genre ??
    ytInfo.genre ??
    parsed.genre ??
    findGenreFromSources({
      tags,
      categories,
      description,
    });

  return {
    genre: genreFromMetadata ?? defaults.genre ?? null,
    recordLabel: parsed.recordLabel ?? null,
    distributor: parsed.distributor ?? null,
    tags,
    categories,
    credits: parsed.credits,
  };
}

function parseDescriptionForCredits(description) {
  const result = {
    distributor: null,
    recordLabel: null,
    genre: null,
    credits: {},
  };

  if (!description) {
    return result;
  }

  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!result.distributor) {
      const distributorMatch = line.match(/^Provided to YouTube by\s+(.+)$/i);
      if (distributorMatch) {
        result.distributor = distributorMatch[1].trim();
        continue;
      }
    }

    if (!result.recordLabel) {
      const labelMatch = line.match(/^℗\s*(.+)$/);
      if (labelMatch) {
        result.recordLabel = labelMatch[1].trim();
        continue;
      }
    }

    if (!result.genre) {
      const genreMatch = line.match(/^Genre:\s*(.+)$/i);
      if (genreMatch) {
        result.genre = genreMatch[1].trim();
        continue;
      }
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).replace(/\s+/g, ' ').trim();
      const value = line.slice(colonIndex + 1).trim();
      if (key && value) {
        if (!result.credits[key]) {
          result.credits[key] = [];
        }
        if (!result.credits[key].includes(value)) {
          result.credits[key].push(value);
        }
      }
    }
  }

  return result;
}

function dedupeStrings(values = []) {
  const seen = new Set();
  const cleaned = [];

  for (const value of values) {
    if (!value && value !== 0) {
      continue;
    }
    const normalized = value.toString().trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push(normalized);
  }

  return cleaned;
}

function findGenreFromSources({ tags = [], categories = [], description = '' }) {
  const category = categories.find((cat) => cat && cat.toLowerCase() !== 'music');
  if (category) {
    return toTitleCase(category);
  }

  const haystack = `${tags.join(' ')} ${description}`;
  for (const { pattern, label } of GENRE_KEYWORDS) {
    if (pattern.test(haystack)) {
      return label;
    }
  }

  return null;
}

function toTitleCase(value) {
  if (!value) {
    return value;
  }

  return value
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
    .trim();
}

/**
 * Generate output filename slug from band and album
 * @param {string} band - Band name
 * @param {string} album - Album name
 * @returns {string} Generated filename slug (e.g., "band-name-album-name")
 */
export function generateOutputFilename(band, album, title) {
  const slug = generateSlug(band, title, album);
  return `ps-${slug}.opus`;
}

function generateSlug(band, title, album) {
  const parts = [band, title, album]
    .map((value) => slugify(value ?? ''))
    .filter((segment) => Boolean(segment));

  if (parts.length === 0) {
    return 'unknown-track';
  }

  return parts.join('-');
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractDate(metadata) {
  const track = metadata?.track ?? {};
  const ytInfo = metadata?.ytInfo ?? {};

  const directCandidates = [
    track.date,
    track.performanceDate,
    track.recordedDate,
    track.releaseDate,
    track.uploadDate,
    ytInfo.release_date,
    ytInfo.upload_date,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeDateString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const textFields = [
    track.title,
    track.album,
    track.description,
    ytInfo.title,
    ytInfo.description,
  ];

  for (const field of textFields) {
    const fromText = findDateInText(field);
    if (fromText) {
      return fromText;
    }
  }

  return 'unknown';
}

function extractReleaseDate(metadata) {
  const track = metadata?.track ?? {};
  const ytInfo = metadata?.ytInfo ?? {};

  const candidates = [
    track.releaseDate,
    track.originalReleaseDate,
    track.publishedDate,
    ytInfo.release_date,
    ytInfo.upload_date,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDateString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeDateString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    return formatDateParts(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const compactMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    return formatDateParts(compactMatch[1], compactMatch[2], compactMatch[3]);
  }

  const textualMatch = raw.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i
  );
  if (textualMatch) {
    const month = monthNameToNumber(textualMatch[1]);
    return formatDateParts(textualMatch[3], month, textualMatch[2]);
  }

  return null;
}

function findDateInText(text) {
  if (!text) {
    return null;
  }

  const normalized = text.replace(/\s+/g, ' ');
  const isoPattern = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/;
  const isoMatch = normalized.match(isoPattern);
  if (isoMatch) {
    return formatDateParts(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const compactPattern = /(\d{4})(\d{2})(\d{2})/;
  const compactMatch = normalized.match(compactPattern);
  if (compactMatch) {
    return formatDateParts(compactMatch[1], compactMatch[2], compactMatch[3]);
  }

  const textPattern =
    /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i;
  const textMatch = normalized.match(textPattern);
  if (textMatch) {
    const month = monthNameToNumber(textMatch[1]);
    return formatDateParts(textMatch[3], month, textMatch[2]);
  }

  return null;
}

function monthNameToNumber(name) {
  if (!name) {
    return null;
  }
  const lookup = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    sept: '09',
    october: '10',
    november: '11',
    december: '12',
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };

  return lookup[name.toLowerCase()] ?? null;
}

function formatDateParts(year, month, day) {
  if (!year || !month || !day) {
    return null;
  }

  const y = String(year);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');

  if (!/^\d{4}$/.test(y)) {
    return null;
  }

  const monthNum = parseInt(m, 10);
  const dayNum = parseInt(d, 10);

  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    return null;
  }

  return `${y}-${m}-${d}`;
}

function printHelp() {
  console.log(`
Usage: npm run encode-audio -- [options]

Options:
  --input-dir <path>       Directory containing downloads (default: from config)
  --output-dir <path>      Directory for encoded output (default: from config)
  --work-dir <path>        Directory for temporary files (default: from config)
  --config <path>          Path to config file (default: encode.config.json)
  --metadata-overrides <path>  JSON file with manual metadata overrides
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

// Only run main function when executed directly (not when imported as a module)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
