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
  aboveCameraSlot,
  belowCameraSlot,
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
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="6.25" />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
          <path d="M12 2.5v2.3" />
          <path d="M12 19.2v2.3" />
          <path d="M2.5 12h2.3" />
          <path d="M19.2 12h2.3" />
          <path d="m5.3 5.3 1.7 1.7" />
          <path d="m17 17 1.7 1.7" />
          <path d="m18.7 5.3-1.7 1.7" />
          <path d="m7 17-1.7 1.7" />
        </svg>
      </button>

      <div
        className={`${styles.content} ${hasAudioControls ? styles.contentWithAudio : ''} ${isMatchedPhoto ? styles.contentMatchedPhoto : ''}`}
      >
        {aboveCameraSlot}
        <div className={isMatchedPhoto ? styles.cameraWrapPhoto : styles.cameraWrap}>
          <div className={isMatchedPhoto ? styles.cameraSectionPhoto : styles.cameraSection}>
            {cameraView}
          </div>
        </div>
        {belowCameraSlot}
      </div>

      {audioControls && <div className={styles.audioSection}>{audioControls}</div>}
    </div>
  );
}
