#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const OUTPUT_DIR = path.resolve('scripts/audio-workflow/output');
const CHECKPOINT_FILE = path.resolve(OUTPUT_DIR, 'clean-slate-checkpoints.json');

const PHASES = ['download', 'encode', 'upload', 'build-data', 'validate'];
const AUDIO_EXTENSIONS = new Set([
  '.opus',
  '.webm',
  '.m4a',
  '.mp3',
  '.wav',
  '.flac',
  '.ogg',
  '.oga',
]);

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }

    if (arg.includes('=')) {
      const normalized = arg.slice(2);
      const separatorIndex = normalized.indexOf('=');
      const key = normalized.slice(0, separatorIndex);
      const value = normalized.slice(separatorIndex + 1);
      parsed[key] = value;
    } else {
      parsed[arg.slice(2)] = 'true';
    }
  }

  return parsed;
}

function toBoolean(value) {
  if (value === undefined || value === null) {
    return false;
  }
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeCheckpoints(summary) {
  ensureOutputDir();
  fs.writeFileSync(CHECKPOINT_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

function resolvePhaseRange(fromPhase, toPhase) {
  const from = normalizePhaseName(fromPhase ?? PHASES[0]);
  const to = normalizePhaseName(toPhase ?? PHASES[PHASES.length - 1]);

  const fromIndex = PHASES.indexOf(from);
  const toIndex = PHASES.indexOf(to);
  if (fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) {
    throw new Error(
      `Invalid phase range. Available phases: ${PHASES.join(', ')} (received from=${from}, to=${to})`
    );
  }

  return PHASES.slice(fromIndex, toIndex + 1);
}

function normalizePhaseName(phase) {
  if (phase === 'apply-cdn') {
    return 'build-data';
  }
  return phase;
}

function buildCommand(phase, args) {
  const prefix = args.prefix ?? process.env.R2_PREFIX ?? 'prod/audio';
  const baseUrl = args['base-url'] ?? process.env.AUDIO_WORKER_BASE_URL ?? '';
  const origin = args.origin ?? process.env.AUDIO_VALIDATE_ORIGIN ?? '';
  const sharedSecret = args['shared-secret'] ?? process.env.AUDIO_VALIDATE_SHARED_SECRET ?? '';
  const timeout = args.timeout ?? process.env.AUDIO_VALIDATE_TIMEOUT ?? '';
  const validateOnlyIds =
    args['validate-only-concert-ids'] ?? process.env.AUDIO_VALIDATE_ONLY_CONCERT_IDS ?? '';
  const skipExisting = toBoolean(args['skip-existing']) ? '--skip-existing' : '';
  const uploadArgs = [skipExisting];

  const uploadPassthroughMap = [
    ['bucket', 'bucket'],
    ['endpoint', 'endpoint'],
    ['account', 'account'],
    ['key', 'key'],
    ['secret', 'secret'],
    ['upload-base-url', 'base-url'],
    ['upload-input-dir', 'input-dir'],
    ['upload-include-ext', 'include-ext'],
    ['upload-concurrency', 'concurrency'],
  ];

  for (const [sourceArg, targetArg] of uploadPassthroughMap) {
    const value = args[sourceArg];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      uploadArgs.push(`--${targetArg}=${value}`);
    }
  }

  const extraUploadArgs = uploadArgs.filter(Boolean).join(' ');
  const downloadMaxItems = args['download-max-items'] ?? process.env.AUDIO_DOWNLOAD_MAX_ITEMS ?? '';
  const downloadPlaylistItems =
    args['download-playlist-items'] ?? process.env.AUDIO_DOWNLOAD_PLAYLIST_ITEMS ?? '';

  if (phase === 'download') {
    const commandParts = ['npm run download-song --'];
    if (downloadPlaylistItems) {
      commandParts.push(`--playlist-items=${downloadPlaylistItems}`);
    } else if (downloadMaxItems) {
      commandParts.push(`--max-items=${downloadMaxItems}`);
    }
    return commandParts.join(' ');
  }

  if (phase === 'encode') {
    return 'npm run encode-audio';
  }

  if (phase === 'upload') {
    return `npm run upload-audio -- ${extraUploadArgs}`.trim();
  }

  if (phase === 'build-data') {
    if (!baseUrl) {
      throw new Error('Phase build-data requires --base-url or AUDIO_WORKER_BASE_URL');
    }
    return `npm run audio:build-data -- --base-url=${baseUrl} --prefix=${prefix}`;
  }

  if (phase === 'validate') {
    const derivedValidateOnlyIds =
      validateOnlyIds || buildValidateConcertIdFilterFromAudioIndex(args);

    if (derivedValidateOnlyIds) {
      console.log(`🎯 Using validate concert ID filter: ${derivedValidateOnlyIds}`);
    }

    const commandParts = [
      'npm run validate-audio --',
      '--source=public/data.json',
      `--prefix=${prefix}`,
      '--trace',
    ];

    if (origin) {
      commandParts.push(`--origin=${origin}`);
    }
    if (sharedSecret) {
      commandParts.push(`--shared-secret=${sharedSecret}`);
    }
    if (timeout) {
      commandParts.push(`--timeout=${timeout}`);
    }
    if (baseUrl) {
      commandParts.push(`--base-url=${baseUrl}`);
    }
    if (derivedValidateOnlyIds) {
      commandParts.push(`--only-concert-ids=${derivedValidateOnlyIds}`);
    }

    return commandParts.join(' ');
  }

  throw new Error(`Unsupported phase: ${phase}`);
}

function runCommand(command, dryRun) {
  if (dryRun) {
    return { exitCode: 0 };
  }

  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
    env: process.env,
  });

  if (typeof result.status === 'number') {
    return { exitCode: result.status };
  }

  return { exitCode: 1 };
}

