/**
 * Manifest-driven phone sample recognition regression tests
 *
 * Validates that `assets/test-videos/phone-samples/samples.manifest.json` is
 * wired to production recognition data and that pHash matching discriminates
 * expected concert targets across all manifest captures.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas, loadImage } from 'canvas';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { computePHash } from '../algorithms/phash';
import { hammingDistance } from '../algorithms/hamming';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');

const MANIFEST_PATH = join(
  PROJECT_ROOT,
  'assets',
  'test-videos',
  'phone-samples',
  'samples.manifest.json'
);
const PHONE_SAMPLES_DIR = join(PROJECT_ROOT, 'assets', 'test-videos', 'phone-samples');
const APP_DATA_PATH = join(PROJECT_ROOT, 'public', 'data.app.v2.json');

// Thresholds are empirically tuned against the current phone-samples manifest.
// Re-baseline only when sample data changes materially or when pHash matching
// implementation changes shift expected Hamming distance variance.
const MAX_TARGET_DISTANCE = 48;
const MIN_DISCRIMINATION_PASS_RATE = 75;

interface ManifestCapture {
  captureId: string;
  concertId: number;
  photoId: string;
}

interface ManifestSample {
  sampleId: string;
  filename: string;
  captures: ManifestCapture[];
}

interface ManifestPayload {
  version: number;
  samples: ManifestSample[];
}

interface AppDataPayload {
  entries: Array<{
    id: number;
    photoId?: string;
    trackId: string;
    recognitionEnabled?: boolean;
  }>;
  tracks: Array<{
    id: string;
    audioFile?: string;
  }>;
  photos: Array<{
    id: string;
    imageFile?: string;
    recognitionEnabled?: boolean;
    photoHashes?: {
      phash?: string[];
    };
  }>;
}

interface ManifestCaptureTarget {
  key: string;
  sampleId: string;
  captureId: string;
  filename: string;
  concertId: number;
  photoId: string;
  imageFile: string;
  referenceHashes: string[];
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

function resolveImagePath(imageFile: string): string {
  return join(PROJECT_ROOT, imageFile.replace(/^\/+/, ''));
}

function minDistance(hash: string, references: string[]): number {
  return references.reduce(
    (best, candidate) => Math.min(best, hammingDistance(hash, candidate)),
    Infinity
  );
}

async function computeHashForImage(imagePath: string): Promise<string> {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return computePHash(imageData as Parameters<typeof computePHash>[0]);
}

describe('Phone Sample Manifest Recognition Regression', () => {
  let manifest: ManifestPayload;
  let appData: AppDataPayload;
  let captureTargets: ManifestCaptureTarget[];
  let uniqueTargets: ManifestCaptureTarget[];
  const computedHashesByPhotoId = new Map<string, string>();

  beforeAll(async () => {
    manifest = loadJson<ManifestPayload>(MANIFEST_PATH);
    appData = loadJson<AppDataPayload>(APP_DATA_PATH);

    const entryById = new Map(appData.entries.map((entry) => [entry.id, entry]));
    const photoById = new Map(appData.photos.map((photo) => [photo.id, photo]));
    const trackById = new Map(appData.tracks.map((track) => [track.id, track]));

    captureTargets = manifest.samples.flatMap((sample) => {
      if (!Array.isArray(sample.captures) || sample.captures.length === 0) {
        throw new Error(`Manifest sample ${sample.sampleId} has no captures`);
      }

      return sample.captures.map((capture) => {
        const entry = entryById.get(capture.concertId);
        if (!entry) {
          throw new Error(
            `Manifest sample ${sample.sampleId} capture ${capture.captureId} references missing concertId ${capture.concertId}`
          );
        }

        if (String(entry.photoId) !== String(capture.photoId)) {
          throw new Error(
            `Manifest sample ${sample.sampleId} capture ${capture.captureId} photo mismatch: entry.photoId=${entry.photoId}, capture.photoId=${capture.photoId}`
          );
        }

        if (entry.recognitionEnabled === false) {
          throw new Error(
            `Manifest sample ${sample.sampleId} capture ${capture.captureId} maps to recognition-disabled concert ${entry.id}`
          );
        }

        const track = trackById.get(entry.trackId);
        if (!track?.audioFile) {
          throw new Error(
            `Manifest sample ${sample.sampleId} capture ${capture.captureId} maps to concert ${entry.id} without audioFile`
          );
        }

        const photo = photoById.get(capture.photoId);
        const hashes = photo?.photoHashes?.phash ?? [];

        if (photo?.recognitionEnabled === false) {
          throw new Error(
            `Manifest sample ${sample.sampleId} capture ${capture.captureId} maps to recognition-disabled photo ${capture.photoId}`
          );
        }

        if (!photo?.imageFile) {
          throw new Error(
            `Manifest sample ${sample.sampleId} capture ${capture.captureId} maps to photo ${capture.photoId} without imageFile`
          );
        }

        if (!Array.isArray(hashes) || hashes.length === 0) {
          throw new Error(
            `Manifest sample ${sample.sampleId} capture ${capture.captureId} maps to photo ${capture.photoId} without pHash`
          );
        }

        return {
          key: `${sample.sampleId}:${capture.captureId}`,
          sampleId: sample.sampleId,
          captureId: capture.captureId,
          filename: sample.filename,
          concertId: capture.concertId,
          photoId: capture.photoId,
          imageFile: photo.imageFile,
          referenceHashes: hashes,
        };
      });
    });

    const uniqueByPhoto = new Map<string, ManifestCaptureTarget>();
    for (const target of captureTargets) {
      if (!uniqueByPhoto.has(target.photoId)) {
        uniqueByPhoto.set(target.photoId, target);
      }
    }

    uniqueTargets = Array.from(uniqueByPhoto.values());

    await Promise.all(
      uniqueTargets.map(async (target) => {
        const imagePath = resolveImagePath(target.imageFile);
        if (!existsSync(imagePath)) {
          throw new Error(`Mapped image for target ${target.key} is missing: ${imagePath}`);
        }

        const computedHash = await computeHashForImage(imagePath);
        computedHashesByPhotoId.set(target.photoId, computedHash);
      })
    );
  });

  it('loads a v2 manifest with committed phone sample files', () => {
    expect(manifest.version).toBe(2);
    expect(Array.isArray(manifest.samples)).toBe(true);
    expect(manifest.samples.length).toBeGreaterThanOrEqual(2);

    for (const sample of manifest.samples) {
      expect(sample.sampleId).toBeTruthy();
      expect(sample.filename).toBeTruthy();
      expect(Array.isArray(sample.captures)).toBe(true);
      expect(sample.captures.length).toBeGreaterThan(0);

      const samplePath = join(PHONE_SAMPLES_DIR, sample.filename);
      expect(existsSync(samplePath)).toBe(true);
    }
  });

  it('keeps all manifest captures wired to valid app data entries', () => {
    expect(captureTargets.length).toBeGreaterThanOrEqual(2);

    for (const target of captureTargets) {
      expect(target.captureId).toMatch(/^\d+$/);
      expect(target.concertId).toBeGreaterThan(0);
      expect(target.photoId).toMatch(/^photo-/);
      expect(target.imageFile).toMatch(/^\//);
      expect(target.referenceHashes.length).toBeGreaterThan(0);
      for (const hash of target.referenceHashes) {
        expect(hash).toMatch(/^[0-9a-f]{16}$/i);
      }
    }
  });

  it(`matches each manifest capture target image within distance <= ${MAX_TARGET_DISTANCE}`, () => {
    for (const target of captureTargets) {
      const computedHash = computedHashesByPhotoId.get(target.photoId);
      expect(computedHash).toBeDefined();

      const targetDistance = minDistance(computedHash!, target.referenceHashes);
      expect(targetDistance).toBeLessThanOrEqual(MAX_TARGET_DISTANCE);
    }
  });

  it('discriminates own target against other unique targets at strong pass rate', () => {
    let ownBestWins = 0;

    for (const target of uniqueTargets) {
      const computedHash = computedHashesByPhotoId.get(target.photoId);
      expect(computedHash).toBeDefined();

      const ownDistance = minDistance(computedHash!, target.referenceHashes);

      let nearestOther = Infinity;
      for (const other of uniqueTargets) {
        if (other.photoId === target.photoId) {
          continue;
        }
        nearestOther = Math.min(nearestOther, minDistance(computedHash!, other.referenceHashes));
      }

      if (ownDistance <= nearestOther) {
        ownBestWins += 1;
      }
    }

    const passRate = (ownBestWins / uniqueTargets.length) * 100;
    expect(passRate).toBeGreaterThanOrEqual(MIN_DISCRIMINATION_PASS_RATE);
  });
});
