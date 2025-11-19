#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';

const DEFAULT_PLAYLIST_URL =
  'https://music.youtube.com/playlist?list=PLqTokna7EJXfBg0o2c629Bmnxk21-G_Dg';
const DEFAULT_OUTPUT_DIR = 'downloads/yt-music';
const DEFAULT_TEMPLATE = '%(playlist_index)02d - %(title)s.%(ext)s';
const DEFAULT_ARCHIVE_NAME = '.yt-dlp-archive.txt';
const DEFAULT_CONFIG_PATH = resolve(
  process.cwd(),
  'scripts/audio-workflow/download/download-yt-song.config.json'
);

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.version) {
  printVersion();
  process.exit(0);
}

const loadedConfig = loadConfig(args.config ?? args['config-file']);
const options = { ...loadedConfig, ...args };

const playlistUrl = options['playlist-url'] ?? options.url ?? DEFAULT_PLAYLIST_URL;
const trackUrl = options['track-url'];
const targetUrl = trackUrl ?? playlistUrl;

if (!targetUrl) {
  console.error('No playlist or track URL provided.');
  process.exit(1);
}

const playlistItem = trackUrl ? null : validateIndex(options.index ?? options.item ?? 1);
const outputDir = resolvePath(options['output-dir'] ?? DEFAULT_OUTPUT_DIR);
const fileTemplate = options.template ?? options['file-template'] ?? DEFAULT_TEMPLATE;
const playerClient = normalizeValue(options['player-client'], 'webremix');
const poToken = normalizeValue(options['po-token'], null);
const keepVideo = toBoolean(options['keep-video'], false);
const writeIndexFiles = options['no-index'] ? false : toBoolean(options['write-index'], true);

const rawFormatOrder =
  options['format-order'] ??
  options['audio-format-order'] ??
  (options.format ? String(options.format) : null);
const formatPreference = keepVideo
  ? [normalizeValue(options.format ?? 'best', 'best')]
  : parseFormatPreference(rawFormatOrder);

mkdirSync(outputDir, { recursive: true });

const metadataEnabled = options['no-metadata'] ? false : toBoolean(options.metadata, true);
const writeInfoJson = options['no-info-json']
  ? false
  : toBoolean(options['write-info-json'] ?? options['info-json'], metadataEnabled);
const writeThumbnail = options['no-thumbnails']
  ? false
  : toBoolean(options['write-thumbnail'] ?? options.thumbnails, metadataEnabled);
const embedThumbnail = options['no-embed-thumbnail']
  ? false
  : toBoolean(options['embed-thumbnail'], metadataEnabled);
const addMetadata = options['no-add-metadata']
  ? false
  : toBoolean(options['add-metadata'], metadataEnabled);

const archiveDisabled = toBoolean(options['no-archive'], false);
const downloadArchive = archiveDisabled
  ? null
  : resolvePath(
      options.archive ?? options['download-archive'] ?? resolve(outputDir, DEFAULT_ARCHIVE_NAME)
    );

if (downloadArchive) {
  mkdirSync(dirname(downloadArchive), { recursive: true });
}

if (playerClient === 'android' && !poToken) {
  console.warn(
    '⚠️  The android client now requires a PO token. Provide --po-token=<token> or switch to the default webremix client.'
  );
}

const sleepRequests = toNumber(options['sleep-requests'], 0.5);
const minSleepInterval = toNumber(
  options['min-sleep-interval'],
  typeof sleepRequests === 'number' && sleepRequests > 0 ? sleepRequests : undefined
);
const maxSleepInterval = toNumber(
  options['max-sleep-interval'],
  typeof sleepRequests === 'number' && sleepRequests > 0
    ? Math.max(sleepRequests * 2, 1.5)
    : undefined
);
const rateLimit = options['rate-limit'] ?? options['limit-rate'];
const retries = toInt(options.retries, 15);
const fragmentRetries = toInt(options['fragment-retries'], 15);

const cookiesFromBrowser = options['cookies-from-browser'];
const cookiesFile = options.cookies ?? options['cookies-file'];
const netrc = toBoolean(options.netrc, false);
const proxy = options.proxy;

