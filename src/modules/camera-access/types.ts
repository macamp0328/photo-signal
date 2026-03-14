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

export interface CameraAccessOptions {
  /** Whether to automatically start camera on mount. Default: true.
   *  When false, camera won't start until retry() is called explicitly. */
  autoStart?: boolean;
}
