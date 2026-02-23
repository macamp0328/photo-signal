/**
 * Debug Overlay Types
 *
 * TypeScript interfaces for the debug overlay component
 */

import type { Concert } from '../../types';
import type { RecognitionDebugInfo } from '../photo-recognition/types';

/**
 * Machine-readable identifier for a test routine.
 */
export type RoutineType =
  | 'baseline'
  | 'glare'
  | 'motion-blur'
  | 'poor-lighting'
  | 'multi-photo-switch'
  | 'collision';

/**
 * A named test routine with its physical instructions for the user.
 */
export interface RoutineDefinition {
  type: RoutineType;
  label: string;
  instructions: string;
}

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
  /** The routine currently selected by the user (null = not yet chosen). */
  selectedRoutine: RoutineType | null;
  /** Called when the user picks a routine from the selector. */
  onSelectRoutine: (routine: RoutineType) => void;
  /** Called when the user clicks "Change" to reset their routine selection. */
  onClearRoutine: () => void;
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
