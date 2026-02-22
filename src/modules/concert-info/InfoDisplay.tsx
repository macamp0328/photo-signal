import type { InfoDisplayProps } from './types';
import styles from './InfoDisplay.module.css';
import { formatConcertTimestamp } from '../../utils/dateUtils';

/**
 * Concert Info Display Component
 *
 * Pure UI component for displaying concert metadata.
 * Styled as a distinct content block with zine-like aesthetic.
 */
export function InfoDisplay({
  concert,
  isVisible,
  className = '',
  statusLabel = 'Now Playing',
  promptText = 'Hold steady to keep the story playing.',
  onClose,
  onSwitch,
  switchLabel = 'Drop the Needle',
}: InfoDisplayProps) {
  // Return null when not visible or no concert for better performance
  if (!concert || !isVisible) return null;

  const formattedDate = formatConcertTimestamp(concert.date).replace(/\s+[A-Z]{2,5}$/, '');
  const primaryDetailItems = [
    { label: 'Venue', value: concert.venue },
    { label: 'Date', value: formattedDate },
  ].filter((item) => Boolean(item.value));
  const secondaryMeta = [
    concert.camera ? `Camera: ${concert.camera}` : null,
    concert.focalLength,
    concert.aperture,
    concert.shutterSpeed,
    concert.iso ? `ISO ${concert.iso}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(' · ');
  return (
    <section className={`${styles.card} ${className}`} aria-label="Concert details">
      <div className={styles.metaRow}>
        <span className={styles.badge}>Signal: {statusLabel}</span>
        {onClose ? (
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close concert details"
          >
            ×
          </button>
        ) : null}
      </div>

      <div className={styles.headlineBlock}>
        <p className={styles.kicker}>Live Capture</p>
        <div className={styles.headlineRow}>
          <h2 className={styles.bandName}>{concert.band}</h2>
        </div>
      </div>

      <div className={styles.detailGrid}>
        {primaryDetailItems.map((item) => (
          <div key={item.label} className={styles.detailItem}>
            <p className={styles.detailLabel}>{item.label}</p>
            <p className={styles.detailValue}>{item.value}</p>
          </div>
        ))}
      </div>

      {secondaryMeta ? <p className={styles.metaCompact}>{secondaryMeta}</p> : null}

      {onSwitch ? (
        <button
          type="button"
          className={styles.switchButton}
          onClick={onSwitch}
          aria-label={`Switch to ${concert.band}`}
        >
          {switchLabel}
        </button>
      ) : null}

      <p className={styles.prompt}>{promptText}</p>
    </section>
  );
}
