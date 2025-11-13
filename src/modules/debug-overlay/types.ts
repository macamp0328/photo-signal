/**
 * Debug Overlay Types
 *
 * TypeScript interfaces for the debug overlay component
 */

import type { Concert } from '../../types';

/**
 * Recognition status states
 */
export type RecognitionStatus = 'IDLE' | 'CHECKING' | 'MATCHING' | 'RECOGNIZED';

/**
 * Best match information for debugging
 */
export interface BestMatch {
  concert: Concert;
  distance: number;
  similarity: number;
}

/**
 * Props for DebugOverlay component
 */
export interface DebugOverlayProps {
  /** Current recognized concert (if any) */
  recognizedConcert: Concert | null;
  /** Whether recognition is actively processing */
  isRecognizing: boolean;
  /** Whether debug overlay is enabled (Test Mode) */
  enabled: boolean;
  /** Last computed frame hash */
  lastFrameHash?: string;
  /** Best match information */
  bestMatch?: BestMatch;
  /** Current similarity threshold */
  threshold?: number;
  /** Time of last frame check */
  lastCheckTime?: number;
}
