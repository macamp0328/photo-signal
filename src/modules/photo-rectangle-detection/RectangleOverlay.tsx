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
 * Three layered SVG paths create a mystical bioluminescent effect:
 * - pathHalo: thick ambient bloom (breathes gently)
 * - pathOutline: thin constant base stroke
 * - pathTravel: a single mote of light traveling around the perimeter
 *
 * detecting state: violet/indigo traveling spark, corners as L-brackets
 * detected state: teal bloom flash then settle, spark fades out
 */
export function RectangleOverlay({ rectangle, state }: RectangleOverlayProps) {
  if (!rectangle || state === 'idle') {
    return null;
  }

  const stateClass = {
    idle: '',
    detecting: styles.detecting,
    detected: styles.detected,
    error: styles.error,
  }[state];

  const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = rectangle;
  const d = `M ${tl.x * 100},${tl.y * 100} L ${tr.x * 100},${tr.y * 100} L ${br.x * 100},${br.y * 100} L ${bl.x * 100},${bl.y * 100} Z`;

  return (
    <div className={styles.overlay}>
      <svg className={styles.overlaySvg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <path className={`${styles.pathHalo} ${stateClass}`} d={d} pathLength="1" />
        <path className={`${styles.pathOutline} ${stateClass}`} d={d} pathLength="1" />
        <path className={`${styles.pathTravel} ${stateClass}`} d={d} pathLength="1" />
      </svg>

      <div
        className={`${styles.cornerTL} ${stateClass}`}
        style={{ left: `${tl.x * 100}%`, top: `${tl.y * 100}%` }}
      />
      <div
        className={`${styles.cornerTR} ${stateClass}`}
        style={{ left: `${tr.x * 100}%`, top: `${tr.y * 100}%` }}
      />
      <div
        className={`${styles.cornerBR} ${stateClass}`}
        style={{ left: `${br.x * 100}%`, top: `${br.y * 100}%` }}
      />
      <div
        className={`${styles.cornerBL} ${stateClass}`}
        style={{ left: `${bl.x * 100}%`, top: `${bl.y * 100}%` }}
      />
    </div>
  );
}
