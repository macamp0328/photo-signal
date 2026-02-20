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

  const formattedDate = formatConcertTimestamp(concert.date);
  const primaryDetailItems = [
    { label: 'Date', value: formattedDate },
    { label: 'Song', value: concert.songTitle },
    { label: 'Venue', value: concert.venue },
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
  const progressPercentage = Math.round(Math.min(Math.max(progressValue, 0), 1) * 100);
  const timelineStyle = {
    width: `${progressPercentage}%`,
    backgroundColor: progressColor ?? 'var(--color-accent)',
  } as const;

  return (
    <section className={`${styles.card} ${className}`} aria-label="Concert details">
      <div className={styles.metaRow}>
        <span className={styles.badge}>Signal: {statusLabel}</span>
      </div>

      <div className={styles.headlineBlock}>
        <p className={styles.kicker}>Live Capture</p>
        <h2 className={styles.bandName}>{concert.band}</h2>
      </div>

      <section className={styles.transportBlock} aria-label="Playback controls and progress">
        {nowPlayingLine ? (
          <div className={styles.nowPlayingRow} aria-label="Now playing status">
            <span
              className={styles.nowPlayingDot}
              style={{ backgroundColor: progressColor ?? 'var(--color-accent)' }}
              aria-hidden="true"
            />
            <p className={styles.nowPlaying}>{nowPlayingLine}</p>
          </div>
        ) : null}

        <div className={styles.timelineWrap} aria-label="Song progress tracker">
          <div className={styles.timelineRail}>
            <div className={styles.timelineFill} style={timelineStyle} />
          </div>
          <div className={styles.timelineMeta}>
            <span>Tracker</span>
            <span>{progressPercentage}%</span>
          </div>
        </div>

        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </section>

      <div className={styles.detailGrid}>
        {primaryDetailItems.map((item) => (
          <div key={item.label} className={styles.detailItem}>
            <p className={styles.detailLabel}>{item.label}</p>
            <p className={styles.detailValue}>{item.value}</p>
          </div>
        ))}
      </div>

      {secondaryMeta ? <p className={styles.metaCompact}>{secondaryMeta}</p> : null}

      <p className={styles.prompt}>{promptText}</p>
    </section>
  );
}
