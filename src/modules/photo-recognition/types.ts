import type { Concert } from '../../types';

/**
 * Photo Recognition Module Types
 */

export interface PhotoRecognitionHook {
  /** Recognized concert, null if none */
  recognizedConcert: Concert | null;
  /** True during recognition process */
  isRecognizing: boolean;
  /** Reset recognition state */
  reset: () => void;
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
}
