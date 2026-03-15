import type { InfoDisplayProps } from './types';
import styles from './InfoDisplay.module.css';
import { formatConcertTimestamp } from '../../utils/dateUtils';

/**
 * Concert Info Display Component
 *
 * Renders as a gradient overlay directly on the matched photo.
 * Band name floats large at the bottom; venue · date in small mono below.
 */
export function InfoDisplay({ concert, isVisible, onClose }: InfoDisplayProps) {
  if (!concert || !isVisible) return null;

  const formattedDate = formatConcertTimestamp(concert.date).replace(/\s+[A-Z]{2,5}$/, '');
  const metaLine = [concert.venue, formattedDate].filter(Boolean).join(' · ');

  return (
    <section className={styles.overlay} aria-label="Concert details">
      <div className={styles.info}>
        <h2 className={styles.bandName}>{concert.band}</h2>
        {metaLine ? <p className={styles.meta}>{metaLine}</p> : null}
      </div>
      {onClose ? (
        <button
          type="button"
          className={styles.nextButton}
          onClick={onClose}
          aria-label="Go to next photo"
        >
          → next
        </button>
      ) : null}
    </section>
  );
}
