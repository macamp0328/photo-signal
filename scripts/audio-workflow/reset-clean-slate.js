#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { resolveConfigFromEnvAndArgs } from './update/upload-to-r2.js';

const OUTPUT_DIR = path.resolve('scripts/audio-workflow/output');
const RESET_REPORT = path.resolve(OUTPUT_DIR, 'clean-slate-reset-report.json');

const DEFAULT_LOCAL_PATHS = [
  path.resolve('downloads'),
  path.resolve('downloads/yt-music'),
  path.resolve('scripts/audio-workflow/encode/work'),
  path.resolve('scripts/audio-workflow/encode/output'),
  path.resolve('scripts/audio-workflow/output'),
];

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }

    if (!arg.includes('=')) {
      parsed[arg.slice(2)] = 'true';
      continue;
    }

    const normalized = arg.slice(2);
    const separatorIndex = normalized.indexOf('=');
    const key = normalized.slice(0, separatorIndex);
    const value = normalized.slice(separatorIndex + 1);
    parsed[key] = value;
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

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function resetLocalArtifacts(localPaths) {
  const removed = [];

  for (const localPath of localPaths) {
    if (!fs.existsSync(localPath)) {
      continue;
    }

    fs.rmSync(localPath, { recursive: true, force: true });
    removed.push(path.relative(process.cwd(), localPath));
  }

  ensureDir(path.resolve('scripts/audio-workflow/encode/output'));
  ensureDir(path.resolve('scripts/audio-workflow/output'));
  return removed;
}

async function listAllKeys(s3Client, bucket, prefix) {
  const keys = [];
  let continuationToken;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const entry of response.Contents ?? []) {
      if (entry.Key) {
        keys.push(entry.Key);
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

async function deleteKeys(s3Client, bucket, keys) {
  const deleted = [];

  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);

    const response = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: true,
        },
      })
    );

    for (const entry of response.Deleted ?? []) {
      if (entry.Key) {
        deleted.push(entry.Key);
      }
    }
  }

  return deleted;
}

function printHelp() {
  console.log(`Reset clean-slate audio pipeline state.

Usage:
  npm run audio:reset -- [options]

Options:
  --with-r2                      Also delete uploaded R2 objects under current prefix
  --confirm-r2-delete=DELETE     Required when using --with-r2 (safety guard)
  --dry-run                      Show actions without deleting files/objects
  --help                         Show this message

Examples:
  npm run audio:reset
  npm run audio:reset -- --with-r2 --confirm-r2-delete=DELETE
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (toBoolean(args.help)) {
    printHelp();
    return;
  }

  const dryRun = toBoolean(args['dry-run']);
  const withR2 = toBoolean(args['with-r2']);

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
    local: {
      removedPaths: [],
    },
    r2: {
      attempted: withR2,
      prefix: null,
      discoveredCount: 0,
      deletedCount: 0,
      deletedKeys: [],
    },
  };

  console.log('🧹 Reset clean-slate pipeline state');
  console.log(`  Dry run: ${dryRun ? 'yes' : 'no'}`);

  if (dryRun) {
    report.local.removedPaths = DEFAULT_LOCAL_PATHS.filter((localPath) =>
      fs.existsSync(localPath)
    ).map((localPath) => path.relative(process.cwd(), localPath));
  } else {
    report.local.removedPaths = resetLocalArtifacts(DEFAULT_LOCAL_PATHS);
  }

  console.log(`  Local paths removed: ${report.local.removedPaths.length}`);

  if (withR2) {
    if (String(args['confirm-r2-delete'] ?? '') !== 'DELETE') {
      throw new Error('Refusing R2 deletion without --confirm-r2-delete=DELETE');
    }

    const config = resolveConfigFromEnvAndArgs(args);
    report.r2.prefix = config.prefix || '';

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    const keys = await listAllKeys(s3Client, config.bucket, config.prefix);
    report.r2.discoveredCount = keys.length;

    if (dryRun || keys.length === 0) {
      console.log(`  R2 keys matched prefix: ${keys.length}`);
    } else {
      const deleted = await deleteKeys(s3Client, config.bucket, keys);
      report.r2.deletedKeys = deleted;
      report.r2.deletedCount = deleted.length;
      console.log(`  R2 keys deleted: ${deleted.length}`);
    }
  }

  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(RESET_REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`📝 Reset report: ${path.relative(process.cwd(), RESET_REPORT)}`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