function walkFiles(rootDir) {
  const files = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || !fs.existsSync(current)) {
      continue;
    }

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function countAudioFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return 0;
  }

  return walkFiles(rootDir).filter((filePath) => AUDIO_EXTENSIONS.has(path.extname(filePath)))
    .length;
}

function countOpusFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return 0;
  }

  return walkFiles(rootDir).filter((filePath) => path.extname(filePath) === '.opus').length;
}

function assertPhaseArtifacts(phase, args) {
  const downloadDir = path.resolve(
    args['download-dir'] ?? process.env.AUDIO_DOWNLOAD_DIR ?? 'downloads'
  );
  const encodeOutputDir = path.resolve(
    args['encode-output-dir'] ??
      process.env.AUDIO_ENCODE_OUTPUT_DIR ??
      'scripts/audio-workflow/encode/output'
  );

  if (phase === 'download') {
    const audioFiles = countAudioFiles(downloadDir);
    if (audioFiles === 0) {
      throw new Error(
        `Download phase completed without audio artifacts in ${path.relative(process.cwd(), downloadDir)}.`
      );
    }
  }

  if (phase === 'encode') {
    const opusFiles = countOpusFiles(encodeOutputDir);
    if (opusFiles === 0) {
      throw new Error(
        `Encode phase completed without .opus artifacts in ${path.relative(process.cwd(), encodeOutputDir)}.`
      );
    }
  }
}

