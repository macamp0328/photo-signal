/**
 * Shared TypeScript types for Photo Signal
 *
 * These types are used across all modules to ensure type safety
 * and clear contracts between components.
 */

export interface PhotoHashes {
  /** Primary pHash variants (dark/normal/bright) */
  phash?: string[];
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
  /** Camera make/model extracted from EXIF */
  camera?: string;
  /** Aperture / f-stop extracted from EXIF (e.g., f/2.8) */
  aperture?: string;
  /** Focal length extracted from EXIF (e.g., 18.3mm) */
  focalLength?: string;
  /** Shutter speed extracted from EXIF */
  shutterSpeed?: string;
  /** ISO sensitivity extracted from EXIF */
  iso?: string;
  /** Perceptual hash storage */
  photoHashes?: PhotoHashes;
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
