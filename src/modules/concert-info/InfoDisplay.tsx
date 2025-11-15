import type { InfoDisplayProps } from './types';
import styles from './InfoDisplay.module.css';

/**
 * Concert Info Display Component
 *
 * Pure UI component for displaying concert metadata.
 * Styled as a distinct content block with zine-like aesthetic.
 */
export function InfoDisplay({ concert, isVisible, className = '' }: InfoDisplayProps) {
  // Return null when not visible or no concert for better performance
  if (!concert || !isVisible) return null;

  const formatDate = (dateString: string): string => {
    // Parse as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // For the new gallery layout, we use a card-style design
  return (
    <div className={`${styles.card} ${className}`}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className={styles.bandName}>{concert.band}</h2>
        </div>
        <div className={styles.details}>
          <p className={styles.venue}>{concert.venue}</p>
          <p className={styles.date}>{formatDate(concert.date)}</p>
        </div>
        <div className={styles.footer}>
          <p className={styles.nowPlaying}>Now Playing</p>
        </div>
      </div>
    </div>
  );
}
