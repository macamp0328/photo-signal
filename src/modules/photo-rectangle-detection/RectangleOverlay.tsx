import type { DetectedRectangle, DetectionState } from './types';
import styles from './RectangleOverlay.module.css';

export interface RectangleOverlayProps {
  /** Detected rectangle (normalized coordinates 0-1) */
  rectangle: DetectedRectangle | null;
  /** Detection state for styling */
  state: DetectionState;
}

/**
 * Rectangle Overlay Component
 *
 * Displays visual feedback for rectangle detection on top of camera view.
 * Shows detected rectangle boundaries with color-coded state indication.
 */
export function RectangleOverlay({ rectangle, state }: RectangleOverlayProps) {
  // Don't render anything if no rectangle or idle state
  if (!rectangle || state === 'idle') {
    return null;
  }

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
          left: `${rectangle.topLeft.x * 100}%`,
          top: `${rectangle.topLeft.y * 100}%`,
          width: `${rectangle.width * 100}%`,
          height: `${rectangle.height * 100}%`,
        }}
      >
        {/* Corner markers */}
        <div className={`${styles.corner} ${styles.topLeft}`} />
        <div className={`${styles.corner} ${styles.topRight}`} />
        <div className={`${styles.corner} ${styles.bottomRight}`} />
        <div className={`${styles.corner} ${styles.bottomLeft}`} />
      </div>
    </div>
  );
}
