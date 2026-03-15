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
            aria-label="Activate camera and begin experience"
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
        ⚙
      </button>

      <div className={`${styles.content} ${hasAudioControls ? styles.contentWithAudio : ''}`}>
        <div className={styles.cameraWrap}>
          <div className={styles.cameraSection}>{cameraView}</div>
        </div>
      </div>

      {audioControls && <div className={styles.audioSection}>{audioControls}</div>}
    </div>
  );
}
