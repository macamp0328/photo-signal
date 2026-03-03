import { useEffect, useRef, type PointerEvent } from 'react';
import type { CameraViewProps } from './types';
import { RectangleOverlay } from '../photo-rectangle-detection';
import type { TapIntent } from '../../types';
import styles from './CameraView.module.css';

/**
 * Camera View Component
 *
 * Pure UI component for displaying camera feed with overlay.
 */
export function CameraView({
  stream,
  hasPermission,
  onRetry,
  grayscale = false,
  detectedRectangle = null,
  rectangleConfidence = 0,
  rectangleDetectionConfidenceThreshold = 0.6,
  showRectangleOverlay = false,
  onTap,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const permissionMessage = 'Camera access is off. Let me in to keep scanning.';

  const normalizeTap = (clientX: number, clientY: number): TapIntent | null => {
    const video = videoRef.current;
    if (!video) {
      return null;
    }

    const bounds = video.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      return null;
    }

    const x = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height));

    return {
      point: { x, y },
      timestamp: Date.now(),
      pointerType: 'unknown',
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLVideoElement>) => {
    if (!onTap) {
      return;
    }

    const tap = normalizeTap(event.clientX, event.clientY);
    if (!tap) {
      return;
    }

    tap.pointerType =
      event.pointerType === 'mouse' || event.pointerType === 'touch' || event.pointerType === 'pen'
        ? event.pointerType
        : 'unknown';

    onTap(tap);
  };

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
          <p className={styles.permissionTitle}>Camera blocked</p>
          <p className={styles.permissionError}>{permissionMessage}</p>
          {onRetry && (
            <button onClick={onRetry} className={styles.retryButton}>
              Let me in
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
        <p>Summoning camera...</p>
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
        onPointerDown={handlePointerDown}
      />

      {/* Rectangle Detection Overlay */}
      {showRectangleOverlay && (
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
