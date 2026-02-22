import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  parseArgs,
  resolveConfigFromEnvAndArgs,
  collectFiles,
  buildObjectKey,
  resolveObjectKeyForFile,
  getContentType,
  getCacheControl,
  computeSha256,
  shouldSkipUpload,
  runWithConcurrency,
  sanitizePrefix,
  deriveEndpointFromAccount,
  normalizeEndpoint,
} from '../upload-to-r2.js';

describe('upload-to-r2 helpers', () => {
  let tempDir;
  let originalEnv;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'upload-to-r2-test-'));
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('parses CLI args with booleans and values', () => {
    const args = parseArgs(['--bucket=photo', '--dry-run', '--concurrency=8']);
    expect(args.bucket).toBe('photo');
    expect(args['dry-run']).toBe('true');
    expect(args.concurrency).toBe('8');
  });

  it('preserves full values that contain additional equals signs', () => {
    const args = parseArgs(['--shared-secret=abc=def=ghi']);
    expect(args['shared-secret']).toBe('abc=def=ghi');
  });

  it('resolves config from args + defaults', () => {
    const config = resolveConfigFromEnvAndArgs({
      bucket: 'test-bucket',
      endpoint: 'https://example.r2.cloudflarestorage.com',
      key: 'KEY',
      secret: 'SECRET',
      prefix: 'prod/audio',
      'input-dir': tempDir,
      concurrency: '2',
      'include-ext': '.opus,.json',
      'skip-existing': 'true',
      'dry-run': 'false',
      'base-url': 'https://cdn.example.com/audio',
    });

    expect(config.bucket).toBe('test-bucket');
    expect(config.endpoint).toBe('https://example.r2.cloudflarestorage.com');
    expect(config.prefix).toBe('prod/audio');
    expect(config.includeExtensions).toEqual(['.opus', '.json']);
    expect(config.skipExisting).toBe(true);
    expect(config.dryRun).toBe(false);
    expect(config.publicBaseUrl).toBe('https://cdn.example.com/audio');
    expect(config.concurrency).toBe(2);
  });

  it('derives endpoint from account id when needed', () => {
    delete process.env.R2_ENDPOINT;
    const config = resolveConfigFromEnvAndArgs({
      bucket: 'photo-signal-audio',
      account: '12345',
      key: 'KEY',
      secret: 'SECRET',
      'input-dir': tempDir,
    });

    expect(config.endpoint).toBe('https://12345.r2.cloudflarestorage.com');
  });

  it('ignores blank endpoint env values and still derives from account', () => {
    process.env.R2_ENDPOINT = '   ';
    const config = resolveConfigFromEnvAndArgs({
      bucket: 'photo-signal-audio',
      account: 'abc123',
      key: 'KEY',
      secret: 'SECRET',
      'input-dir': tempDir,
    });

    expect(config.endpoint).toBe('https://abc123.r2.cloudflarestorage.com');
  });

  it('collects files with extension filtering', () => {
    const opus = path.join(tempDir, 'track.opus');
    const json = path.join(tempDir, 'audio-index.json');
    const skip = path.join(tempDir, 'notes.txt');
    writeFileSync(opus, 'opus-data');
    writeFileSync(json, '{}');
    writeFileSync(skip, 'ignore me');

    const files = collectFiles(tempDir, ['.opus', '.json']);

    expect(files).toHaveLength(2);
    expect(files.map((f) => f.relativePath)).toEqual(['audio-index.json', 'track.opus']);
  });

  it('builds object keys with prefixes and normalizes slashes', () => {
    const key = buildObjectKey('folder/file.opus', 'prod/audio');
    expect(key).toBe('prod/audio/folder/file.opus');
  });

  it('keeps opus files flat under prefix', () => {
    const key = resolveObjectKeyForFile({ relativePath: 'ps-example-track.opus' }, 'prod/audio');
    expect(key).toBe('prod/audio/ps-example-track.opus');
  });

  it('keeps non-opus files flat under prefix', () => {
    const key = resolveObjectKeyForFile({ relativePath: 'audio-index.json' }, 'prod/audio');
    expect(key).toBe('prod/audio/audio-index.json');
  });

  it('returns accurate content types and cache headers', () => {
    expect(getContentType('/tmp/file.opus')).toBe('audio/ogg; codecs=opus');
    expect(getCacheControl('/tmp/file.opus')).toContain('31536000');
    expect(getContentType('/tmp/photo.jpg')).toBe('image/jpeg');
    expect(getCacheControl('/tmp/photo.jpg')).toContain('31536000');
    expect(getContentType('/tmp/data.json')).toBe('application/json; charset=utf-8');
    expect(getCacheControl('/tmp/data.json')).toBe('public, max-age=300');
  });

  it('computes SHA256 checksums for files', async () => {
    const target = path.join(tempDir, 'hash-test.txt');
    writeFileSync(target, 'hash me');
    const hash = await computeSha256(target);
    expect(hash).toHaveLength(64);
  });

  it('skips upload when remote hash and size match', async () => {
    const fakeS3 = {
      send: vi.fn(async () => ({
        Metadata: { sha256: 'abc123' },
        ContentLength: 128,
      })),
    };

    const result = await shouldSkipUpload(fakeS3, 'bucket', 'key', {
      sha256: 'abc123',
      size: 128,
    });

    expect(result).toEqual({ skip: true, reason: 'Remote object hash + size match' });
  });

  it('does not skip when remote asset missing', async () => {
    const error = new Error('NotFound');
    error.$metadata = { httpStatusCode: 404 };
    const fakeS3 = {
      send: vi.fn(async () => {
        throw error;
      }),
    };

    const result = await shouldSkipUpload(fakeS3, 'bucket', 'key', {
      sha256: 'abc123',
      size: 128,
    });

    expect(result.skip).toBe(false);
  });

  it('runs tasks with limited concurrency while preserving order', async () => {
    const items = [1, 2, 3, 4, 5];
    const order = [];
    const results = await runWithConcurrency(items, 2, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(value);
      return value * 2;
    });

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(order).toHaveLength(5);
  });

  it('sanitizes prefixes and endpoints', () => {
    expect(sanitizePrefix('/prod/audio/')).toBe('prod/audio');
    expect(deriveEndpointFromAccount('abc')).toBe('https://abc.r2.cloudflarestorage.com');
    expect(normalizeEndpoint('https://example.com//path/')).toBe('https://example.com/path');
  });
});
