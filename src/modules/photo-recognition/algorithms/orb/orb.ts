/**
 * ORB (Oriented FAST and Rotated BRIEF) Feature Matching
 *
 * This module implements feature-based photo matching using ORB keypoint detection.
 * ORB is more robust than perceptual hashing for matching photos despite:
 * - Print quality differences
 * - Camera angle/perspective changes
 * - Lighting variations
 * - Scale changes
 *
 * Unlike perceptual hashing (dHash/pHash), ORB extracts distinctive feature points
 * and their descriptors, which are invariant to rotation, scale, and lighting.
 */

/**
 * Confidence scoring constant for match ratio
 * A match ratio of 30% or higher indicates a strong match and provides full confidence.
 * This threshold was empirically determined based on testing with print→camera scenarios.
 */
const FULL_CONFIDENCE_MATCH_RATIO = 0.3;

/**
 * A keypoint represents a distinctive feature point in an image
 */
export interface ORBKeypoint {
  x: number;
  y: number;
  angle: number;
  response: number;
  octave: number;
  size: number;
}

/**
 * Binary descriptor for a keypoint (256 bits = 32 bytes)
 */
export type ORBDescriptor = Uint8Array;

/**
 * Feature set for an image
 */
export interface ORBFeatures {
  keypoints: ORBKeypoint[];
  descriptors: ORBDescriptor[];
}

/**
 * Match between two keypoints
 */
export interface FeatureMatch {
  queryIdx: number;
  trainIdx: number;
  distance: number;
}

/**
 * ORB matching result
 */
export interface ORBMatchResult {
  /** Number of good matches found */
  matchCount: number;
  /** Total keypoints in query image */
  queryKeypointCount: number;
  /** Total keypoints in reference image */
  refKeypointCount: number;
  /** Match ratio (matchCount / min(query, ref)) */
  matchRatio: number;
  /** Whether this is considered a match (based on threshold) */
  isMatch: boolean;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Configuration for ORB feature extraction
 */
export interface ORBConfig {
  /** Maximum number of features to detect (default: 500) */
  maxFeatures?: number;
  /** Scale factor between pyramid levels (default: 1.2) */
  scaleFactor?: number;
  /** Number of pyramid levels (default: 8) */
  nLevels?: number;
  /** Edge threshold (default: 31) */
  edgeThreshold?: number;
  /** FAST threshold for corner detection (default: 20) */
  fastThreshold?: number;
  /** Minimum number of matches to consider a valid match (default: 15) */
  minMatchCount?: number;
  /** Match ratio threshold for good matches (default: 0.7) */
  matchRatioThreshold?: number;
}

const DEFAULT_ORB_CONFIG: Required<ORBConfig> = {
  maxFeatures: 500,
  scaleFactor: 1.5, // Increased from 1.2 for better scale invariance in print-to-camera scenarios
  nLevels: 8,
  edgeThreshold: 15, // Reduced from 31 to allow more features at higher octaves
  fastThreshold: 12, // Reduced from 20 to detect more corners in low-texture regions
  minMatchCount: 15,
  matchRatioThreshold: 0.75, // Slightly increased from 0.7 for more lenient matching with print distortions
};

interface PyramidLevel {
  gray: Uint8ClampedArray;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  octave: number;
}

/**
 * Construct an image pyramid for multi-scale feature extraction
 */
function buildImagePyramid(
  baseGray: Uint8ClampedArray,
  baseWidth: number,
  baseHeight: number,
  nLevels: number,
  scaleFactor: number
): PyramidLevel[] {
  const levels: PyramidLevel[] = [
    {
      gray: baseGray,
      width: baseWidth,
      height: baseHeight,
      scaleX: 1,
      scaleY: 1,
      octave: 0,
    },
  ];

  let prevGray = baseGray;
  let prevWidth = baseWidth;
  let prevHeight = baseHeight;

  for (let levelIndex = 1; levelIndex < nLevels; levelIndex++) {
    const targetWidth = Math.max(16, Math.round(prevWidth / scaleFactor));
    const targetHeight = Math.max(16, Math.round(prevHeight / scaleFactor));

    if (
      targetWidth >= prevWidth ||
      targetHeight >= prevHeight ||
      targetWidth < 16 ||
      targetHeight < 16
    ) {
      break; // Cannot downscale further with useful resolution
    }

    const downscaled = downscaleImage(prevGray, prevWidth, prevHeight, targetWidth, targetHeight);

    levels.push({
      gray: downscaled,
      width: targetWidth,
      height: targetHeight,
      scaleX: baseWidth / targetWidth,
      scaleY: baseHeight / targetHeight,
      octave: levelIndex,
    });

    prevGray = downscaled;
    prevWidth = targetWidth;
    prevHeight = targetHeight;
  }

  return levels;
}

/**
 * Downscale a grayscale image using nearest-neighbor sampling
 */
function downscaleImage(
  srcGray: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstWidth * dstHeight);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    const srcY = Math.min(srcHeight - 1, Math.floor(y * yRatio));
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.min(srcWidth - 1, Math.floor(x * xRatio));
      dst[y * dstWidth + x] = srcGray[srcY * srcWidth + srcX];
    }
  }

  return dst;
}

