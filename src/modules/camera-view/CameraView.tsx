import { useEffect, useRef } from 'react';
import type { CameraViewProps } from './types';
import { RectangleOverlay } from '../photo-rectangle-detection';
import styles from './CameraView.module.css';
import { formatConcertTimestamp } from '../../utils/dateUtils';

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

      {/* Concert Info Overlay */}
      {concertInfo && showConcertOverlay && (
        <div className={styles.concertOverlay}>
          <div className={styles.concertCard}>
            <div className={styles.concertHeader}>
              <h2 className={styles.concertBandName}>{concertInfo.band}</h2>
            </div>
            <div className={styles.concertDetails}>
              <p className={styles.concertVenue}>{concertInfo.venue}</p>
              <p className={styles.concertDate}>
                {formatConcertTimestamp(concertInfo.date, { includeTime: false })}
              </p>
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
        />
      )}

      {/* Instructions */}
      {!concertInfo && (
        <div className={styles.instructions}>
          <p className={styles.instructionsText}>Point camera at a photo to play music</p>
        </div>
      )}
    </div>
  );
}