const ensureLatest = toBoolean(options['update-yt-dlp'] ?? options['ensure-updated'], false);
const skipPrereqCheck = toBoolean(options['skip-prereq-check'], false);
const ytBinary = normalizeBinary(options['yt-dlp-path'] ?? options['yt-dlp']) ?? 'yt-dlp';

const outputPathTemplate = `${outputDir}/${fileTemplate}`;

if (!skipPrereqCheck) {
  ensureBinaryAvailable(ytBinary, 'yt-dlp');
  if (!keepVideo) {
    ensureBinaryAvailable('ffmpeg', 'ffmpeg (required for audio extraction)');
  }
}

if (ensureLatest && !options['dry-run']) {
  console.log('🔄 Checking for yt-dlp updates...');
  const updateResult = spawnSync(ytBinary, ['-U'], { stdio: 'inherit' });
  if (updateResult.status !== 0) {
    console.warn('⚠️  yt-dlp update check failed. Continuing with the current version.');
  }
}

const downloadPlans = buildDownloadPlans();

if (!downloadPlans.length) {
  console.error('Could not build any download plans. Check your format configuration.');
  process.exit(1);
}

if (options['dry-run']) {
  downloadPlans.forEach((plan) => {
    const args = buildYtArgs({ ...plan.params });
    console.log(`${ytBinary} ${args.join(' ')}`);
  });
  process.exit(0);
}

runDownloadPlan(0);

function runDownloadPlan(planIndex) {
  const plan = downloadPlans[planIndex];
  const label = plan.label ? ` (${plan.label.toUpperCase()})` : '';
  const attemptInfo =
    downloadPlans.length > 1 ? ` attempt ${planIndex + 1}/${downloadPlans.length}` : '';
  console.log(`⬇️  Downloading${label}${attemptInfo} with yt-dlp...`);

  const tempDir = mkdtempSync(join(tmpdir(), 'photo-signal-yt-'));
  const filepathLog = join(tempDir, 'filepath.log');
  const args = buildYtArgs({ ...plan.params, printFilePath: filepathLog });
  const ytProcess = spawn(ytBinary, args, { stdio: 'inherit' });

  ytProcess.on('error', (error) => {
    cleanupTempPath(tempDir);
    if (error.code === 'ENOENT') {
      console.error(
        `${ytBinary} is not installed or not in your PATH. Install yt-dlp: https://github.com/yt-dlp/yt-dlp`
      );
    } else {
      console.error('Failed to start yt-dlp:', error);
    }
    process.exit(1);
  });

  ytProcess.on('close', (code) => {
    const downloadedFilePath = readPrintedFile(filepathLog);
    cleanupTempPath(tempDir);

    if (code === 0) {
      if (writeIndexFiles && downloadedFilePath) {
        try {
          createMetadataIndex({
            downloadedFilePath,
            audioFormat: plan.audioFormat,
            planLabel: plan.label,
          });
        } catch (error) {
          console.warn(`⚠️  Unable to write metadata index: ${error.message}`);
        }
      } else if (writeIndexFiles && !downloadedFilePath) {
        console.warn('⚠️  Could not determine downloaded file path for metadata indexing.');
      }

      console.log(`✅ Finished${label}! Files saved to ${outputDir}`);
      process.exit(0);
    }

    if (planIndex + 1 < downloadPlans.length) {
      const nextPlan = downloadPlans[planIndex + 1];
      console.warn(
        `⚠️  ${plan.label?.toUpperCase() ?? 'Attempt'} failed (exit ${code}). Falling back to ${
          nextPlan.label?.toUpperCase() ?? 'next attempt'
        }...`
      );
      runDownloadPlan(planIndex + 1);
      return;
    }

    console.error(`yt-dlp exited with code ${code}. See output above.`);
    process.exit(code ?? 1);
  });
}