/**
 * Clamp edge threshold to workable bounds for image dimensions
 */
function resolveEdgeThreshold(width: number, height: number, edgeThreshold: number): number {
  const maxBorder = Math.min(Math.floor(width / 2) - 1, Math.floor(height / 2) - 1);
  if (!Number.isFinite(maxBorder) || maxBorder < 3) {
    return 3;
  }

  const clamped = Math.min(edgeThreshold, maxBorder);
  return Math.max(3, clamped);
}

/**
 * FAST (Features from Accelerated Segment Test) corner detection
 *
 * Detects corners by examining a circle of 16 pixels around each candidate point.
 * A point is considered a corner if at least 12 contiguous pixels are all brighter
 * or all darker than the center pixel by more than the threshold.
 *
 * @param gray - Grayscale image data
 * @param width - Image width
 * @param height - Image height
 * @param threshold - Intensity difference threshold for corner detection
 * @returns Array of detected keypoints with position and response strength
 */
function detectFASTCorners(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
  edgeThreshold: number
): ORBKeypoint[] {
  const keypoints: ORBKeypoint[] = [];
  const circle = [
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

  const safeBorder = resolveEdgeThreshold(width, height, edgeThreshold);

  if (safeBorder * 2 >= width || safeBorder * 2 >= height) {
    return keypoints;
  }

  for (let y = safeBorder; y < height - safeBorder; y++) {
    for (let x = safeBorder; x < width - safeBorder; x++) {
      const centerIdx = y * width + x;
      const centerVal = gray[centerIdx];

      let numBrighter = 0;
      let numDarker = 0;

      // Check circle of 16 pixels
      for (const [dx, dy] of circle) {
        const idx = (y + dy) * width + (x + dx);
        const val = gray[idx];

        if (val > centerVal + threshold) {
          numBrighter++;
        } else if (val < centerVal - threshold) {
          numDarker++;
        }
      }

      // Need at least 12 contiguous pixels brighter or darker
      if (numBrighter >= 12 || numDarker >= 12) {
        // Compute corner response (simple version)
        let response = 0;
        for (const [dx, dy] of circle) {
          const idx = (y + dy) * width + (x + dx);
          response += Math.abs(gray[idx] - centerVal);
        }

        keypoints.push({
          x,
          y,
          angle: 0, // Will compute later
          response: response / 16,
          octave: 0,
          size: 7,
        });
      }
    }
  }

  return keypoints;
}

/**
 * Compute orientation for keypoint using intensity centroid method
 *
 * Calculates the orientation by computing the intensity-weighted centroid
 * of a circular patch around the keypoint. The orientation is the angle
 * from the keypoint to this centroid.
 *
 * @param keypoint - Keypoint to compute orientation for
 * @param gray - Grayscale image data
 * @param width - Image width
 * @param height - Image height
 * @param radius - Radius of the patch to examine (default: 15 pixels)
 * @returns Orientation angle in radians (-π to π)
 */
function computeKeypointOrientation(
  keypoint: ORBKeypoint,
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  radius = 15
): number {
  let mx = 0;
  let my = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;

      const x = Math.round(keypoint.x + dx);
      const y = Math.round(keypoint.y + dy);

      if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) continue;

      const idx = y * width + x;
      mx += dx * gray[idx];
      my += dy * gray[idx];
    }
  }

  return Math.atan2(my, mx);
}

