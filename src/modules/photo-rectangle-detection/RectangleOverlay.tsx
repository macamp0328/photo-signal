import type { DetectedRectangle, DetectionState } from './types';
import styles from './RectangleOverlay.module.css';

export interface RectangleOverlayProps {
  /** Detected rectangle (normalized coordinates 0-1) */
  rectangle: DetectedRectangle | null;
  /** Detection state for styling */
  state: DetectionState;
  /** Width of the video element in pixels */
  videoWidth: number;
  /** Height of the video element in pixels */
  videoHeight: number;
}

/**
 * Rectangle Overlay Component
 *
 * Displays visual feedback for rectangle detection on top of camera view.
 * Shows detected rectangle boundaries with color-coded state indication.
 */
export function RectangleOverlay({
  rectangle,
  state,
  videoWidth,
  videoHeight,
}: RectangleOverlayProps) {
  // Don't render anything if no rectangle or idle state
  if (!rectangle || state === 'idle') {
    return null;
  }

  // Calculate rectangle dimensions for positioning
  const width = rectangle.width * videoWidth;
  const height = rectangle.height * videoHeight;
  const left = rectangle.topLeft.x * videoWidth;
  const top = rectangle.topLeft.y * videoHeight;

  // Determine CSS class based on state
  const stateClass = {
    idle: '',
    detecting: styles.detecting,
    detected: styles.detected,
    error: styles.error,
  }[state];

  return (
    <div className={styles.overlay}>
      {/* Rectangle outline */}
      <div
        className={`${styles.rectangle} ${stateClass}`}
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* Corner markers */}
        <div className={`${styles.corner} ${styles.topLeft}`} />
        <div className={`${styles.corner} ${styles.topRight}`} />
        <div className={`${styles.corner} ${styles.bottomRight}`} />
        <div className={`${styles.corner} ${styles.bottomLeft}`} />
      </div>

      {/* State indicator */}
      {state === 'detecting' && <div className={styles.statusMessage}>Detecting photo...</div>}
      {state === 'detected' && <div className={styles.statusMessage}>Photo detected!</div>}
    </div>
  );
}