function buildDownloadPlans() {
  const baseParams = {
    targetUrl,
    playlistItem,
    outputPathTemplate,
    playerClient,
    poToken,
    keepVideo,
    writeInfoJson,
    writeThumbnail,
    embedThumbnail,
    addMetadata,
    downloadArchive,
    sleepRequests,
    minSleepInterval,
    maxSleepInterval,
    rateLimit,
    retries,
    fragmentRetries,
    cookiesFromBrowser,
    cookiesFile,
    netrc,
    proxy,
  };

  if (keepVideo) {
    return [
      {
        label: formatPreference[0] ?? 'video',
        audioFormat: formatPreference[0] ?? null,
        params: {
          ...baseParams,
          audioFormat: null,
          formatSelector: formatPreference[0] ?? 'best',
        },
      },
    ];
  }

  const preference = formatPreference.length ? formatPreference : ['opus', 'mp3'];

  return preference.map((audioFormat) => ({
    label: audioFormat,
    audioFormat,
    params: {
      ...baseParams,
      audioFormat,
      formatSelector: resolveAudioFormatSelector(audioFormat),
    },
  }));
}

function parseArgs(argv) {
  const result = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }

    let keyValue = arg.slice(2);
    let value;

    if (keyValue.includes('=')) {
      const [rawKey, valueFromEquals] = keyValue.split('=');
      keyValue = rawKey;
      value = valueFromEquals;
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        value = next;
        i += 1;
      } else {
        value = true;
      }
    }

    const normalizedKey = normalizeKey(keyValue);

    if (normalizedKey.startsWith('no-') && value === true) {
      result[normalizedKey] = true;
    } else {
      result[normalizedKey] = value;
    }
  }

  return result;
}

function validateIndex(rawIndex) {
  const parsed = Number(rawIndex);
  if (Number.isNaN(parsed) || parsed < 1) {
    console.error('Playlist index must be a positive number.');
    process.exit(1);
  }
  return Math.floor(parsed);
}

function buildYtArgs({
  targetUrl,
  playlistItem,
  audioFormat,
  formatSelector,
  outputPathTemplate,
  playerClient,
  poToken,
  keepVideo,
  writeInfoJson,
  writeThumbnail,
  embedThumbnail,
  addMetadata,
  downloadArchive,
  sleepRequests,
  minSleepInterval,
  maxSleepInterval,
  rateLimit,
  retries,
  fragmentRetries,
  cookiesFromBrowser,
  cookiesFile,
  netrc,
  proxy,
  printFilePath,
}) {
  const argsList = [
    targetUrl,
    '--ignore-errors',
    '--no-abort-on-error',
    '--no-overwrites',
    '--newline',
    '--retries',
    String(retries),
    '--fragment-retries',
    String(fragmentRetries),
    '--concurrent-fragments',
    '1',
  ];

  if (playlistItem) {
    argsList.push('--playlist-items', String(playlistItem));
  }

  if (!keepVideo && audioFormat) {
    argsList.push('--extract-audio', '--audio-format', audioFormat);
  } else if (!keepVideo) {
    argsList.push('--extract-audio');
  }

  const extractorArgs = [];

  if (playerClient && playerClient !== 'none') {
    extractorArgs.push(`player_client=${playerClient}`);
  }

  if (poToken) {
    extractorArgs.push(`po_token=${poToken}`);
  }

  if (extractorArgs.length) {
    argsList.push('--extractor-args', `youtube:${extractorArgs.join('&')}`);
  }

  argsList.push('--format', formatSelector ?? 'bestaudio[ext=m4a]/bestaudio/best');
  argsList.push('--output', outputPathTemplate);

  if (writeInfoJson) {
    argsList.push('--write-info-json');
  }

  if (writeThumbnail) {
    argsList.push('--write-thumbnail');
  }

  if (embedThumbnail) {
    argsList.push('--embed-thumbnail');
  }

  if (addMetadata) {
    argsList.push('--add-metadata');
  }

  if (downloadArchive) {
    argsList.push('--download-archive', downloadArchive);
  }

  if (typeof sleepRequests === 'number' && sleepRequests > 0) {
    argsList.push('--sleep-requests', String(sleepRequests));
  }

  if (typeof minSleepInterval === 'number' && minSleepInterval >= 0) {
    argsList.push('--min-sleep-interval', String(minSleepInterval));
  }

  if (typeof maxSleepInterval === 'number' && maxSleepInterval > 0) {
    argsList.push('--max-sleep-interval', String(maxSleepInterval));
  }

  if (rateLimit) {
    argsList.push('--limit-rate', rateLimit);
  }

  if (cookiesFromBrowser) {
    argsList.push('--cookies-from-browser', cookiesFromBrowser);
  }

  if (cookiesFile) {
    argsList.push('--cookies', resolvePath(cookiesFile));
  }

  if (netrc) {
    argsList.push('--netrc');
  }

  if (proxy) {
    argsList.push('--proxy', proxy);
  }

  if (printFilePath) {
    argsList.push('--print-to-file', 'after_move:filepath', printFilePath);
  }

  return argsList;
}

