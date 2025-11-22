/**
 * Camera View Module Types
 */

import type { AspectRatio as AspectRatioType, Concert } from '../../types';
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
  /** Concert info to display as overlay (optional) */
  concertInfo?: Concert | null;
  /** Control visibility of concert overlay independently */
  showConcertOverlay?: boolean;
  /** Detected rectangle (for rectangle detection overlay) */
  detectedRectangle?: DetectedRectangle | null;
  /** Rectangle detection confidence (0-1) */
  rectangleConfidence?: number;
  /** Confidence threshold for rectangle detection (default 0.6) */
  rectangleDetectionConfidenceThreshold?: number;
  /** Show rectangle detection overlay */
  showRectangleOverlay?: boolean;
}
