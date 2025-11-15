import type { Concert, AspectRatio as AspectRatioType } from '../../types';

/**
 * Photo Recognition Module Types
 */

export type AspectRatio = AspectRatioType;

/**
 * Best match information for debugging
 */
export interface BestMatchInfo {
  concert: Concert;
  distance: number;
  similarity: number;
}

export interface StabilityDebugInfo {
  concert: Concert;
  elapsedMs: number;
  remainingMs: number;
  requiredMs: number;
  progress: number;
}

export interface FrameSizeInfo {
  width: number;
  height: number;
}

/**
 * Debug information from photo recognition
 */
export interface RecognitionDebugInfo {
  /** Last computed frame hash */
  lastFrameHash: string | null;
  /** Best match found in last check */
  bestMatch: BestMatchInfo | null;
  /** Timestamp of last frame check */
  lastCheckTime: number;
  /** Number of concerts being checked */
  concertCount: number;
  /** Total frames processed since start */
  frameCount: number;
  /** Interval between frame checks (ms) */
  checkInterval: number;
  /** Aspect ratio currently in use */
  aspectRatio: AspectRatio;
  /** Cropped frame size */
  frameSize: FrameSizeInfo | null;
  /** Stability timer info for the current candidate */
  stability: StabilityDebugInfo | null;
  /** Active similarity threshold */
  similarityThreshold: number;
  /** Active recognition delay (ms) */
  recognitionDelay: number;
}

export interface PhotoRecognitionHook {
  /** Recognized concert, null if none */
  recognizedConcert: Concert | null;
  /** True during recognition process */
  isRecognizing: boolean;
  /** Reset recognition state */
  reset: () => void;
  /** Debug information (only populated in dev mode or test mode) */
  debugInfo: RecognitionDebugInfo | null;
}

export interface PhotoRecognitionOptions {
  /** Delay before triggering recognition (ms), default 3000 */
  recognitionDelay?: number;
  /** Enable/disable recognition, default true */
  enabled?: boolean;
  /** Hamming distance threshold for matching (0-64), default 10 */
  similarityThreshold?: number;
  /** Interval for checking frames (ms), default 1000 */
  checkInterval?: number;
  /** Enable debug information output, default false */
  enableDebugInfo?: boolean;
  /** Aspect ratio for frame cropping (default '3:2') */
  aspectRatio?: AspectRatio;
}
