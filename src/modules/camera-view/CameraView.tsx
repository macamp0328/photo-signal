import { useEffect, useRef } from 'react';
import type { CameraViewProps } from './types';
import styles from './CameraView.module.css';

/**
 * Camera View Component
 *
 * Pure UI component for displaying camera feed with overlay.
 */
export function CameraView({
  stream,
  error,
  hasPermission,
  onRetry,
  aspectRatio = '3:2',
  onAspectRatioToggle,
  grayscale = false,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Permission denied state
  if (hasPermission === false) {
    return (
      <div className={styles.permissionDenied}>
        <div>
          <p className={styles.permissionTitle}>Camera Access Required</p>
          <p className={styles.permissionError}>{error}</p>
          {onRetry && (
            <button onClick={onRetry} className={styles.retryButton}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (hasPermission === null || !stream) {
    return (
      <div className={styles.loading}>
        <p>Requesting camera access...</p>
      </div>
    );
  }

  // Camera active state
  return (
    <div className={styles.container}>
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`${styles.video} ${grayscale ? styles.grayscale : ''}`}
      />

      {/* Aspect Ratio Overlay */}
      <div className={styles.overlay}>
        <div className={styles.overlayWrapper}>
          <div
            className={
              aspectRatio === '3:2' ? styles.overlayAspectRatio32 : styles.overlayAspectRatio23
            }
          >
            <div className={styles.overlayFrame}>
              {/* Corner markers */}
              <div className={styles.cornerTopLeft} />
              <div className={styles.cornerTopRight} />
              <div className={styles.cornerBottomLeft} />
              <div className={styles.cornerBottomRight} />
            </div>
          </div>
        </div>
      </div>

      {/* Aspect Ratio Toggle Button */}
      {onAspectRatioToggle && (
        <button
          onClick={onAspectRatioToggle}
          className={styles.aspectToggle}
          aria-label={`Switch to ${aspectRatio === '3:2' ? 'portrait' : 'landscape'} mode`}
        >
          {aspectRatio === '3:2' ? '⤾ Portrait' : '⤿ Landscape'}
        </button>
      )}

      {/* Instructions */}
      <div className={styles.instructions}>
        <p className={styles.instructionsText}>Point camera at a photo to play music</p>
      </div>
    </div>
  );
}
