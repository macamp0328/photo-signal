/**
 * Debug Overlay Types
 *
 * TypeScript interfaces for the debug overlay component
 */

import type { Concert } from '../../types';
import type { AiRecommendation, RecognitionDebugInfo } from '../photo-recognition';

/**
 * Recognition status states
 */
export type RecognitionStatus = 'IDLE' | 'CHECKING' | 'MATCHING' | 'RECOGNIZED';

/**
 * Props for DebugOverlay component
 */
export interface DebugOverlayProps {
  /** Current recognized concert (if any) */
  recognizedConcert: Concert | null;
  /** Whether recognition is actively processing */
  isRecognizing: boolean;
  /** Whether the overlay should be shown */
  enabled: boolean;
  /** Notify parent when overlay visibility changes (open/closed).
   *  Wire to enableDebugInfo so telemetry only runs while the overlay is visible. */
  onVisibilityChange?: (isVisible: boolean) => void;
  /** Aggregated debug information */
  debugInfo?: RecognitionDebugInfo | null;
  /** Telemetry-derived tuning recommendations for the current session */
  recommendations?: AiRecommendation[];
  /** Optional reset handler for restarting recognition */
  onReset?: () => void;
  /** Audio URL to use for the Test Song diagnostic button */
  testAudioUrl?: string | null;
}
