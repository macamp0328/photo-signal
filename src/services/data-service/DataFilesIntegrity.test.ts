import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

interface RawHashSet {
  phash?: string[];
}

interface RawConcert {
  id: number;
  band: string;
  venue: string;
  date: string;
  audioFile: string;
  songTitle?: string;
  imageFile?: string;
  photoHashes?: RawHashSet;
}

function loadConcerts(relativePath: string): RawConcert[] {
  const absolutePath = path.resolve(projectRoot, relativePath);
  const contents = readFileSync(absolutePath, 'utf-8');
  const parsed = JSON.parse(contents);
  expect(Array.isArray(parsed.concerts)).toBe(true);
  return parsed.concerts as RawConcert[];
}

function expectHashArray(hashes: string[] | undefined): asserts hashes is string[] {
  expect(hashes, 'phash array should exist').toBeTruthy();
  if (!hashes) {
    throw new Error('phash hash array missing');
  }

  expect(Array.isArray(hashes), 'phash hash should be an array').toBe(true);
  expect(hashes.length, 'phash hash array should not be empty').toBeGreaterThan(0);

  const regex = new RegExp('^[0-9a-f]{16}$', 'i');

  hashes.forEach((value) => {
    expect(typeof value).toBe('string');
    expect(value).toMatch(regex);
  });
}

function expectHashSet(hashSet: RawHashSet | undefined) {
  expect(hashSet, 'photoHashes.phash should be defined').toBeTruthy();
  if (!hashSet) {
    throw new Error('photoHashes missing');
  }

  expectHashArray(hashSet.phash);
}

function ensureFileExists(relativePath: string) {
  const normalized = relativePath.replace(/^\//, '');
  const absolutePath = path.resolve(projectRoot, normalized);
  expect(existsSync(absolutePath)).toBe(true);
}

function isRemoteAsset(assetPath: string): boolean {
  return /^https?:\/\//i.test(assetPath);
}

/**
 * Maps asset paths to their repository-relative locations.
 *
 * Public audio files (e.g., `/audio/sample.opus`) are stored in `public/audio/`
 * at the repository root, while test data assets (e.g., `/assets/test-data/...`)
 * are already repository-relative paths. This function transforms `/audio/*`
 * paths to `public/audio/*` while leaving `/assets/*` paths unchanged.
 *
 * @param assetPath - The asset path from the data file (e.g., `/audio/sample.opus` or `/assets/test-data/image.jpg`)
 * @returns Repository-relative path to the asset file
 */
function getRepositoryRelativeAssetPath(assetPath: string): string {
  if (assetPath.startsWith('/audio/')) {
    return path.join('public', assetPath.replace(/^\//, ''));
  }
  return assetPath;
}

describe('Data files integrity', () => {
  it('public data has unique ids, pHash hashes, and local audio files', () => {
    const concerts = loadConcerts('public/data.json');
    expect(concerts.length).toBeGreaterThanOrEqual(4);
    const seenIds = new Set<number>();

    concerts.forEach((concert) => {
      expect(typeof concert.id).toBe('number');
      expect(seenIds.has(concert.id)).toBe(false);
      seenIds.add(concert.id);

      expect(typeof concert.audioFile).toBe('string');
      if (concert.songTitle !== undefined) {
        expect(typeof concert.songTitle).toBe('string');
      }
      if (!isRemoteAsset(concert.audioFile)) {
        ensureFileExists(getRepositoryRelativeAssetPath(concert.audioFile));
      }

      expectHashSet(concert.photoHashes);
    });
  });
});
