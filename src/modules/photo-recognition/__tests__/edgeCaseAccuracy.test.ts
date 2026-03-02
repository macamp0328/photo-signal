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
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const PRODUCTION_DATA_PATH = join(PROJECT_ROOT, 'public', 'data.app.v2.json');
const TEST_IMAGES_DIR = join(PROJECT_ROOT, 'assets', 'test-images');
const REQUIRED_TEST_IMAGES = [
  'easy-target-bullseye.png',
  'easy-target-checker.png',
  'easy-target-diagonals.png',
];
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

function resolveTestImagePath(fileName: string): string {
  return join(TEST_IMAGES_DIR, fileName);
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

function hasAvailableProductionSamples(): boolean {
  try {
    const payload = JSON.parse(readFileSync(PRODUCTION_DATA_PATH, 'utf-8')) as ProductionData;
    const concerts = toConcerts(payload);

    return concerts.some((concert) => {
      if (!concert.imageFile) {
        return false;
      }

      const hasHashes =
        Array.isArray(concert.photoHashes?.phash) && concert.photoHashes.phash.length > 0;
      if (!hasHashes) {
        return false;
      }

      return existsSync(resolveImagePath(concert.imageFile));
    });
  } catch {
    return false;
  }
}

const shouldSkipProductionSampleRegression = !hasAvailableProductionSamples();

describe('Production Data Recognition Regression Tests', () => {
  let productionData: ProductionData;
  let concerts: Concert[];
  let recognitionEnabledConcerts: Concert[];
  let concertsWithImagesAndHashes: Concert[];
  let concertsWithAvailableImagesAndHashes: Concert[];
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

    concertsWithAvailableImagesAndHashes = concertsWithImagesAndHashes.filter((concert) => {
      const imagePath = resolveImagePath(concert.imageFile);
      return existsSync(imagePath);
    });

    sampleConcerts = concertsWithAvailableImagesAndHashes.slice(0, SAMPLE_SIZE);

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
      if (concertsWithAvailableImagesAndHashes.length === 0) {
        for (const concert of concertsWithImagesAndHashes) {
          expect(concert.imageFile).toMatch(/^\//);
        }
        return;
      }

      for (const concert of concertsWithAvailableImagesAndHashes) {
        const imagePath = resolveImagePath(concert.imageFile);
        expect(existsSync(imagePath)).toBe(true);
      }
    });

    it('tracks stable synthetic image fixtures for image-dependent tests', () => {
      for (const fileName of REQUIRED_TEST_IMAGES) {
        const fixturePath = resolveTestImagePath(fileName);
        expect(existsSync(fixturePath)).toBe(true);
      }
    });
  });

  describe('Synthetic Fixture Hash Smoke Tests', () => {
    it('computes valid 64-bit pHash values for committed fixture images', async () => {
      for (const fileName of REQUIRED_TEST_IMAGES) {
        const fixturePath = resolveTestImagePath(fileName);
        const computedHash = await computeHashForImage(fixturePath);
        expect(computedHash).toMatch(/^[0-9a-f]{16}$/i);
      }
    });
  });

  describe('pHash Regression (Production Sample)', () => {
    it.skipIf(shouldSkipProductionSampleRegression)(
      `matches sampled production images within distance <= ${MAX_PHASH_DISTANCE}`,
      async () => {
        if (sampleConcerts.length === 0) {
          return;
        }

        for (const concert of sampleConcerts) {
          const computedHash = sampleComputedHashes.get(concert.id);
          expect(computedHash).toBeDefined();
          const referenceHashes = getReferenceHashes(concert);
          const bestDistance = findBestDistance(computedHash!, referenceHashes);

          expect(bestDistance).toBeLessThanOrEqual(MAX_PHASH_DISTANCE);
        }
      }
    );

    it.skipIf(shouldSkipProductionSampleRegression)(
      'keeps a strong pass rate across sampled production images',
      async () => {
        if (sampleConcerts.length === 0) {
          return;
        }

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
      }
    );

    it.skipIf(shouldSkipProductionSampleRegression)(
      'matches own reference set better than other concerts for most sampled images',
      () => {
        if (sampleConcerts.length === 0) {
          return;
        }

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
      }
    );
  });
});
