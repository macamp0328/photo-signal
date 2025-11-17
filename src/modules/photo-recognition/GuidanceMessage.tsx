import { useEffect, useState, useRef } from 'react';
import type { GuidanceType } from './types';
import { defaultGuidanceConfig } from '../../config/guidanceConfig';
import styles from './GuidanceMessage.module.css';

interface GuidanceMessageProps {
  /** Active guidance type */
  guidanceType: GuidanceType;
  /** Optional custom CSS class */
  className?: string;
}

/**
 * Guidance Message Component
 *
 * Displays real-time user guidance when detection issues are found.
 * Shows messages with icons, auto-dismisses after configured duration,
 * and respects cooldown periods to avoid annoyance.
 *
 * Based on Section 2 and 6 of docs/image-recognition-exploratory-analysis.md
 */
export function GuidanceMessage({ guidanceType, className = '' }: GuidanceMessageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayedType, setDisplayedType] = useState<GuidanceType>('none');
  const cooldownMapRef = useRef<Map<GuidanceType, number>>(new Map());
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Don't show if guidance type is 'none'
    if (guidanceType === 'none') {
      setIsVisible(false);
      return;
    }

    // Check cooldown for this guidance type
    const now = Date.now();
    const lastShown = cooldownMapRef.current.get(guidanceType) || 0;
    const timeSinceLastShown = now - lastShown;

    // Don't show if still in cooldown period
    if (timeSinceLastShown < defaultGuidanceConfig.cooldownDuration) {
      return;
    }

    // Show the guidance
    setDisplayedType(guidanceType);
    setIsVisible(true);
    cooldownMapRef.current.set(guidanceType, now);

    // Auto-dismiss after display duration
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, defaultGuidanceConfig.displayDuration);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [guidanceType]);

  // Don't render if not visible
  if (!isVisible || displayedType === 'none') {
    return null;
  }

  const message = defaultGuidanceConfig.messages[displayedType];

  return (
    <div className={`${styles.container} ${className}`} role="alert" aria-live="polite">
      <div className={styles.message}>
        <span className={styles.icon}>{message.icon}</span>
        <span className={styles.text}>{message.text}</span>
      </div>
    </div>
  );
}
