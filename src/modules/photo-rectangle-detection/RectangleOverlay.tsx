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

  const points = [
    rectangle.topLeft,
    rectangle.topRight,
    rectangle.bottomRight,
    rectangle.bottomLeft,
  ]
    .map((point) => `${point.x * 100},${point.y * 100}`)
    .join(' ');

  return (
    <div className={styles.overlay}>
      <svg className={styles.polygonSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon className={`${styles.polygon} ${stateClass}`} points={points} />
      </svg>

      <div
        className={`${styles.corner} ${stateClass}`}
        style={{ left: `${rectangle.topLeft.x * 100}%`, top: `${rectangle.topLeft.y * 100}%` }}
      />
      <div
        className={`${styles.corner} ${stateClass}`}
        style={{ left: `${rectangle.topRight.x * 100}%`, top: `${rectangle.topRight.y * 100}%` }}
      />
      <div
        className={`${styles.corner} ${stateClass}`}
        style={{
          left: `${rectangle.bottomRight.x * 100}%`,
          top: `${rectangle.bottomRight.y * 100}%`,
        }}
      />
      <div
        className={`${styles.corner} ${stateClass}`}
        style={{
          left: `${rectangle.bottomLeft.x * 100}%`,
          top: `${rectangle.bottomLeft.y * 100}%`,
        }}
      />
    </div>
  );
}
