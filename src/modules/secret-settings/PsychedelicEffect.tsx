/**
 * Psychedelic Effect Component
 *
 * Displays vibrant gradient overlays and liquid light show effects
 * when the psychedelic mode feature flag is enabled.
 */

import styles from './PsychedelicEffect.module.css';

export interface PsychedelicEffectProps {
  enabled: boolean;
}

/**
 * Psychedelic visual effect overlay
 *
 * Creates animated gradient backgrounds that cycle through vibrant colors
 * to create a "live concert vibes" atmosphere. Uses pure CSS animations
 * for better performance.
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * const { isEnabled } = useFeatureFlags();
 * return <PsychedelicEffect enabled={isEnabled('psychedelic-mode')} />;
 * ```
 */
export function PsychedelicEffect({ enabled }: PsychedelicEffectProps) {
  if (!enabled) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.gradient1} />
      <div className={styles.gradient2} />
      <div className={styles.pulse1} />
      <div className={styles.pulse2} />
    </div>
  );
}