function ensureBinaryAvailable(binaryName, friendlyName) {
  if (binaryName.includes('/') || binaryName.includes('\\')) {
    if (!existsSync(binaryName)) {
      console.error(`Cannot find ${friendlyName ?? binaryName} at ${binaryName}`);
      process.exit(1);
    }
    return;
  }

  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [binaryName]);
  if (result.status !== 0) {
    console.error(`Missing dependency: ${friendlyName ?? binaryName}`);
    process.exit(1);
  }
}

function normalizeValue(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
}

function toBoolean(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = String(value).toLowerCase();
  if (['false', '0', 'off', 'no', ''].includes(normalized)) {
    return false;
  }
  return true;
}

function toNumber(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
}

function toInt(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
}

function normalizeKey(key) {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function resolvePath(value) {
  if (!value) {
    return value;
  }
  const expanded = value.startsWith('~') ? value.replace('~', homedir()) : value;
  return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
}

function normalizeBinary(value) {
  if (!value) {
    return value;
  }
  const trimmed = String(value).trim();
  if (
    trimmed.startsWith('.') ||
    trimmed.startsWith('~') ||
    trimmed.includes('/') ||
    trimmed.includes('\\')
  ) {
    return resolvePath(trimmed);
  }
  return trimmed;
}

function parseFormatPreference(rawPreference) {
  if (!rawPreference) {
    return ['opus', 'mp3'];
  }

  return String(rawPreference)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function resolveAudioFormatSelector(audioFormat) {
  switch ((audioFormat ?? '').toLowerCase()) {
    case 'opus':
      return 'bestaudio[acodec^=opus]/bestaudio[ext=webm]/bestaudio/best';
    case 'mp3':
      return 'bestaudio[acodec=mp3]/bestaudio[ext=m4a]/bestaudio/best';
    case 'aac':
      return 'bestaudio[acodec=aac]/bestaudio[ext=m4a]/bestaudio/best';
    default:
      return 'bestaudio/best';
  }
}

function readPrintedFile(filePath) {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const raw = readFileSync(filePath, 'utf-8').trim();
    if (!raw) {
      return null;
    }
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.at(-1) ?? null;
  } catch {
    return null;
  }
}

function cleanupTempPath(tempPath) {
  try {
    rmSync(tempPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function createMetadataIndex({ downloadedFilePath, audioFormat, planLabel }) {
  const metadataPath = `${downloadedFilePath}.metadata.json`;
  const infoJsonPath = `${downloadedFilePath}.info.json`;
  let infoData = null;

  if (existsSync(infoJsonPath)) {
    try {
      infoData = JSON.parse(readFileSync(infoJsonPath, 'utf-8'));
    } catch (error) {
      console.warn(`⚠️  Could not parse ${infoJsonPath}: ${error.message}`);
    }
  } else if (writeInfoJson) {
    console.warn('⚠️  Expected .info.json file not found; metadata index will be partial.');
  }

  const metadata = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    playlist: {
      url: playlistUrl,
      id: infoData?.playlist_id ?? null,
      title: infoData?.playlist_title ?? null,
      index: infoData?.playlist_index ?? playlistItem ?? null,
    },
    track: {
      id: infoData?.id ?? null,
      title: infoData?.title ?? null,
      album: infoData?.album ?? infoData?.track ?? null,
      artist: infoData?.artist ?? infoData?.uploader ?? null,
      channelId: infoData?.channel_id ?? null,
      durationSeconds: infoData?.duration ?? null,
      thumbnails: infoData?.thumbnails ?? [],
      webpageUrl: infoData?.webpage_url ?? infoData?.original_url ?? targetUrl,
    },
    download: {
      filePath: downloadedFilePath,
      fileName: basename(downloadedFilePath),
      ext: infoData?.ext ?? detectExtension(downloadedFilePath),
      codec: infoData?.acodec ?? null,
      bitrateKbps: infoData?.abr ?? null,
      formatAttempted: planLabel ?? audioFormat ?? null,
      formatPreference,
      archivePath: downloadArchive,
    },
    source: {
      playlistUrl,
      trackUrl,
      requestedUrl: targetUrl,
    },
    infoJsonPath: existsSync(infoJsonPath) ? infoJsonPath : null,
  };

  if (infoData) {
    metadata.ytInfo = infoData;
  }

  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`🗂️  Metadata index saved to ${metadataPath}`);
}

function detectExtension(filePath) {
  const ext = extname(filePath ?? '');
  if (!ext) {
    return null;
  }
  return ext.replace('.', '');
}

function loadConfig(explicitPath) {
  const candidate = explicitPath ? resolvePath(explicitPath) : DEFAULT_CONFIG_PATH;
  if (!candidate || !existsSync(candidate)) {
    return {};
  }

  try {
    const contents = readFileSync(candidate, 'utf-8');
    const parsed = JSON.parse(contents);
    console.log(`🛠️  Loaded download config from ${candidate}`);
    return Object.entries(parsed).reduce((acc, [key, value]) => {
      acc[normalizeKey(key)] = value;
      return acc;
    }, {});
  } catch (error) {
    console.warn(`⚠️  Could not read ${candidate}: ${error.message}`);
    return {};
  }
}

function printHelp() {
  console.log(`
Usage: npm run download-song -- [options]

Options:
	--playlist-url <url>         YouTube Music playlist URL (default: Photo Signal playlist)
	--track-url <url>            Download a single track URL (skips playlist indexing)
	--item <n>                   Playlist index (1-based) to download
	--output-dir <path>          Directory for downloads (default: ${DEFAULT_OUTPUT_DIR})
  --format <ext>               Audio format (comma-separated list for priority; default: opus,mp3)
  --format-order <list>        Alternate way to set comma-separated audio priority
	--file-template <tpl>        yt-dlp output template (default: ${DEFAULT_TEMPLATE})
	--keep-video                 Skip audio extraction and keep original container
  --player-client <client>     Force specific YouTube client (default: webremix)
  --po-token <token>           Provide required PO token when using android or tv clients
	--cookies-from-browser <b>   Use authenticated cookies from a local browser profile
	--cookies <path>             Use cookies from a Netscape-format file
	--netrc                      Use credentials from ~/.netrc
	--proxy <url>                Route traffic through a proxy
	--archive <path>             Download archive file (default: <output-dir>/${DEFAULT_ARCHIVE_NAME})
	--no-archive                 Disable duplicate protection archive
	--metadata / --no-metadata   Toggle metadata sidecars, tags, and thumbnails
	--no-info-json               Skip writing the .info.json metadata file
	--no-thumbnails              Skip thumbnail download/embedding
  --write-index / --no-index   Toggle machine-readable per-track metadata index files (default: on)
  --sleep-requests <seconds>   Friendly throttle between requests (default: 0.5)
  --min-sleep-interval <sec>   Minimum random delay when throttling (default: --sleep-requests)
  --max-sleep-interval <sec>   Maximum random delay when throttling (default: 2x min, >=1.5s)
	--rate-limit <value>         Limit download rate, e.g. 3M for 3 megabytes/sec
	--retries <n>                Overall retry attempts (default: 15)
	--fragment-retries <n>       Fragment retry attempts (default: 15)
	--yt-dlp-path <path>         Custom yt-dlp binary path
	--update-yt-dlp              Run "yt-dlp -U" before downloading
	--skip-prereq-check          Skip ffmpeg/yt-dlp availability checks
  --config <path>              JSON file with default flags (auto-loads scripts/audio-workflow/download/download-yt-song.config.json)
	--dry-run                    Print the final command instead of executing
	--help                       Show this message
	--version                    Print script version
`);
}

function printVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8')
    );
    console.log(`download-yt-song v${pkg.version}`);
  } catch {
    console.log('download-yt-song');
  }
}
