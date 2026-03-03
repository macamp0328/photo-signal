/**
 * Camera View Module Types
 */

import type { AspectRatio as AspectRatioType } from '../../types';
import type { TapIntent } from '../../types';
import type { DetectedRectangle } from '../photo-rectangle-detection';

export type AspectRatio = AspectRatioType;

export interface CameraViewProps {
  /** Video stream to display */
  stream: MediaStream | null;
  /** Error message if camera access failed */
  error: string | null;
  /** Permission state */
  hasPermission: boolean | null;
  /** Retry callback */
  onRetry?: () => void;
  /** Apply grayscale filter to camera view */
  grayscale?: boolean;
  /** Detected rectangle (for rectangle detection overlay) */
  detectedRectangle?: DetectedRectangle | null;
  /** Rectangle detection confidence (0-1) */
  rectangleConfidence?: number;
  /** Confidence threshold for rectangle detection (default 0.6) */
  rectangleDetectionConfidenceThreshold?: number;
  /** Show rectangle detection overlay */
  showRectangleOverlay?: boolean;
  /** Callback when user taps/clicks preview area */
  onTap?: (tap: TapIntent) => void;
}
