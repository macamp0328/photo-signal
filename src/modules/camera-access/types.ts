/**
 * Camera Access Module Types
 */

export interface CameraAccessHook {
  /** Camera video stream, null if not yet available */
  stream: MediaStream | null;
  /** Error message if camera access failed */
  error: string | null;
  /** Permission state: null=loading, true=granted, false=denied */
  hasPermission: boolean | null;
  /** Retry camera access after error */
  retry: () => void;
}

export interface CameraConstraints {
  video: {
    facingMode: 'user' | 'environment';
    aspectRatio: number;
  };
  audio: boolean;
}
