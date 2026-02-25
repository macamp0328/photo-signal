/**
 * Production Data Recognition Regression Tests
 *
 * Uses canonical production `public/data.app.v2.json` and production image assets to
 * validate that core recognition inputs remain healthy and that pHash matching
 * still works for representative real photos.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createCanvas, loadImage } from 'canvas';
import { computePHash } from '../algorithms/phash';
import { hammingDistance } from '../algorithms/hamming';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const PRODUCTION_DATA_PATH = join(PROJECT_ROOT, 'public', 'data.app.v2.json');
const SAMPLE_SIZE = 12;
const MAX_PHASH_DISTANCE = 48;
const MIN_DISCRIMINATION_PASS_RATE = 75;

interface Concert {
  id: number;
  band: string;
  imageFile: string;
  recognitionEnabled?: boolean;
  photoHashes?: {
    phash?: string[];
  };
  audioFile?: string;
}

interface ProductionData {
  version: 2;
  artists: Array<{ id: string; name: string }>;
  tracks: Array<{ id: string; artistId: string; audioFile: string; songTitle?: string }>;
  photos: Array<{
    id: string;
    artistId: string;
    imageFile?: string;
    recognitionEnabled?: boolean;
    photoHashes?: { phash?: string[] };
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

async function loadProductionData(): Promise<ProductionData> {
  const data = await readFile(PRODUCTION_DATA_PATH, 'utf-8');
  return JSON.parse(data);
}

function toConcerts(payload: ProductionData): Concert[] {
  const artistsById = new Map(payload.artists.map((artist) => [artist.id, artist]));
  const photosById = new Map(payload.photos.map((photo) => [photo.id, photo]));

  return payload.entries.flatMap((entry) => {
    const artist = artistsById.get(entry.artistId);
    if (!artist) {
      return [];
    }

    const photo = entry.photoId ? photosById.get(entry.photoId) : undefined;

    return [
      {
        id: entry.id,
        band: artist.name,
        imageFile: photo?.imageFile ?? '',
        recognitionEnabled: entry.recognitionEnabled ?? photo?.recognitionEnabled,
        photoHashes: photo?.photoHashes,
      },
    ];
  });
}

function resolveImagePath(imageFile: string): string {
  return join(PROJECT_ROOT, imageFile.replace(/^\/+/, ''));
}

async function computeHashForImage(imagePath: string): Promise<string> {
  const image = await loadImage(imagePath);

  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return computePHash(imageData as unknown as ImageData);
}

function findBestDistance(testHash: string, referenceHashes: string[]): number {
  let bestDistance = Infinity;
  for (const refHash of referenceHashes) {
    bestDistance = Math.min(bestDistance, hammingDistance(testHash, refHash));
  }
  return bestDistance;
}

function getReferenceHashes(concert: Concert): string[] {
  const hashes = concert.photoHashes?.phash ?? [];
  if (!Array.isArray(hashes) || hashes.length === 0) {
    throw new Error(`Missing photoHashes.phash for concert ${concert.id}`);
  }
  return hashes;
}

describe('Production Data Recognition Regression Tests', () => {
  let productionData: ProductionData;
  let concerts: Concert[];
  let recognitionEnabledConcerts: Concert[];
  let concertsWithImagesAndHashes: Concert[];
  let sampleConcerts: Concert[];
  const sampleComputedHashes = new Map<number, string>();

  beforeAll(async () => {
    productionData = await loadProductionData();
    concerts = toConcerts(productionData);
    recognitionEnabledConcerts = concerts.filter((concert) => concert.recognitionEnabled !== false);
    concertsWithImagesAndHashes = recognitionEnabledConcerts.filter(
      (concert) =>
        Boolean(concert.imageFile) &&
        Array.isArray(concert.photoHashes?.phash) &&
        (concert.photoHashes?.phash?.length ?? 0) > 0
    );

    sampleConcerts = concertsWithImagesAndHashes.slice(0, SAMPLE_SIZE);

    for (const concert of sampleConcerts) {
      const imagePath = resolveImagePath(concert.imageFile);
      const computedHash = await computeHashForImage(imagePath);
      sampleComputedHashes.set(concert.id, computedHash);
    }
  });

  describe('Dataset Validation', () => {
    it('loads production data with concerts', () => {
      expect(productionData).toBeDefined();
      expect(productionData.version).toBe(2);
      expect(Array.isArray(concerts)).toBe(true);
      expect(concerts.length).toBeGreaterThan(0);
    });

    it('has imageFile + pHash references for production concerts', () => {
      expect(concertsWithImagesAndHashes.length).toBeGreaterThan(0);
      expect(concertsWithImagesAndHashes.length).toBe(recognitionEnabledConcerts.length);
    });

    it('uses stable pHash format in production data', () => {
      for (const concert of concertsWithImagesAndHashes) {
        const hashes = getReferenceHashes(concert);
        for (const hash of hashes) {
          expect(hash).toMatch(/^[0-9a-f]{16}$/i);
        }
      }
    });

    it('keeps unique concert ids', () => {
      const ids = concerts.map((concert) => concert.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('resolves production image files from v2 photo paths', () => {
      for (const concert of concertsWithImagesAndHashes) {
        const imagePath = resolveImagePath(concert.imageFile);
        expect(existsSync(imagePath)).toBe(true);
      }
    });
  });

  describe('pHash Regression (Production Sample)', () => {
    it(`matches sampled production images within distance <= ${MAX_PHASH_DISTANCE}`, async () => {
      expect(sampleConcerts.length).toBeGreaterThan(0);

      for (const concert of sampleConcerts) {
        const computedHash = sampleComputedHashes.get(concert.id);
        expect(computedHash).toBeDefined();
        const referenceHashes = getReferenceHashes(concert);
        const bestDistance = findBestDistance(computedHash!, referenceHashes);

        expect(bestDistance).toBeLessThanOrEqual(MAX_PHASH_DISTANCE);
      }
    });

    it('keeps a strong pass rate across sampled production images', async () => {
      let passing = 0;

      for (const concert of sampleConcerts) {
        const computedHash = sampleComputedHashes.get(concert.id);
        expect(computedHash).toBeDefined();
        const referenceHashes = getReferenceHashes(concert);
        const bestDistance = findBestDistance(computedHash!, referenceHashes);

        if (bestDistance <= MAX_PHASH_DISTANCE) {
          passing += 1;
        }
      }

      const passRate = (passing / sampleConcerts.length) * 100;
      expect(passRate).toBeGreaterThanOrEqual(90);
    });

    it('matches own reference set better than other concerts for most sampled images', () => {
      let ownBestWins = 0;

      for (const concert of sampleConcerts) {
        const computedHash = sampleComputedHashes.get(concert.id);
        expect(computedHash).toBeDefined();

        const ownBestDistance = findBestDistance(computedHash!, getReferenceHashes(concert));

        let nearestOtherDistance = Infinity;
        for (const otherConcert of sampleConcerts) {
          if (otherConcert.id === concert.id) {
            continue;
          }
          const candidateDistance = findBestDistance(
            computedHash!,
            getReferenceHashes(otherConcert)
          );
          nearestOtherDistance = Math.min(nearestOtherDistance, candidateDistance);
        }

        if (ownBestDistance <= nearestOtherDistance) {
          ownBestWins += 1;
        }
      }

      const discriminationRate = (ownBestWins / sampleConcerts.length) * 100;
      expect(discriminationRate).toBeGreaterThanOrEqual(MIN_DISCRIMINATION_PASS_RATE);
    });
  });
});
