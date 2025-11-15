import type { FrameQualityInfo } from './types';
import styles from './FrameQualityIndicator.module.css';

interface FrameQualityIndicatorProps {
  frameQuality: FrameQualityInfo | null;
  className?: string;
}

/**
 * Frame Quality Indicator Component
 *
 * Displays user-friendly messages when frame quality issues are detected:
 * - Motion blur: "Hold steady..."
 * - Glare: "Tilt to avoid glare"
 *
 * Only shown when quality issues are actively detected.
 */
export function FrameQualityIndicator({ frameQuality, className = '' }: FrameQualityIndicatorProps) {
  if (!frameQuality) return null;

  const { isSharp, hasGlare } = frameQuality;

  // Only show when there's an issue
  if (isSharp && !hasGlare) return null;

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.message}>
        {!isSharp && (
          <div className={styles.warning}>
            <span className={styles.icon}>📹</span>
            <span className={styles.text}>Hold steady...</span>
          </div>
        )}
        {hasGlare && (
          <div className={styles.warning}>
            <span className={styles.icon}>✨</span>
            <span className={styles.text}>Tilt to avoid glare</span>
          </div>
        )}
      </div>
    </div>
  );
}
