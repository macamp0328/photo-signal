import type { GalleryLayoutProps } from './types';
import styles from './GalleryLayout.module.css';

/**
 * Gallery Layout Component
 *
 * Landing: two-line typographic statement, flush left.
 * Active: camera fills the center, watermark label + settings icon float in corners.
 */
export function GalleryLayout({
  isActive,
  cameraView,
  onActivate,
  onSettingsClick,
  audioControls,
  isMatchedPhoto = false,
}: GalleryLayoutProps) {
  const hasAudioControls = Boolean(audioControls);

  if (!isActive) {
    return (
      <div className={styles.landing}>
        <div className={styles.landingContent}>
          <h1 className={styles.landingHeadline} aria-label="Still Broadcasting.">
            <span className={styles.landingLine}>Still</span>
            <span className={styles.landingLine}>Broadcasting.</span>
          </h1>
          <p className={styles.landingTagline}>some photographs never stopped.</p>
          <button
            onClick={onActivate}
            aria-label="Tune in — activate camera and begin experience"
            className={styles.beginButton}
          >
            Tune in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.active}>
      <span className={styles.watermark}>Photo Signal</span>
      <button
        type="button"
        className={styles.settingsIcon}
        onClick={onSettingsClick}
        aria-label="Open settings"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <circle cx="9" cy="6" r="2.5" fill="currentColor" stroke="none" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="15" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="7" cy="18" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <div className={`${styles.content} ${hasAudioControls ? styles.contentWithAudio : ''}`}>
        <div className={isMatchedPhoto ? styles.cameraWrapPhoto : styles.cameraWrap}>
          <div className={isMatchedPhoto ? styles.cameraSectionPhoto : styles.cameraSection}>
            {cameraView}
          </div>
        </div>
      </div>

      {audioControls && <div className={styles.audioSection}>{audioControls}</div>}
    </div>
  );
}
