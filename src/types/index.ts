/**
 * Shared TypeScript types for Photo Signal
 *
 * These types are used across all modules to ensure type safety
 * and clear contracts between components.
 */

/**
 * Concert data structure
 */
export interface HashSet {
  /** Optional dHash variants (dark/normal/bright) */
  dhash?: string[];
  /** Optional pHash variants (dark/normal/bright) */
  phash?: string[];
}

export type ORBKeypointTuple = [number, number, number, number, number, number];

export interface ORBFeaturePayload {
  /** Serialization format version */
  version: number;
  /** Original reference image dimensions */
  imageSize: [number, number];
  /** Length of each descriptor (bytes) */
  descriptorLength: number;
  /** Packed keypoint tuples: [x, y, angle, response, octave, size] */
  keypoints: ORBKeypointTuple[];
  /** Descriptors encoded as base64 strings */
  descriptors: string[];
  /** Extraction configuration metadata */
  config: {
    maxFeatures: number;
    fastThreshold: number;
    minMatchCount: number;
    matchRatioThreshold: number;
  };
}

export interface Concert {
  /** Unique identifier */
  id: number;
  /** Band or artist name */
  band: string;
  /** Venue where concert took place */
  venue: string;
  /** ISO 8601 timestamp (America/Chicago). */
  date: string;
  /** Path or URL to audio file (Opus) - supports both local paths and remote URLs */
  audioFile: string;
  /** Optional path to reference image (used by test mode + docs) */
  imageFile?: string;
  /** Multi-algorithm hash storage */
  photoHashes?: HashSet;
  /** Pre-computed ORB keypoints/descriptors for feature matching */
  orbFeatures?: ORBFeaturePayload;
}

/**
 * Concert data response from API/JSON
 */
export interface ConcertData {
  concerts: Concert[];
}

/**
 * Aspect ratio for framing guides and cropping
 * - 'auto' is resolved by the photo-recognition module
 */
export type AspectRatio = '3:2' | '2:3' | '1:1' | 'auto';
