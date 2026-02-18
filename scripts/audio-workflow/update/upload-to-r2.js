#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const DEFAULT_INPUT_DIR = 'scripts/audio-workflow/encode/output';
const DEFAULT_INCLUDE_EXTENSIONS = ['.opus', '.json', '.md'];
const DEFAULT_CONCURRENCY = 4;

export function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      if (arg.includes('=')) {
        const raw = arg.slice(2);
        const separatorIndex = raw.indexOf('=');
        const key = raw.slice(0, separatorIndex);
        const value = raw.slice(separatorIndex + 1);
        args[key] = value;
      } else {
        args[arg.slice(2)] = 'true';
      }
    }
  }
  return args;
}

export function coerceOptional(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

export function resolveConfigFromEnvAndArgs(args) {
  const env = process.env;
  const bucket =
    coerceOptional(args.bucket) ?? coerceOptional(env.R2_BUCKET_NAME) ?? 'photo-signal-audio';
  const prefix = sanitizePrefix(coerceOptional(args.prefix) ?? coerceOptional(env.R2_PREFIX) ?? '');
  const includeExtArg =
    coerceOptional(args['include-ext']) ?? coerceOptional(env.R2_INCLUDE_EXTENSIONS);
  const includeExtensions = includeExtArg
    ? includeExtArg
        .split(',')
        .map((ext) => normalizeExtension(ext.trim()))
        .filter(Boolean)
    : DEFAULT_INCLUDE_EXTENSIONS;
  const concurrency = Number.parseInt(
    args.concurrency ?? env.R2_CONCURRENCY ?? DEFAULT_CONCURRENCY,
    10
  );
  const dryRun = toBoolean(args['dry-run'] ?? env.R2_DRY_RUN);
  const skipExisting = toBoolean(args['skip-existing'] ?? env.R2_SKIP_EXISTING);
  const inputDir = path.resolve(
    process.cwd(),
    coerceOptional(args['input-dir']) ?? coerceOptional(env.R2_INPUT_DIR) ?? DEFAULT_INPUT_DIR
  );
  const accessKeyId = coerceOptional(args.key) ?? coerceOptional(env.R2_ACCESS_KEY_ID);
  const secretAccessKey = coerceOptional(args.secret) ?? coerceOptional(env.R2_SECRET_ACCESS_KEY);
  const accountId = coerceOptional(args.account) ?? coerceOptional(env.R2_ACCOUNT_ID) ?? null;
  const endpoint = normalizeEndpoint(
    coerceOptional(args.endpoint) ??
      coerceOptional(env.R2_ENDPOINT) ??
      deriveEndpointFromAccount(accountId)
  );
  const publicBaseUrl = trimTrailingSlash(
    coerceOptional(args['base-url']) ??
      coerceOptional(env.R2_BASE_URL) ??
      buildDefaultPublicBaseUrl(endpoint, bucket)
  );

  if (!bucket) {
    throw new Error('R2 bucket name missing. Set R2_BUCKET_NAME or pass --bucket.');
  }
  if (!endpoint) {
    throw new Error('R2 endpoint missing. Set R2_ENDPOINT or R2_ACCOUNT_ID or pass --endpoint.');
  }
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 access credentials missing. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY or pass --key/--secret.'
    );
  }

  return {
    accountId,
    endpoint,
    bucket,
    prefix,
    includeExtensions,
    concurrency:
      Number.isFinite(concurrency) && concurrency > 0 ? concurrency : DEFAULT_CONCURRENCY,
    dryRun,
    skipExisting,
    inputDir,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

export function sanitizePrefix(value) {
  if (!value) return '';
  return value.replace(/^\/+|\/+$/g, '').trim();
}

export function normalizeExtension(ext) {
  if (!ext) return null;
  return ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
}

export function toBoolean(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(normalized);
}

export function deriveEndpointFromAccount(accountId) {
  if (!accountId) return null;
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function normalizeEndpoint(endpoint) {
  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    url.pathname = url.pathname.replace(/\/+$|^\/+/g, '');
    return trimTrailingSlash(url.toString());
  } catch {
    return trimTrailingSlash(endpoint);
  }
}

export function trimTrailingSlash(value) {
  if (!value) return value;
  return value.endsWith('/') ? value.replace(/\/+$/, '') : value;
}

export function buildDefaultPublicBaseUrl(endpoint, bucket) {
  if (!endpoint || !bucket) return null;
  return `${trimTrailingSlash(endpoint)}/${bucket}`;
}

export function collectFiles(inputDir, includeExtensions = DEFAULT_INCLUDE_EXTENSIONS) {
  const stats = statSync(inputDir);
  if (!stats.isDirectory()) {
    throw new Error(`Input directory is not a folder: ${inputDir}`);
  }

  const results = [];
  const queue = [inputDir];

  while (queue.length) {
    const current = queue.pop();
    const dirEntries = readdirSync(current, { withFileTypes: true });
    for (const entry of dirEntries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (shouldIncludeFile(entry.name, includeExtensions)) {
        const relativePath = path.relative(inputDir, fullPath);
        const posixRelative = relativePath.split(path.sep).join('/');
        const { size } = statSync(fullPath);
        results.push({
          fullPath,
          relativePath: posixRelative,
          size,
        });
      }
    }
  }

  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function shouldIncludeFile(filename, includeExtensions) {
  if (!includeExtensions || includeExtensions.length === 0) {
    return true;
  }
  const ext = path.extname(filename).toLowerCase();
  return includeExtensions.includes(ext);
}

export function buildObjectKey(relativePath, prefix) {
  const cleanRelative = relativePath.replace(/^\/+/, '');
  return [prefix, cleanRelative].filter(Boolean).join('/');
}

export function loadPhotoIdByFileName(audioIndexPath) {
  if (!audioIndexPath) {
    return new Map();
  }

  try {
    const raw = JSON.parse(requireTextFile(audioIndexPath));
    const map = new Map();
    for (const track of raw?.tracks ?? []) {
      const fileName = track?.fileName;
      const photoId = Number.parseInt(String(track?.photoId ?? ''), 10);
      if (fileName && Number.isInteger(photoId) && photoId > 0) {
        map.set(fileName, photoId);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function requireTextFile(filePath) {
  return readFileSync(filePath, 'utf8');
}

export function resolveObjectKeyForFile(file, prefix, photoIdByFileName) {
  void photoIdByFileName;
  return buildObjectKey(file.relativePath, prefix);
}

export function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.opus':
      return 'audio/ogg; codecs=opus';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.md':
    case '.markdown':
      return 'text/markdown; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

export function getCacheControl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.opus') {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=300';
}

export function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function shouldSkipUpload(s3Client, bucket, key, { sha256, size }) {
  try {
    const response = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const remoteHash = response.Metadata?.sha256;
    const remoteSize = response.ContentLength ?? null;
    if (remoteHash && remoteHash.toLowerCase() === sha256.toLowerCase() && remoteSize === size) {
      return { skip: true, reason: 'Remote object hash + size match' };
    }
    if (!remoteHash && remoteSize === size) {
      return { skip: true, reason: 'Remote object size match (no hash metadata)' };
    }
    return { skip: false };
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') {
      return { skip: false };
    }
    throw error;
  }
}

export async function uploadSingleFile({ file, config, s3Client }) {
  const key = file.objectKey ?? buildObjectKey(file.relativePath, config.prefix);
  const sha256 = await computeSha256(file.fullPath);
  const metadata = {
    sha256,
  };

  if (config.skipExisting && !config.dryRun) {
    const skipResult = await shouldSkipUpload(s3Client, config.bucket, key, {
      sha256,
      size: file.size,
    });
    if (skipResult.skip) {
      return {
        status: 'skipped',
        key,
        reason: skipResult.reason,
        file,
        sha256,
      };
    }
  }

  if (config.dryRun) {
    return {
      status: 'dry-run',
      key,
      file,
      sha256,
    };
  }

  const bodyStream = createReadStream(file.fullPath);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bodyStream,
      ContentType: getContentType(file.fullPath),
      CacheControl: getCacheControl(file.fullPath),
      Metadata: metadata,
    })
  );

  return {
    status: 'uploaded',
    key,
    file,
    sha256,
  };
}

export async function runWithConcurrency(items, limit, iterator) {
  const results = [];
  let index = 0;

  async function worker() {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) {
        break;
      }
      results[currentIndex] = await iterator(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function printHelp() {
  console.log(`Upload encoded audio + manifests to Cloudflare R2.

Usage:
  npm run upload-audio -- [options]

Options:
  --input-dir=<path>       Directory containing encoded assets (default: ${DEFAULT_INPUT_DIR})
  --bucket=<name>          Override R2 bucket name
  --endpoint=<url>         Custom R2 S3 endpoint
  --base-url=<url>         Public base URL for reporting (defaults to endpoint/bucket)
  --prefix=<path>          Optional key prefix inside the bucket (e.g., prod/audio)
  --include-ext=.opus,.json Include file extensions (comma separated)
  --concurrency=<n>        Parallel uploads (default: ${DEFAULT_CONCURRENCY})
  --skip-existing          Check remote objects before uploading
  --dry-run                Print planned uploads without sending data
  --help                   Show this message
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let config;
  try {
    config = resolveConfigFromEnvAndArgs(args);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  let files;
  try {
    files = collectFiles(config.inputDir, config.includeExtensions);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  if (!files.length) {
    console.warn(
      '⚠️  No matching files found. Check the input directory or --include-ext filters.'
    );
    process.exit(0);
  }

  const photoIdByFileName = new Map();
  files = files.map((file) => ({
    ...file,
    objectKey: resolveObjectKeyForFile(file, config.prefix, photoIdByFileName),
  }));

  console.log('🎧 Cloudflare R2 Upload Script');
  console.log('');
  console.log('Configuration:');
  console.log(`  Input dir:    ${config.inputDir}`);
  console.log(`  Bucket:       ${config.bucket}`);
  console.log(`  Endpoint:     ${config.endpoint}`);
  console.log(`  Prefix:       ${config.prefix || '(none)'}`);
  console.log(`  Include ext:  ${config.includeExtensions.join(', ')}`);
  console.log(`  Concurrency:  ${config.concurrency}`);
  console.log(`  Dry run:      ${config.dryRun ? 'yes' : 'no'}`);
  console.log(`  Skip existing:${config.skipExisting ? 'yes' : 'no'}`);
  console.log('  Upload shape: flat (prefix/fileName)');
  console.log('');
  console.log(`Discovered ${files.length} file(s)`);
  console.log('');

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const results = [];
  await runWithConcurrency(files, config.concurrency, async (file) => {
    const prettyName = `${file.relativePath} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
    console.log(`↥ Uploading ${prettyName} ...`);
    try {
      const result = await uploadSingleFile({ file, config, s3Client });
      results.push(result);
      if (result.status === 'uploaded') {
        console.log(`   ✅ Uploaded as ${result.key}`);
      } else if (result.status === 'dry-run') {
        console.log(`   ℹ️  DRY RUN would upload to ${result.key}`);
      } else if (result.status === 'skipped') {
        console.log(`   ⏭️  Skipped (${result.reason})`);
      }
      return result;
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      results.push({ status: 'failed', key: file.relativePath, error });
      return { status: 'failed', error };
    }
  });

  const uploaded = results.filter((r) => r.status === 'uploaded');
  const skipped = results.filter((r) => r.status === 'skipped');
  const failed = results.filter((r) => r.status === 'failed');

  console.log('');
  console.log('📊 Summary');
  console.log(`  Uploaded: ${uploaded.length}`);
  console.log(`  Skipped:  ${skipped.length}`);
  console.log(`  Dry-run:  ${results.filter((r) => r.status === 'dry-run').length}`);
  console.log(`  Failed:   ${failed.length}`);

  if (uploaded.length && config.publicBaseUrl) {
    console.log('');
    console.log('CDN URLs:');
    for (const item of uploaded) {
      const url = `${config.publicBaseUrl}/${item.key}`.replace(/(?<!:)\/\//g, '/');
      console.log(`  • ${url}`);
    }
  }

  if (failed.length) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  });
}
