/**
 * ORB feature extraction utilities for Node-based scripts.
 * Mirrors the browser implementation in src/modules/photo-recognition/algorithms/orb/orb.ts
 */

export const DEFAULT_ORB_CONFIG = {
  maxFeatures: 1000,
  scaleFactor: 1.5,
  nLevels: 8,
  edgeThreshold: 15,
  fastThreshold: 12,
  minMatchCount: 15,
  matchRatioThreshold: 0.75,
};

const FULL_CIRCLE = [
  [0, 3],
  [1, 3],
  [2, 2],
  [3, 1],
  [3, 0],
  [3, -1],
  [2, -2],
  [1, -3],
  [0, -3],
  [-1, -3],
  [-2, -2],
  [-3, -1],
  [-3, 0],
  [-3, 1],
  [-2, 2],
  [-1, 3],
];

export const LCG_MULTIPLIER = 1103515245;
export const LCG_INCREMENT = 12345;
export const LCG_MODULUS = 0x7fffffff;

const BRIEF_TEST_PATTERN = (() => {
  const tests = [];
  const numTests = 256;
  const halfPatch = Math.floor(31 / 2);

  let seed = 12345;
  const seededRandom = () => {
    seed = (seed * LCG_MULTIPLIER + LCG_INCREMENT) & LCG_MODULUS;
    return seed / LCG_MODULUS;
  };

  for (let i = 0; i < numTests; i++) {
    const x1 = Math.floor((seededRandom() * 2 - 1) * halfPatch);
    const y1 = Math.floor((seededRandom() * 2 - 1) * halfPatch);
    const x2 = Math.floor((seededRandom() * 2 - 1) * halfPatch);
    const y2 = Math.floor((seededRandom() * 2 - 1) * halfPatch);
    tests.push([x1, y1, x2, y2]);
  }

  return tests;
})();

function detectFASTCorners(gray, width, height, threshold) {
  const keypoints = [];

  for (let y = 3; y < height - 3; y++) {
    for (let x = 3; x < width - 3; x++) {
      const centerIdx = y * width + x;
      const centerVal = gray[centerIdx];

      let numBrighter = 0;
      let numDarker = 0;

      for (const [dx, dy] of FULL_CIRCLE) {
        const idx = (y + dy) * width + (x + dx);
        const val = gray[idx];

        if (val > centerVal + threshold) {
          numBrighter++;
        } else if (val < centerVal - threshold) {
          numDarker++;
        }
      }

      if (numBrighter >= 12 || numDarker >= 12) {
        let response = 0;
        for (const [dx, dy] of FULL_CIRCLE) {
          const idx = (y + dy) * width + (x + dx);
          response += Math.abs(gray[idx] - centerVal);
        }

        keypoints.push({
          x,
          y,
          angle: 0,
          response: response / 16,
          octave: 0,
          size: 7,
        });
      }
    }
  }

  return keypoints;
}

function computeKeypointOrientation(keypoint, gray, width, height, radius = 15) {
  let mx = 0;
  let my = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) {
        continue;
      }

      const x = Math.round(keypoint.x + dx);
      const y = Math.round(keypoint.y + dy);

      if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) {
        continue;
      }

      const idx = y * width + x;
      mx += dx * gray[idx];
      my += dy * gray[idx];
    }
  }

  return Math.atan2(my, mx);
}

function extractBRIEFDescriptor(keypoint, gray, width, height) {
  const descriptor = new Uint8Array(32);
  const cos = Math.cos(keypoint.angle);
  const sin = Math.sin(keypoint.angle);

  for (let i = 0; i < BRIEF_TEST_PATTERN.length; i++) {
    const [x1, y1, x2, y2] = BRIEF_TEST_PATTERN[i];

    const rx1 = Math.round(x1 * cos - y1 * sin + keypoint.x);
    const ry1 = Math.round(x1 * sin + y1 * cos + keypoint.y);
    const rx2 = Math.round(x2 * cos - y2 * sin + keypoint.x);
    const ry2 = Math.round(x2 * sin + y2 * cos + keypoint.y);

    if (
      rx1 < 0 ||
      rx1 >= width ||
      ry1 < 0 ||
      ry1 >= height ||
      rx2 < 0 ||
      rx2 >= width ||
      ry2 < 0 ||
      ry2 >= height
    ) {
      continue;
    }

    const val1 = gray[ry1 * width + rx1];
    const val2 = gray[ry2 * width + rx2];

    if (val1 < val2) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      descriptor[byteIdx] |= 1 << bitIdx;
    }
  }

  return descriptor;
}

export function extractORBFeatures(imageData, config = {}) {
  if (!imageData || !imageData.data) {
    throw new Error('Invalid ImageData supplied to extractORBFeatures');
  }

  const cfg = { ...DEFAULT_ORB_CONFIG, ...config };
  const { width, height, data } = imageData;

  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  let keypoints = detectFASTCorners(gray, width, height, cfg.fastThreshold);
  keypoints.sort((a, b) => b.response - a.response);
  keypoints = keypoints.slice(0, cfg.maxFeatures);

  for (const kp of keypoints) {
    kp.angle = computeKeypointOrientation(kp, gray, width, height);
  }

  const descriptors = keypoints.map((kp) => extractBRIEFDescriptor(kp, gray, width, height));

  return {
    keypoints,
    descriptors,
  };
}

function round(value, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function encodeDescriptor(descriptor) {
  return Buffer.from(descriptor).toString('base64');
}

export function serializeORBFeatures(imageData, features, config = {}) {
  if (!features || !Array.isArray(features.keypoints)) {
    throw new Error('serializeORBFeatures requires ORB features');
  }

  const cfg = { ...DEFAULT_ORB_CONFIG, ...config };
  const payload = {
    version: 1,
    imageSize: [imageData.width, imageData.height],
    descriptorLength: features.descriptors[0]?.length ?? 0,
    keypoints: features.keypoints.map((kp) => [
      round(kp.x, 3),
      round(kp.y, 3),
      round(kp.angle, 4),
      round(kp.response, 4),
      round(kp.octave ?? 0, 2),
      round(kp.size ?? 0, 2),
    ]),
    descriptors: features.descriptors.map((descriptor) => encodeDescriptor(descriptor)),
    config: {
      maxFeatures: cfg.maxFeatures,
      fastThreshold: cfg.fastThreshold,
      minMatchCount: cfg.minMatchCount,
      matchRatioThreshold: cfg.matchRatioThreshold,
    },
  };

  return payload;
}
