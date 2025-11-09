/**
 * Camera View Module Types
 */

export interface CameraViewProps {
  /** Video stream to display */
  stream: MediaStream | null;
  /** Error message if camera access failed */
  error: string | null;
  /** Permission state */
  hasPermission: boolean | null;
  /** Retry callback */
  onRetry?: () => void;
}