function printHelp() {
  console.log(`Run clean-slate audio workflow deterministically with checkpoints.

Usage:
  npm run audio:clean-slate -- [options]

Options:
  --from=<phase>             Start phase (download|encode|upload|build-data|validate)
  --to=<phase>               End phase (download|encode|upload|build-data|validate)
  --base-url=<url>           Worker base URL for apply-cdn/validate phases
  --prefix=<path>            Audio key prefix (default: prod/audio)
  --download-max-items=<n>   Limit download phase to first n playlist items
  --download-playlist-items=<expr> Pass explicit playlist selection to download phase
  --skip-existing            Pass through to upload phase
  --bucket=<name>            Optional R2 bucket override for upload phase
  --endpoint=<url>           Optional R2 endpoint override for upload phase
  --account=<id>             Optional R2 account id for upload phase
  --key=<key>                Optional R2 access key for upload phase
  --secret=<secret>          Optional R2 secret key for upload phase
  --upload-input-dir=<path>  Optional upload input dir override
  --upload-include-ext=<list> Optional upload extension filter (e.g. .opus,.json)
  --upload-concurrency=<n>   Optional upload concurrency override
  --upload-base-url=<url>    Optional upload report base URL (distinct from worker base URL)
  --origin=<origin>          Optional Origin header used during URL validation
  --shared-secret=<secret>   Optional worker shared secret used during URL validation
  --timeout=<ms>             Optional timeout for URL validation requests
  --validate-only-concert-ids=<ids> Optional comma-separated concert IDs to validate
  --force-full-validate       Run validate phase even for smoke runs without ID filter
  --dry-run                  Print commands only
  --help                     Show this message

Notes:
  Legacy phase name "apply-cdn" is accepted as an alias for "build-data".
`);
}

function buildValidateConcertIdFilterFromAudioIndex(args) {
  const shouldDerive =
    args['download-max-items'] !== undefined || process.env.AUDIO_DOWNLOAD_MAX_ITEMS !== undefined;
  if (!shouldDerive) {
    return null;
  }

  const audioIndexPath = path.resolve(
    args['encode-output-dir'] ??
      process.env.AUDIO_ENCODE_OUTPUT_DIR ??
      'scripts/audio-workflow/encode/output',
    'audio-index.json'
  );

  if (!fs.existsSync(audioIndexPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(audioIndexPath, 'utf8'));
    const ids = (parsed?.tracks ?? [])
      .map((track) => Number(track.photoId))
      .filter((id) => Number.isInteger(id));
    const unique = Array.from(new Set(ids));
    return unique.length > 0 ? unique.join(',') : null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (toBoolean(args.help)) {
    printHelp();
    return;
  }

  const dryRun = toBoolean(args['dry-run']);
  const forceFullValidate = toBoolean(args['force-full-validate']);
  const isSmokeRun =
    args['download-max-items'] !== undefined || args['download-playlist-items'] !== undefined;
  let selectedPhases = resolvePhaseRange(args.from, args.to);

  if (
    isSmokeRun &&
    !forceFullValidate &&
    !args['validate-only-concert-ids'] &&
    selectedPhases.includes('validate')
  ) {
    selectedPhases = selectedPhases.filter((phase) => phase !== 'validate');
    console.log(
      '⚠️  Smoke run detected: skipping full data.json validate phase. Use --force-full-validate or --validate-only-concert-ids to run it.'
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun,
    phases: [],
  };

  console.log('🚦 Running clean-slate audio phases');
  console.log(`  Phases: ${selectedPhases.join(' -> ')}`);
  console.log(`  Dry run: ${dryRun ? 'yes' : 'no'}`);

  for (const phase of selectedPhases) {
    const startedAt = new Date().toISOString();
    const command = buildCommand(phase, args);

    console.log('');
    console.log(`▶ Phase: ${phase}`);
    console.log(`  Command: ${command}`);

    const result = runCommand(command, dryRun);
    const finishedAt = new Date().toISOString();

    if (result.exitCode === 0 && !dryRun) {
      try {
        assertPhaseArtifacts(phase, args);
      } catch (error) {
        console.error(`❌ ${error.message}`);
        result.exitCode = 1;
      }
    }

    const checkpoint = {
      phase,
      command,
      startedAt,
      finishedAt,
      status: result.exitCode === 0 ? 'passed' : 'failed',
      exitCode: result.exitCode,
    };

    summary.phases.push(checkpoint);
    writeCheckpoints(summary);

    if (result.exitCode !== 0) {
      console.error(`❌ Phase failed: ${phase}`);
      process.exit(result.exitCode);
    }

    console.log(`✅ Phase complete: ${phase}`);
  }

  console.log('');
  console.log(`📝 Checkpoints written to ${path.relative(process.cwd(), CHECKPOINT_FILE)}`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
