import { useEffect, useRef } from 'react';
import type { CameraViewProps } from './types';
import { RectangleOverlay } from '../photo-rectangle-detection';
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
  grayscale = false,
  detectedRectangle = null,
  rectangleConfidence = 0,
  rectangleDetectionConfidenceThreshold = 0.6,
  showRectangleOverlay = false,
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

      {/* Rectangle Detection Overlay */}
      {showRectangleOverlay && videoRef.current && (
        <RectangleOverlay
          rectangle={detectedRectangle}
          state={
            detectedRectangle && rectangleConfidence >= rectangleDetectionConfidenceThreshold
              ? 'detected'
              : detectedRectangle
                ? 'detecting'
                : 'idle'
          }
        />
      )}
    </div>
  );
}
