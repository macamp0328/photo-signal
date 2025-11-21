import { useEffect, useRef } from 'react';
import type { CameraViewProps } from './types';
import { RectangleOverlay } from '../photo-rectangle-detection';
import styles from './CameraView.module.css';

/**
 * Format date string (YYYY-MM-DD) to readable format
 */
const formatDate = (dateString: string): string => {
  // Parse as local date to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

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
  concertInfo = null,
  showConcertOverlay = false,
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

      {/* Concert Info Overlay */}
      {concertInfo && showConcertOverlay && (
        <div className={styles.concertOverlay}>
          <div className={styles.concertCard}>
            <div className={styles.concertHeader}>
              <h2 className={styles.concertBandName}>{concertInfo.band}</h2>
            </div>
            <div className={styles.concertDetails}>
              <p className={styles.concertVenue}>{concertInfo.venue}</p>
              <p className={styles.concertDate}>{formatDate(concertInfo.date)}</p>
            </div>
            <div className={styles.concertFooter}>
              <p className={styles.concertNowPlaying}>Now Playing</p>
            </div>
          </div>
        </div>
      )}

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
          videoWidth={videoRef.current.videoWidth || 0}
          videoHeight={videoRef.current.videoHeight || 0}
        />
      )}

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
      {!showConcertOverlay && (
        <div className={styles.instructions}>
          <p className={styles.instructionsText}>Point camera at a photo to play music</p>
        </div>
      )}
    </div>
  );
}
