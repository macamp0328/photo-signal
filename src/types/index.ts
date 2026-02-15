/**
 * Shared TypeScript types for Photo Signal
 *
 * These types are used across all modules to ensure type safety
 * and clear contracts between components.
 */

export interface PhotoHashes {
  /** Primary pHash variants (dark/normal/bright) */
  phash?: string[];
  /** Legacy algorithms may still exist in data files */
  [algorithm: string]: string[] | undefined;
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
  /** Perceptual hash storage */
  photoHashes?: PhotoHashes;
  /** Legacy feature payload (not used by runtime recognizer) */
  orbFeatures?: unknown;
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
