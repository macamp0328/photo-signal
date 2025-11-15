import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

interface RawConcert {
  id: number;
  band: string;
  venue: string;
  date: string;
  audioFile: string;
  imageFile?: string;
  photoHash?: string | string[];
}

function loadConcerts(relativePath: string): RawConcert[] {
  const absolutePath = path.resolve(projectRoot, relativePath);
  const contents = readFileSync(absolutePath, 'utf-8');
  const parsed = JSON.parse(contents);
  expect(Array.isArray(parsed.concerts)).toBe(true);
  return parsed.concerts as RawConcert[];
}

function expectHexHash(hash: string | string[] | undefined) {
  expect(hash, 'photoHash should be defined').toBeTruthy();

  const hashes = Array.isArray(hash) ? hash : [hash];
  expect(hashes.length, 'photoHash array should not be empty').toBeGreaterThan(0);

  hashes.forEach((value) => {
    expect(typeof value).toBe('string');
    expect(value).toMatch(/^[0-9a-f]{32}$/i);
  });
}

function ensureFileExists(relativePath: string) {
  const normalized = relativePath.replace(/^\//, '');
  const absolutePath = path.resolve(projectRoot, normalized);
  expect(existsSync(absolutePath)).toBe(true);
}

describe('Data files integrity', () => {
  it('production data has unique ids, hashes, and local audio files', () => {
    const concerts = loadConcerts('public/data.json');
    expect(concerts.length).toBeGreaterThanOrEqual(4);
    const seenIds = new Set<number>();

    concerts.forEach((concert) => {
      expect(typeof concert.id).toBe('number');
      expect(seenIds.has(concert.id)).toBe(false);
      seenIds.add(concert.id);

      expect(typeof concert.audioFile).toBe('string');
      ensureFileExists(path.join('public', concert.audioFile.replace(/^\//, '')));

      expectHexHash(concert.photoHash);
    });
  });

  it('test data entries reference printable images, audio, and hashes', () => {
    const concerts = loadConcerts('assets/test-data/concerts.json');
    expect(concerts.length).toBeGreaterThanOrEqual(4);

    concerts.forEach((concert) => {
      expectHexHash(concert.photoHash);
      expect(typeof concert.audioFile).toBe('string');
      ensureFileExists(concert.audioFile);

      expect(concert.imageFile, 'imageFile must be defined for test entries').toBeTruthy();
      if (concert.imageFile) {
        ensureFileExists(concert.imageFile);
      }
    });
  });
});
