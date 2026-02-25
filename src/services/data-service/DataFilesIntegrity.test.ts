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
  recognitionEnabled?: boolean;
  photoHashes?: RawHashSet;
}

interface AppDataV2 {
  version: number;
  artists: Array<{ id: string; name: string }>;
  tracks: Array<{ id: string; artistId: string; audioFile: string; songTitle?: string }>;
  photos: Array<{
    id: string;
    artistId: string;
    imageFile?: string;
    recognitionEnabled?: boolean;
    photoHashes?: RawHashSet;
  }>;
  entries: Array<{
    id: number;
    artistId: string;
    trackId: string;
    photoId?: string;
    venue: string;
    date: string;
    recognitionEnabled?: boolean;
  }>;
}

interface RecognitionDataV2 {
  version: number;
  entries: Array<{
    concertId: number;
    phash: string[];
  }>;
}

function loadConcerts(relativePath: string): RawConcert[] {
  const absolutePath = path.resolve(projectRoot, relativePath);
  const contents = readFileSync(absolutePath, 'utf-8');
  const parsed = JSON.parse(contents) as AppDataV2;
  expect(parsed.version).toBe(2);
  expect(Array.isArray(parsed.entries)).toBe(true);

  const artistsById = new Map(parsed.artists.map((artist) => [artist.id, artist]));
  const tracksById = new Map(parsed.tracks.map((track) => [track.id, track]));
  const photosById = new Map(parsed.photos.map((photo) => [photo.id, photo]));

  return parsed.entries.flatMap((entry) => {
    const artist = artistsById.get(entry.artistId);
    const track = tracksById.get(entry.trackId);
    if (!artist || !track) {
      return [];
    }

    const photo = entry.photoId ? photosById.get(entry.photoId) : undefined;

    return [
      {
        id: entry.id,
        band: artist.name,
        venue: entry.venue,
        date: entry.date,
        audioFile: track.audioFile,
        songTitle: track.songTitle,
        imageFile: photo?.imageFile,
        recognitionEnabled: entry.recognitionEnabled ?? photo?.recognitionEnabled,
        photoHashes: photo?.photoHashes,
      },
    ];
  });
}

function loadRecognitionData(relativePath: string): RecognitionDataV2 {
  const absolutePath = path.resolve(projectRoot, relativePath);
  const contents = readFileSync(absolutePath, 'utf-8');
  return JSON.parse(contents) as RecognitionDataV2;
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
  it('public v2 app data has unique ids, local audio files, and hashes for recognizable entries', () => {
    const concerts = loadConcerts('public/data.app.v2.json');
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

      if (concert.recognitionEnabled !== false) {
        expectHashSet(concert.photoHashes);
      }
    });
  });

  it('public v2 recognition data exists and has valid hash entries', () => {
    const recognition = loadRecognitionData('public/data.recognition.v2.json');
    expect(recognition.version).toBe(2);
    expect(Array.isArray(recognition.entries)).toBe(true);
    expect(recognition.entries.length).toBeGreaterThan(0);

    recognition.entries.forEach((entry) => {
      expect(typeof entry.concertId).toBe('number');
      expectHashArray(entry.phash);
    });
  });
});
