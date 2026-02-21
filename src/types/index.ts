/**
 * Shared TypeScript types for Photo Signal
 *
 * These types are used across all modules to ensure type safety
 * and clear contracts between components.
 */

/**
 * Named crop regions used for partial-photo recognition.
 * Center crops handle the common case where the user is too close (edges cut off).
 * Corner crops handle off-center framing where one corner is outside the frame.
 */
export type CropRegionKey =
  | 'center-80'
  | 'center-60'
  | 'center-50'
  | 'top-left-70'
  | 'top-right-70'
  | 'bottom-left-70'
  | 'bottom-right-70';

export interface PhotoHashes {
  /** Primary pHash variants (dark/normal/bright) */
  phash?: string[];
  /**
   * pHash variants for named crop sub-regions (partial photo recognition).
   * Each entry is an array of 5 gamma-variant hashes, same order as phash[].
   * Absent in legacy records — runtime falls back gracefully.
   */
  cropPhashes?: Partial<Record<CropRegionKey, string[]>>;
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
  /** Song title for the currently mapped audio track */
  songTitle?: string;
  /** Optional path to reference image (used by test mode + docs) */
  imageFile?: string;
  /** Whether this entry should be considered by camera recognition (defaults to true) */
  recognitionEnabled?: boolean;
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