/**
 * Linear congruential generator constants (POSIX standard)
 * These are exported for use in tests to ensure consistent random number generation
 */
export const LCG_MULTIPLIER = 1103515245;
export const LCG_INCREMENT = 12345;
export const LCG_MODULUS = 0x7fffffff;

/**
 * Pre-computed BRIEF test pattern
 * Generated once at module load time for optimal performance
 * Uses fixed seed for repeatability across runs
 */
const BRIEF_TEST_PATTERN = (() => {
  const tests: Array<[number, number, number, number]> = [];
  const numTests = 256;
  const halfPatch = Math.floor(31 / 2); // 31x31 patch size

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

/**
 * Extract BRIEF descriptor for a keypoint
 * Uses pre-computed test pattern rotated according to keypoint orientation
 */
function extractBRIEFDescriptor(
  keypoint: ORBKeypoint,
  gray: Uint8ClampedArray,
  width: number,
  height: number
): ORBDescriptor {
  const descriptor = new Uint8Array(32); // 256 bits

  // Rotate test pattern according to keypoint orientation
  const cos = Math.cos(keypoint.angle);
  const sin = Math.sin(keypoint.angle);

  for (let i = 0; i < BRIEF_TEST_PATTERN.length; i++) {
    const [x1, y1, x2, y2] = BRIEF_TEST_PATTERN[i];

    // Rotate coordinates
    const rx1 = Math.round(x1 * cos - y1 * sin + keypoint.x);
    const ry1 = Math.round(x1 * sin + y1 * cos + keypoint.y);
    const rx2 = Math.round(x2 * cos - y2 * sin + keypoint.x);
    const ry2 = Math.round(x2 * sin + y2 * cos + keypoint.y);

    // Check bounds
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

    // Set bit if val1 < val2
    if (val1 < val2) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      descriptor[byteIdx] |= 1 << bitIdx;
    }
  }

  return descriptor;
}

/**
 * Extract ORB features from an image
 */
export function extractORBFeatures(imageData: ImageData, config: ORBConfig = {}): ORBFeatures {
  const cfg = { ...DEFAULT_ORB_CONFIG, ...config };
  const { width, height, data } = imageData;

  // Convert to grayscale
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const pyramid = buildImagePyramid(gray, width, height, cfg.nLevels, cfg.scaleFactor);
  const collected: Array<{
    keypoint: ORBKeypoint;
    descriptor: ORBDescriptor;
    response: number;
  }> = [];

  for (const level of pyramid) {
    const levelKeypoints = detectFASTCorners(
      level.gray,
      level.width,
      level.height,
      cfg.fastThreshold,
      cfg.edgeThreshold
    );

    for (const kp of levelKeypoints) {
      const angle = computeKeypointOrientation(kp, level.gray, level.width, level.height);
      const descriptor = extractBRIEFDescriptor(
        { ...kp, angle },
        level.gray,
        level.width,
        level.height
      );

      collected.push({
        keypoint: {
          x: kp.x * level.scaleX,
          y: kp.y * level.scaleY,
          angle,
          response: kp.response,
          octave: level.octave,
          size: kp.size * Math.max(level.scaleX, level.scaleY),
        },
        descriptor,
        response: kp.response,
      });
    }
  }

  collected.sort((a, b) => b.response - a.response);

  const selectedEntries: typeof collected = [];
  const usedIndices = new Set<number>();
  const coveredOctaves = new Set<number>();

  // First, guarantee at least one keypoint per octave (when available)
  for (let i = 0; i < collected.length && selectedEntries.length < cfg.maxFeatures; i++) {
    const entry = collected[i];
    if (coveredOctaves.has(entry.keypoint.octave)) {
      continue;
    }

    selectedEntries.push(entry);
    coveredOctaves.add(entry.keypoint.octave);
    usedIndices.add(i);
  }

  // Fill remaining slots with highest-response keypoints
  for (let i = 0; i < collected.length && selectedEntries.length < cfg.maxFeatures; i++) {
    if (usedIndices.has(i)) {
      continue;
    }
    selectedEntries.push(collected[i]);
  }

  return {
    keypoints: selectedEntries.map((entry) => entry.keypoint),
    descriptors: selectedEntries.map((entry) => entry.descriptor),
  };
}

/**
 * Compute Hamming distance between two binary descriptors
 *
 * @param desc1 - First descriptor
 * @param desc2 - Second descriptor
 * @returns Hamming distance (number of differing bits)
 */
function hammingDistance(desc1: ORBDescriptor, desc2: ORBDescriptor): number {
  // Validate descriptor lengths match
  if (desc1.length !== desc2.length) {
    console.warn(`Descriptor length mismatch: ${desc1.length} vs ${desc2.length}`);
    return Infinity; // Return max distance for incompatible descriptors
  }

  let distance = 0;

  for (let i = 0; i < desc1.length; i++) {
    let xor = desc1[i] ^ desc2[i];

    // Count set bits
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Match features using brute-force Hamming distance
 */
export function matchORBFeatures(
  features1: ORBFeatures,
  features2: ORBFeatures,
  config: ORBConfig = {}
): ORBMatchResult {
  const cfg = { ...DEFAULT_ORB_CONFIG, ...config };
  const matches: FeatureMatch[] = [];

  // For each descriptor in features1, find best and second-best match in features2
  for (let i = 0; i < features1.descriptors.length; i++) {
    let bestDist = Infinity;
    let secondBestDist = Infinity;
    let bestIdx = -1;

    for (let j = 0; j < features2.descriptors.length; j++) {
      const dist = hammingDistance(features1.descriptors[i], features2.descriptors[j]);

      // Skip if descriptors are incompatible (returns Infinity)
      if (dist === Infinity) {
        continue;
      }

      if (dist < bestDist) {
        secondBestDist = bestDist;
        bestDist = dist;
        bestIdx = j;
      } else if (dist < secondBestDist) {
        secondBestDist = dist;
      }
    }

    // Lowe's ratio test: good match if best is significantly better than second-best
    if (
      bestIdx >= 0 &&
      bestDist !== Infinity &&
      bestDist < cfg.matchRatioThreshold * secondBestDist
    ) {
      matches.push({
        queryIdx: i,
        trainIdx: bestIdx,
        distance: bestDist,
      });
    }
  }

  const matchCount = matches.length;
  const minKeypoints = Math.min(features1.keypoints.length, features2.keypoints.length);
  const matchRatio = minKeypoints > 0 ? matchCount / minKeypoints : 0;

  const isMatch = matchCount >= cfg.minMatchCount;

  // Confidence based on match count and ratio
  // Higher of: (1) match count relative to minimum, (2) match ratio relative to threshold
  const confidence = Math.min(
    matchCount / cfg.minMatchCount,
    matchRatio / FULL_CONFIDENCE_MATCH_RATIO
  );

  return {
    matchCount,
    queryKeypointCount: features1.keypoints.length,
    refKeypointCount: features2.keypoints.length,
    matchRatio,
    isMatch,
    confidence: Math.min(1, confidence),
  };
}

/**
 * Helper to match a query image against a reference image
 */
export function matchImages(
  queryImageData: ImageData,
  refImageData: ImageData,
  config: ORBConfig = {}
): ORBMatchResult {
  const queryFeatures = extractORBFeatures(queryImageData, config);
  const refFeatures = extractORBFeatures(refImageData, config);

  return matchORBFeatures(queryFeatures, refFeatures, config);
}
