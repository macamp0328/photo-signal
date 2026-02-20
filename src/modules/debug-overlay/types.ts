/**
 * Debug Overlay Types
 *
 * TypeScript interfaces for the debug overlay component
 */

import type { Concert } from '../../types';
import type { RecognitionDebugInfo } from '../photo-recognition/types';

/**
 * Recognition status states
 */
export type RecognitionStatus = 'IDLE' | 'CHECKING' | 'MATCHING' | 'RECOGNIZED';

/**
 * Controls for the 30-second telemetry recording flow embedded in the debug overlay.
 */
export interface TelemetryRecordingControls {
  state: 'idle' | 'recording' | 'done';
  secondsRemaining: number;
  onStart: () => void;
  onDownload: () => void;
  onDiscard: () => void;
}

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
  /** Whether the app is currently using the test dataset */
  isTestMode: boolean;
  /** Notify parent when overlay visibility changes (open/closed).
   *  Wire to enableDebugInfo so telemetry only runs while the overlay is visible. */
  onVisibilityChange?: (isVisible: boolean) => void;
  /** Current similarity threshold */
  threshold?: number;
  /** Aggregated debug information */
  debugInfo?: RecognitionDebugInfo | null;
  /** Optional reset handler for restarting recognition */
  onReset?: () => void;
  /** Audio URL to use for the Test Song diagnostic button */
  testAudioUrl?: string | null;
  /** Controls for the 30-second telemetry recording flow */
  telemetryRecording: TelemetryRecordingControls;
}
