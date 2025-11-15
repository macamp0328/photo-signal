/**
 * Camera View Module Types
 */

import type { AspectRatio as AspectRatioType } from '../../types';

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
  /** Aspect ratio for framing guide (default '3:2') */
  aspectRatio?: AspectRatio;
  /** Callback when aspect ratio toggle is clicked */
  onAspectRatioToggle?: () => void;
  /** Apply grayscale filter to camera view */
  grayscale?: boolean;
}
