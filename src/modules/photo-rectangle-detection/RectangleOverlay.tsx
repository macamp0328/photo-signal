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
 * Displays visual feedback for rectangle detection on top of the camera view.
 *
 * Two SVG path layers:
 * - pathGlow:   thick ambient phosphor bloom behind the border
 * - pathBorder: the main outline — broken dashes + stutter while detecting,
 *               snaps solid on lock with a phosphor bloom/decay
 *
 * A scanLine div sweeps the interior (clip-path keeps it inside the
 * quadrilateral even for perspective-distorted rectangles).
 *
 * detecting: amber broken signal, digital corner jitter, scan line sweeping
 * detected:  signal snaps — phosphor bloom flares near-white then decays;
 *            corner L-brackets stamp into place (spring-overshoot)
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

  // Scan line: sweeps from the top edge to the bottom edge of the rectangle.
  // clip-path constrains it to the quadrilateral for perspective-distorted rects.
  const scanTop = `${Math.min(tl.y, tr.y) * 100}%`;
  const scanBottom = `${Math.max(bl.y, br.y) * 100}%`;
  const clipPolygon = `polygon(${tl.x * 100}% ${tl.y * 100}%, ${tr.x * 100}% ${tr.y * 100}%, ${br.x * 100}% ${br.y * 100}%, ${bl.x * 100}% ${bl.y * 100}%)`;

  return (
    <div className={styles.overlay}>
      <svg className={styles.overlaySvg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <path className={`${styles.pathGlow} ${stateClass}`} d={d} pathLength="1" />
        <path className={`${styles.pathBorder} ${stateClass}`} d={d} pathLength="1" />
      </svg>

      {state === 'detecting' && (
        <div
          className={`${styles.scanLine} ${styles.detecting}`}
          style={
            {
              '--scan-top': scanTop,
              '--scan-bottom': scanBottom,
              clipPath: clipPolygon,
            } as React.CSSProperties
          }
        />
      )}

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
