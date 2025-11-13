/**
 * Psychedelic Effect Component
 *
 * Displays vibrant gradient overlays and liquid light show effects
 * when the psychedelic mode feature flag is enabled.
 */

import { useEffect, useState } from 'react';
import styles from './PsychedelicEffect.module.css';

export interface PsychedelicEffectProps {
  enabled: boolean;
}

/**
 * Psychedelic visual effect overlay
 *
 * Creates animated gradient backgrounds that cycle through vibrant colors
 * to create a "live concert vibes" atmosphere.
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
  const [hue, setHue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Animate the hue rotation for color cycling effect
    const interval = setInterval(() => {
      setHue((prev) => (prev + 1) % 360);
    }, 50); // Update every 50ms for smooth animation

    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.gradient1}
        style={{
          background: `linear-gradient(45deg, 
            hsl(${hue}, 100%, 50%), 
            hsl(${(hue + 60) % 360}, 100%, 50%), 
            hsl(${(hue + 120) % 360}, 100%, 50%))`,
        }}
      />
      <div
        className={styles.gradient2}
        style={{
          background: `linear-gradient(135deg, 
            hsl(${(hue + 180) % 360}, 100%, 50%), 
            hsl(${(hue + 240) % 360}, 100%, 50%), 
            hsl(${(hue + 300) % 360}, 100%, 50%))`,
        }}
      />
      <div className={styles.pulse1} />
      <div className={styles.pulse2} />
    </div>
  );
}
