import type { InfoDisplayProps } from './types';
import styles from './InfoDisplay.module.css';
import { formatConcertTimestamp } from '../../utils/dateUtils';

/**
 * Concert Info Display Component
 *
 * Pure UI component for displaying concert metadata.
 * Styled as a distinct content block with zine-like aesthetic.
 */
export function InfoDisplay({ concert, isVisible, className = '' }: InfoDisplayProps) {
  // Return null when not visible or no concert for better performance
  if (!concert || !isVisible) return null;

  const archiveNumber = `#${String(concert.id).padStart(2, '0')}`;
  const formattedDate = formatConcertTimestamp(concert.date);

  return (
    <section className={`${styles.card} ${className}`} aria-label="Concert details">
      <div className={styles.metaRow}>
        <span className={styles.badge}>Now Playing</span>
        <span className={styles.archiveTag}>{archiveNumber}</span>
      </div>

      <h2 className={styles.bandName}>{concert.band}</h2>

      <div className={styles.detailGrid}>
        <div>
          <p className={styles.detailLabel}>Recorded</p>
          <p className={styles.detailValue}>{formattedDate}</p>
        </div>
        <div>
          <p className={styles.detailLabel}>Venue</p>
          <p className={styles.detailValue}>{concert.venue}</p>
        </div>
      </div>

      <p className={styles.prompt}>Hold steady to keep the story playing.</p>
    </section>
  );
}
