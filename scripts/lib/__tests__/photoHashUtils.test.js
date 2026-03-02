import { createCanvas } from 'canvas';
import { describe, expect, it } from 'vitest';
import {
  hammingDistanceHex,
  dedupeNearDuplicateHashes,
  createExposureAndRotationVariants,
  computePHash,
  generateHashVariants,
  createExposureVariants,
} from '../photoHashUtils.js';

function makeImageData(width = 16, height = 16) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const shade = (i / 4) % 256;
    imageData.data[i] = shade;
    imageData.data[i + 1] = (shade * 3) % 256;
    imageData.data[i + 2] = (shade * 5) % 256;
    imageData.data[i + 3] = 255;
  }

  return imageData;
}

describe('hammingDistanceHex', () => {
  it('returns 0 for identical hashes', () => {
    expect(hammingDistanceHex('0123456789abcdef', '0123456789abcdef')).toBe(0);
  });

  it('counts bit differences across hex nibbles', () => {
    expect(hammingDistanceHex('0000000000000000', '0000000000000001')).toBe(1);
    expect(hammingDistanceHex('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });
});

describe('dedupeNearDuplicateHashes', () => {
  it('removes exact and near duplicates using threshold', () => {
    const hashes = ['0000000000000000', '0000000000000000', '0000000000000001', 'ffffffffffffffff'];

    expect(dedupeNearDuplicateHashes(hashes, 1)).toEqual(['0000000000000000', 'ffffffffffffffff']);
    expect(dedupeNearDuplicateHashes(hashes, 0)).toEqual([
      '0000000000000000',
      '0000000000000001',
      'ffffffffffffffff',
    ]);
  });
});

describe('createExposureAndRotationVariants', () => {
  it('creates base + rotation variants per exposure', () => {
    const imageData = makeImageData();

    const variants = createExposureAndRotationVariants(imageData, [1.0, 0.7], [-8, 8]);

    expect(variants).toHaveLength(6);
    expect(variants[0]).toBe(imageData);
  });

  it('produces hashes that can be deduped conservatively', () => {
    const imageData = makeImageData();
    const variants = createExposureAndRotationVariants(imageData, [1.0], [-8, 8]);
    const hashes = variants.map((variant) => computePHash(variant));

    const deduped = dedupeNearDuplicateHashes(hashes, 1);

    expect(deduped.length).toBeGreaterThan(0);
    expect(deduped.length).toBeLessThanOrEqual(hashes.length);
  });
});

describe('generateHashVariants', () => {
  it('matches base exposure output when rotation angles are disabled', () => {
    const imageData = makeImageData();
    const exposureVariants = createExposureVariants(imageData, [2.0, 1.4, 1.0, 0.7, 0.5]);
    const basePHashes = exposureVariants.map((variant) => computePHash(variant));
    const expected = dedupeNearDuplicateHashes(basePHashes, 1);

    const generated = generateHashVariants(imageData, [2.0, 1.4, 1.0, 0.7, 0.5], {
      rotationAngles: [],
      nearDupHammingThreshold: 1,
    });

    expect(generated.phash).toEqual(expected);
  });

  it('retains fewer rotated hashes when dedup threshold increases', () => {
    const imageData = makeImageData(48, 48);

    const lowThreshold = generateHashVariants(imageData, [1.0], {
      rotationAngles: [-8, 8],
      nearDupHammingThreshold: 0,
    });
    const highThreshold = generateHashVariants(imageData, [1.0], {
      rotationAngles: [-8, 8],
      nearDupHammingThreshold: 4,
    });

    expect(highThreshold.phash.length).toBeLessThanOrEqual(lowThreshold.phash.length);
    expect(highThreshold.dhash.length).toBeLessThanOrEqual(lowThreshold.dhash.length);
  });
});
