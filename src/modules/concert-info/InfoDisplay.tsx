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
  actions,
  nowPlayingLine,
  progressValue = 0,
  progressColor,
}: InfoDisplayProps) {
  // Return null when not visible or no concert for better performance
  if (!concert || !isVisible) return null;

  const archiveNumber = `#${String(concert.id).padStart(2, '0')}`;
  const formattedDate = formatConcertTimestamp(concert.date);
  const detailItems = [
    { label: 'Recorded', value: formattedDate },
    { label: 'Venue', value: concert.venue },
    { label: 'Camera', value: concert.camera },
    { label: 'Focal Length', value: concert.focalLength },
    { label: 'Aperture (f-stop)', value: concert.aperture },
    { label: 'Shutter', value: concert.shutterSpeed },
    { label: 'ISO', value: concert.iso },
  ].filter((item) => Boolean(item.value));
  const progressPercentage = Math.round(Math.min(Math.max(progressValue, 0), 1) * 100);
  const progressStyle = {
    backgroundImage: `linear-gradient(90deg, var(--color-accent) ${progressPercentage}%, rgba(255, 255, 255, 0.25) ${progressPercentage}%)`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    // Fallback solid color so text remains visible if background-clip is unsupported
    color: progressColor ?? 'var(--color-accent)',
    WebkitTextFillColor: 'transparent',
  } as const;

  return (
    <section className={`${styles.card} ${className}`} aria-label="Concert details">
      <div className={styles.metaRow}>
        <span className={styles.badge}>{statusLabel}</span>
        <span className={styles.archiveTag}>{archiveNumber}</span>
      </div>

      {nowPlayingLine ? (
        <div className={styles.nowPlayingRow} aria-label="Now playing status">
          <span
            className={styles.nowPlayingDot}
            style={{ backgroundColor: progressColor ?? 'var(--color-accent)' }}
            aria-hidden="true"
          />
          <p className={styles.nowPlaying} style={progressStyle}>
            {nowPlayingLine}
          </p>
        </div>
      ) : null}

      <h2 className={styles.bandName}>{concert.band}</h2>

      <div className={styles.detailGrid}>
        {detailItems.map((item) => (
          <div key={item.label}>
            <p className={styles.detailLabel}>{item.label}</p>
            <p className={styles.detailValue}>{item.value}</p>
          </div>
        ))}
      </div>

      <p className={styles.prompt}>{promptText}</p>

      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}
