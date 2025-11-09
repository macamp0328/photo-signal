/**
 * Shared TypeScript types for Photo Signal
 * 
 * These types are used across all modules to ensure type safety
 * and clear contracts between components.
 */

/**
 * Concert data structure
 */
export interface Concert {
  /** Unique identifier */
  id: number;
  /** Band or artist name */
  band: string;
  /** Venue where concert took place */
  venue: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Path to audio file (MP3) */
  audioFile: string;
}

/**
 * Concert data response from API/JSON
 */
export interface ConcertData {
  concerts: Concert[];
}

/**
 * Camera permission states
 */
export type PermissionState = null | boolean;

/**
 * Error types for better error handling
 */
export interface AppError {
  message: string;
  code?: string;
  module?: string;
}
